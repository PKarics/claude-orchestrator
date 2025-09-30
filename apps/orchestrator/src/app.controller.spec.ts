import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { DataSource } from 'typeorm';

describe('AppController', () => {
  let controller: AppController;
  let dataSource: DataSource;

  const mockDataSource = {
    isInitialized: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    controller = module.get<AppController>(AppController);
    dataSource = module.get<DataSource>(DataSource);
  });

  describe('getHealth', () => {
    it('should return health status with database connected', async () => {
      mockDataSource.isInitialized = true;

      const result = await controller.getHealth();

      expect(result).toEqual({
        status: 'ok',
        database: 'connected',
      });
    });

    it('should return health status with database disconnected', async () => {
      mockDataSource.isInitialized = false;

      const result = await controller.getHealth();

      expect(result).toEqual({
        status: 'ok',
        database: 'disconnected',
      });
    });
  });
});