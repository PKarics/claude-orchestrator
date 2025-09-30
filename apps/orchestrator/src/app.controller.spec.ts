import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { DataSource } from 'typeorm';
import { QueueService } from './modules/queue/queue.service';

describe('AppController', () => {
  let controller: AppController;
  let dataSource: DataSource;
  let queueService: QueueService;

  const mockDataSource = {
    isInitialized: true,
  };

  const mockQueueService = {
    healthCheck: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
      ],
    }).compile();

    controller = module.get<AppController>(AppController);
    dataSource = module.get<DataSource>(DataSource);
    queueService = module.get<QueueService>(QueueService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getHealth', () => {
    it('should return healthy status when both database and redis are connected', async () => {
      mockDataSource.isInitialized = true;
      mockQueueService.healthCheck.mockResolvedValue(true);

      const result = await controller.getHealth();

      expect(result).toEqual({
        status: 'healthy',
        database: { connected: true },
        redis: { connected: true },
      });
    });

    it('should return unhealthy status when database is disconnected', async () => {
      mockDataSource.isInitialized = false;
      mockQueueService.healthCheck.mockResolvedValue(true);

      const result = await controller.getHealth();

      expect(result).toEqual({
        status: 'unhealthy',
        database: { connected: false },
        redis: { connected: true },
      });
    });

    it('should return unhealthy status when redis is disconnected', async () => {
      mockDataSource.isInitialized = true;
      mockQueueService.healthCheck.mockResolvedValue(false);

      const result = await controller.getHealth();

      expect(result).toEqual({
        status: 'unhealthy',
        database: { connected: true },
        redis: { connected: false },
      });
    });

    it('should return unhealthy status when both are disconnected', async () => {
      mockDataSource.isInitialized = false;
      mockQueueService.healthCheck.mockResolvedValue(false);

      const result = await controller.getHealth();

      expect(result).toEqual({
        status: 'unhealthy',
        database: { connected: false },
        redis: { connected: false },
      });
    });

    it('should handle redis health check errors gracefully', async () => {
      mockDataSource.isInitialized = true;
      mockQueueService.healthCheck.mockRejectedValue(new Error('Redis connection failed'));

      const result = await controller.getHealth();

      expect(result).toEqual({
        status: 'unhealthy',
        database: { connected: true },
        redis: { connected: false },
      });
    });
  });
});