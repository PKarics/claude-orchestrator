import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job } from 'bullmq';
import { TasksService } from '../tasks/tasks.service';
import { QueueJobData, QueueJobResult, QueueStats } from './queue.types';
import { getRedisConfig } from '../../config/redis.config';
import { TaskStatus } from '@claude-orchestrator/shared';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private taskQueue: Queue<QueueJobData>;
  private resultWorker: Worker<QueueJobResult>;
  private readonly queueName: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly tasksService: TasksService,
  ) {
    this.queueName = this.configService.get('QUEUE_NAME', 'claude-tasks');
  }

  async onModuleInit() {
    const redisConfig = getRedisConfig(this.configService);

    // Initialize task queue
    this.taskQueue = new Queue<QueueJobData>(this.queueName, {
      connection: redisConfig.connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 1000, // Keep max 1000 completed jobs
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours
        },
      },
    });

    // Initialize result worker
    this.resultWorker = new Worker<QueueJobResult>(
      `${this.queueName}-results`,
      async (job: Job<QueueJobResult>) => await this.processResult(job.data),
      {
        connection: redisConfig.connection,
      },
    );

    this.resultWorker.on('completed', (job) => {
      this.logger.log(`Result processed for task ${job.data.taskId}`);
    });

    this.resultWorker.on('failed', (job, err) => {
      this.logger.error(`Failed to process result for task ${job?.data?.taskId}: ${err.message}`);
    });

    this.logger.log('Queue service initialized');
  }

  async onModuleDestroy() {
    await this.taskQueue?.close();
    await this.resultWorker?.close();
    this.logger.log('Queue service destroyed');
  }

  async addTask(taskId: string, data: QueueJobData): Promise<void> {
    try {
      await this.taskQueue.add('execute-task', data, {
        jobId: taskId,
      });
      this.logger.log(`Task ${taskId} added to queue`);
    } catch (error) {
      this.logger.error(`Failed to add task ${taskId} to queue: ${error.message}`);
      throw error;
    }
  }

  private async processResult(result: QueueJobResult): Promise<void> {
    try {
      const updateData = {
        status: result.status === 'completed' ? TaskStatus.COMPLETED : TaskStatus.FAILED,
        workerId: result.workerId,
        result: result.result,
        errorMessage: result.errorMessage,
        completedAt: new Date(),
      };

      await this.tasksService.update(result.taskId, updateData);
      this.logger.log(`Task ${result.taskId} updated with status ${updateData.status}`);
    } catch (error) {
      this.logger.error(`Failed to process result for task ${result.taskId}: ${error.message}`);
      throw error;
    }
  }

  async getQueueStats(): Promise<QueueStats> {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.taskQueue.getWaitingCount(),
        this.taskQueue.getActiveCount(),
        this.taskQueue.getCompletedCount(),
        this.taskQueue.getFailedCount(),
        this.taskQueue.getDelayedCount(),
      ]);

      return {
        waiting,
        active,
        completed,
        failed,
        delayed,
      };
    } catch (error) {
      this.logger.error(`Failed to get queue stats: ${error.message}`);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const client = await this.taskQueue.client;
      await client.ping();
      return true;
    } catch (error) {
      this.logger.error(`Redis health check failed: ${error.message}`);
      return false;
    }
  }
}