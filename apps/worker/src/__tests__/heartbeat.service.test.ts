import { HeartbeatService } from '../services/heartbeat.service';
import Redis from 'ioredis';

// Mock Redis
jest.mock('ioredis');

describe('HeartbeatService', () => {
  let heartbeatService: HeartbeatService;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    mockRedis = {
      setex: jest.fn().mockResolvedValue('OK'),
    } as any;

    heartbeatService = new HeartbeatService(mockRedis, 'test-worker-1', 10);
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    heartbeatService.stop();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('start', () => {
    it('should send initial heartbeat immediately', () => {
      heartbeatService.start();

      expect(mockRedis.setex).toHaveBeenCalledTimes(1);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'worker:test-worker-1:heartbeat',
        30,
        expect.any(String)
      );
    });

    it('should send heartbeat at regular intervals', () => {
      heartbeatService.start();

      // Initial heartbeat
      expect(mockRedis.setex).toHaveBeenCalledTimes(1);

      // Advance time by 10 seconds (intervalSeconds)
      jest.advanceTimersByTime(10000);
      expect(mockRedis.setex).toHaveBeenCalledTimes(2);

      // Advance another 10 seconds
      jest.advanceTimersByTime(10000);
      expect(mockRedis.setex).toHaveBeenCalledTimes(3);

      // Advance another 10 seconds
      jest.advanceTimersByTime(10000);
      expect(mockRedis.setex).toHaveBeenCalledTimes(4);
    });

    it('should use correct TTL of 30 seconds', () => {
      heartbeatService.start();

      const setexCalls = mockRedis.setex.mock.calls;
      expect(setexCalls[0][1]).toBe(30);
    });

    it('should include ISO timestamp in heartbeat', () => {
      const fixedDate = '2025-01-15T10:30:00.000Z';
      jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(fixedDate);

      heartbeatService.start();

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'worker:test-worker-1:heartbeat',
        30,
        fixedDate
      );
    });

    it('should use custom interval when provided', () => {
      const customService = new HeartbeatService(mockRedis, 'test-worker-2', 5);
      customService.start();

      expect(mockRedis.setex).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(5000);
      expect(mockRedis.setex).toHaveBeenCalledTimes(2);

      customService.stop();
    });

    it('should handle Redis errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const redisError = new Error('Redis connection failed');
      mockRedis.setex.mockRejectedValue(redisError);

      heartbeatService.start();

      // Wait for promise to resolve
      await Promise.resolve();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to send heartbeat:',
        redisError
      );

      consoleErrorSpy.mockRestore();
    });

    it('should continue sending heartbeats after Redis error', async () => {
      mockRedis.setex
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValue('OK');

      heartbeatService.start();

      await Promise.resolve();
      expect(mockRedis.setex).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(10000);
      await Promise.resolve();
      expect(mockRedis.setex).toHaveBeenCalledTimes(2);
    });
  });

  describe('stop', () => {
    it('should stop sending heartbeats', () => {
      heartbeatService.start();
      expect(mockRedis.setex).toHaveBeenCalledTimes(1);

      heartbeatService.stop();

      // Advance time, should not send more heartbeats
      jest.advanceTimersByTime(10000);
      expect(mockRedis.setex).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(10000);
      expect(mockRedis.setex).toHaveBeenCalledTimes(1);
    });

    it('should clear interval when stopped', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      heartbeatService.start();
      heartbeatService.stop();

      expect(clearIntervalSpy).toHaveBeenCalled();

      clearIntervalSpy.mockRestore();
    });

    it('should handle stop being called multiple times', () => {
      heartbeatService.start();
      heartbeatService.stop();
      heartbeatService.stop();
      heartbeatService.stop();

      jest.advanceTimersByTime(30000);
      expect(mockRedis.setex).toHaveBeenCalledTimes(1);
    });

    it('should handle stop being called before start', () => {
      expect(() => heartbeatService.stop()).not.toThrow();
    });

    it('should be safe to start after stop', () => {
      heartbeatService.start();
      expect(mockRedis.setex).toHaveBeenCalledTimes(1);

      heartbeatService.stop();

      heartbeatService.start();
      expect(mockRedis.setex).toHaveBeenCalledTimes(2);

      jest.advanceTimersByTime(10000);
      expect(mockRedis.setex).toHaveBeenCalledTimes(3);
    });
  });

  describe('worker identification', () => {
    it('should use correct worker ID in Redis key', () => {
      const service1 = new HeartbeatService(mockRedis, 'worker-alpha', 10);
      service1.start();

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'worker:worker-alpha:heartbeat',
        30,
        expect.any(String)
      );

      service1.stop();
    });

    it('should handle special characters in worker ID', () => {
      const service = new HeartbeatService(mockRedis, 'worker-123_test.local', 10);
      service.start();

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'worker:worker-123_test.local:heartbeat',
        30,
        expect.any(String)
      );

      service.stop();
    });
  });

  describe('edge cases', () => {
    it('should handle interval being null when stopping', () => {
      const service = new HeartbeatService(mockRedis, 'test-worker', 10);

      // Stop without starting
      expect(() => service.stop()).not.toThrow();
    });

    it('should clear existing interval when stopping multiple times', () => {
      const service = new HeartbeatService(mockRedis, 'test-worker', 10);
      service.start();

      service.stop();
      service.stop(); // Second stop

      // Should not throw
      expect(mockRedis.setex).toHaveBeenCalledTimes(1); // Only initial heartbeat
    });
  });
});
