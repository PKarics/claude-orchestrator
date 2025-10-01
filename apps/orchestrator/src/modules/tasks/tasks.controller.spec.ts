import { Test, TestingModule } from '@nestjs/testing';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { QueueService } from '../queue/queue.service';
import { TaskEntity } from './entities/task.entity';
import { TaskStatus } from '@claude-orchestrator/shared';
import { CreateTaskDto, QueryTaskDto } from '@claude-orchestrator/shared';

describe('TasksController', () => {
  let controller: TasksController;
  let service: TasksService;
  let queueService: QueueService;

  const mockTasksService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    getStatistics: jest.fn(),
    remove: jest.fn(),
  };

  const mockQueueService = {
    addTask: jest.fn(),
    getQueueStats: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        {
          provide: TasksService,
          useValue: mockTasksService,
        },
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
      ],
    }).compile();

    controller = module.get<TasksController>(TasksController);
    service = module.get<TasksService>(TasksService);
    queueService = module.get<QueueService>(QueueService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new task and queue it', async () => {
      const createTaskDto: CreateTaskDto = {
        code: 'console.log("test")',
        prompt: 'test prompt',
      };

      const expectedTask = {
        id: '123',
        code: createTaskDto.code,
        prompt: createTaskDto.prompt,
        timeout: 300,
        status: TaskStatus.QUEUED,
        createdAt: new Date(),
      } as TaskEntity;

      mockTasksService.create.mockResolvedValue(expectedTask);
      mockQueueService.addTask.mockResolvedValue(undefined);

      const result = await controller.create(createTaskDto);

      expect(service.create).toHaveBeenCalledWith(createTaskDto);
      expect(queueService.addTask).toHaveBeenCalledWith('123', {
        taskId: '123',
        code: 'console.log("test")',
        prompt: 'test prompt',
        timeout: 300,
      });
      expect(result).toEqual({
        id: '123',
        status: TaskStatus.QUEUED,
        createdAt: expectedTask.createdAt,
      });
    });

    it('should create a task with custom timeout', async () => {
      const createTaskDto: CreateTaskDto = {
        code: 'console.log("test")',
        prompt: 'test prompt',
        timeout: 600,
      };

      const expectedTask = {
        id: '123',
        code: createTaskDto.code,
        prompt: createTaskDto.prompt,
        timeout: 600,
        status: TaskStatus.QUEUED,
        createdAt: new Date(),
      } as TaskEntity;

      mockTasksService.create.mockResolvedValue(expectedTask);
      mockQueueService.addTask.mockResolvedValue(undefined);

      const result = await controller.create(createTaskDto);

      expect(queueService.addTask).toHaveBeenCalledWith('123', {
        taskId: '123',
        code: 'console.log("test")',
        prompt: 'test prompt',
        timeout: 600,
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated tasks', async () => {
      const query: QueryTaskDto = {
        page: 1,
        limit: 10,
      };

      const expectedResult = {
        tasks: [
          { id: '1', status: TaskStatus.QUEUED } as TaskEntity,
          { id: '2', status: TaskStatus.RUNNING } as TaskEntity,
        ],
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      };

      mockTasksService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });

    it('should filter by status', async () => {
      const query: QueryTaskDto = {
        status: TaskStatus.QUEUED,
        page: 1,
        limit: 10,
      };

      const expectedResult = {
        tasks: [{ id: '1', status: TaskStatus.QUEUED } as TaskEntity],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      };

      mockTasksService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });

    it('should use default pagination values', async () => {
      const query: QueryTaskDto = {};

      const expectedResult = {
        tasks: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      };

      mockTasksService.findAll.mockResolvedValue(expectedResult);

      await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne', () => {
    it('should return a task by id', async () => {
      const task = {
        id: '123',
        status: TaskStatus.QUEUED,
        code: 'test code',
        prompt: 'test prompt',
      } as TaskEntity;

      mockTasksService.findOne.mockResolvedValue(task);

      const result = await controller.findOne('123');

      expect(service.findOne).toHaveBeenCalledWith('123');
      expect(result).toEqual(task);
    });
  });

  describe('getStats', () => {
    it('should return task and queue statistics', async () => {
      const expectedDbStats = {
        total: 100,
        byStatus: {
          queued: 20,
          running: 5,
          completed: 70,
          failed: 5,
        },
      };

      const expectedQueueStats = {
        waiting: 15,
        active: 5,
        completed: 80,
        failed: 0,
      };

      mockTasksService.getStatistics.mockResolvedValue(expectedDbStats);
      mockQueueService.getQueueStats.mockResolvedValue(expectedQueueStats);

      const result = await controller.getStats();

      expect(service.getStatistics).toHaveBeenCalled();
      expect(queueService.getQueueStats).toHaveBeenCalled();
      expect(result).toEqual({
        database: expectedDbStats,
        queue: expectedQueueStats,
      });
    });

    it('should return empty statistics', async () => {
      const expectedDbStats = {
        total: 0,
        byStatus: {
          queued: 0,
          running: 0,
          completed: 0,
          failed: 0,
        },
      };

      const expectedQueueStats = {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
      };

      mockTasksService.getStatistics.mockResolvedValue(expectedDbStats);
      mockQueueService.getQueueStats.mockResolvedValue(expectedQueueStats);

      const result = await controller.getStats();

      expect(result).toEqual({
        database: expectedDbStats,
        queue: expectedQueueStats,
      });
    });
  });

  describe('remove', () => {
    it('should delete a task', async () => {
      mockTasksService.remove.mockResolvedValue(undefined);

      await controller.remove('123');

      expect(service.remove).toHaveBeenCalledWith('123');
    });

    it('should handle deletion of multiple tasks', async () => {
      mockTasksService.remove.mockResolvedValue(undefined);

      await controller.remove('123');
      await controller.remove('456');

      expect(service.remove).toHaveBeenCalledTimes(2);
      expect(service.remove).toHaveBeenNthCalledWith(1, '123');
      expect(service.remove).toHaveBeenNthCalledWith(2, '456');
    });
  });
});