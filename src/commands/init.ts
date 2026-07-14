import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { parse as parseYaml } from 'yaml';
import { createDatabase } from '../db/connection';
import { getDefaultSparkYaml } from '../templates/spark.yaml';

const GITIGNORE_SPARK = `
# SPARK OS Core
.spark/
.env.local
`;

export function initProject(projectName: string): void {
  const rootDir = process.cwd();
  const sparkDir = path.join(rootDir, '.spark');

  console.log(`[SPARK] Khởi tạo dự án: ${projectName}...`);

  // 1. Tạo thư mục .spark/ + subdirs
  for (const sub of ['', 'sandbox', 'audit_logs']) {
    const dir = path.join(sparkDir, sub);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
  console.log('✅ Tạo thư mục .spark/ (sandbox, audit_logs)');

  // 2. Tạo spark.yaml
  const yamlPath = path.join(rootDir, 'spark.yaml');
  if (!fs.existsSync(yamlPath)) {
    fs.writeFileSync(yamlPath, getDefaultSparkYaml(projectName));
    console.log('✅ Tạo spark.yaml (Project DNA)');
  } else {
    console.log('ℹ️  spark.yaml đã tồn tại, giữ nguyên.');
  }

  // 3. Tạo .env.local
  const envPath = path.join(rootDir, '.env.local');
  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, '# SPARK OS Secrets — KHÔNG commit file này\nSPARK_DEPLOY_TOKEN=\nANTHROPIC_API_KEY=\nDEEPSEEK_API_KEY=\n');
    console.log('✅ Tạo .env.local (Secrets)');
  }

  // 4. Cập nhật .gitignore
  const gitignorePath = path.join(rootDir, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const current = fs.readFileSync(gitignorePath, 'utf-8');
    if (!current.includes('.spark/')) {
      fs.appendFileSync(gitignorePath, GITIGNORE_SPARK);
    }
  } else {
    fs.writeFileSync(gitignorePath, 'node_modules/' + GITIGNORE_SPARK);
  }
  console.log('✅ .gitignore (bảo vệ .spark/ và .env.local)');

  // 5. Khởi tạo SQLite DB + Schema
  const db = createDatabase(sparkDir);
  console.log('✅ spark.db (WAL Mode, 4 bảng, CHECK constraints, Trigger)');

  // 6. Đồng bộ budget từ spark.yaml → projects table (DB là SoT sau bước này)
  const yamlContent = fs.readFileSync(yamlPath, 'utf-8');
  const parsed = parseYaml(yamlContent);
  const budgetCap = parsed?.budget?.budget_cap_usd ?? 15.0;

  const projectId = crypto.randomUUID();
  db.prepare('INSERT OR IGNORE INTO projects (id, name, budget_cap_usd) VALUES (?, ?, ?)').run(projectId, projectName, budgetCap);
  console.log(`✅ Project "${projectName}" → spark.db (budget_cap: $${budgetCap})`);

  db.close();
  console.log(`\n🚀 SPARK OS sẵn sàng. Chạy 'spark status' để xem trạng thái.`);
}
