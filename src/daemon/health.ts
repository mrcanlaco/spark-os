import os from 'os';

const WARNING_MB = 300;
const KILL_MB = 500;

export interface HealthReport {
  rss_mb: number;
  cpu_count: number;
  max_concurrent_tasks: number;
  status: string;
}

export function checkHealth(): HealthReport {
  const rss_mb = Math.round(process.memoryUsage.rss() / 1024 / 1024);
  const cpu_count = os.cpus().length;
  const max_concurrent_tasks = Math.max(1, cpu_count - 1);
  let status = 'OK';

  if (rss_mb >= KILL_MB) {
    status = 'CRITICAL';
    console.error(`[HEALTH] RSS ${rss_mb}MB >= ${KILL_MB}MB`);
  } else if (rss_mb >= WARNING_MB) {
    status = 'WARNING';
    console.warn(`[HEALTH] RSS ${rss_mb}MB >= ${WARNING_MB}MB`);
    if (global.gc) global.gc();
  }

  return { rss_mb, cpu_count, max_concurrent_tasks, status };
}

export function getChildProcessArgs(): string[] {
  return ['--max-old-space-size=250'];
}
