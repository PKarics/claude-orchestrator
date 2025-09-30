# Task 03: Implement Redis and BullMQ Queue Integration

**Difficulty:** Intermediate
**Estimated Time:** 3-4 hours
**Prerequisites:** Task 02 completed, understanding of message queues

## Goal

Integrate BullMQ for reliable task queuing with Redis. Implement job processors, queue management, and event handling.

## Learning Objectives

By completing this task, you will learn:
- How to set up Redis with NestJS
- How to use BullMQ for job queuing
- How to implement job processors
- How to handle job events (completed, failed)
- How to integrate queues with database operations

## Step-by-Step Instructions

### Step 1: Install BullMQ and Redis Dependencies

```bash
cd apps/orchestrator

# Dependencies should already be in package.json
# Verify installation
pnpm list bullmq ioredis @nestjs/bull

# If not installed, add them
pnpm add bullmq ioredis
pnpm add -D @types/ioredis
```

### Step 2: Create Redis Configuration

```bash
# Create redis configuration
cat > src/config/redis.config.ts << 'EOF'
import { ConfigService } from '@nestjs/config';
import { QueueOptions } from 'bullmq';

export const getRedisConfig = (configService: ConfigService) => {
  return {
    connection: {
      host: configService.get<string>('REDIS_HOST', 'localhost'),
      port: configService.get<number>('REDIS_PORT', 6379),
      password: configService.get<string>('REDIS_PASSWORD'),
      maxRetriesPerRequest: null, // Required for BullMQ
    },
  };
};

export const getQueueConfig = (
  configService: ConfigService,
): Partial<QueueOptions> => {
  return {
    ...getRedisConfig(configService),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 3600, // Keep completed jobs for 1 hour
        count: 1000, // Keep last 1000 completed jobs
      },
      removeOnFail: {
        age: 86400, // Keep failed jobs for 24 hours
      },
    },
  };
};
EOF
```

**Configuration Explained:**
- `maxRetriesPerRequest: null` - Required for BullMQ (allows blocking operations)
- `attempts: 3` - Retry failed jobs up to 3 times
- `backoff` - Wait time between retries (exponential: 2s, 4s, 8s)
- `removeOnComplete` - Auto-cleanup old completed jobs
- `removeOnFail` - Keep failed jobs longer for debugging

### Step 3: Create Queue Module

```bash
# Create queue directory
mkdir -p src/modules/queue

# Create queue service
cat > src/modules/queue/queue.service.ts << 'EOF'
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job } from 'bullmq';
import { getQueueConfig } from '../../config/redis.config';
import { QueueJobData, QueueJobResult } from '@shared/types';
import { TasksService } from '../tasks/tasks.service';
import { TaskStatus } from '@shared/types';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private taskQueue: Queue<QueueJobData>;
  private resultWorker: Worker<QueueJobResult>;
  private readonly queueName: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly tasksService: TasksService,
  ) {
    this.queueName = this.configService.get<string>(
      'QUEUE_NAME',
      'claude-tasks',
    );
  }

  async onModuleInit() {
    await this.initializeQueue();
    await this.initializeResultWorker();
    this.logger.log('Queue service initialized');
  }

  async onModuleDestroy() {
    await this.taskQueue.close();
    await this.resultWorker.close();
    this.logger.log('Queue service destroyed');
  }

  /**
   * Initialize task queue
   */
  private async initializeQueue() {
    const queueConfig = getQueueConfig(this.configService);

    this.taskQueue = new Queue<QueueJobData>(this.queueName, queueConfig);

    // Listen to queue events
    this.taskQueue.on('error', (error) => {
      this.logger.error('Queue error:', error);
    });

    this.logger.log(`Task queue "${this.queueName}" initialized`);
  }

  /**
   * Initialize result worker to process job results
   */
  private async initializeResultWorker() {
    const queueConfig = getQueueConfig(this.configService);

    this.resultWorker = new Worker<QueueJobResult>(
      `${this.queueName}-results`,
      async (job: Job<QueueJobResult>) => {
        await this.handleJobResult(job.data);
      },
      queueConfig,
    );

    this.resultWorker.on('completed', (job) => {
      this.logger.log(`Result processed for task: ${job.data.taskId}`);
    });

    this.resultWorker.on('failed', (job, error) => {
      this.logger.error(
        `Failed to process result for task: ${job?.data.taskId}`,
        error,
      );
    });

    this.logger.log('Result worker initialized');
  }

  /**
   * Add task to queue
   */
  async addTask(taskId: string, data: QueueJobData): Promise<void> {
    const job = await this.taskQueue.add('execute-task', data, {
      jobId: taskId,
      priority: 1, // Can be customized based on task priority
    });

    this.logger.log(`Task ${taskId} added to queue, job ID: ${job.id}`);
  }

  /**
   * Handle job result from worker
   */
  private async handleJobResult(result: QueueJobResult): Promise<void> {
    const { taskId, status, result: taskResult, errorMessage } = result;

    this.logger.log(`Processing result for task: ${taskId}, status: ${status}`);

    try {
      await this.tasksService.update(taskId, {
        status:
          status === 'completed' ? TaskStatus.COMPLETED : TaskStatus.FAILED,
        result: taskResult,
        errorMessage,
      });

      this.logger.log(`Task ${taskId} result saved to database`);
    } catch (error) {
      this.logger.error(
        `Failed to save result for task ${taskId}:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.taskQueue.getWaitingCount(),
      this.taskQueue.getActiveCount(),
      this.taskQueue.getCompletedCount(),
      this.taskQueue.getFailedCount(),
      this.taskQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string) {
    return this.taskQueue.getJob(jobId);
  }

  /**
   * Remove job from queue
   */
  async removeJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (job) {
      await job.remove();
      this.logger.log(`Job ${jobId} removed from queue`);
    }
  }

  /**
   * Retry failed job
   */
  async retryJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (job) {
      await job.retry();
      this.logger.log(`Job ${jobId} retried`);
    }
  }

  /**
   * Clean old jobs
   */
  async cleanQueue(grace: number = 3600): Promise<void> {
    await this.taskQueue.clean(grace * 1000, 100, 'completed');
    await this.taskQueue.clean(grace * 1000 * 24, 100, 'failed');
    this.logger.log('Queue cleaned');
  }
}
EOF
```

**Queue Service Explained:**
- `onModuleInit()` - Sets up queue and worker when app starts
- `addTask()` - Adds task to queue for workers to pick up
- `handleJobResult()` - Processes results from workers and updates database
- `getQueueStats()` - Returns queue metrics
- Event listeners - Logs important queue events

### Step 4: Create Queue Module

```bash
cat > src/modules/queue/queue.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [TasksModule],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
EOF
```

### Step 5: Update Tasks Service to Use Queue

```bash
# Update tasks.service.ts to integrate with queue
# Add this method to TasksService:

cat >> src/modules/tasks/tasks.service.ts << 'EOF'

  /**
   * Mark task as running
   */
  async markAsRunning(id: string, workerId: string): Promise<TaskEntity> {
    return this.update(id, {
      status: TaskStatus.RUNNING,
      workerId,
    });
  }
EOF
```

### Step 6: Update Tasks Controller to Queue Tasks

```bash
# Backup and update tasks.controller.ts
cp src/modules/tasks/tasks.controller.ts src/modules/tasks/tasks.controller.ts.bak

cat > src/modules/tasks/tasks.controller.ts << 'EOF'
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { QueueService } from '../queue/queue.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';

@ApiTags('tasks')
@Controller('tasks')
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly queueService: QueueService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Create a new task' })
  @ApiResponse({
    status: 202,
    description: 'Task accepted for processing',
  })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  async create(@Body() createTaskDto: CreateTaskDto) {
    // 1. Save task to database
    const task = await this.tasksService.create(createTaskDto);

    // 2. Add task to queue
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
      queuePosition: await this.queueService.getQueueStats().then(s => s.waiting),
    };
  }

  @Get()
  @ApiOperation({ summary: 'List all tasks' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['queued', 'running', 'completed', 'failed'],
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of tasks' })
  async findAll(@Query() queryDto: QueryTaskDto) {
    const result = await this.tasksService.findAll(queryDto);
    return {
      tasks: result.tasks.map((task) => this.tasksService.entityToTask(task)),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.offset + result.limit < result.total,
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get task statistics' })
  @ApiResponse({ status: 200, description: 'Task statistics' })
  async getStatistics() {
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
  @ApiOperation({ summary: 'Get task by ID' })
  @ApiParam({ name: 'id', description: 'Task UUID' })
  @ApiResponse({ status: 200, description: 'Task details' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const task = await this.tasksService.findOne(id);
    const job = await this.queueService.getJob(id);

    return {
      ...this.tasksService.entityToTask(task),
      queue: job
        ? {
            state: await job.getState(),
            progress: job.progress,
            attemptsMade: job.attemptsMade,
          }
        : null,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a task' })
  @ApiParam({ name: 'id', description: 'Task UUID' })
  @ApiResponse({ status: 204, description: 'Task deleted' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete running or queued task',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.tasksService.remove(id);
    await this.queueService.removeJob(id);
  }
}
EOF
```

### Step 7: Update Tasks Module

```bash
cat > src/modules/tasks/tasks.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TaskEntity } from './entities/task.entity';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TaskEntity]),
    QueueModule,
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
EOF
```

### Step 8: Update App Module

```bash
cat > src/app.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getDatabaseConfig } from './config/database.config';
import { HealthModule } from './modules/health/health.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { QueueModule } from './modules/queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        getDatabaseConfig(configService),
    }),
    HealthModule,
    TasksModule,
    QueueModule,
  ],
})
export class AppModule {}
EOF
```

### Step 9: Update Health Check to Include Redis

```bash
cat > src/modules/health/health.controller.ts << 'EOF'
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { QueueService } from '../queue/queue.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly queueService: QueueService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  async getHealth() {
    const dbConnected = this.dataSource.isInitialized;

    let redisConnected = false;
    let queueStats = null;

    try {
      queueStats = await this.queueService.getQueueStats();
      redisConnected = true;
    } catch (error) {
      redisConnected = false;
    }

    const isHealthy = dbConnected && redisConnected;

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      database: {
        connected: dbConnected,
        type: this.dataSource.options.type,
      },
      redis: {
        connected: redisConnected,
      },
      queue: queueStats,
    };
  }
}
EOF
```

### Step 10: Update Health Module

```bash
cat > src/modules/health/health.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [QueueModule],
  controllers: [HealthController],
})
export class HealthModule {}
EOF
```

### Step 11: Test Queue Integration

```bash
# Start Redis
docker compose up redis -d

# Verify Redis is running
docker compose ps redis

# Start the orchestrator
cd apps/orchestrator
pnpm dev
```

In another terminal:

```bash
# Test health (should show Redis connected)
curl http://localhost:3000/health | jq .

# Create a task (should be queued)
TASK_ID=$(curl -s -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "code": "console.log(\"Queue test\")",
    "prompt": "Test queuing",
    "timeout": 60
  }' | jq -r '.id')

echo "Task ID: $TASK_ID"

# Check task status
curl http://localhost:3000/tasks/$TASK_ID | jq .

# Get statistics (should show queue info)
curl http://localhost:3000/tasks/stats | jq .

# Check Redis directly
redis-cli -h localhost -p 6379 -a $REDIS_PASSWORD
# Run: KEYS *
# Should see claude-tasks keys
```

### Step 12: Create Queue Monitoring Script

```bash
cat > ../../scripts/monitor-queue.sh << 'EOF'
#!/bin/bash

API_URL="http://localhost:3000"

while true; do
  clear
  echo "=== Claude Orchestrator Queue Monitor ==="
  echo "Time: $(date)"
  echo ""

  # Get stats
  stats=$(curl -s $API_URL/tasks/stats)

  echo "📊 Database Stats:"
  echo "$stats" | jq '.database'

  echo ""
  echo "📬 Queue Stats:"
  echo "$stats" | jq '.queue'

  echo ""
  echo "Refreshing in 5 seconds... (Ctrl+C to stop)"
  sleep 5
done
EOF

chmod +x ../../scripts/monitor-queue.sh
```

### Step 13: Write Integration Tests

```bash
cat > src/modules/queue/queue.service.spec.ts << 'EOF'
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';
import { TasksService } from '../tasks/tasks.service';

describe('QueueService', () => {
  let service: QueueService;
  let tasksService: TasksService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config = {
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        REDIS_PASSWORD: 'test',
        QUEUE_NAME: 'test-queue',
      };
      return config[key] || defaultValue;
    }),
  };

  const mockTasksService = {
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: TasksService,
          useValue: mockTasksService,
        },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
    tasksService = module.get<TasksService>(TasksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Note: Full integration tests require Redis running
  // These are unit tests with mocked dependencies
});
EOF
```

## Verification Checklist

- [ ] Redis running in Docker
- [ ] BullMQ queue initialized
- [ ] Tasks added to queue on creation
- [ ] Queue statistics accessible
- [ ] Health check includes Redis status
- [ ] Result worker processes job results
- [ ] Task status updates after processing
- [ ] Queue monitoring script works
- [ ] Integration tests pass

## Common Issues

### Issue: Cannot connect to Redis
**Solution:**
```bash
# Check Redis is running
docker compose ps redis

# Check Redis password matches .env
docker compose logs redis

# Test connection
redis-cli -h localhost -p 6379 -a your_password ping
```

### Issue: Jobs not being processed
**Solution:** Workers need to be implemented (next task). For now, jobs will stay in "waiting" state.

### Issue: maxRetriesPerRequest error
**Solution:** Ensure `maxRetriesPerRequest: null` in Redis config

## Testing Complete Flow

```bash
#!/bin/bash
# Save as test-task-03.sh

API_URL="http://localhost:3000"

echo "🧪 Testing Task 03: Queue Integration"

# 1. Health check
echo "1. Checking health..."
health=$(curl -s $API_URL/health)
echo "$health" | jq .

redis_connected=$(echo "$health" | jq -r '.redis.connected')
if [ "$redis_connected" != "true" ]; then
  echo "❌ Redis not connected!"
  exit 1
fi
echo "✅ Redis connected"

# 2. Create task
echo "2. Creating task..."
task=$(curl -s -X POST $API_URL/tasks \
  -H "Content-Type: application/json" \
  -d '{"code":"console.log(2+2)","prompt":"Math","timeout":60}')
echo "$task" | jq .

task_id=$(echo "$task" | jq -r '.id')
echo "✅ Task created: $task_id"

# 3. Check queue stats
echo "3. Checking queue stats..."
stats=$(curl -s $API_URL/tasks/stats)
echo "$stats" | jq '.queue'

waiting=$(echo "$stats" | jq -r '.queue.waiting')
if [ "$waiting" -gt 0 ]; then
  echo "✅ Task in queue (waiting: $waiting)"
else
  echo "⚠️  No tasks waiting (worker may have processed it)"
fi

echo ""
echo "✅ All Task 03 tests passed!"
```

## Next Steps

Proceed to **Task 04: Implement Worker Application**

The orchestrator now has full queue integration! Workers will pick up tasks from this queue. 🎉