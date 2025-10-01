import { Worker, Job, Queue } from 'bullmq';
import Redis from 'ioredis';
import { HeartbeatService } from './heartbeat.service';
import { ExecutorService } from './executor.service';

export class WorkerService {
  private worker!: Worker;
  private resultQueue!: Queue;
  private heartbeat: HeartbeatService;
  private executor: ExecutorService;

  constructor(
    private workerId: string,
    private redis: Redis,
    private queueName: string,
    private workerType: string = 'local',
  ) {
    this.heartbeat = new HeartbeatService(redis, workerId, workerType);
    this.executor = new ExecutorService();
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

    // Add worker event listeners for better error handling
    this.worker.on('failed', (job, error) => {
      console.error(`Job ${job?.id} failed:`, error);
    });

    this.worker.on('error', (error) => {
      console.error('Worker error:', error);
    });

    // Start heartbeat (this also registers the worker)
    this.heartbeat.start();

    // Handle shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());

    console.log(`Worker ${this.workerId} (${this.workerType}) started and registered`);
  }

  private async processJob(job: Job) {
    const { taskId, prompt, timeout = 300 } = job.data;
    const startTime = Date.now();

    // Validate required fields
    if (!taskId) {
      throw new Error('Missing required field: taskId');
    }

    if (!prompt) {
      throw new Error('Missing required field: prompt');
    }

    // Validate prompt is a non-empty string
    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      throw new Error('Invalid prompt: must be a non-empty string');
    }

    // Log job receipt
    const truncatedPrompt = prompt.length > 100 ? prompt.substring(0, 100) + '...' : prompt;
    console.log(`Worker ${this.workerId} processing task ${taskId} with prompt: ${truncatedPrompt}`);

    try {
      // Execute the prompt using Claude Agent SDK
      const result = await this.executor.executePrompt(prompt, timeout);
      const executionTimeMs = Date.now() - startTime;

      // Send result to result queue
      await this.resultQueue.add('process-result', {
        taskId,
        workerId: this.workerId,
        status: result.exitCode === 0 ? 'completed' : 'failed',
        result: result.stdout,
        errorMessage: result.stderr || undefined,
        executionTimeMs,
      });

      console.log(`Worker ${this.workerId} completed task ${taskId} in ${executionTimeMs}ms`);

      // Return acknowledgment that job was processed
      return { taskId, workerId: this.workerId, status: 'processed' };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error(`Worker ${this.workerId} failed task ${taskId}:`, errorMessage);

      // Send failure result to result queue
      await this.resultQueue.add('process-result', {
        taskId,
        workerId: this.workerId,
        status: 'failed',
        errorMessage,
        executionTimeMs,
      });

      // Re-throw so BullMQ can handle retry logic
      throw error;
    }
  }

  async shutdown() {
    console.log('Shutting down...');
    await this.worker.close();
    await this.resultQueue.close();
    this.heartbeat.stop();
    await this.heartbeat.cleanup();
    await this.redis.quit();
    process.exit(0);
  }
}