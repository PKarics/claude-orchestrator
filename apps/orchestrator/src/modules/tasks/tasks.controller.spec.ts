import { Test, TestingModule } from '@nestjs/testing';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TaskEntity } from './entities/task.entity';
import { TaskStatus } from '../../types/task-status.enum';
import { CreateTaskDto } from './dto/create-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';

describe('TasksController', () => {
  let controller: TasksController;
  let service: TasksService;

  const mockTasksService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    getStatistics: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        {
          provide: TasksService,
          useValue: mockTasksService,
        },
      ],
    }).compile();

    controller = module.get<TasksController>(TasksController);
    service = module.get<TasksService>(TasksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new task', async () => {
      const createTaskDto: CreateTaskDto = {
        code: 'console.log("test")',
        prompt: 'test prompt',
      };

      const expectedTask = {
        id: '123',
        ...createTaskDto,
        status: TaskStatus.QUEUED,
        createdAt: new Date(),
      } as TaskEntity;

      mockTasksService.create.mockResolvedValue(expectedTask);

      const result = await controller.create(createTaskDto);

      expect(service.create).toHaveBeenCalledWith(createTaskDto);
      expect(result).toEqual(expectedTask);
    });

    it('should create a task with custom timeout', async () => {
      const createTaskDto: CreateTaskDto = {
        code: 'console.log("test")',
        prompt: 'test prompt',
        timeout: 600,
      };

      const expectedTask = {
        id: '123',
        ...createTaskDto,
        status: TaskStatus.QUEUED,
        createdAt: new Date(),
      } as TaskEntity;

      mockTasksService.create.mockResolvedValue(expectedTask);

      const result = await controller.create(createTaskDto);

      expect(result.timeout).toBe(600);
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
    it('should return task statistics', async () => {
      const expectedStats = {
        total: 100,
        byStatus: {
          queued: 20,
          running: 5,
          completed: 70,
          failed: 5,
        },
      };

      mockTasksService.getStatistics.mockResolvedValue(expectedStats);

      const result = await controller.getStats();

      expect(service.getStatistics).toHaveBeenCalled();
      expect(result).toEqual(expectedStats);
    });

    it('should return empty statistics', async () => {
      const expectedStats = {
        total: 0,
        byStatus: {
          queued: 0,
          running: 0,
          completed: 0,
          failed: 0,
        },
      };

      mockTasksService.getStatistics.mockResolvedValue(expectedStats);

      const result = await controller.getStats();

      expect(result).toEqual(expectedStats);
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