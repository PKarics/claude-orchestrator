import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';
import { TasksService } from '../tasks/tasks.service';
import { TaskStatus } from '@claude-orchestrator/shared';

// Create mock instances
const mockQueue = {
  add: jest.fn(),
  getWaitingCount: jest.fn(),
  getActiveCount: jest.fn(),
  getCompletedCount: jest.fn(),
  getFailedCount: jest.fn(),
  getDelayedCount: jest.fn(),
  client: Promise.resolve({
    ping: jest.fn().mockResolvedValue('PONG'),
  }),
  close: jest.fn(),
};

const mockWorker = {
  on: jest.fn(),
  close: jest.fn(),
};

let capturedWorkerProcessor: any = null;

// Mock BullMQ before imports
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => mockQueue),
  Worker: jest.fn().mockImplementation((name, processor, config) => {
    capturedWorkerProcessor = processor;
    return mockWorker;
  }),
}));

describe('QueueService', () => {
  let service: QueueService;
  let tasksService: TasksService;

  const mockTasksService = {
    update: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config: Record<string, any> = {
        QUEUE_NAME: 'test-queue',
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
      };
      return config[key] ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    capturedWorkerProcessor = null;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: TasksService,
          useValue: mockTasksService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
    tasksService = module.get<TasksService>(TasksService);

    // Initialize the service
    await service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  describe('onModuleInit', () => {
    it('should initialize with correct configuration', () => {
      expect(mockQueue).toBeDefined();
      expect(mockWorker).toBeDefined();
      expect(mockWorker.on).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('failed', expect.any(Function));
    });
  });

  describe('addTask', () => {
    it('should add a task to the queue', async () => {
      const taskData = {
        taskId: 'task-123',
        code: 'console.log("test")',
        prompt: 'test prompt',
        timeout: 300,
      };

      mockQueue.add.mockResolvedValue({ id: 'task-123' });

      await service.addTask('task-123', taskData);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'execute-task',
        taskData,
        { jobId: 'task-123' },
      );
    });

    it('should throw error if adding task fails', async () => {
      const taskData = {
        taskId: 'task-123',
        code: 'console.log("test")',
        prompt: 'test prompt',
        timeout: 300,
      };

      mockQueue.add.mockRejectedValue(new Error('Redis connection failed'));

      await expect(service.addTask('task-123', taskData)).rejects.toThrow('Redis connection failed');
    });
  });

  describe('processResult', () => {
    it('should process completed result and update task', async () => {
      const result = {
        taskId: 'task-123',
        workerId: 'worker-1',
        status: 'completed' as const,
        result: 'success output',
        executionTime: 1000,
      };

      mockTasksService.update.mockResolvedValue({});

      await capturedWorkerProcessor({ data: result });

      expect(tasksService.update).toHaveBeenCalledWith('task-123', {
        status: TaskStatus.COMPLETED,
        workerId: 'worker-1',
        result: 'success output',
        errorMessage: undefined,
        completedAt: expect.any(Date),
      });
    });

    it('should process failed result and update task', async () => {
      const result = {
        taskId: 'task-456',
        workerId: 'worker-2',
        status: 'failed' as const,
        errorMessage: 'Task execution failed',
        executionTime: 500,
      };

      mockTasksService.update.mockResolvedValue({});

      await capturedWorkerProcessor({ data: result });

      expect(tasksService.update).toHaveBeenCalledWith('task-456', {
        status: TaskStatus.FAILED,
        workerId: 'worker-2',
        result: undefined,
        errorMessage: 'Task execution failed',
        completedAt: expect.any(Date),
      });
    });

    it('should throw error if updating task fails', async () => {
      const result = {
        taskId: 'task-789',
        workerId: 'worker-3',
        status: 'completed' as const,
        result: 'output',
      };

      mockTasksService.update.mockRejectedValue(new Error('Database error'));

      await expect(capturedWorkerProcessor({ data: result })).rejects.toThrow('Database error');
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      mockQueue.getWaitingCount.mockResolvedValue(10);
      mockQueue.getActiveCount.mockResolvedValue(5);
      mockQueue.getCompletedCount.mockResolvedValue(100);
      mockQueue.getFailedCount.mockResolvedValue(2);
      mockQueue.getDelayedCount.mockResolvedValue(3);

      const stats = await service.getQueueStats();

      expect(stats).toEqual({
        waiting: 10,
        active: 5,
        completed: 100,
        failed: 2,
        delayed: 3,
      });
    });

    it('should throw error if getting stats fails', async () => {
      mockQueue.getWaitingCount.mockRejectedValue(new Error('Redis error'));

      await expect(service.getQueueStats()).rejects.toThrow('Redis error');
    });
  });

  describe('healthCheck', () => {
    it('should return true when Redis is connected', async () => {
      const result = await service.healthCheck();

      expect(result).toBe(true);
    });

    it('should return false when Redis connection fails', async () => {
      mockQueue.client = Promise.resolve({
        ping: jest.fn().mockRejectedValue(new Error('Connection refused')),
      });

      const result = await service.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('onModuleDestroy', () => {
    it('should close queue and worker', async () => {
      await service.onModuleDestroy();

      expect(mockQueue.close).toHaveBeenCalled();
      expect(mockWorker.close).toHaveBeenCalled();
    });
  });
});