import { Command } from 'commander';
import { config } from 'dotenv';
import { WorkerService } from './services/worker.service';
import { createRedisConnection } from './utils/redis.util';

config({ path: '../../.env' });

const program = new Command();
program
  .option('-i, --id <id>', 'Worker ID', process.env.WORKER_ID || 'worker-1')
  .option('-t, --type <type>', 'Worker type', process.env.WORKER_TYPE || 'local')
  .parse();

const options = program.opts();

async function main() {
  const redis = createRedisConnection();
  await new Promise((resolve) => redis.once('ready', resolve));

  const worker = new WorkerService(
    options.id,
    redis,
    process.env.QUEUE_NAME || 'claude-tasks',
  );

  await worker.start();
}

main().catch(console.error);