import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { TasksModule } from '../../src/modules/tasks/tasks.module';
import { QueueModule } from '../../src/modules/queue/queue.module';
import { TasksService } from '../../src/modules/tasks/tasks.service';
import { QueueService } from '../../src/modules/queue/queue.service';
import { TaskEntity } from '../../src/modules/tasks/entities/task.entity';
import { TaskStatus } from '@shared/types';

/**
 * End-to-End Integration Tests
 *
 * Tests the full orchestration flow:
 * 1. Create task via TasksService
 * 2. Add task to queue via QueueService
 * 3. Simulate worker processing
 * 4. Process result via result queue
 * 5. Verify task status updated in database
 *
 * NOTE: These tests require Redis to be running.
 * Run: docker-compose up redis -d
 *
 * To skip these tests if Redis is unavailable, run:
 * npm test -- --testPathIgnorePatterns=e2e
 */
describe('Worker Integration E2E', () => {
  let app: INestApplication;
  let tasksService: TasksService;
  let queueService: QueueService;
  let redis: Redis;
  let taskQueue: Queue;
  let mockWorker: Worker;

  const REDIS_CONFIG = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  };

  beforeAll(async () => {
    // Test if Redis is available
    redis = new Redis(REDIS_CONFIG);
    try {
      await redis.ping();
    } catch (error) {
      console.warn('Redis not available, skipping e2e tests');
      await redis.quit();
      return;
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [TaskEntity],
          synchronize: true,
        }),
        TasksModule,
        QueueModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    tasksService = moduleFixture.get<TasksService>(TasksService);
    queueService = moduleFixture.get<QueueService>(QueueService);

    // Initialize task queue for tests
    taskQueue = new Queue('claude-tasks', { connection: redis });
  });

  afterAll(async () => {
    if (!redis) return;

    // Clean up queues
    await taskQueue?.obliterate({ force: true });
    await taskQueue?.close();
    await mockWorker?.close();
    await redis.quit();
    await app?.close();
  });

  afterEach(async () => {
    if (!redis) return;

    // Clean up jobs
    await taskQueue?.drain();
    await taskQueue?.clean(0, 1000);
  });

  describe('Full Task Processing Flow', () => {
    it('should process task from creation to completion', async () => {
      if (!redis) {
        console.warn('Skipping test - Redis not available');
        return;
      }

      // 1. Create task
      const task = await tasksService.create({
        code: 'console.log("e2e test")',
        prompt: 'E2E test prompt',
        timeout: 60,
      });

      expect(task.status).toBe(TaskStatus.QUEUED);

      // 2. Add to queue
      await queueService.addTask(task.id, {
        taskId: task.id,
        code: task.code,
        prompt: task.prompt,
        timeout: task.timeout,
      });

      // 3. Verify job in queue
      const job = await taskQueue.getJob(task.id);
      expect(job).toBeDefined();
      expect(job?.data.taskId).toBe(task.id);

      // 4. Simulate worker picking up job
      const mockResult = {
        stdout: 'Task executed successfully',
        stderr: '',
        exitCode: 0,
      };

      // 5. Process job (simulate worker)
      mockWorker = new Worker(
        'claude-tasks',
        async (job) => {
          // Simulate task execution
          const resultQueue = new Queue('claude-tasks-results', { connection: redis });
          await resultQueue.add('process-result', {
            taskId: job.data.taskId,
            workerId: 'test-worker-1',
            status: 'completed',
            result: mockResult,
            executionTimeMs: 1000,
          });
          await resultQueue.close();
          return mockResult;
        },
        { connection: redis, autorun: false },
      );

      // Start worker
      mockWorker.run();

      // Wait for processing (with timeout)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 6. Verify task updated in database
      const updatedTask = await tasksService.findOne(task.id);
      expect(updatedTask.status).toBe(TaskStatus.COMPLETED);
      expect(updatedTask.workerId).toBe('test-worker-1');
      expect(updatedTask.result).toEqual(mockResult);
      expect(updatedTask.completedAt).toBeInstanceOf(Date);
    }, 10000);

    it('should handle task failure', async () => {
      if (!redis) {
        console.warn('Skipping test - Redis not available');
        return;
      }

      // Create task
      const task = await tasksService.create({
        code: 'throw new Error("test error")',
        prompt: 'Error test',
        timeout: 60,
      });

      // Add to queue
      await queueService.addTask(task.id, {
        taskId: task.id,
        code: task.code,
        prompt: task.prompt,
        timeout: task.timeout,
      });

      // Simulate worker processing with error
      mockWorker = new Worker(
        'claude-tasks',
        async (job) => {
          const resultQueue = new Queue('claude-tasks-results', { connection: redis });
          await resultQueue.add('process-result', {
            taskId: job.data.taskId,
            workerId: 'test-worker-1',
            status: 'failed',
            errorMessage: 'Execution failed: test error',
            executionTimeMs: 500,
          });
          await resultQueue.close();
          throw new Error('test error');
        },
        { connection: redis, autorun: false },
      );

      mockWorker.run();

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Verify task marked as failed
      const updatedTask = await tasksService.findOne(task.id);
      expect(updatedTask.status).toBe(TaskStatus.FAILED);
      expect(updatedTask.errorMessage).toBe('Execution failed: test error');
      expect(updatedTask.completedAt).toBeInstanceOf(Date);
    }, 10000);
  });

  describe('Queue Statistics', () => {
    it('should report accurate queue statistics', async () => {
      if (!redis) {
        console.warn('Skipping test - Redis not available');
        return;
      }

      // Create and queue multiple tasks
      const task1 = await tasksService.create({
        code: 'console.log("task1")',
        prompt: 'Task 1',
      });
      const task2 = await tasksService.create({
        code: 'console.log("task2")',
        prompt: 'Task 2',
      });

      await queueService.addTask(task1.id, {
        taskId: task1.id,
        code: task1.code,
        prompt: task1.prompt,
        timeout: task1.timeout,
      });

      await queueService.addTask(task2.id, {
        taskId: task2.id,
        code: task2.code,
        prompt: task2.prompt,
        timeout: task2.timeout,
      });

      // Get queue stats
      const stats = await queueService.getQueueStats();

      expect(stats.waiting).toBeGreaterThanOrEqual(2);
      expect(stats).toHaveProperty('active');
      expect(stats).toHaveProperty('completed');
      expect(stats).toHaveProperty('failed');
    });
  });

  describe('Health Check', () => {
    it('should return true when Redis is connected', async () => {
      if (!redis) {
        console.warn('Skipping test - Redis not available');
        return;
      }

      const healthy = await queueService.healthCheck();
      expect(healthy).toBe(true);
    });
  });

  describe('Concurrent Task Processing', () => {
    it('should handle multiple tasks concurrently', async () => {
      if (!redis) {
        console.warn('Skipping test - Redis not available');
        return;
      }

      // Create multiple tasks
      const tasks = await Promise.all([
        tasksService.create({
          code: 'console.log("concurrent1")',
          prompt: 'Concurrent 1',
        }),
        tasksService.create({
          code: 'console.log("concurrent2")',
          prompt: 'Concurrent 2',
        }),
        tasksService.create({
          code: 'console.log("concurrent3")',
          prompt: 'Concurrent 3',
        }),
      ]);

      // Queue all tasks
      await Promise.all(
        tasks.map((task) =>
          queueService.addTask(task.id, {
            taskId: task.id,
            code: task.code,
            prompt: task.prompt,
            timeout: task.timeout,
          }),
        ),
      );

      // Verify all jobs in queue
      const stats = await queueService.getQueueStats();
      expect(stats.waiting).toBeGreaterThanOrEqual(3);

      // Simulate worker processing all tasks
      mockWorker = new Worker(
        'claude-tasks',
        async (job) => {
          const resultQueue = new Queue('claude-tasks-results', { connection: redis });
          await resultQueue.add('process-result', {
            taskId: job.data.taskId,
            workerId: 'test-worker-1',
            status: 'completed',
            result: { stdout: 'Done', stderr: '', exitCode: 0 },
            executionTimeMs: 100,
          });
          await resultQueue.close();
        },
        { connection: redis, concurrency: 3, autorun: false },
      );

      mockWorker.run();

      // Wait for all tasks to process
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Verify all tasks completed
      const updatedTasks = await Promise.all(
        tasks.map((task) => tasksService.findOne(task.id)),
      );

      expect(updatedTasks.every((t) => t.status === TaskStatus.COMPLETED)).toBe(true);
    }, 15000);
  });

  describe('Task Timeout Simulation', () => {
    it('should handle task timeout from worker', async () => {
      if (!redis) {
        console.warn('Skipping test - Redis not available');
        return;
      }

      const task = await tasksService.create({
        code: 'sleep 300',
        prompt: 'Long running task',
        timeout: 1, // Very short timeout
      });

      await queueService.addTask(task.id, {
        taskId: task.id,
        code: task.code,
        prompt: task.prompt,
        timeout: task.timeout,
      });

      // Simulate worker timing out
      mockWorker = new Worker(
        'claude-tasks',
        async (job) => {
          const resultQueue = new Queue('claude-tasks-results', { connection: redis });
          await resultQueue.add('process-result', {
            taskId: job.data.taskId,
            workerId: 'test-worker-1',
            status: 'failed',
            errorMessage: 'Task execution timed out after 1 seconds',
            executionTimeMs: 1000,
          });
          await resultQueue.close();
          throw new Error('timeout');
        },
        { connection: redis, autorun: false },
      );

      mockWorker.run();

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const updatedTask = await tasksService.findOne(task.id);
      expect(updatedTask.status).toBe(TaskStatus.FAILED);
      expect(updatedTask.errorMessage).toContain('timed out');
    }, 10000);
  });
});
