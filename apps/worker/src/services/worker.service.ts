import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { HeartbeatService } from './heartbeat.service';

export class WorkerService {
  private worker!: Worker;
  private heartbeat: HeartbeatService;

  constructor(
    private workerId: string,
    private redis: Redis,
    private queueName: string,
  ) {
    this.heartbeat = new HeartbeatService(redis, workerId);
  }

  async start() {
    // Initialize worker
    this.worker = new Worker(
      this.queueName,
      async (job) => await this.processJob(job),
      { connection: this.redis, concurrency: 1 },
    );

    // Add worker event listeners for better error handling
    this.worker.on('failed', (job, error) => {
      console.error(`Job ${job?.id} failed:`, error);
    });

    this.worker.on('error', (error) => {
      console.error('Worker error:', error);
    });

    // Start heartbeat
    this.heartbeat.start();

    // Handle shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());

    console.log(`Worker ${this.workerId} started`);
  }

  private async processJob(job: Job) {
    const { taskId, prompt } = job.data;

    if (!prompt) {
      throw new Error('Missing required field: prompt');
    }

    // Submit prompt to Claude Code and return immediately
    // The worker will handle the prompt asynchronously
    console.log(`Worker ${this.workerId} received task ${taskId} with prompt: ${prompt.substring(0, 100)}...`);

    // TODO: Submit to Claude Code API
    // For now, just acknowledge receipt
    return { taskId, status: 'submitted' };
  }

  private async shutdown() {
    console.log('Shutting down...');
    await this.worker.close();
    this.heartbeat.stop();
    await this.redis.quit();
    process.exit(0);
  }
}