import { Worker, Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import { ExecutorService } from './executor.service';
import { HeartbeatService } from './heartbeat.service';

export class WorkerService {
  private worker: Worker;
  private resultQueue: Queue;
  private heartbeat: HeartbeatService;
  private executor: ExecutorService;

  constructor(
    private workerId: string,
    private redis: Redis,
    private queueName: string,
  ) {
    this.executor = new ExecutorService();
    this.heartbeat = new HeartbeatService(redis, workerId);
  }

  async start() {
    // Initialize result queue
    this.resultQueue = new Queue(`${this.queueName}-results`, {
      connection: this.redis,
    });

    // Initialize worker
    this.worker = new Worker(
      this.queueName,
      async (job) => await this.processJob(job),
      { connection: this.redis, concurrency: 1 },
    );

    // Start heartbeat
    this.heartbeat.start();

    // Handle shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());

    console.log(`Worker ${this.workerId} started`);
  }

  private async processJob(job: Job) {
    const { taskId, code, timeout } = job.data;
    const startTime = Date.now();

    try {
      const result = await this.executor.executeCode(code, timeout);

      await this.resultQueue.add('process-result', {
        taskId,
        workerId: this.workerId,
        status: 'completed',
        result,
        executionTimeMs: Date.now() - startTime,
      });
    } catch (error) {
      await this.resultQueue.add('process-result', {
        taskId,
        workerId: this.workerId,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error),
        executionTimeMs: Date.now() - startTime,
      });
      throw error;
    }
  }

  private async shutdown() {
    console.log('Shutting down...');
    await this.worker.close();
    this.heartbeat.stop();
    await this.redis.quit();
    process.exit(0);
  }
}