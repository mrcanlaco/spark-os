import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

export function showStatus(): void {
  const sparkDir = path.join(process.cwd(), '.spark');
  const dbPath = path.join(sparkDir, 'spark.db');

  if (!fs.existsSync(dbPath)) {
    console.error('[SPARK] Không tìm thấy spark.db. Chạy "spark init <name>" trước.');
    process.exit(1);
  }

  const db = new Database(dbPath, { readonly: true });

  const project = db.prepare('SELECT name, status, budget_cap_usd, budget_used_usd FROM projects LIMIT 1').get() as any;
  if (!project) {
    console.log('[SPARK] Chưa có project nào.');
    db.close();
    return;
  }

  console.log(`\n📦 Project: ${project.name} [${project.status}]`);
  console.log(`💰 Budget: $${project.budget_used_usd} / $${project.budget_cap_usd}`);

  const tasks = db.prepare('SELECT id, title, phase, status, priority, assigned_model, retry_count FROM tasks ORDER BY priority DESC, created_at').all() as any[];
  if (tasks.length === 0) {
    console.log('📋 Tasks: (trống)');
  } else {
    console.log(`📋 Tasks (${tasks.length}):`);
    for (const t of tasks) {
      const model = t.assigned_model ? ` [${t.assigned_model}]` : '';
      const retry = t.retry_count > 0 ? ` ⟳${t.retry_count}` : '';
      console.log(`   ${t.status === 'COMPLETED' ? '✅' : t.status === 'FAILED' ? '❌' : t.status === 'DEAD' ? '💀' : t.status === 'RUNNING' ? '🔄' : t.status === 'WAITING_APPROVAL' ? '⏸️' : '⬚'} [${t.phase}] ${t.title}${model}${retry}`);
    }
  }

  const rfas = db.prepare("SELECT id, type, status FROM rfa_queue WHERE status = 'PENDING'").all() as any[];
  if (rfas.length > 0) {
    console.log(`\n🔔 RFA Pending (${rfas.length}):`);
    for (const r of rfas) {
      console.log(`   ⚠️  ${r.type} (${r.id})`);
    }
  }

  db.close();
  console.log('');
}