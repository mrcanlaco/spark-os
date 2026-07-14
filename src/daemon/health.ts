import os from 'os';

const WARNING_MB = 300;
const KILL_MB = 500;

export function checkHealth(): { rss_mb: number; cpu_count: number; status: string } {
  const rss_mb = Math.round(process.memoryUsage.rss() / 1024 / 1024);
  const cpu_count = os.cpus().length;
  let status = 'OK';

  if (rss_mb >= KILL_MB) {
    status = 'CRITICAL';
    console.error(`[HEALTH] RSS ${rss_mb}MB >= ${KILL_MB}MB — cần restart`);
  } else if (rss_mb >= WARNING_MB) {
    status = 'WARNING';
    console.warn(`[HEALTH] RSS ${rss_mb}MB >= ${WARNING_MB}MB — bắt đầu GC`);
    if (global.gc) global.gc();
  }

  return { rss_mb, cpu_count, status };
}