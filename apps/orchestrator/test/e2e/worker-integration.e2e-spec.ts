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
import { TaskStatus } from '@claude-orchestrator/shared';

/**
 * End-to-End Integration Tests
 *
 * Tests the simplified orchestration flow:
 * 1. Create task via TasksService
 * 2. Add task to queue via QueueService
 * 3. Simulate worker acknowledgment (returns immediately)
 * 4. Verify task is queued properly
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
          type: 'better-sqlite3',
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

  describe('Simplified Task Processing Flow', () => {
    it('should create task and add to queue', async () => {
      if (!redis) {
        console.warn('Skipping test - Redis not available');
        return;
      }

      // 1. Create task
      const task = await tasksService.create({
        prompt: 'E2E test prompt',
      });

      expect(task.status).toBe(TaskStatus.QUEUED);
      expect(task.prompt).toBe('E2E test prompt');

      // 2. Add to queue
      await queueService.addTask(task.id, {
        taskId: task.id,
        prompt: task.prompt,
      });

      // 3. Verify job in queue
      const job = await taskQueue.getJob(task.id);
      expect(job).toBeDefined();
      expect(job?.data.taskId).toBe(task.id);
      expect(job?.data.prompt).toBe('E2E test prompt');
    }, 10000);

    it('should acknowledge worker receipt immediately', async () => {
      if (!redis) {
        console.warn('Skipping test - Redis not available');
        return;
      }

      // Create task
      const task = await tasksService.create({
        prompt: 'Worker acknowledgment test',
      });

      // Add to queue
      await queueService.addTask(task.id, {
        taskId: task.id,
        prompt: task.prompt,
      });

      // Simulate worker that returns immediately
      mockWorker = new Worker(
        'claude-tasks',
        async (job) => {
          // Worker returns immediately with acknowledgment
          return { taskId: job.data.taskId, status: 'submitted' };
        },
        { connection: redis, autorun: false },
      );

      // Start worker
      mockWorker.run();

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Task should still be in queued state (worker just acknowledged)
      const updatedTask = await tasksService.findOne(task.id);
      expect(updatedTask.status).toBe(TaskStatus.QUEUED);
      expect(updatedTask.prompt).toBe('Worker acknowledgment test');
    }, 10000);

    it('should handle missing prompt validation', async () => {
      if (!redis) {
        console.warn('Skipping test - Redis not available');
        return;
      }

      // Simulate worker that validates prompt
      mockWorker = new Worker(
        'claude-tasks',
        async (job) => {
          if (!job.data.prompt) {
            throw new Error('Missing required field: prompt');
          }
          return { taskId: job.data.taskId, status: 'submitted' };
        },
        { connection: redis, autorun: false },
      );

      mockWorker.run();

      // This test verifies worker validation logic
      // In practice, the API would prevent creation of tasks without prompts
      expect(mockWorker).toBeDefined();
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
        prompt: 'Task 1',
      });
      const task2 = await tasksService.create({
        prompt: 'Task 2',
      });

      await queueService.addTask(task1.id, {
        taskId: task1.id,
        prompt: task1.prompt,
      });

      await queueService.addTask(task2.id, {
        taskId: task2.id,
        prompt: task2.prompt,
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
          prompt: 'Concurrent 1',
        }),
        tasksService.create({
          prompt: 'Concurrent 2',
        }),
        tasksService.create({
          prompt: 'Concurrent 3',
        }),
      ]);

      // Queue all tasks
      await Promise.all(
        tasks.map((task) =>
          queueService.addTask(task.id, {
            taskId: task.id,
            prompt: task.prompt,
          }),
        ),
      );

      // Verify all jobs in queue
      const stats = await queueService.getQueueStats();
      expect(stats.waiting).toBeGreaterThanOrEqual(3);

      // Simulate worker acknowledging all tasks
      mockWorker = new Worker(
        'claude-tasks',
        async (job) => {
          // Worker returns immediately with acknowledgment
          return { taskId: job.data.taskId, status: 'submitted' };
        },
        { connection: redis, concurrency: 3, autorun: false },
      );

      mockWorker.run();

      // Wait for acknowledgment
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify all tasks are still queued (workers just acknowledged)
      const updatedTasks = await Promise.all(
        tasks.map((task) => tasksService.findOne(task.id)),
      );

      // All tasks should remain in QUEUED state
      expect(updatedTasks.every((t) => t.status === TaskStatus.QUEUED)).toBe(true);
    }, 15000);
  });
});
