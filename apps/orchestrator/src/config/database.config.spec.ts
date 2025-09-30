import { ConfigService } from '@nestjs/config';
import { getDatabaseConfig } from './database.config';

describe('getDatabaseConfig', () => {
  let configService: ConfigService;

  beforeEach(() => {
    configService = new ConfigService();
  });

  it('should return SQLite configuration with default values', () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string, defaultValue?: any) => {
      return defaultValue;
    });

    const config = getDatabaseConfig(configService);

    expect(config).toMatchObject({
      type: 'sqlite',
      database: './data/tasks.db',
      synchronize: false,
      logging: false,
    });
    expect(config.entities).toBeDefined();
  });

  it('should use custom database path from environment', () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'DB_DATABASE') return '/custom/path/tasks.db';
      return undefined;
    });

    const config = getDatabaseConfig(configService);

    expect(config.database).toBe('/custom/path/tasks.db');
  });

  it('should enable synchronize in development mode', () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string, defaultValue?: any) => {
      if (key === 'NODE_ENV') return 'development';
      return defaultValue;
    });

    const config = getDatabaseConfig(configService);

    expect(config.synchronize).toBe(true);
    expect(config.logging).toBe(true);
  });

  it('should disable synchronize in production mode', () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string, defaultValue?: any) => {
      if (key === 'NODE_ENV') return 'production';
      return defaultValue;
    });

    const config = getDatabaseConfig(configService);

    expect(config.synchronize).toBe(false);
    expect(config.logging).toBe(false);
  });
});