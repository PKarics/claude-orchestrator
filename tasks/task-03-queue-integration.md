# AAI-003: Integrate BullMQ Queue System

**Type:** Task
**Priority:** High
**Story Points:** 5
**Sprint:** Core Infrastructure
**Dependencies:** AAI-002

## Description

Integrate BullMQ with Redis for task queuing. When tasks are created via API, they should be added to the queue. Implement result processing worker to update database when workers complete tasks.

## Acceptance Criteria

- [ ] BullMQ configured with Redis connection
- [ ] Tasks automatically added to queue on creation
- [ ] Result queue processes worker responses
- [ ] Queue statistics available via API
- [ ] Task status updates when picked up by worker
- [ ] Failed jobs retry with exponential backoff
- [ ] Queue cleanup removes old completed jobs
- [ ] Health endpoint includes Redis connection status

## Technical Specification

### Queue Structure

- **Task Queue**: `claude-tasks` - Jobs waiting for workers
- **Result Queue**: `claude-tasks-results` - Completed job results
- **Job Data**: TaskId, code, prompt, timeout
- **Result Data**: TaskId, workerId, status, result, executionTime

### Queue Configuration

```typescript
{
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000
  },
  removeOnComplete: {
    age: 3600,
    count: 1000
  }
}
```

## Implementation

### 1. Install Dependencies

```bash
cd apps/orchestrator
pnpm add bullmq ioredis
pnpm add -D @types/ioredis
```

### 2. Create Redis Configuration

`src/config/redis.config.ts`:
```typescript
export const getRedisConfig = (configService: ConfigService) => ({
  connection: {
    host: configService.get('REDIS_HOST', 'localhost'),
    port: configService.get('REDIS_PORT', 6379),
    password: configService.get('REDIS_PASSWORD'),
    maxRetriesPerRequest: null,
  },
});
```

### 3. Create QueueService

`src/modules/queue/queue.service.ts`:
```typescript
@Injectable()
export class QueueService implements OnModuleInit {
  private taskQueue: Queue<QueueJobData>;
  private resultWorker: Worker<QueueJobResult>;

  constructor(
    private configService: ConfigService,
    private tasksService: TasksService,
  ) {}

  async onModuleInit() {
    const queueName = this.configService.get('QUEUE_NAME', 'claude-tasks');
    const config = getQueueConfig(this.configService);

    // Initialize task queue
    this.taskQueue = new Queue(queueName, config);

    // Initialize result worker
    this.resultWorker = new Worker(
      `${queueName}-results`,
      async (job) => await this.processResult(job.data),
      config,
    );
  }

  async addTask(taskId: string, data: QueueJobData) {
    await this.taskQueue.add('execute-task', data, { jobId: taskId });
  }

  private async processResult(result: QueueJobResult) {
    await this.tasksService.update(result.taskId, {
      status: result.status === 'completed' ? TaskStatus.COMPLETED : TaskStatus.FAILED,
      workerId: result.workerId,
      result: result.result,
      errorMessage: result.errorMessage,
    });
  }

  async getQueueStats() {
    return {
      waiting: await this.taskQueue.getWaitingCount(),
      active: await this.taskQueue.getActiveCount(),
      completed: await this.taskQueue.getCompletedCount(),
      failed: await this.taskQueue.getFailedCount(),
    };
  }
}
```

### 4. Update TasksController

Modify create endpoint to queue tasks:

```typescript
@Post()
async create(@Body() dto: CreateTaskDto) {
  const task = await this.tasksService.create(dto);

  await this.queueService.addTask(task.id, {
    taskId: task.id,
    code: task.code,
    prompt: task.prompt,
    timeout: task.timeout,
  });

  return { id: task.id, status: task.status, createdAt: task.createdAt };
}
```

### 5. Update Stats Endpoint

```typescript
@Get('stats')
async getStats() {
  const [dbStats, queueStats] = await Promise.all([
    this.tasksService.getStatistics(),
    this.queueService.getQueueStats(),
  ]);

  return { database: dbStats, queue: queueStats };
}
```

### 6. Update Health Check

```typescript
@Get('health')
async getHealth() {
  let redisConnected = false;
  try {
    await this.queueService.getQueueStats();
    redisConnected = true;
  } catch (error) {
    redisConnected = false;
  }

  return {
    status: redisConnected ? 'healthy' : 'unhealthy',
    database: { connected: this.dataSource.isInitialized },
    redis: { connected: redisConnected },
  };
}
```

## Testing

```bash
# Start Redis
docker compose up redis -d

# Start orchestrator
pnpm dev

# Verify Redis connection
curl http://localhost:3000/health

# Create task (should be queued)
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"code":"console.log(1)","prompt":"test"}'

# Check queue stats
curl http://localhost:3000/tasks/stats

# Verify task in Redis
redis-cli -a $REDIS_PASSWORD LLEN claude-tasks
```

## Subtasks

- [ ] AAI-003-1: Configure Redis connection
- [ ] AAI-003-2: Create QueueService with BullMQ
- [ ] AAI-003-3: Implement task queuing on creation
- [ ] AAI-003-4: Implement result worker
- [ ] AAI-003-5: Update TasksController to use queue
- [ ] AAI-003-6: Add queue stats to API
- [ ] AAI-003-7: Update health check with Redis status

## Definition of Done

- Tasks are queued in Redis on creation
- Queue statistics accessible via API
- Health endpoint shows Redis status
- Result worker processes responses
- All tests pass