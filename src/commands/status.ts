import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { AuditLogger } from '../daemon/audit';

export function showStatus(): void {
  const sparkDir = path.join(process.cwd(), '.spark');
  const dbPath = path.join(sparkDir, 'spark.db');

  if (!fs.existsSync(dbPath)) {
    console.error('[SPARK] spark.db not found. Run "spark init <name>" first.');
    process.exit(1);
  }

  const db = new Database(dbPath, { readonly: true });

  const project = db.prepare('SELECT name, status, budget_cap_usd, budget_used_usd FROM projects LIMIT 1').get() as any;
  if (!project) {
    console.log('[SPARK] No project found.');
    db.close();
    return;
  }

  const budgetPct = project.budget_cap_usd > 0 ? Math.round((project.budget_used_usd / project.budget_cap_usd) * 100) : 0;
  console.log(`\nProject: ${project.name} [${project.status}]`);
  console.log(`Budget: $${project.budget_used_usd} / $${project.budget_cap_usd} (${budgetPct}%)`);

  const tasks = db.prepare('SELECT id, title, phase, status, priority, assigned_model, retry_count, token_cost_usd FROM tasks ORDER BY priority DESC, created_at').all() as any[];
  if (tasks.length === 0) {
    console.log('Tasks: (empty)');
  } else {
    console.log(`Tasks (${tasks.length}):`);
    for (const t of tasks) {
      const model = t.assigned_model ? ` [${t.assigned_model}]` : '';
      const retry = t.retry_count > 0 ? ` retry:${t.retry_count}` : '';
      const cost = t.token_cost_usd > 0 ? ` $${t.token_cost_usd.toFixed(4)}` : '';
      console.log(`   [${t.phase}] ${t.title} (${t.status})${model}${retry}${cost}`);
    }
  }

  const rfas = db.prepare("SELECT id, type, status FROM rfa_queue WHERE status = 'PENDING'").all() as any[];
  if (rfas.length > 0) {
    console.log(`\nRFA Pending (${rfas.length}):`);
    for (const r of rfas) {
      console.log(`   ${r.type} (${r.id})`);
    }
  }

  const audit = new AuditLogger(sparkDir);
  const stats = audit.stats();
  console.log(`\nAudit Logs: ${stats.fileCount} files, ${(stats.totalSizeBytes / 1024).toFixed(1)} KB`);

  db.close();
  console.log('');
}
