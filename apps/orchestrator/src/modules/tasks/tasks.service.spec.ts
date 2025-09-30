import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TaskEntity } from './entities/task.entity';
import { TaskStatus } from '@shared/types';
import { CreateTaskDto, QueryTaskDto, UpdateTaskDto } from '@shared/types';

describe('TasksService', () => {
  let service: TasksService;
  let repository: Repository<TaskEntity>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
    count: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        {
          provide: getRepositoryToken(TaskEntity),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    repository = module.get<Repository<TaskEntity>>(getRepositoryToken(TaskEntity));
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

      mockRepository.create.mockReturnValue(expectedTask);
      mockRepository.save.mockResolvedValue(expectedTask);

      const result = await service.create(createTaskDto);

      expect(mockRepository.create).toHaveBeenCalledWith({
        ...createTaskDto,
        status: TaskStatus.QUEUED,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(expectedTask);
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

      mockRepository.create.mockReturnValue(expectedTask);
      mockRepository.save.mockResolvedValue(expectedTask);

      const result = await service.create(createTaskDto);

      expect(result.timeout).toBe(600);
    });
  });

  describe('findAll', () => {
    it('should return paginated tasks', async () => {
      const query: QueryTaskDto = {
        page: 1,
        limit: 10,
      };

      const tasks = [
        { id: '1', status: TaskStatus.QUEUED } as TaskEntity,
        { id: '2', status: TaskStatus.RUNNING } as TaskEntity,
      ];

      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([tasks, 2]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.findAll(query);

      expect(result).toEqual({
        tasks,
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
      expect(queryBuilder.orderBy).toHaveBeenCalledWith('task.createdAt', 'DESC');
      expect(queryBuilder.skip).toHaveBeenCalledWith(0);
      expect(queryBuilder.take).toHaveBeenCalledWith(10);
    });

    it('should filter by status', async () => {
      const query: QueryTaskDto = {
        status: TaskStatus.QUEUED,
        page: 1,
        limit: 10,
      };

      const tasks = [{ id: '1', status: TaskStatus.QUEUED } as TaskEntity];

      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([tasks, 1]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      await service.findAll(query);

      expect(queryBuilder.where).toHaveBeenCalledWith('task.status = :status', {
        status: TaskStatus.QUEUED,
      });
    });

    it('should calculate pagination correctly for page 2', async () => {
      const query: QueryTaskDto = {
        page: 2,
        limit: 10,
      };

      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 25]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.findAll(query);

      expect(queryBuilder.skip).toHaveBeenCalledWith(10);
      expect(result.totalPages).toBe(3);
    });
  });

  describe('findOne', () => {
    it('should return a task by id', async () => {
      const task = { id: '123', status: TaskStatus.QUEUED } as TaskEntity;
      mockRepository.findOne.mockResolvedValue(task);

      const result = await service.findOne('123');

      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: '123' } });
      expect(result).toEqual(task);
    });

    it('should throw NotFoundException when task not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        'Task with ID nonexistent not found',
      );
    });
  });

  describe('update', () => {
    it('should update a task', async () => {
      const task = {
        id: '123',
        status: TaskStatus.QUEUED,
        startedAt: null,
        completedAt: null,
      } as TaskEntity;

      const updateDto: UpdateTaskDto = {
        status: TaskStatus.RUNNING,
        workerId: 'worker-1',
      };

      mockRepository.findOne.mockResolvedValue(task);
      mockRepository.save.mockImplementation((t) => Promise.resolve(t));

      const result = await service.update('123', updateDto);

      expect(result.status).toBe(TaskStatus.RUNNING);
      expect(result.workerId).toBe('worker-1');
      expect(result.startedAt).toBeInstanceOf(Date);
    });

    it('should set startedAt when status changes to RUNNING', async () => {
      const task = {
        id: '123',
        status: TaskStatus.QUEUED,
        startedAt: null,
      } as TaskEntity;

      const updateDto: UpdateTaskDto = {
        status: TaskStatus.RUNNING,
      };

      mockRepository.findOne.mockResolvedValue(task);
      mockRepository.save.mockImplementation((t) => Promise.resolve(t));

      await service.update('123', updateDto);

      expect(mockRepository.save).toHaveBeenCalled();
      const savedTask = mockRepository.save.mock.calls[0][0];
      expect(savedTask.startedAt).toBeInstanceOf(Date);
    });

    it('should set completedAt when status changes to COMPLETED', async () => {
      const task = {
        id: '123',
        status: TaskStatus.RUNNING,
        completedAt: null,
      } as TaskEntity;

      const updateDto: UpdateTaskDto = {
        status: TaskStatus.COMPLETED,
        result: 'success',
      };

      mockRepository.findOne.mockResolvedValue(task);
      mockRepository.save.mockImplementation((t) => Promise.resolve(t));

      await service.update('123', updateDto);

      const savedTask = mockRepository.save.mock.calls[0][0];
      expect(savedTask.completedAt).toBeInstanceOf(Date);
    });

    it('should set completedAt when status changes to FAILED', async () => {
      const task = {
        id: '123',
        status: TaskStatus.RUNNING,
        completedAt: null,
      } as TaskEntity;

      const updateDto: UpdateTaskDto = {
        status: TaskStatus.FAILED,
        errorMessage: 'Error occurred',
      };

      mockRepository.findOne.mockResolvedValue(task);
      mockRepository.save.mockImplementation((t) => Promise.resolve(t));

      await service.update('123', updateDto);

      const savedTask = mockRepository.save.mock.calls[0][0];
      expect(savedTask.completedAt).toBeInstanceOf(Date);
    });

    it('should not update timestamps if already set', async () => {
      const startedAt = new Date('2023-01-01');
      const task = {
        id: '123',
        status: TaskStatus.RUNNING,
        startedAt,
      } as TaskEntity;

      const updateDto: UpdateTaskDto = {
        status: TaskStatus.RUNNING,
      };

      mockRepository.findOne.mockResolvedValue(task);
      mockRepository.save.mockImplementation((t) => Promise.resolve(t));

      await service.update('123', updateDto);

      const savedTask = mockRepository.save.mock.calls[0][0];
      expect(savedTask.startedAt).toBe(startedAt);
    });
  });

  describe('remove', () => {
    it('should remove a completed task', async () => {
      const task = { id: '123', status: TaskStatus.COMPLETED } as TaskEntity;
      mockRepository.findOne.mockResolvedValue(task);
      mockRepository.remove.mockResolvedValue(task);

      await service.remove('123');

      expect(mockRepository.remove).toHaveBeenCalledWith(task);
    });

    it('should remove a failed task', async () => {
      const task = { id: '123', status: TaskStatus.FAILED } as TaskEntity;
      mockRepository.findOne.mockResolvedValue(task);
      mockRepository.remove.mockResolvedValue(task);

      await service.remove('123');

      expect(mockRepository.remove).toHaveBeenCalledWith(task);
    });

    it('should throw BadRequestException when trying to delete queued task', async () => {
      const task = { id: '123', status: TaskStatus.QUEUED } as TaskEntity;
      mockRepository.findOne.mockResolvedValue(task);

      await expect(service.remove('123')).rejects.toThrow(BadRequestException);
      await expect(service.remove('123')).rejects.toThrow(
        'Can only delete completed or failed tasks',
      );
    });

    it('should throw BadRequestException when trying to delete running task', async () => {
      const task = { id: '123', status: TaskStatus.RUNNING } as TaskEntity;
      mockRepository.findOne.mockResolvedValue(task);

      await expect(service.remove('123')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getStatistics', () => {
    it('should return task statistics', async () => {
      mockRepository.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(20) // queued
        .mockResolvedValueOnce(5) // running
        .mockResolvedValueOnce(70) // completed
        .mockResolvedValueOnce(5); // failed

      const result = await service.getStatistics();

      expect(result).toEqual({
        total: 100,
        byStatus: {
          queued: 20,
          running: 5,
          completed: 70,
          failed: 5,
        },
      });
      expect(mockRepository.count).toHaveBeenCalledTimes(5);
    });

    it('should return zero statistics when no tasks exist', async () => {
      mockRepository.count.mockResolvedValue(0);

      const result = await service.getStatistics();

      expect(result).toEqual({
        total: 0,
        byStatus: {
          queued: 0,
          running: 0,
          completed: 0,
          failed: 0,
        },
      });
    });
  });
});