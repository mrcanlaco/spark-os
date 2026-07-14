import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { WebSocketServer } from 'ws';
import { checkHealth } from './health';
import { exec } from 'child_process';

const HEALTH_INTERVAL_MS = 30_000;

export class SparkDaemon {
  private db: Database.Database;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private wss: WebSocketServer | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private gitTimer: ReturnType<typeof setInterval> | null = null;
  private lastStateHash = '';
  private lastCommitHash = '';

  constructor(private projectRoot: string) {
    const dbPath = path.join(projectRoot, '.spark', 'spark.db');
    if (!fs.existsSync(dbPath)) {
      throw new Error(`spark.db not found at ${dbPath}. Run "spark init" first.`);
    }
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
  }

  start(port: number = 9000): void {
    if (this.running) return;
    this.running = true;

    console.log(`[DAEMON] Khá»Ÿi Ä‘á»™ng táº¡i ${this.projectRoot}`);
    console.log(`[DAEMON] spark.db WAL mode â€” sáºµn sÃ ng concurrent read/write`);
    console.log(`[DAEMON] Port ${port} dÃ nh cho WebSocket (Cycle 1d)`);

    this.healthTimer = setInterval(() => {
      const h = checkHealth();
      if (h.status === 'CRITICAL') {
        console.error('[DAEMON] Memory critical â€” graceful shutdown...');
        this.stop();
        process.exit(1);
      }
    }, HEALTH_INTERVAL_MS);

    console.log(`[DAEMON] Health monitor: má»—i ${HEALTH_INTERVAL_MS / 1000}s`);

    this.wss = new WebSocketServer({ port });
    this.wss.on('connection', (ws) => {
      console.log('[DAEMON] Dashboard connected to WS');
      
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'APPROVE_RFA') {
            this.handleApproveRfa(msg.data.id);
          }
        } catch (e) {
          console.error('[DAEMON] Error parsing WS message:', e);
        }
      });

      ws.on('error', console.error);
    });

    this.pingTimer = setInterval(() => {
      this.wss?.clients.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.ping();
        }
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
            console.log(`[DAEMON] New commit detected: ${hash} - ${message}`);
            try {
              this.db.prepare("INSERT INTO events (type, payload) VALUES ('GIT_COMMIT', ?)").run(JSON.stringify({ hash, message }));

              const phaseMatch = message.match(/\[(define|plan|spec|build|verify|release)\]/i);
              if (phaseMatch) {
                const newPhase = phaseMatch[1].toUpperCase();
                const task = this.db.prepare("SELECT id, phase FROM tasks WHERE status IN ('PENDING', 'RUNNING') ORDER BY priority DESC, created_at ASC LIMIT 1").get() as any;
                if (task && task.phase !== newPhase) {
                  this.db.prepare("UPDATE tasks SET phase = ? WHERE id = ?").run(newPhase, task.id);
                  this.db.prepare("INSERT INTO state_transitions (task_id, from_phase, to_phase, git_snapshot) VALUES (?, ?, ?, ?)").run(task.id, task.phase, newPhase, hash);
                  console.log(`[DAEMON] Auto transitioned task ${task.id} phase to ${newPhase}`);
                }
              }
            } catch(e) {
              console.error('[DAEMON] Error processing commit:', e);
            }
          }
          this.lastCommitHash = hash;
        }
      });
    }, 5000);
  }

  private handleApproveRfa(rfaId: string): void {
    console.log(`[DAEMON] Received APPROVE_RFA for ${rfaId}`);
    try {
      this.db.transaction(() => {
        const rfa = this.db.prepare("SELECT task_id, status FROM rfa_queue WHERE id = ?").get(rfaId) as any;
        if (rfa && rfa.status === 'PENDING') {
          this.db.prepare("UPDATE rfa_queue SET status = 'APPROVED', resolved_at = CURRENT_TIMESTAMP WHERE id = ?").run(rfaId);
          this.db.prepare("UPDATE tasks SET status = 'RUNNING' WHERE id = ?").run(rfa.task_id);
          console.log(`[DAEMON] Task ${rfa.task_id} unlocked and is now RUNNING`);
          
          this.triggerAiCodeGen(rfa.task_id);
        }
      })();
      this.syncState();
    } catch (e) {
      console.error('[DAEMON] Error approving RFA:', e);
    }
  }

  private triggerAiCodeGen(taskId: string): void {
    const sandboxDir = path.join(this.projectRoot, '.spark', 'sandbox');
    if (!fs.existsSync(sandboxDir)) {
      fs.mkdirSync(sandboxDir, { recursive: true });
    }
    const fakeCode = `// AI Generated code for task ${taskId}\nconsole.log('AI implemented this feature.');\n`;
    const targetFile = path.join(sandboxDir, `task_${taskId}_output.js`);
    fs.writeFileSync(targetFile, fakeCode);
    console.log(`[DAEMON] AI Code generated at ${targetFile}`);
  }

  private syncState(): void {
    if (!this.wss || this.wss.clients.size === 0) return;
    try {
      const project = this.db.prepare('SELECT name, status, budget_cap_usd, budget_used_usd FROM projects LIMIT 1').get();
      const tasks = this.db.prepare('SELECT id, title, phase, status, priority, assigned_model, retry_count FROM tasks ORDER BY priority DESC, created_at').all();
      const rfas = this.db.prepare("SELECT id, task_id, type, payload, status FROM rfa_queue WHERE status = 'PENDING'").all();
      let events: any[] = [];
      try {
        events = this.db.prepare('SELECT id, type, payload, created_at FROM events ORDER BY created_at DESC LIMIT 10').all();
      } catch (e) {} // ignore if table not created yet
      
      const payload = JSON.stringify({ type: 'STATE_SYNC', data: { project, tasks, rfas, events } });
      
      if (payload !== this.lastStateHash) {
        this.lastStateHash = payload;
        this.wss.clients.forEach((client) => {
          if (client.readyState === 1) { // WebSocket.OPEN
            client.send(payload);
          }
        });
      }
    } catch (err) {
      console.error('[DAEMON] DB sync error:', err);
    }
  }

  stop(): void {
    if (this.healthTimer) clearInterval(this.healthTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.syncTimer) clearInterval(this.syncTimer);
    if (this.gitTimer) clearInterval(this.gitTimer);
    this.wss?.close();
    this.db.close();
    this.running = false;
    console.log('[DAEMON] ÄÃ£ dá»«ng.');
  }

  getDb(): Database.Database {
    return this.db;
  }

  isRunning(): boolean {
    return this.running;
  }
}