import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { WebSocketServer } from 'ws';
import { checkHealth, getChildProcessArgs } from './health';
import { AuditLogger } from './audit';
import { exec } from 'child_process';

const HEALTH_INTERVAL_MS = 30_000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const HIBERNATION_CHECK_MS = 60_000;
const HIBERNATION_IDLE_MS = 15 * 60 * 1000;

export class SparkDaemon {
  private db: Database.Database;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private wss: WebSocketServer | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private gitTimer: ReturnType<typeof setInterval> | null = null;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private hibernationTimer: ReturnType<typeof setInterval> | null = null;
  private lastStateHash = '';
  private lastCommitHash = '';
  private audit: AuditLogger;
  private startedAt: number = 0;
  private lastActivityAt: number = 0;
  private hibernated = false;

  constructor(private projectRoot: string) {
    const sparkDir = path.join(projectRoot, '.spark');
    const dbPath = path.join(sparkDir, 'spark.db');
    if (!fs.existsSync(dbPath)) {
      throw new Error(`spark.db not found at ${dbPath}. Run "spark init" first.`);
    }
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.audit = new AuditLogger(sparkDir);
  }

  start(port: number = 9000): void {
    if (this.running) return;
    this.running = true;
    this.startedAt = Date.now();
    this.lastActivityAt = Date.now();

    console.log(`[DAEMON] Started at ${this.projectRoot}`);
    console.log(`[DAEMON] spark.db WAL mode`);
    console.log(`[DAEMON] WebSocket port ${port}`);
    console.log(`[DAEMON] Child process args: ${getChildProcessArgs().join(' ')}`);

    this.audit.log('DAEMON_START', { port, projectRoot: this.projectRoot });

    this.healthTimer = setInterval(() => {
      const h = checkHealth();
      if (h.status === 'CRITICAL') {
        this.audit.log('HEALTH_CRITICAL', { rss_mb: h.rss_mb });
        console.error('[DAEMON] Memory critical');
        this.stop();
        process.exit(1);
      } else if (h.status === 'WARNING') {
        this.audit.log('HEALTH_WARNING', { rss_mb: h.rss_mb });
      }
    }, HEALTH_INTERVAL_MS);

    this.wss = new WebSocketServer({ port });
    this.wss.on('connection', (ws) => {
      console.log('[DAEMON] Dashboard connected');
      this.audit.log('WS_CONNECT');
      this.touchActivity();
      
      ws.on('message', (data) => {
        this.touchActivity();
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'APPROVE_RFA') {
            this.handleApproveRfa(msg.data.id);
          } else if (msg.type === 'REJECT_RFA') {
            this.handleRejectRfa(msg.data.id, msg.data.resolution_note || '');
          }
        } catch (e) {
          console.error('[DAEMON] WS parse error:', e);
        }
      });

      ws.on('error', console.error);
    });

    this.pingTimer = setInterval(() => {
      this.wss?.clients.forEach((client) => {
        if (client.readyState === 1) client.ping();
      });
    }, 5000);

    this.syncTimer = setInterval(() => {
      this.syncState();
    }, 1000);

    this.gitTimer = setInterval(() => {
      exec('git log -1 --format="%H|%B"', { cwd: this.projectRoot }, (err, stdout) => {
        if (!err && stdout) {
          const parts = stdout.trim().split('|');
          const hash = parts[0];
          const message = parts.slice(1).join('|').trim();
          
          if (this.lastCommitHash && hash !== this.lastCommitHash) {
            this.touchActivity();
            console.log(`[DAEMON] New commit: ${hash.substring(0, 7)} - ${message}`);
            this.audit.log('GIT_COMMIT', { hash, message });
            try {
              this.db.prepare("INSERT INTO events (type, payload) VALUES ('GIT_COMMIT', ?)").run(JSON.stringify({ hash, message }));

              const phaseMatch = message.match(/\\[(define|plan|spec|build|verify|release)\\]/i);
              if (phaseMatch) {
                const newPhase = phaseMatch[1].toUpperCase();
                const task = this.db.prepare("SELECT id, phase FROM tasks WHERE status IN ('PENDING', 'RUNNING') ORDER BY priority DESC, created_at ASC LIMIT 1").get() as any;
                if (task && task.phase !== newPhase) {
                  this.db.prepare("UPDATE tasks SET phase = ? WHERE id = ?").run(newPhase, task.id);
                  this.db.prepare("INSERT INTO state_transitions (task_id, from_phase, to_phase, git_snapshot) VALUES (?, ?, ?, ?)").run(task.id, task.phase, newPhase, hash);
                  this.audit.log('PHASE_TRANSITION', { task_id: task.id, from: task.phase, to: newPhase, git: hash });
                }
              }
            } catch(e) {
              console.error('[DAEMON] Commit processing error:', e);
            }
          }
          this.lastCommitHash = hash;
        }
      });
    }, 5000);

    this.cleanupTimer = setInterval(() => {
      this.audit.cleanup();
    }, CLEANUP_INTERVAL_MS);

    this.hibernationTimer = setInterval(() => {
      this.checkHibernation();
    }, HIBERNATION_CHECK_MS);
  }

  private touchActivity(): void {
    this.lastActivityAt = Date.now();
    if (this.hibernated) this.wakeUp();
  }

  private checkHibernation(): void {
    if (this.hibernated) return;
    if (Date.now() - this.lastActivityAt >= HIBERNATION_IDLE_MS) {
      this.hibernate();
    }
  }

  private hibernate(): void {
    this.hibernated = true;
    this.audit.log('HIBERNATION_ENTER', { idle_ms: Date.now() - this.lastActivityAt });
    console.log('[DAEMON] Entering hibernation');
    try {
      this.db.prepare("UPDATE projects SET status = 'HIBERNATED' WHERE status = 'ACTIVE'").run();
    } catch {}
  }

  private wakeUp(): void {
    this.hibernated = false;
    this.audit.log('HIBERNATION_EXIT');
    console.log('[DAEMON] Waking up');
    try {
      this.db.prepare("UPDATE projects SET status = 'ACTIVE' WHERE status = 'HIBERNATED'").run();
    } catch {}
  }

  private handleApproveRfa(rfaId: string): void {
    try {
      this.db.transaction(() => {
        const rfa = this.db.prepare("SELECT task_id, status FROM rfa_queue WHERE id = ?").get(rfaId) as any;
        if (rfa && rfa.status === 'PENDING') {
          this.db.prepare("UPDATE rfa_queue SET status = 'APPROVED', resolved_at = CURRENT_TIMESTAMP WHERE id = ?").run(rfaId);
          this.db.prepare("UPDATE tasks SET status = 'RUNNING' WHERE id = ?").run(rfa.task_id);
          this.audit.log('RFA_APPROVED', { rfa_id: rfaId, task_id: rfa.task_id });
          this.triggerAiCodeGen(rfa.task_id);
        }
      })();
      this.syncState();
    } catch (e) {
      console.error('[DAEMON] Approve error:', e);
    }
  }

  private handleRejectRfa(rfaId: string, resolutionNote: string): void {
    try {
      this.db.transaction(() => {
        const rfa = this.db.prepare("SELECT task_id, status FROM rfa_queue WHERE id = ?").get(rfaId) as any;
        if (rfa && rfa.status === 'PENDING') {
          this.db.prepare("UPDATE rfa_queue SET status = 'REJECTED', resolution_note = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?").run(resolutionNote, rfaId);
          this.db.prepare("UPDATE tasks SET status = 'FAILED', error_message = ? WHERE id = ?").run(resolutionNote || 'Rejected by human', rfa.task_id);
          this.audit.log('RFA_REJECTED', { rfa_id: rfaId, task_id: rfa.task_id, note: resolutionNote });
        }
      })();
      this.syncState();
    } catch (e) {
      console.error('[DAEMON] Reject error:', e);
    }
  }

  private triggerAiCodeGen(taskId: string): void {
    const sandboxDir = path.join(this.projectRoot, '.spark', 'sandbox');
    if (!fs.existsSync(sandboxDir)) {
      fs.mkdirSync(sandboxDir, { recursive: true });
    }
    const targetFile = path.join(sandboxDir, `task_${taskId}_output.js`);
    fs.writeFileSync(targetFile, `// AI Generated code for task ${taskId}\nconsole.log('AI implemented this feature.');\n`);
    this.audit.log('AI_CODE_GEN', { task_id: taskId, file: targetFile });
  }

  private syncState(): void {
    if (!this.wss || this.wss.clients.size === 0) return;
    try {
      const project = this.db.prepare('SELECT name, status, budget_cap_usd, budget_used_usd FROM projects LIMIT 1').get();
      const tasks = this.db.prepare('SELECT id, title, phase, status, priority, assigned_model, retry_count, token_cost_usd FROM tasks ORDER BY priority DESC, created_at').all();
      const rfas = this.db.prepare("SELECT id, task_id, type, payload, status FROM rfa_queue WHERE status = 'PENDING'").all();
      let events: any[] = [];
      try {
        events = this.db.prepare('SELECT id, type, payload, created_at FROM events ORDER BY created_at DESC LIMIT 10').all();
      } catch (e) {}
      
      const health = checkHealth();
      const auditStats = this.audit.stats();
      const uptime = Math.floor((Date.now() - this.startedAt) / 1000);
      const runningTasks = (tasks as any[]).filter((t: any) => t.status === 'RUNNING').length;
      
      const payload = JSON.stringify({ 
        type: 'STATE_SYNC', 
        data: { 
          project, tasks, rfas, events, 
          health: { ...health, active_tasks: runningTasks },
          auditStats, uptime, hibernated: this.hibernated 
        } 
      });
      
      if (payload !== this.lastStateHash) {
        this.lastStateHash = payload;
        this.wss.clients.forEach((client) => {
          if (client.readyState === 1) client.send(payload);
        });
      }
    } catch (err) {
      console.error('[DAEMON] Sync error:', err);
    }
  }

  stop(): void {
    this.audit.log('DAEMON_STOP');
    if (this.healthTimer) clearInterval(this.healthTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.syncTimer) clearInterval(this.syncTimer);
    if (this.gitTimer) clearInterval(this.gitTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    if (this.hibernationTimer) clearInterval(this.hibernationTimer);
    this.wss?.close();
    this.db.close();
    this.running = false;
    console.log('[DAEMON] Stopped.');
  }

  getDb(): Database.Database {
    return this.db;
  }

  isRunning(): boolean {
    return this.running;
  }
}
