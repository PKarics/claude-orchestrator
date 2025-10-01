import { WorkerService } from '../services/worker.service';
import { HeartbeatService } from '../services/heartbeat.service';
import { ExecutorService } from '../services/executor.service';
import { Worker, Job, Queue } from 'bullmq';
import Redis from 'ioredis';

// Mock dependencies
jest.mock('bullmq');
jest.mock('ioredis');
jest.mock('../services/heartbeat.service');
jest.mock('../services/executor.service');
jest.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: jest.fn(),
}));

describe('WorkerService', () => {
  let workerService: WorkerService;
  let mockRedis: jest.Mocked<Redis>;
  let mockWorker: jest.Mocked<Worker>;
  let mockQueue: jest.Mocked<Queue>;
  let mockHeartbeat: jest.Mocked<HeartbeatService>;
  let mockExecutor: jest.Mocked<ExecutorService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRedis = {
      quit: jest.fn().mockResolvedValue('OK'),
    } as any;

    mockHeartbeat = {
      start: jest.fn(),
      stop: jest.fn(),
      cleanup: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockExecutor = {
      executePrompt: jest.fn().mockResolvedValue({
        stdout: 'Task completed successfully',
        stderr: '',
        exitCode: 0,
      }),
    } as any;

    mockWorker = {
      on: jest.fn().mockReturnThis(),
      close: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'result-123' }),
      close: jest.fn().mockResolvedValue(undefined),
    } as any;

    (Worker as jest.MockedClass<typeof Worker>).mockImplementation(() => mockWorker);
    (Queue as jest.MockedClass<typeof Queue>).mockImplementation(() => mockQueue);
    (HeartbeatService as jest.MockedClass<typeof HeartbeatService>).mockImplementation(() => mockHeartbeat);
    (ExecutorService as jest.MockedClass<typeof ExecutorService>).mockImplementation(() => mockExecutor);

    workerService = new WorkerService('test-worker-1', mockRedis, 'test-queue');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('start', () => {
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

      expect(consoleLogSpy).toHaveBeenCalledWith('Worker test-worker-1 (local) started and registered');

      consoleLogSpy.mockRestore();
    });
  });

  describe('processJob', () => {
    let jobProcessor: (job: Job) => Promise<any>;

    beforeEach(async () => {
      await workerService.start();

      // Extract the job processor function from Worker constructor
      const workerConstructorCalls = (Worker as jest.MockedClass<typeof Worker>).mock.calls;
      jobProcessor = workerConstructorCalls[0][1] as (job: Job) => Promise<any>;
    });

    it('should acknowledge task receipt and return immediately', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const mockJob: Job = {
        data: {
          taskId: 'task-123',
          prompt: 'Test prompt for Claude Code',
        },
      } as any;

      const result = await jobProcessor(mockJob);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Worker test-worker-1 processing task task-123')
      );
      expect(result).toEqual({
        taskId: 'task-123',
        status: 'processed',
        workerId: 'test-worker-1',
      });

      consoleLogSpy.mockRestore();
    });

    it('should reject job with missing prompt', async () => {
      const mockJob: Job = {
        data: {
          taskId: 'task-123',
        },
      } as any;

      await expect(jobProcessor(mockJob)).rejects.toThrow('Missing required field: prompt');
    });

    it('should log truncated prompt if too long', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const longPrompt = 'a'.repeat(200);

      const mockJob: Job = {
        data: {
          taskId: 'task-123',
          prompt: longPrompt,
        },
      } as any;

      await jobProcessor(mockJob);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('a'.repeat(100))
      );

      consoleLogSpy.mockRestore();
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
