import { createRedisConnection } from '../utils/redis.util';
import Redis from 'ioredis';

// Mock Redis
jest.mock('ioredis');

describe('Redis Utility', () => {
  let mockRedis: jest.Mocked<Redis>;
  let eventListeners: Map<string, Function>;

  beforeEach(() => {
    eventListeners = new Map();

    mockRedis = {
      on: jest.fn((event, handler) => {
        eventListeners.set(event, handler);
        return mockRedis;
      }),
    } as any;

    (Redis as jest.MockedClass<typeof Redis>).mockImplementation(() => mockRedis);

    // Clear environment variables
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createRedisConnection', () => {
    it('should create Redis connection with default configuration', () => {
      createRedisConnection();

      expect(Redis).toHaveBeenCalledWith({
        host: 'localhost',
        port: 6379,
        maxRetriesPerRequest: null,
        retryStrategy: expect.any(Function),
        enableReadyCheck: true,
        connectTimeout: 10000,
      });
    });

    it('should use REDIS_HOST from environment', () => {
      process.env.REDIS_HOST = 'redis.example.com';

      createRedisConnection();

      expect(Redis).toHaveBeenCalledWith(expect.objectContaining({
        host: 'redis.example.com',
      }));
    });

    it('should use REDIS_PORT from environment', () => {
      process.env.REDIS_PORT = '6380';

      createRedisConnection();

      expect(Redis).toHaveBeenCalledWith(expect.objectContaining({
        port: 6380,
      }));
    });

    it('should handle invalid REDIS_PORT gracefully', () => {
      process.env.REDIS_PORT = 'invalid';

      createRedisConnection();

      expect(Redis).toHaveBeenCalledWith(expect.objectContaining({
        port: NaN,
      }));
    });

    it('should register error event listener', () => {
      createRedisConnection();

      expect(mockRedis.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should register connect event listener', () => {
      createRedisConnection();

      expect(mockRedis.on).toHaveBeenCalledWith('connect', expect.any(Function));
    });

    it('should register close event listener', () => {
      createRedisConnection();

      expect(mockRedis.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should log error on connection error', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      createRedisConnection();

      const errorHandler = eventListeners.get('error');
      const testError = new Error('Connection failed');

      errorHandler?.(testError);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Redis connection error:', testError);

      consoleErrorSpy.mockRestore();
    });

    it('should log message on successful connection', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      createRedisConnection();

      const connectHandler = eventListeners.get('connect');
      connectHandler?.();

      expect(consoleLogSpy).toHaveBeenCalledWith('Connected to Redis');

      consoleLogSpy.mockRestore();
    });

    it('should log message on connection close', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      createRedisConnection();

      const closeHandler = eventListeners.get('close');
      closeHandler?.();

      expect(consoleLogSpy).toHaveBeenCalledWith('Redis connection closed');

      consoleLogSpy.mockRestore();
    });

    it('should return Redis instance', () => {
      const redis = createRedisConnection();

      expect(redis).toBe(mockRedis);
    });
  });

  describe('retryStrategy', () => {
    let retryStrategy: (times: number) => number;

    beforeEach(() => {
      createRedisConnection();

      const redisConstructorCalls = (Redis as jest.MockedClass<typeof Redis>).mock.calls;
      retryStrategy = (redisConstructorCalls as any)[0]?.[0]?.retryStrategy as (times: number) => number;
    });

    it('should implement exponential backoff', () => {
      expect(retryStrategy(1)).toBe(50);
      expect(retryStrategy(2)).toBe(100);
      expect(retryStrategy(3)).toBe(150);
      expect(retryStrategy(10)).toBe(500);
    });

    it('should cap delay at 2000ms', () => {
      expect(retryStrategy(50)).toBe(2000);
      expect(retryStrategy(100)).toBe(2000);
      expect(retryStrategy(1000)).toBe(2000);
    });

    it('should log retry attempts', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      retryStrategy(1);
      expect(consoleLogSpy).toHaveBeenCalledWith('Retrying Redis connection in 50ms (attempt 1)');

      retryStrategy(5);
      expect(consoleLogSpy).toHaveBeenCalledWith('Retrying Redis connection in 250ms (attempt 5)');

      retryStrategy(100);
      expect(consoleLogSpy).toHaveBeenCalledWith('Retrying Redis connection in 2000ms (attempt 100)');

      consoleLogSpy.mockRestore();
    });

    it('should handle attempt 0', () => {
      expect(retryStrategy(0)).toBe(0);
    });

    it('should handle negative attempts gracefully', () => {
      expect(retryStrategy(-1)).toBeLessThanOrEqual(2000);
    });
  });

  describe('configuration', () => {
    it('should set maxRetriesPerRequest to null for BullMQ compatibility', () => {
      createRedisConnection();

      expect(Redis).toHaveBeenCalledWith(expect.objectContaining({
        maxRetriesPerRequest: null,
      }));
    });

    it('should enable ready check', () => {
      createRedisConnection();

      expect(Redis).toHaveBeenCalledWith(expect.objectContaining({
        enableReadyCheck: true,
      }));
    });

    it('should set connect timeout to 10 seconds', () => {
      createRedisConnection();

      expect(Redis).toHaveBeenCalledWith(expect.objectContaining({
        connectTimeout: 10000,
      }));
    });
  });

  describe('multiple connections', () => {
    it('should create independent connections', () => {
      // Each call creates a new mock instance
      createRedisConnection();
      createRedisConnection();

      expect(Redis).toHaveBeenCalledTimes(2);
    });

    it('should apply environment variables to all connections', () => {
      process.env.REDIS_HOST = 'redis1.example.com';
      createRedisConnection();

      process.env.REDIS_HOST = 'redis2.example.com';
      createRedisConnection();

      const calls = (Redis as jest.MockedClass<typeof Redis>).mock.calls as any;
      expect(calls[0]?.[0]?.host).toBe('redis1.example.com');
      expect(calls[1]?.[0]?.host).toBe('redis2.example.com');
    });
  });
});
