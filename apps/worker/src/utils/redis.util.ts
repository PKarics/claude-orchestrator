import Redis from 'ioredis';

export function createRedisConnection(): Redis {
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: null,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      console.log(`Retrying Redis connection in ${delay}ms (attempt ${times})`);
      return delay;
    },
    enableReadyCheck: true,
    connectTimeout: 10000,
  });

  redis.on('error', (error) => {
    console.error('Redis connection error:', error);
  });

  redis.on('connect', () => {
    console.log('Connected to Redis');
  });

  redis.on('close', () => {
    console.log('Redis connection closed');
  });

  return redis;
}