import { Command } from 'commander';
import { initProject } from './commands/init';
import { showStatus } from './commands/status';
import { pingModels } from './commands/ping-models';
import { planTasks } from './commands/plan';
import { showDecisions } from './commands/decisions';
import { SparkDaemon } from './daemon';

const program = new Command();

program
  .name('spark')
  .description('SPARK OS - AI Fleet Orchestration System')
  .version('2.0.0');

program
  .command('init <project-name>')
  .description('Initialize a new SPARK OS project')
  .action((projectName: string) => {
    initProject(projectName);
  });

program
  .command('status')
  .description('Show project status, tasks and RFA queue')
  .action(() => {
    showStatus();
  });

program
  .command('ping-models')
  .description('Ping configured models and check fallback')
  .action(async () => {
    await pingModels();
  });

program
  .command('plan')
  .description('AI analyzes spark.yaml and generates task list')
  .action(async () => {
    await planTasks();
  });

program
  .command('decisions')
  .description('Show AI decision logs and recurring patterns')
  .action(() => {
    showDecisions();
  });

program
  .command('daemon')
  .description('Start Local Daemon')
  .option('-p, --port <number>', 'WebSocket port', '9000')
  .action((opts) => {
    const daemon = new SparkDaemon(process.cwd());
    daemon.start(parseInt(opts.port));
    process.on('SIGINT', () => { daemon.stop(); process.exit(0); });
    process.on('SIGTERM', () => { daemon.stop(); process.exit(0); });
  });

program
  .command('reload')
  .description('Reload configuration from spark.yaml')
  .action(() => {
    console.log('[SPARK] Sending reload signal to Daemon...');
  });

program.parse(process.argv);
