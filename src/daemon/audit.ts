import fs from 'fs';
import path from 'path';
import { createGzip } from 'zlib';

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const RETENTION_DAYS = 14;

export interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

export class AuditLogger {
  private logDir: string;

  constructor(sparkDir: string) {
    this.logDir = path.join(sparkDir, 'audit_logs');
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  log(action: string, details: Record<string, unknown> = {}): void {
    const entry: AuditEntry = {
      timestamp: new Date().toISOString(),
      action,
      details,
    };
    const filePath = this.currentLogPath();
    fs.appendFileSync(filePath, JSON.stringify(entry) + '\n');
    this.maybeRotate(filePath);
  }

  private currentLogPath(): string {
    const date = new Date().toISOString().slice(0, 10);
    return path.join(this.logDir, `spark-${date}.log`);
  }

  private maybeRotate(filePath: string): void {
    try {
      const stat = fs.statSync(filePath);
      if (stat.size >= MAX_FILE_SIZE) {
        const gzPath = filePath + '.gz';
        const src = fs.createReadStream(filePath);
        const dest = fs.createWriteStream(gzPath);
        const gzip = createGzip();
        src.pipe(gzip).pipe(dest);
        dest.on('finish', () => {
          fs.writeFileSync(filePath, '');
        });
      }
    } catch {}
  }

  cleanup(): void {
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    try {
      for (const file of fs.readdirSync(this.logDir)) {
        const filePath = path.join(this.logDir, file);
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs < cutoff) {
          fs.unlinkSync(filePath);
        }
      }
    } catch {}
  }

  stats(): { fileCount: number; totalSizeBytes: number } {
    let fileCount = 0;
    let totalSizeBytes = 0;
    try {
      for (const file of fs.readdirSync(this.logDir)) {
        const stat = fs.statSync(path.join(this.logDir, file));
        fileCount++;
        totalSizeBytes += stat.size;
      }
    } catch {}
    return { fileCount, totalSizeBytes };
  }
}
