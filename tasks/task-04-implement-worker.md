# Task 04: Implement Worker Application

**Difficulty:** Intermediate
**Estimated Time:** 4-5 hours
**Prerequisites:** Task 03 completed, understanding of child processes and async operations

## Goal

Implement the worker application that polls the BullMQ queue, executes tasks, sends heartbeats, and reports results back to the orchestrator.

## Learning Objectives

By completing this task, you will learn:
- How to implement a BullMQ worker
- How to execute code safely using child processes
- How to implement heartbeat mechanisms
- How to handle task timeouts
- How to report results back through queues

## Step-by-Step Instructions

### Step 1: Set Up Worker Package Structure

```bash
cd apps/worker

# Verify dependencies are installed
pnpm install

# Create source structure
mkdir -p src/{services,utils}
```

### Step 2: Create Redis Client Utility

```bash
cat > src/utils/redis.util.ts << 'EOF'
import Redis from 'ioredis';
import { config } from 'dotenv';

config({ path: '../../.env' });

export function createRedisConnection(): Redis {
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  redis.on('connect', () => {
    console.log('✅ Connected to Redis');
  });

  redis.on('error', (error) => {
    console.error('❌ Redis connection error:', error.message);
  });

  return redis;
}
EOF
```

### Step 3: Create Task Executor

```bash
cat > src/services/executor.service.ts << 'EOF'
import { spawn } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { TaskResult } from '@shared/types';

export class ExecutorService {
  /**
   * Execute code in a separate Node.js process
   */
  async executeCode(code: string, timeout: number): Promise<TaskResult> {
    const tempFile = join(tmpdir(), `task-${randomUUID()}.js`);

    try {
      // Write code to temporary file
      writeFileSync(tempFile, code);

      // Execute in separate process
      const result = await this.runProcess(tempFile, timeout);

      return result;
    } finally {
      // Clean up temp file
      try {
        unlinkSync(tempFile);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Run Node.js process with timeout
   */
  private runProcess(file: string, timeout: number): Promise<TaskResult> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';
      let killed = false;

      // Spawn Node.js process
      const child = spawn('node', [file], {
        timeout: timeout * 1000,
        killSignal: 'SIGTERM',
      });

      // Set timeout
      const timeoutHandle = setTimeout(() => {
        killed = true;
        child.kill('SIGKILL');
      }, timeout * 1000);

      // Collect stdout
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      // Collect stderr
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle process completion
      child.on('close', (code) => {
        clearTimeout(timeoutHandle);

        const executionTime = Date.now() - startTime;

        if (killed) {
          reject(
            new Error(
              `Task execution exceeded timeout of ${timeout} seconds`,
            ),
          );
        } else {
          resolve({
            stdout,
            stderr,
            exitCode: code || 0,
          });
        }
      });

      // Handle process errors
      child.on('error', (error) => {
        clearTimeout(timeoutHandle);
        reject(error);
      });
    });
  }

  /**
   * Validate code before execution (basic safety checks)
   */
  validateCode(code: string): { valid: boolean; reason?: string } {
    // Check for obviously dangerous patterns
    const dangerousPatterns = [
      /require\s*\(\s*['"]child_process['"]\s*\)/, // Prevent spawning processes
      /require\s*\(\s*['"]fs['"]\s*\)/, // Prevent file system access (optional)
      /process\.exit/, // Prevent killing the worker
      /while\s*\(\s*true\s*\)/, // Prevent infinite loops
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        return {
          valid: false,
          reason: `Code contains dangerous pattern: ${pattern}`,
        };
      }
    }

    return { valid: true };
  }
}
EOF
```

**Executor Explained:**
- `executeCode()` - Writes code to temp file and executes it
- `runProcess()` - Spawns Node.js child process with timeout
- `validateCode()` - Basic security checks (can be expanded)
- Uses temp files to avoid eval() security issues
- Kills process if it exceeds timeout

### Step 4: Create Heartbeat Service

```bash
cat > src/services/heartbeat.service.ts << 'EOF'
import Redis from 'ioredis';

export class HeartbeatService {
  private interval: NodeJS.Timeout | null = null;
  private readonly ttl = 30; // 30 seconds TTL

  constructor(
    private readonly redis: Redis,
    private readonly workerId: string,
    private readonly intervalSeconds: number = 10,
  ) {}

  /**
   * Start sending heartbeats
   */
  start(): void {
    if (this.interval) {
      return; // Already started
    }

    // Send initial heartbeat
    this.sendHeartbeat();

    // Send periodic heartbeats
    this.interval = setInterval(() => {
      this.sendHeartbeat();
    }, this.intervalSeconds * 1000);

    console.log(
      `💓 Heartbeat started (every ${this.intervalSeconds}s, TTL: ${this.ttl}s)`,
    );
  }

  /**
   * Stop sending heartbeats
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log('💔 Heartbeat stopped');
    }
  }

  /**
   * Send heartbeat to Redis
   */
  private async sendHeartbeat(): Promise<void> {
    try {
      const key = `worker:${this.workerId}:heartbeat`;
      const timestamp = new Date().toISOString();

      await this.redis.setex(key, this.ttl, timestamp);

      // Also update worker info
      await this.redis.hset(`worker:${this.workerId}:info`, {
        type: process.env.WORKER_TYPE || 'local',
        lastHeartbeat: timestamp,
        pid: process.pid,
      });
    } catch (error) {
      console.error('Failed to send heartbeat:', error.message);
    }
  }

  /**
   * Get worker info from Redis
   */
  async getWorkerInfo(): Promise<any> {
    try {
      return await this.redis.hgetall(`worker:${this.workerId}:info`);
    } catch (error) {
      console.error('Failed to get worker info:', error);
      return null;
    }
  }
}
EOF
```

**Heartbeat Service Explained:**
- Sends periodic Redis SETEX commands with TTL
- If worker crashes, key expires and orchestrator knows it's dead
- Also stores worker metadata in Redis hash
- Can be monitored by orchestrator

### Step 5: Create Worker Service

```bash
cat > src/services/worker.service.ts << 'EOF'
import { Worker, Job, Queue } from 'bullmq';
import Redis from 'ioredis';
import { QueueJobData, QueueJobResult } from '@shared/types';
import { ExecutorService } from './executor.service';
import { HeartbeatService } from './heartbeat.service';

export class WorkerService {
  private worker: Worker<QueueJobData>;
  private resultQueue: Queue<QueueJobResult>;
  private heartbeatService: HeartbeatService;
  private executor: ExecutorService;
  private tasksCompleted = 0;
  private isShuttingDown = false;

  constructor(
    private readonly workerId: string,
    private readonly redis: Redis,
    private readonly queueName: string,
  ) {
    this.executor = new ExecutorService();
    this.heartbeatService = new HeartbeatService(
      redis,
      workerId,
      parseInt(process.env.HEARTBEAT_INTERVAL || '10'),
    );
  }

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    console.log(`🚀 Starting worker: ${this.workerId}`);
    console.log(`📬 Queue: ${this.queueName}`);
    console.log(`🔧 Worker type: ${process.env.WORKER_TYPE || 'local'}`);

    // Initialize result queue
    this.resultQueue = new Queue<QueueJobResult>(
      `${this.queueName}-results`,
      {
        connection: this.redis,
      },
    );

    // Initialize worker
    this.worker = new Worker<QueueJobData>(
      this.queueName,
      async (job: Job<QueueJobData>) => {
        return this.processJob(job);
      },
      {
        connection: this.redis,
        concurrency: parseInt(process.env.MAX_CONCURRENT_JOBS || '1'),
      },
    );

    // Set up event handlers
    this.setupEventHandlers();

    // Start heartbeat
    this.heartbeatService.start();

    // Handle graceful shutdown
    this.setupShutdownHandlers();

    console.log('✅ Worker started and ready to process tasks');
  }

  /**
   * Process a job from the queue
   */
  private async processJob(job: Job<QueueJobData>): Promise<void> {
    const { taskId, code, timeout } = job.data;

    console.log(`📝 Processing task: ${taskId}`);

    const startTime = Date.now();

    try {
      // Validate code
      const validation = this.executor.validateCode(code);
      if (!validation.valid) {
        throw new Error(`Code validation failed: ${validation.reason}`);
      }

      // Update job progress
      await job.updateProgress(10);

      // Execute code
      const result = await this.executor.executeCode(code, timeout);

      await job.updateProgress(90);

      const executionTime = Date.now() - startTime;

      // Send result to result queue
      await this.resultQueue.add('process-result', {
        taskId,
        workerId: this.workerId,
        status: 'completed',
        result,
        executionTimeMs: executionTime,
      });

      await job.updateProgress(100);

      this.tasksCompleted++;
      console.log(
        `✅ Task completed: ${taskId} (${executionTime}ms)`,
      );

      // Update worker stats
      await this.redis.hincrby(
        `worker:${this.workerId}:info`,
        'tasksCompleted',
        1,
      );
    } catch (error) {
      const executionTime = Date.now() - startTime;

      console.error(`❌ Task failed: ${taskId}`, error.message);

      // Send failure result
      await this.resultQueue.add('process-result', {
        taskId,
        workerId: this.workerId,
        status: 'failed',
        errorMessage: error.message,
        executionTimeMs: executionTime,
      });

      throw error; // Let BullMQ handle retries
    }
  }

  /**
   * Set up event handlers for worker
   */
  private setupEventHandlers(): void {
    this.worker.on('completed', (job) => {
      console.log(`Job ${job.id} completed`);
    });

    this.worker.on('failed', (job, error) => {
      console.error(`Job ${job?.id} failed:`, error.message);
    });

    this.worker.on('error', (error) => {
      console.error('Worker error:', error);
    });

    this.worker.on('stalled', (jobId) => {
      console.warn(`Job ${jobId} stalled`);
    });
  }

  /**
   * Set up graceful shutdown handlers
   */
  private setupShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) {
        return;
      }

      this.isShuttingDown = true;
      console.log(`\n⚠️  Received ${signal}, shutting down gracefully...`);

      // Stop accepting new jobs
      await this.worker.close();

      // Stop heartbeat
      this.heartbeatService.stop();

      // Close Redis connections
      await this.resultQueue.close();
      await this.redis.quit();

      console.log('👋 Worker shut down successfully');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Get worker statistics
   */
  getStats() {
    return {
      workerId: this.workerId,
      tasksCompleted: this.tasksCompleted,
      isShuttingDown: this.isShuttingDown,
    };
  }
}
EOF
```

**Worker Service Explained:**
- Connects to BullMQ and processes jobs
- Executes code using ExecutorService
- Sends results to results queue
- Handles job events (completed, failed, stalled)
- Implements graceful shutdown
- Updates worker stats in Redis

### Step 6: Update Worker Main Entry Point

```bash
cat > src/index.ts << 'EOF'
import { Command } from 'commander';
import { config } from 'dotenv';
import { WorkerService } from './services/worker.service';
import { createRedisConnection } from './utils/redis.util';

// Load environment variables
config({ path: '../../.env' });

// CLI setup
const program = new Command();

program
  .name('claude-worker')
  .description('Claude Code worker for task execution')
  .version('0.1.0')
  .option(
    '-i, --id <id>',
    'Worker ID',
    process.env.WORKER_ID || `worker-${Math.random().toString(36).substr(2, 9)}`,
  )
  .option(
    '-t, --type <type>',
    'Worker type (local|cloud)',
    process.env.WORKER_TYPE || 'local',
  )
  .option(
    '-q, --queue <name>',
    'Queue name',
    process.env.QUEUE_NAME || 'claude-tasks',
  )
  .parse();

const options = program.opts();

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   Claude Code Worker Starting...      ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');

  // Set environment variables from CLI options
  process.env.WORKER_ID = options.id;
  process.env.WORKER_TYPE = options.type;

  // Create Redis connection
  const redis = createRedisConnection();

  // Wait for Redis to connect
  await new Promise((resolve) => {
    redis.once('ready', resolve);
  });

  // Create and start worker
  const worker = new WorkerService(options.id, redis, options.queue);

  await worker.start();

  // Log stats periodically
  setInterval(() => {
    const stats = worker.getStats();
    console.log(
      `📊 Stats: ${stats.tasksCompleted} tasks completed`,
    );
  }, 60000); // Every minute
}

// Start worker
main().catch((error) => {
  console.error('❌ Worker failed to start:', error);
  process.exit(1);
});
EOF
```

### Step 7: Add Worker Scripts to package.json

```bash
# Update package.json to include proper scripts
cat > package.json << 'EOF'
{
  "name": "@apps/worker",
  "version": "0.1.0",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "start:debug": "tsx src/index.ts --id debug-worker --type local",
    "lint": "eslint \"src/**/*.ts\" --fix"
  },
  "dependencies": {
    "@shared/types": "workspace:*",
    "bullmq": "^5.1.0",
    "ioredis": "^5.3.2",
    "commander": "^11.1.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/node": "^20.10.6",
    "typescript": "^5.3.3",
    "tsx": "^4.7.0",
    "eslint": "^8.56.0",
    "@typescript-eslint/eslint-plugin": "^6.15.0",
    "@typescript-eslint/parser": "^6.15.0"
  }
}
EOF

pnpm install
```

### Step 8: Test Worker Locally

```bash
# In terminal 1: Start orchestrator
cd apps/orchestrator
pnpm dev

# In terminal 2: Start worker
cd apps/worker
pnpm dev

# In terminal 3: Submit tasks
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "code": "console.log(\"Hello from worker test!\"); console.log(2 + 2);",
    "prompt": "Test worker execution",
    "timeout": 30
  }'

# Watch worker logs - you should see:
# - Task being picked up
# - Code being executed
# - Result being sent back

# Check task status
curl http://localhost:3000/tasks | jq '.tasks[0]'
# Status should change from "queued" to "running" to "completed"
```

### Step 9: Test Multiple Workers

```bash
# Start 3 workers in different terminals
cd apps/worker

# Terminal 1
pnpm dev -- --id worker-1

# Terminal 2
pnpm dev -- --id worker-2

# Terminal 3
pnpm dev -- --id worker-3

# Submit multiple tasks
for i in {1..10}; do
  curl -X POST http://localhost:3000/tasks \
    -H "Content-Type: application/json" \
    -d "{
      \"code\": \"console.log('Task $i: ' + ($i * $i))\",
      \"prompt\": \"Calculate square of $i\"
    }"
  sleep 0.5
done

# Watch how tasks are distributed across workers
```

### Step 10: Test Error Handling

```bash
# Test timeout
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "code": "setTimeout(() => console.log(\"done\"), 10000);",
    "prompt": "Test timeout",
    "timeout": 2
  }'

# Test code error
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "code": "throw new Error(\"Intentional error\");",
    "prompt": "Test error handling"
  }'

# Test invalid code
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "code": "undefined.variable.access()",
    "prompt": "Test invalid code"
  }'

# Check that tasks are marked as failed
curl http://localhost:3000/tasks/stats | jq '.database.failed'
```

### Step 11: Create Worker Monitoring Script

```bash
cat > ../../scripts/monitor-workers.sh << 'EOF'
#!/bin/bash

REDIS_HOST=${REDIS_HOST:-localhost}
REDIS_PORT=${REDIS_PORT:-6379}
REDIS_PASSWORD=${REDIS_PASSWORD}

echo "=== Claude Orchestrator Worker Monitor ==="
echo ""

# Get active workers from Redis
redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD \
  KEYS "worker:*:heartbeat" | while read key; do
  if [ ! -z "$key" ]; then
    worker_id=$(echo $key | cut -d: -f2)
    last_heartbeat=$(redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD GET $key)
    ttl=$(redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD TTL $key)

    echo "Worker: $worker_id"
    echo "  Last Heartbeat: $last_heartbeat"
    echo "  TTL: ${ttl}s"

    # Get worker info
    info=$(redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD \
      HGETALL "worker:$worker_id:info")
    echo "  Info: $info"
    echo ""
  fi
done
EOF

chmod +x ../../scripts/monitor-workers.sh
```

### Step 12: Create Complete Integration Test

```bash
cat > ../../scripts/test-complete-flow.sh << 'EOF'
#!/bin/bash

API_URL="http://localhost:3000"

echo "🧪 Testing Complete Task Flow"
echo "=============================="
echo ""

# 1. Submit task
echo "1. Submitting task..."
task=$(curl -s -X POST $API_URL/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "code": "const result = Array.from({length: 5}, (_, i) => i * i); console.log(JSON.stringify(result));",
    "prompt": "Calculate squares of 0-4"
  }')

task_id=$(echo $task | jq -r '.id')
echo "   Task ID: $task_id"
echo ""

# 2. Poll for completion
echo "2. Waiting for completion..."
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
  status=$(curl -s $API_URL/tasks/$task_id | jq -r '.status')
  echo "   Attempt $((attempt + 1)): Status = $status"

  if [ "$status" = "completed" ]; then
    echo "   ✅ Task completed!"
    break
  elif [ "$status" = "failed" ]; then
    echo "   ❌ Task failed!"
    break
  fi

  sleep 2
  attempt=$((attempt + 1))
done

echo ""

# 3. Get final result
echo "3. Final task details:"
curl -s $API_URL/tasks/$task_id | jq .

echo ""
echo "✅ Test completed!"
EOF

chmod +x ../../scripts/test-complete-flow.sh
```

## Verification Checklist

- [ ] Worker connects to Redis successfully
- [ ] Worker picks up tasks from queue
- [ ] Code execution works correctly
- [ ] Task results are sent back to orchestrator
- [ ] Task status updates to "completed"
- [ ] Heartbeats are sent periodically
- [ ] Multiple workers can run simultaneously
- [ ] Tasks are distributed across workers
- [ ] Timeout handling works
- [ ] Error handling works
- [ ] Failed tasks retry (BullMQ automatic)
- [ ] Graceful shutdown works (Ctrl+C)

## Common Issues

### Issue: Worker not picking up tasks
**Solution:**
```bash
# Check Redis connection
redis-cli -a $REDIS_PASSWORD PING

# Check queue name matches
echo $QUEUE_NAME

# Check worker logs for errors
```

### Issue: Code execution fails
**Solution:**
```bash
# Test executor directly
node -e "console.log('test')"

# Check temp directory permissions
ls -la /tmp

# Check Node.js version
node --version
```

### Issue: Results not appearing in database
**Solution:**
```bash
# Check results queue
redis-cli -a $REDIS_PASSWORD LLEN claude-tasks-results

# Check orchestrator logs for result processing
# Ensure QueueService result worker is running
```

## Next Steps

Proceed to **Task 05: Create Dashboard UI**

You now have a fully functional worker! 🎉 Tasks flow from API → Database → Queue → Worker → Results → Database.