# AAI-004: Implement Worker Application

**Type:** Task
**Priority:** High
**Story Points:** 8
**Sprint:** Core Functionality
**Dependencies:** AAI-003

## Description

Implement worker application that connects to BullMQ, polls for tasks, executes code in isolated processes, and reports results. Includes heartbeat mechanism for worker health tracking.

## Acceptance Criteria

- [ ] Worker connects to Redis/BullMQ
- [ ] Worker polls task queue and picks up jobs
- [ ] Code execution runs in child process with timeout
- [ ] Execution results sent to result queue
- [ ] Heartbeat sent every 10 seconds to Redis
- [ ] Worker handles SIGTERM/SIGINT for graceful shutdown
- [ ] Multiple workers can run simultaneously
- [ ] Failed executions reported with error message
- [ ] Worker statistics tracked in Redis

## Technical Specification

### Worker Components

1. **Main Loop**: BullMQ worker polling for jobs
2. **Executor**: Spawns child process to run code
3. **Heartbeat**: Updates Redis key with TTL
4. **Result Reporter**: Sends results to result queue

### Code Execution

- Spawn Node.js child process
- Write code to temp file
- Execute with timeout
- Capture stdout/stderr
- Report exit code

## Implementation

### 1. Create Executor Service

`apps/worker/src/services/executor.service.ts`:
```typescript
import { spawn } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

export class ExecutorService {
  async executeCode(code: string, timeout: number): Promise<TaskResult> {
    const tempFile = join(tmpdir(), `task-${randomUUID()}.js`);

    try {
      writeFileSync(tempFile, code);
      return await this.runProcess(tempFile, timeout);
    } finally {
      try {
        unlinkSync(tempFile);
      } catch {}
    }
  }

  private runProcess(file: string, timeout: number): Promise<TaskResult> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      const child = spawn('node', [file], { timeout: timeout * 1000 });
      const timeoutHandle = setTimeout(() => child.kill('SIGKILL'), timeout * 1000);

      child.stdout.on('data', (data) => (stdout += data.toString()));
      child.stderr.on('data', (data) => (stderr += data.toString()));

      child.on('close', (code) => {
        clearTimeout(timeoutHandle);
        resolve({ stdout, stderr, exitCode: code || 0 });
      });

      child.on('error', reject);
    });
  }
}
```

### 2. Create Heartbeat Service

`apps/worker/src/services/heartbeat.service.ts`:
```typescript
import Redis from 'ioredis';

export class HeartbeatService {
  private interval: NodeJS.Timeout | null = null;

  constructor(
    private redis: Redis,
    private workerId: string,
    private intervalSeconds: number = 10,
  ) {}

  start() {
    this.sendHeartbeat();
    this.interval = setInterval(() => this.sendHeartbeat(), this.intervalSeconds * 1000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  private async sendHeartbeat() {
    const key = `worker:${this.workerId}:heartbeat`;
    await this.redis.setex(key, 30, new Date().toISOString());
  }
}
```

### 3. Create Worker Service

`apps/worker/src/services/worker.service.ts`:
```typescript
import { Worker, Queue } from 'bullmq';
import Redis from 'ioredis';

export class WorkerService {
  private worker: Worker;
  private resultQueue: Queue;
  private heartbeat: HeartbeatService;
  private executor: ExecutorService;

  constructor(
    private workerId: string,
    private redis: Redis,
    private queueName: string,
  ) {
    this.executor = new ExecutorService();
    this.heartbeat = new HeartbeatService(redis, workerId);
  }

  async start() {
    // Initialize result queue
    this.resultQueue = new Queue(`${this.queueName}-results`, {
      connection: this.redis,
    });

    // Initialize worker
    this.worker = new Worker(
      this.queueName,
      async (job) => await this.processJob(job),
      { connection: this.redis, concurrency: 1 },
    );

    // Start heartbeat
    this.heartbeat.start();

    // Handle shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());

    console.log(`Worker ${this.workerId} started`);
  }

  private async processJob(job: Job) {
    const { taskId, code, timeout } = job.data;
    const startTime = Date.now();

    try {
      const result = await this.executor.executeCode(code, timeout);

      await this.resultQueue.add('process-result', {
        taskId,
        workerId: this.workerId,
        status: 'completed',
        result,
        executionTimeMs: Date.now() - startTime,
      });
    } catch (error) {
      await this.resultQueue.add('process-result', {
        taskId,
        workerId: this.workerId,
        status: 'failed',
        errorMessage: error.message,
        executionTimeMs: Date.now() - startTime,
      });
      throw error;
    }
  }

  private async shutdown() {
    console.log('Shutting down...');
    await this.worker.close();
    this.heartbeat.stop();
    await this.redis.quit();
    process.exit(0);
  }
}
```

### 4. Update Main Entry Point

`apps/worker/src/index.ts`:
```typescript
import { Command } from 'commander';
import { config } from 'dotenv';
import { WorkerService } from './services/worker.service';
import { createRedisConnection } from './utils/redis.util';

config({ path: '../../.env' });

const program = new Command();
program
  .option('-i, --id <id>', 'Worker ID', process.env.WORKER_ID || 'worker-1')
  .option('-t, --type <type>', 'Worker type', process.env.WORKER_TYPE || 'local')
  .parse();

const options = program.opts();

async function main() {
  const redis = createRedisConnection();
  await new Promise((resolve) => redis.once('ready', resolve));

  const worker = new WorkerService(
    options.id,
    redis,
    process.env.QUEUE_NAME || 'claude-tasks',
  );

  await worker.start();
}

main().catch(console.error);
```

## Testing

### Start Worker

```bash
# Terminal 1: Start orchestrator + Redis
docker compose up redis -d
cd apps/orchestrator && pnpm dev

# Terminal 2: Start worker
cd apps/worker
pnpm dev

# Terminal 3: Submit task
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"code":"console.log(2+2)","prompt":"math test"}'

# Wait and check result
curl http://localhost:3000/tasks/{task-id}
```

### Test Multiple Workers

```bash
# Start 3 workers in parallel
pnpm dev -- --id worker-1 &
pnpm dev -- --id worker-2 &
pnpm dev -- --id worker-3 &

# Submit 10 tasks
for i in {1..10}; do
  curl -X POST http://localhost:3000/tasks \
    -H "Content-Type: application/json" \
    -d "{\"code\":\"console.log($i)\",\"prompt\":\"task $i\"}"
done

# Check distribution
curl http://localhost:3000/workers
```

## Subtasks

- [ ] AAI-004-1: Create ExecutorService for code execution
- [ ] AAI-004-2: Create HeartbeatService for worker health
- [ ] AAI-004-3: Create WorkerService for job processing
- [ ] AAI-004-4: Implement graceful shutdown
- [ ] AAI-004-5: Add CLI argument parsing
- [ ] AAI-004-6: Test with single worker
- [ ] AAI-004-7: Test with multiple workers
- [ ] AAI-004-8: Test timeout handling
- [ ] AAI-004-9: Test error handling

## Definition of Done

- Worker picks up tasks from queue
- Code executes successfully
- Results saved to database
- Heartbeats visible in Redis
- Multiple workers can run
- Graceful shutdown works
- Timeouts are enforced
- Errors are reported