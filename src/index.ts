import { Command } from 'commander';
import { initProject } from './commands/init';
import { showStatus } from './commands/status';
import { pingModels } from './commands/ping-models';
import { planTasks } from './commands/plan';
import { SparkDaemon } from './daemon';

const program = new Command();

program
  .name('spark')
  .description('SPARK OS — Hệ điều hành quản trị hạm đội AI Agentic')
  .version('1.0.0');

program
  .command('init <project-name>')
  .description('Khởi tạo dự án SPARK OS mới')
  .action((projectName: string) => {
    initProject(projectName);
  });

program
  .command('status')
  .description('Hiển thị trạng thái dự án, tasks và RFA queue')
  .action(() => {
    showStatus();
  });

program
  .command('ping-models')
  .description('Ping cấu hình models trong spark.yaml và kiểm tra fallback')
  .action(async () => {
    await pingModels();
  });

program
  .command('plan')
  .description('AI phân tích spark.yaml và sinh task list')
  .action(async () => {
    await planTasks();
  });

program
  .command('daemon')
  .description('Khởi chạy Local Daemon')
  .option('-p, --port <number>', 'WebSocket port', '9000')
  .action((opts) => {
    const daemon = new SparkDaemon(process.cwd());
    daemon.start(parseInt(opts.port));
    process.on('SIGINT', () => { daemon.stop(); process.exit(0); });
    process.on('SIGTERM', () => { daemon.stop(); process.exit(0); });
  });

program
  .command('reload')
  .description('Nạp lại cấu hình từ spark.yaml')
  .action(() => {
    console.log('[SPARK] Gửi tín hiệu reload tới Daemon...');
  });

program.parse(process.argv);