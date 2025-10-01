import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WorkersService } from './workers.service';

describe('WorkersService', () => {
  let service: WorkersService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config: Record<string, any> = {
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
      };
      return config[key] ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkersService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<WorkersService>(WorkersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getWorkers', () => {
    it('should return empty array when no workers exist', async () => {
      // Mock Redis to return empty keys
      const mockRedis = service['redis'];
      jest.spyOn(mockRedis, 'keys').mockResolvedValue([]);

      const result = await service.getWorkers();

      expect(result).toEqual([]);
    });

    it('should filter out stale workers (30+ seconds old)', async () => {
      const mockRedis = service['redis'];
      const now = new Date();
      const staleHeartbeat = new Date(now.getTime() - 40000).toISOString(); // 40 seconds ago

      jest.spyOn(mockRedis, 'keys').mockResolvedValue(['worker:stale-worker:heartbeat']);
      jest.spyOn(mockRedis, 'get').mockResolvedValue(staleHeartbeat);

      const result = await service.getWorkers();

      expect(result).toEqual([]);
    });

    it('should return active workers (< 15 seconds)', async () => {
      const mockRedis = service['redis'];
      const now = new Date();
      const recentHeartbeat = new Date(now.getTime() - 5000).toISOString(); // 5 seconds ago

      jest.spyOn(mockRedis, 'keys').mockResolvedValue(['worker:active-worker:heartbeat']);
      jest.spyOn(mockRedis, 'get').mockResolvedValue(recentHeartbeat);

      const result = await service.getWorkers();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'active-worker',
        type: 'local',
        status: 'active',
        lastHeartbeat: recentHeartbeat,
      });
    });

    it('should return idle workers (15-30 seconds)', async () => {
      const mockRedis = service['redis'];
      const now = new Date();
      const idleHeartbeat = new Date(now.getTime() - 20000).toISOString(); // 20 seconds ago

      jest.spyOn(mockRedis, 'keys').mockResolvedValue(['worker:idle-worker:heartbeat']);
      jest.spyOn(mockRedis, 'get').mockResolvedValue(idleHeartbeat);

      const result = await service.getWorkers();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'idle-worker',
        status: 'idle',
      });
    });

    it('should identify cloud workers correctly', async () => {
      const mockRedis = service['redis'];
      const now = new Date();
      const recentHeartbeat = new Date(now.getTime() - 5000).toISOString();

      jest.spyOn(mockRedis, 'keys').mockResolvedValue(['worker:cloud-worker-123:heartbeat']);
      jest.spyOn(mockRedis, 'get').mockResolvedValue(recentHeartbeat);

      const result = await service.getWorkers();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'cloud-worker-123',
        type: 'cloud',
        status: 'active',
      });
    });
  });
});
