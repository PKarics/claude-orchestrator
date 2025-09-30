# TASK-004-01: Worker Integration and Testing

**Type:** Task
**Priority:** High
**Story Points:** 3
**Sprint:** Core Functionality
**Dependencies:** TASK-002 (Database), TASK-003 (Queue Integration)

## Description

This task covers the integration and testing of the worker application once the database (Task 2) and queue system (Task 3) are fully implemented. The core worker functionality has been implemented, but full integration requires the orchestrator's queue producer and database models.

## Status

**BLOCKED** - Waiting for:
- TASK-002: Database schema and models (for task/result storage)
- TASK-003: Queue integration (for orchestrator to produce tasks)

## What's Already Implemented

The worker application has been fully implemented with the following components:

### Completed Components

1. **ExecutorService** (`apps/worker/src/services/executor.service.ts`)
   - Executes JavaScript code in isolated child processes
   - Handles timeout enforcement
   - Captures stdout, stderr, and exit codes
   - Cleans up temporary files

2. **HeartbeatService** (`apps/worker/src/services/heartbeat.service.ts`)
   - Sends heartbeat to Redis every 10 seconds
   - Sets TTL of 30 seconds on heartbeat keys
   - Provides start/stop lifecycle methods

3. **WorkerService** (`apps/worker/src/services/worker.service.ts`)
   - Connects to BullMQ queue
   - Processes jobs from the task queue
   - Sends results to result queue
   - Handles graceful shutdown (SIGTERM/SIGINT)
   - Integrates executor and heartbeat services

4. **Redis Utility** (`apps/worker/src/utils/redis.util.ts`)
   - Creates Redis connections with proper configuration
   - Handles connection events and errors

5. **CLI Interface** (`apps/worker/src/index.ts`)
   - Accepts worker ID and type via command-line arguments
   - Loads environment configuration
   - Initializes and starts worker

## Remaining Integration Tasks

Once TASK-002 and TASK-003 are complete, the following integration work is needed:

### 1. Test Worker with Orchestrator

**Prerequisites:**
- Orchestrator API endpoints for task submission (TASK-002)
- Task queue producer in orchestrator (TASK-003)
- Result queue consumer in orchestrator (TASK-003)

**Steps:**
```bash
# Start Redis
docker compose up redis -d

# Start orchestrator
cd apps/orchestrator && pnpm dev

# Start worker
cd apps/worker && pnpm dev

# Submit test task
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"code":"console.log(2+2)","prompt":"math test"}'

# Check result
curl http://localhost:3000/tasks/{task-id}
```

### 2. Test Multiple Workers

**Test Scenario:**
- Start 3 workers with different IDs
- Submit 10 tasks
- Verify tasks are distributed across workers
- Check worker statistics

```bash
# Start workers
pnpm dev -- --id worker-1 &
pnpm dev -- --id worker-2 &
pnpm dev -- --id worker-3 &

# Submit tasks
for i in {1..10}; do
  curl -X POST http://localhost:3000/tasks \
    -H "Content-Type: application/json" \
    -d "{\"code\":\"console.log($i)\",\"prompt\":\"task $i\"}"
done

# Check worker stats
curl http://localhost:3000/workers
```

### 3. Test Timeout Handling

**Test Scenario:**
- Submit task with infinite loop
- Verify timeout is enforced
- Check error is reported properly

```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"code":"while(true){}","prompt":"timeout test","timeout":5}'
```

### 4. Test Error Handling

**Test Scenario:**
- Submit task with syntax error
- Submit task with runtime error
- Verify errors are captured and reported

```bash
# Syntax error
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"code":"console.log(","prompt":"syntax error"}'

# Runtime error
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"code":"throw new Error(\"test error\")","prompt":"runtime error"}'
```

### 5. Test Graceful Shutdown

**Test Scenario:**
- Start worker with long-running task
- Send SIGTERM to worker
- Verify task completes before shutdown
- Verify heartbeat stops

### 6. Verify Heartbeat

**Test Scenario:**
- Start worker
- Check Redis for heartbeat keys
- Verify TTL is ~30 seconds
- Stop worker and verify key expires

```bash
# Check heartbeat
redis-cli keys "worker:*:heartbeat"
redis-cli ttl "worker:worker-1:heartbeat"
```

## Acceptance Criteria

- [ ] Worker successfully picks up tasks from orchestrator
- [ ] Code executes and results are saved to database
- [ ] Multiple workers can run simultaneously
- [ ] Tasks are distributed across workers
- [ ] Timeouts are enforced correctly
- [ ] Errors are captured and reported
- [ ] Graceful shutdown completes running tasks
- [ ] Heartbeats are visible in Redis
- [ ] Worker statistics are tracked

## Notes

- The worker implementation is complete and follows the specification from TASK-004
- No changes to worker code should be needed for integration
- If issues arise during integration, they should be documented here
- Consider adding integration tests once manual testing is complete

## Definition of Done

- All acceptance criteria met
- Integration tests passing
- Worker can process tasks end-to-end with orchestrator
- Documentation updated with setup instructions