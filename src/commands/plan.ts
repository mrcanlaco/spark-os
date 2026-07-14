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
    console.error('[SPARK] spark.yaml hoặc spark.db không tồn tại. Chạy "spark init" trước.');
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

  // If no model answers ping, fallback to deepseek with mock
  if (!activeAdapter) {
    console.log('[SPARK] Các model không phản hồi ping, dùng mock DeepSeekAdapter...');
    activeAdapter = new DeepSeekAdapter('deepseek-cloud', '');
  }

  console.log(`[SPARK] Sử dụng model ${activeAdapter.id} để phân tích spark.yaml...`);

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
    let responseText = await activeAdapter.generateText(prompt);
    
    // Clean up response if it contains markdown code blocks
    responseText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    const tasks = JSON.parse(responseText);
    if (!Array.isArray(tasks)) throw new Error('AI did not return an array');
    
    const db = new Database(dbPath);
    const project = db.prepare('SELECT id FROM projects LIMIT 1').get() as any;
    if (!project) throw new Error('No project found in db');
    
    const insertTask = db.prepare(`
      INSERT INTO tasks (id, project_id, title, phase, priority, assigned_model, status)
      VALUES (?, ?, ?, ?, ?, ?, 'PENDING')
    `);
    
    let count = 0;
    db.transaction(() => {
      for (const t of tasks) {
        insertTask.run(crypto.randomUUID(), project.id, t.title, t.phase || 'DEFINE', t.priority || 1, t.assigned_model || activeAdapter?.id);
        count++;
      }
    })();
    
    db.close();
    console.log(`[SPARK] Đã sinh và lưu ${count} tasks vào database.`);
  } catch (err) {
    console.error('[SPARK] Lỗi khi sinh tasks:', err);
  }
}
