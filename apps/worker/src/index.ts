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
  try {
    const redis = createRedisConnection();

    // Wait for Redis connection with timeout
    await Promise.race([
      new Promise((resolve) => redis.once('ready', resolve)),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Redis connection timeout')), 15000)
      ),
    ]);

    const worker = new WorkerService(
      options.id,
      redis,
      process.env.QUEUE_NAME || 'claude-tasks',
    );

    await worker.start();
  } catch (error) {
    console.error('Failed to start worker:', error);
    process.exit(1);
  }
}

main();