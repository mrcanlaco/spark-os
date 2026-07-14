import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { parse as parseYaml } from 'yaml';
import Database from 'better-sqlite3';
import { OllamaAdapter, DeepSeekAdapter, IModelAdapter } from '../models/adapter';
import dotenv from 'dotenv';

export async function planTasks(): Promise<void> {
  const rootDir = process.cwd();
  const yamlPath = path.join(rootDir, 'spark.yaml');
  const dbPath = path.join(rootDir, '.spark', 'spark.db');
  
  dotenv.config({ path: path.join(rootDir, '.env.local') });

  if (!fs.existsSync(yamlPath) || !fs.existsSync(dbPath)) {
    console.error('[SPARK] spark.yaml or spark.db not found. Run "spark init" first.');
    return;
  }
  
  const yamlContent = fs.readFileSync(yamlPath, 'utf-8');
  const parsed = parseYaml(yamlContent);
  const registry = parsed?.model_registry?.adapters || [];

  let activeAdapter: IModelAdapter | null = null;
  for (const cfg of registry) {
    let adapter: IModelAdapter | null = null;
    if (cfg.provider === 'ollama') {
      adapter = new OllamaAdapter(cfg.id, cfg.base_url, cfg.model_name);
    } else if (cfg.provider === 'deepseek') {
      adapter = new DeepSeekAdapter(cfg.id, process.env.DEEPSEEK_API_KEY || '');
    }

    if (adapter && await adapter.ping()) {
      activeAdapter = adapter;
      break;
    }
  }

  if (!activeAdapter) {
    console.log('[SPARK] No model responded, using mock DeepSeekAdapter...');
    activeAdapter = new DeepSeekAdapter('deepseek-cloud', '');
  }

  console.log(`[SPARK] Using model ${activeAdapter.id}...`);

  const prompt = `You are an expert AI architect. Analyze the following project configuration and generate 5-10 development tasks.
Return ONLY a valid JSON array of objects, with NO markdown formatting, NO backticks, and NO extra text.
Each object must have these exact keys:
- "title": (string) short description of the task
- "phase": (string) one of "DEFINE", "PLAN", "SPEC", "BUILD", "VERIFY", "RELEASE"
- "priority": (integer) 1-5 where 5 is highest
- "assigned_model": (string) suggest an AI model ID to handle this task

Project Config:
${yamlContent}
`;

  try {
    const result = await activeAdapter.generateText(prompt);
    let responseText = result.text.replace(/\`\`\`json/gi, '').replace(/\`\`\`/g, '').trim();
    
    const tasks = JSON.parse(responseText);
    if (!Array.isArray(tasks)) throw new Error('AI did not return an array');
    
    const db = new Database(dbPath);
    const project = db.prepare('SELECT id, budget_cap_usd, budget_used_usd FROM projects LIMIT 1').get() as any;
    if (!project) throw new Error('No project found in db');
    
    const insertTask = db.prepare(`
      INSERT INTO tasks (id, project_id, title, phase, priority, assigned_model, status, token_cost_usd)
      VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)
    `);

    const promptHash = crypto.createHash('md5').update(prompt).digest('hex').slice(0, 16);

    let hasDecisionLogs = true;
    try {
      db.prepare('SELECT 1 FROM decision_logs LIMIT 1').get();
    } catch {
      hasDecisionLogs = false;
    }
    
    let count = 0;
    const costPerTask = tasks.length > 0 ? result.cost_usd / tasks.length : 0;
    db.transaction(() => {
      for (const t of tasks) {
        const taskId = crypto.randomUUID();
        insertTask.run(taskId, project.id, t.title, t.phase || 'DEFINE', t.priority || 1, t.assigned_model || activeAdapter?.id, costPerTask);
        if (hasDecisionLogs) {
          db.prepare('INSERT INTO decision_logs (task_id, prompt_hash, model, tokens_used, cost_usd) VALUES (?, ?, ?, ?, ?)').run(taskId, promptHash, activeAdapter!.id, result.tokens_used, costPerTask);
        }
        count++;
      }
    })();

    const newBudget = db.prepare('SELECT budget_used_usd, budget_cap_usd FROM projects WHERE id = ?').get(project.id) as any;
    if (newBudget && newBudget.budget_used_usd >= newBudget.budget_cap_usd * 0.9) {
      const rfaId = crypto.randomUUID();
      const firstTask = db.prepare('SELECT id FROM tasks WHERE project_id = ? LIMIT 1').get(project.id) as any;
      if (firstTask) {
        db.prepare("INSERT INTO rfa_queue (id, task_id, type, payload, status) VALUES (?, ?, 'BUDGET_EXCEEDED', ?, 'PENDING')").run(
          rfaId, firstTask.id, JSON.stringify({ used: newBudget.budget_used_usd, cap: newBudget.budget_cap_usd })
        );
        console.log(`[SPARK] Budget at ${Math.round((newBudget.budget_used_usd / newBudget.budget_cap_usd) * 100)}% - RFA created`);
      }
    }
    
    db.close();
    console.log(`[SPARK] Generated ${count} tasks (cost: $${result.cost_usd.toFixed(4)}, tokens: ${result.tokens_used})`);
  } catch (err) {
    console.error('[SPARK] Error generating tasks:', err);
  }
}
