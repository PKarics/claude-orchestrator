import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { QueueService } from '../queue/queue.service';
import { CreateTaskDto, QueryTaskDto } from '@shared/types';

@Controller('tasks')
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly queueService: QueueService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async create(@Body() dto: CreateTaskDto) {
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

  @Get()
  findAll(@Query() query: QueryTaskDto) {
    return this.tasksService.findAll(query);
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

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.findOne(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.tasksService.remove(id);
  }
}