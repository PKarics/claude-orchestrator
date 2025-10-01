import { Test, TestingModule } from '@nestjs/testing';
import { WorkersController } from './workers.controller';
import { WorkersService } from './workers.service';

describe('WorkersController', () => {
  let controller: WorkersController;
  let service: WorkersService;

  const mockWorkersService = {
    getWorkers: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkersController],
      providers: [
        {
          provide: WorkersService,
          useValue: mockWorkersService,
        },
      ],
    }).compile();

    controller = module.get<WorkersController>(WorkersController);
    service = module.get<WorkersService>(WorkersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getWorkers', () => {
    it('should return list of workers', async () => {
      const mockWorkers = [
        {
          id: 'worker-1',
          type: 'local',
          status: 'active' as const,
          lastHeartbeat: '2025-10-01T12:00:00Z',
        },
        {
          id: 'worker-2',
          type: 'cloud',
          status: 'idle' as const,
          lastHeartbeat: '2025-10-01T12:00:10Z',
        },
      ];

      mockWorkersService.getWorkers.mockResolvedValue(mockWorkers);

      const result = await controller.getWorkers();

      expect(service.getWorkers).toHaveBeenCalled();
      expect(result).toEqual({ workers: mockWorkers });
    });

    it('should return empty array when no workers are active', async () => {
      mockWorkersService.getWorkers.mockResolvedValue([]);

      const result = await controller.getWorkers();

      expect(result).toEqual({ workers: [] });
    });
  });
});
