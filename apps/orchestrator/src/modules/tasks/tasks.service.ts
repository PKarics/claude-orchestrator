import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskEntity } from './entities/task.entity';
import { CreateTaskDto, QueryTaskDto, UpdateTaskDto } from '@shared/types';
import { TaskStatus } from '../../types/task-status.enum';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
  ) {}

  async create(dto: CreateTaskDto): Promise<TaskEntity> {
    const task = this.taskRepository.create({
      ...dto,
      status: TaskStatus.QUEUED,
    });
    return this.taskRepository.save(task);
  }

  async findAll(query: QueryTaskDto) {
    const { status, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.taskRepository.createQueryBuilder('task');

    if (status) {
      queryBuilder.where('task.status = :status', { status });
    }

    queryBuilder
      .orderBy('task.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [tasks, total] = await queryBuilder.getManyAndCount();

    return {
      tasks,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<TaskEntity> {
    const task = await this.taskRepository.findOne({ where: { id } });
    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }
    return task;
  }

  async update(id: string, dto: UpdateTaskDto): Promise<TaskEntity> {
    const task = await this.findOne(id);

    // Update timestamps based on status changes
    if (dto.status) {
      if (dto.status === TaskStatus.RUNNING && !task.startedAt) {
        task.startedAt = new Date();
      } else if (
        (dto.status === TaskStatus.COMPLETED || dto.status === TaskStatus.FAILED) &&
        !task.completedAt
      ) {
        task.completedAt = new Date();
      }
    }

    Object.assign(task, dto);
    return this.taskRepository.save(task);
  }

  async remove(id: string): Promise<void> {
    const task = await this.findOne(id);

    // Only allow deleting completed or failed tasks
    if (task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.FAILED) {
      throw new BadRequestException('Can only delete completed or failed tasks');
    }

    await this.taskRepository.remove(task);
  }

  async getStatistics() {
    const [
      total,
      queued,
      running,
      completed,
      failed,
    ] = await Promise.all([
      this.taskRepository.count(),
      this.taskRepository.count({ where: { status: TaskStatus.QUEUED } }),
      this.taskRepository.count({ where: { status: TaskStatus.RUNNING } }),
      this.taskRepository.count({ where: { status: TaskStatus.COMPLETED } }),
      this.taskRepository.count({ where: { status: TaskStatus.FAILED } }),
    ]);

    return {
      total,
      byStatus: {
        queued,
        running,
        completed,
        failed,
      },
    };
  }
}