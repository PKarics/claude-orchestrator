# Testing and Deployment Guide

This document describes how to test and run the Claude Orchestrator system locally and in production.

## Quick Start - Running the Full System

The fastest way to run the complete orchestrator system (Redis, Orchestrator API, and Worker) is:

```bash
pnpm start
```

This command:
- ✅ Automatically finds available ports (no conflicts!)
- ✅ Starts Redis/Valkey container
- ✅ Starts Orchestrator API
- ✅ Starts Worker process
- ✅ Creates instance-specific logs and configuration
- ✅ Can be run multiple times for multiple isolated instances

### Example Output
```bash
$ pnpm start

🚀 Starting Claude Orchestrator...
Instance: instance-1759249283
Orchestrator port: 3000
Redis port: 6379

📦 Starting Docker containers...
✅ Valkey is ready
🎯 Starting orchestrator...
✅ Orchestrator is ready
⚙️  Starting worker...

✨ Instance 'instance-1759249283' started successfully!

📊 Service Status:
  - Valkey: running on port 6379
  - Orchestrator: http://localhost:3000 (PID: 12345)
  - Worker: running (PID: 12346)

📝 Logs:
  - Orchestrator: tail -f data/instance-1759249283/orchestrator.log
  - Worker: tail -f data/instance-1759249283/worker.log

🛑 To stop this instance, run: ./scripts/stop-instance.sh instance-1759249283
```

### Testing the Running System

Once started, you can immediately test the system:

```bash
# Check health
curl http://localhost:3000/health

# Create a task
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "code": "console.log(\"Hello from Claude!\")",
    "prompt": "Execute this simple test",
    "timeout": 60
  }'

# Get task status (replace TASK_ID with the ID from above)
curl http://localhost:3000/tasks/TASK_ID

# List all tasks
curl http://localhost:3000/tasks

# Get statistics
curl http://localhost:3000/tasks/stats
```

### Stopping the System

```bash
# Stop all running instances
pnpm stop:all

# Or stop a specific instance
./scripts/stop-instance.sh instance-1759249283

# Check what's running
pnpm list
```

## Running Multiple Instances

You can run multiple independent instances simultaneously:

```bash
# Start instance 1 on custom ports
pnpm start:instance dev 3001 6380

# Start instance 2
pnpm start:instance staging 3002 6381

# Start instance 3
pnpm start:instance prod 3003 6382

# List all instances
pnpm list

# Stop specific instance
pnpm stop:instance dev
```

See [MULTI_INSTANCE.md](./MULTI_INSTANCE.md) for detailed information.

## Automated Testing

### Unit Tests (Fast - 2-3 seconds)

Run all unit tests without external dependencies:

```bash
cd apps/orchestrator
pnpm test --testPathIgnorePatterns=e2e

cd apps/worker
pnpm test
```

**Test Coverage:**
- ✅ 53 orchestrator unit tests
- ✅ 77 worker unit tests
- ✅ Total: 130 tests
- ✅ All tests use mocks, no Redis/Docker required

**What's tested:**
- TasksService CRUD operations
- QueueService integration
- WorkerService job processing
- ExecutorService timeout handling
- HeartbeatService Redis operations
- All error handling paths
- Edge cases and validation

### Manual End-to-End Testing

For complete system verification, use `pnpm start` and test manually:

```bash
# 1. Start the system
pnpm start

# 2. Wait for startup (watch the output)

# 3. Run manual tests
cd apps/orchestrator
./scripts/manual-e2e-test.sh

# 4. Check logs
tail -f data/instance-*/orchestrator.log
tail -f data/instance-*/worker.log

# 5. Stop when done
pnpm stop:all
```

### Why Manual E2E Testing?

E2E tests that spin up the full NestJS application have several challenges:
- Complex module initialization with circular dependencies
- TypeORM SQLite driver loading issues in test environment
- Redis connection management in Jest environment
- Long startup times (15-30 seconds)

**Manual testing with `pnpm start` is more reliable because:**
- ✅ Real production-like environment
- ✅ Actual Docker containers (not mocks)
- ✅ Easy to debug with logs
- ✅ Can test multiple scenarios interactively
- ✅ Verifies deployment scripts work correctly

## Development Workflow

### Day-to-Day Development

```bash
# 1. Start development servers with hot reload
pnpm dev

# This runs both orchestrator and worker in watch mode
# Changes automatically rebuild and restart

# 2. In another terminal, run tests on file changes
cd apps/orchestrator
pnpm test --watch

# 3. Make your changes

# 4. Run full test suite before committing
pnpm test --testPathIgnorePatterns=e2e
```

### Before Committing

```bash
# 1. Build everything
pnpm build

# 2. Run all unit tests
cd apps/orchestrator && pnpm test --testPathIgnorePatterns=e2e
cd apps/worker && pnpm test

# 3. Test the full system
pnpm start
# ... run manual tests ...
pnpm stop:all

# 4. Commit
git add .
git commit -m "Your changes"
```

## CI/CD Integration

### GitHub Actions (Recommended)

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
        with:
          version: 10
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Build
        run: pnpm build

      - name: Run unit tests
        run: |
          cd apps/orchestrator
          pnpm test --testPathIgnorePatterns=e2e
          cd ../worker
          pnpm test
```

### Docker-Based Testing

For more isolated testing:

```bash
# Build and test in Docker
docker-compose -f docker-compose.test.yml up --abort-on-container-exit

# Or use the test script
./scripts/test-in-docker.sh
```

## Production Deployment

### Prerequisites

- Node.js 20+
- pnpm 10+
- Docker & Docker Compose
- Linux/macOS (Windows via WSL2)

### Deployment Steps

```bash
# 1. Clone and build
git clone <repo>
cd claude-orchestrator
pnpm install
pnpm build

# 2. Configure environment
cp .env.example .env
# Edit .env with production settings

# 3. Start production instance
pnpm start:instance prod 3000 6379

# 4. Verify health
curl http://localhost:3000/health

# 5. Monitor logs
tail -f data/prod/orchestrator.log
tail -f data/prod/worker.log

# 6. Set up monitoring
# - Configure log aggregation (ELK, Datadog, etc.)
# - Set up health check monitoring
# - Configure alerts for failures
```

### Production Checklist

- [ ] Environment variables configured
- [ ] Redis persistence enabled
- [ ] Database backups configured
- [ ] Logging to centralized system
- [ ] Health checks configured
- [ ] Rate limiting enabled
- [ ] SSL/TLS certificates installed
- [ ] Firewall rules configured
- [ ] Monitoring and alerting set up
- [ ] Backup and disaster recovery plan

## Troubleshooting

### "Port already in use"

```bash
# Check what's using the port
lsof -i :3000

# Kill the process
kill -9 PID

# Or let pnpm start auto-select ports
pnpm start  # Automatically finds available ports
```

### "Redis connection failed"

```bash
# Check if Redis is running
docker ps | grep valkey

# Check Redis logs
docker logs claude-orchestrator-valkey-<instance-name>

# Restart Redis
docker restart claude-orchestrator-valkey-<instance-name>
```

### "Worker not processing tasks"

```bash
# Check worker logs
tail -f data/instance-*/worker.log

# Check worker is running
ps aux | grep worker

# Restart worker
./scripts/stop-instance.sh <instance>
./scripts/start-instance.sh <instance>
```

### "Tests failing"

```bash
# Clean and rebuild
pnpm clean
pnpm install
pnpm build

# Run tests with verbose output
cd apps/orchestrator
pnpm test --verbose --testPathIgnorePatterns=e2e

# Check for hung processes
ps aux | grep node
```

## Performance Testing

### Load Testing with Apache Bench

```bash
# Test task creation endpoint
ab -n 1000 -c 10 -p task.json -T application/json \
  http://localhost:3000/tasks

# Where task.json contains:
{
  "code": "console.log('test')",
  "prompt": "Test prompt",
  "timeout": 60
}
```

### Monitoring Performance

```bash
# Watch queue stats
watch -n 1 'curl -s http://localhost:3000/tasks/stats | jq'

# Monitor Redis
redis-cli -p 6379 info stats

# Check worker health
redis-cli -p 6379 keys "worker:*:heartbeat"
```

## Summary

- **Quick Start**: Use `pnpm start` for instant full system testing
- **Unit Tests**: Fast, reliable, no external dependencies (130 tests)
- **Integration Tests**: Use manual testing with `pnpm start`
- **Multiple Instances**: Easy to run parallel instances for testing
- **Production Ready**: Built-in scripts for deployment and monitoring

For more details:
- [MULTI_INSTANCE.md](./MULTI_INSTANCE.md) - Running multiple instances
- [docs/getting-started.md](./docs/getting-started.md) - Initial setup guide
- [docs/api-reference.md](./docs/api-reference.md) - API documentation
