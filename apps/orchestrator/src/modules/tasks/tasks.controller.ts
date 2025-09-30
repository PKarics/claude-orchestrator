import { Controller, Post, Get, Body, Param, HttpCode, HttpStatus, ParseUUIDPipe, ValidationPipe } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { QueueService } from '../queue/queue.service';
import { CreateTaskDto } from './dto/create-task.dto';

@Controller('tasks')
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly queueService: QueueService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async create(@Body(ValidationPipe) dto: CreateTaskDto) {
    const task = await this.tasksService.create(dto);

    await this.queueService.addTask(task.id, {
      taskId: task.id,
      code: task.code,
      prompt: task.prompt,
      timeout: task.timeout,
    });

    return {
      id: task.id,
      status: task.status,
      createdAt: task.createdAt,
    };
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.findOne(id);
  }

  @Get('stats')
  async getStats() {
    const [dbStats, queueStats] = await Promise.all([
      this.tasksService.getStatistics(),
      this.queueService.getQueueStats(),
    ]);

    return {
      database: dbStats,
      queue: queueStats,
    };
  }
}