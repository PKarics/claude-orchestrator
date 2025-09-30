import { ConfigService } from '@nestjs/config';
import { getRedisConfig } from './redis.config';

describe('getRedisConfig', () => {
  let configService: ConfigService;

  beforeEach(() => {
    configService = new ConfigService();
  });

  it('should return Redis configuration with default values', () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string, defaultValue?: any) => {
      return defaultValue;
    });

    const config = getRedisConfig(configService);

    expect(config).toEqual({
      connection: {
        host: 'localhost',
        port: 6379,
        password: undefined,
        maxRetriesPerRequest: null,
      },
    });
  });

  it('should use custom Redis host from environment', () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string, defaultValue?: any) => {
      if (key === 'REDIS_HOST') return 'redis.example.com';
      return defaultValue;
    });

    const config = getRedisConfig(configService);

    expect(config.connection.host).toBe('redis.example.com');
  });

  it('should use custom Redis port from environment', () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string, defaultValue?: any) => {
      if (key === 'REDIS_PORT') return 6380;
      return defaultValue;
    });

    const config = getRedisConfig(configService);

    expect(config.connection.port).toBe(6380);
  });

  it('should include password when provided', () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string, defaultValue?: any) => {
      if (key === 'REDIS_PASSWORD') return 'secret123';
      return defaultValue;
    });

    const config = getRedisConfig(configService);

    expect(config.connection.password).toBe('secret123');
  });

  it('should have maxRetriesPerRequest set to null for BullMQ', () => {
    const config = getRedisConfig(configService);

    expect(config.connection.maxRetriesPerRequest).toBeNull();
  });
});