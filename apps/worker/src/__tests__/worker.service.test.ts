import { WorkerService } from '../services/worker.service';
import { ExecutorService } from '../services/executor.service';
import { HeartbeatService } from '../services/heartbeat.service';
import { Worker, Queue, Job } from 'bullmq';
import Redis from 'ioredis';

// Mock dependencies
jest.mock('bullmq');
jest.mock('ioredis');
jest.mock('../services/executor.service');
jest.mock('../services/heartbeat.service');

describe('WorkerService', () => {
  let workerService: WorkerService;
  let mockRedis: jest.Mocked<Redis>;
  let mockWorker: jest.Mocked<Worker>;
  let mockQueue: jest.Mocked<Queue>;
  let mockExecutor: jest.Mocked<ExecutorService>;
  let mockHeartbeat: jest.Mocked<HeartbeatService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRedis = {
      quit: jest.fn().mockResolvedValue('OK'),
    } as any;

    mockExecutor = {
      executePrompt: jest.fn(),
    } as any;

    mockHeartbeat = {
      start: jest.fn(),
      stop: jest.fn(),
    } as any;

    mockWorker = {
      on: jest.fn().mockReturnThis(),
      close: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-123' }),
    } as any;

    (Worker as jest.MockedClass<typeof Worker>).mockImplementation(() => mockWorker);
    (Queue as jest.MockedClass<typeof Queue>).mockImplementation(() => mockQueue);
    (ExecutorService as jest.MockedClass<typeof ExecutorService>).mockImplementation(() => mockExecutor);
    (HeartbeatService as jest.MockedClass<typeof HeartbeatService>).mockImplementation(() => mockHeartbeat);

    workerService = new WorkerService('test-worker-1', mockRedis, 'test-queue');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('start', () => {
    it('should initialize result queue with correct configuration', async () => {
      await workerService.start();

      expect(Queue).toHaveBeenCalledWith('test-queue-results', {
        connection: mockRedis,
      });
    });

    it('should initialize worker with correct configuration', async () => {
      await workerService.start();

      expect(Worker).toHaveBeenCalledWith(
        'test-queue',
        expect.any(Function),
        { connection: mockRedis, concurrency: 1 }
      );
    });

    it('should register failed event listener', async () => {
      await workerService.start();

      expect(mockWorker.on).toHaveBeenCalledWith('failed', expect.any(Function));
    });

    it('should register error event listener', async () => {
      await workerService.start();

      expect(mockWorker.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should start heartbeat service', async () => {
      await workerService.start();

      expect(mockHeartbeat.start).toHaveBeenCalled();
    });

    it('should register SIGTERM handler', async () => {
      const processSpy = jest.spyOn(process, 'on');

      await workerService.start();

      expect(processSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    });

    it('should register SIGINT handler', async () => {
      const processSpy = jest.spyOn(process, 'on');

      await workerService.start();

      expect(processSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });

    it('should log startup message', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await workerService.start();

      expect(consoleLogSpy).toHaveBeenCalledWith('Worker test-worker-1 started');

      consoleLogSpy.mockRestore();
    });
  });

  describe('processJob', () => {
    let jobProcessor: (job: Job) => Promise<void>;

    beforeEach(async () => {
      await workerService.start();

      // Extract the job processor function from Worker constructor
      const workerConstructorCalls = (Worker as jest.MockedClass<typeof Worker>).mock.calls;
      jobProcessor = workerConstructorCalls[0][1] as (job: Job) => Promise<void>;
    });

    it('should execute prompt successfully', async () => {
      const mockJob: Job = {
        data: {
          taskId: 'task-123',
          prompt: 'Test prompt',
          timeout: 60,
        },
      } as any;

      const mockResult = {
        stdout: 'Success',
        stderr: '',
        exitCode: 0,
      };

      mockExecutor.executePrompt.mockResolvedValue(mockResult);

      await jobProcessor(mockJob);

      expect(mockExecutor.executePrompt).toHaveBeenCalledWith('Test prompt', 60);
      expect(mockQueue.add).toHaveBeenCalledWith('process-result', {
        taskId: 'task-123',
        workerId: 'test-worker-1',
        status: 'completed',
        result: mockResult,
        executionTimeMs: expect.any(Number),
      });
    });

    it('should use default timeout when not provided', async () => {
      const mockJob: Job = {
        data: {
          taskId: 'task-123',
          prompt: 'Test prompt',
        },
      } as any;

      mockExecutor.executePrompt.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      await jobProcessor(mockJob);

      expect(mockExecutor.executePrompt).toHaveBeenCalledWith('Test prompt', 300);
    });

    it('should reject job with missing prompt', async () => {
      const mockJob: Job = {
        data: {
          taskId: 'task-123',
          timeout: 60,
        },
      } as any;

      await expect(jobProcessor(mockJob)).rejects.toThrow('Missing required field: prompt');

      expect(mockQueue.add).toHaveBeenCalledWith('process-result', {
        taskId: 'task-123',
        workerId: 'test-worker-1',
        status: 'failed',
        errorMessage: 'Missing required field: prompt',
        executionTimeMs: expect.any(Number),
      });
    });

    it('should handle execution errors', async () => {
      const mockJob: Job = {
        data: {
          taskId: 'task-123',
          prompt: 'Test prompt',
          timeout: 60,
        },
      } as any;

      const testError = new Error('Execution failed');
      mockExecutor.executePrompt.mockRejectedValue(testError);

      await expect(jobProcessor(mockJob)).rejects.toThrow('Execution failed');

      expect(mockQueue.add).toHaveBeenCalledWith('process-result', {
        taskId: 'task-123',
        workerId: 'test-worker-1',
        status: 'failed',
        errorMessage: 'Execution failed',
        executionTimeMs: expect.any(Number),
      });
    });

    it('should handle non-Error exceptions', async () => {
      const mockJob: Job = {
        data: {
          taskId: 'task-123',
          prompt: 'Test prompt',
          timeout: 60,
        },
      } as any;

      mockExecutor.executePrompt.mockRejectedValue('String error');

      await expect(jobProcessor(mockJob)).rejects.toBe('String error');

      expect(mockQueue.add).toHaveBeenCalledWith('process-result', {
        taskId: 'task-123',
        workerId: 'test-worker-1',
        status: 'failed',
        errorMessage: 'String error',
        executionTimeMs: expect.any(Number),
      });
    });

    it('should track execution time accurately', async () => {
      jest.useFakeTimers();
      const startTime = Date.now();
      jest.setSystemTime(startTime);

      const mockJob: Job = {
        data: {
          taskId: 'task-123',
          prompt: 'Test prompt',
          timeout: 60,
        },
      } as any;

      mockExecutor.executePrompt.mockImplementation(async () => {
        jest.advanceTimersByTime(5000); // Simulate 5 second execution
        return { stdout: 'Done', stderr: '', exitCode: 0 };
      });

      await jobProcessor(mockJob);

      expect(mockQueue.add).toHaveBeenCalledWith('process-result', expect.objectContaining({
        executionTimeMs: 5000,
      }));

      jest.useRealTimers();
    });

    it('should log error when reporting failure fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const mockJob: Job = {
        data: {
          taskId: 'task-123',
          prompt: 'Test prompt',
          timeout: 60,
        },
      } as any;

      mockExecutor.executePrompt.mockRejectedValue(new Error('Execution error'));
      mockQueue.add.mockRejectedValue(new Error('Queue error'));

      await expect(jobProcessor(mockJob)).rejects.toThrow('Execution error');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to report failure to queue:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('event handlers', () => {
    it('should log failed jobs', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await workerService.start();

      const failedHandler = mockWorker.on.mock.calls.find(
        call => call[0] === 'failed'
      )?.[1] as any;

      const mockJob = { id: 'job-123' } as Job;
      const mockError = new Error('Job failed');

      failedHandler?.(mockJob, mockError, 0);

      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should log worker errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await workerService.start();

      const errorHandler = mockWorker.on.mock.calls.find(
        call => call[0] === 'error'
      )?.[1] as any;

      const mockError = new Error('Worker error');

      errorHandler?.(mockError, null);

      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should handle failed job with null job', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await workerService.start();

      const failedHandler = mockWorker.on.mock.calls.find(
        call => call[0] === 'failed'
      )?.[1] as any;

      failedHandler?.(null, new Error('Error'), 0);

      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('shutdown', () => {
    it('should close worker gracefully', async () => {
      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const processOnSpy = jest.spyOn(process, 'on');

      await workerService.start();

      const sigintHandler = processOnSpy.mock.calls.find(
        call => call[0] === 'SIGINT'
      )?.[1] as any;

      await sigintHandler?.();

      expect(consoleLogSpy).toHaveBeenCalledWith('Shutting down...');
      expect(mockWorker.close).toHaveBeenCalled();
      expect(mockHeartbeat.stop).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(0);

      processExitSpy.mockRestore();
      consoleLogSpy.mockRestore();
      processOnSpy.mockRestore();
    });

    it('should stop heartbeat on shutdown', async () => {
      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const processOnSpy = jest.spyOn(process, 'on');

      await workerService.start();

      const sigtermHandler = processOnSpy.mock.calls.find(
        call => call[0] === 'SIGTERM'
      )?.[1] as any;

      await sigtermHandler?.();

      expect(mockHeartbeat.stop).toHaveBeenCalled();

      processExitSpy.mockRestore();
      processOnSpy.mockRestore();
    });

    it('should quit redis on shutdown', async () => {
      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const processOnSpy = jest.spyOn(process, 'on');
      mockRedis.quit = jest.fn().mockResolvedValue('OK');

      await workerService.start();

      const sigtermHandler = processOnSpy.mock.calls.find(
        call => call[0] === 'SIGTERM'
      )?.[1] as any;

      await sigtermHandler?.();

      expect(mockRedis.quit).toHaveBeenCalled();

      processExitSpy.mockRestore();
      processOnSpy.mockRestore();
    });
  });
});
