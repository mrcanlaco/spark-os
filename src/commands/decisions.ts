import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

export function showDecisions(): void {
  const dbPath = path.join(process.cwd(), '.spark', 'spark.db');
  if (!fs.existsSync(dbPath)) {
    console.error('[SPARK] spark.db not found. Run "spark init" first.');
    return;
  }

  const db = new Database(dbPath, { readonly: true });

  try {
    const logs = db.prepare(`
      SELECT d.id, d.prompt_hash, d.model, d.tokens_used, d.cost_usd, d.created_at,
             t.title as task_title
      FROM decision_logs d
      LEFT JOIN tasks t ON d.task_id = t.id
      ORDER BY d.created_at DESC
      LIMIT 20
    `).all() as any[];

    if (logs.length === 0) {
      console.log('[SPARK] No decision logs yet.');
      db.close();
      return;
    }

    console.log(`\nRecent AI Decisions (${logs.length}):\n`);
    for (const l of logs) {
      console.log(`  #${l.id} [${l.model}] ${l.task_title || 'N/A'}`);
      console.log(`     hash: ${l.prompt_hash} | tokens: ${l.tokens_used} | cost: $${l.cost_usd.toFixed(4)} | ${l.created_at}`);
    }

    const patterns = db.prepare(`
      SELECT prompt_hash, model, COUNT(*) as cnt, SUM(tokens_used) as total_tokens, SUM(cost_usd) as total_cost
      FROM decision_logs
      GROUP BY prompt_hash
      HAVING cnt >= 3
      ORDER BY cnt DESC
      LIMIT 5
    `).all() as any[];

    if (patterns.length > 0) {
      console.log(`\nRecurring Patterns (>= 3 occurrences):\n`);
      for (const pp of patterns) {
        console.log(`  hash: ${pp.prompt_hash} | ${pp.cnt}x | ${pp.total_tokens} tokens | $${pp.total_cost.toFixed(4)} total`);
        console.log(`     Consider caching or template reuse`);
      }
    }
  } catch (e) {
    console.error('[SPARK] Error reading decision logs:', e);
  }

  db.close();
  console.log('');
}
