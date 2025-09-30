# Running Multiple Instances

This project supports running multiple independent instances of the Claude Orchestrator on the same machine. Each instance runs with its own:
- Valkey/Redis container on a unique port
- Orchestrator service on a unique port
- Worker service
- Data directory and logs

## Quick Start

### Start a single instance (default)
```bash
pnpm start
# Runs on default ports: Orchestrator=3000, Redis=6379
```

### Start multiple named instances
```bash
# Instance 1
pnpm start:instance instance1 3001 6380

# Instance 2
pnpm start:instance instance2 3002 6381

# Instance 3
pnpm start:instance instance3 3003 6382
```

### List all running instances
```bash
pnpm list
```

### Stop specific instances
```bash
pnpm stop:instance instance1
pnpm stop:instance instance2
```

## Instance Management

### Start an instance
```bash
./scripts/start-instance.sh <instance-name> [orchestrator-port] [redis-port]
```

Parameters:
- `instance-name` (required): Unique identifier for this instance
- `orchestrator-port` (optional): HTTP port for orchestrator API (default: 3000)
- `redis-port` (optional): Redis/Valkey port (default: 6379)

Example:
```bash
./scripts/start-instance.sh prod-1 3001 6380
```

### Stop an instance
```bash
./scripts/stop-instance.sh <instance-name>
```

Example:
```bash
./scripts/stop-instance.sh prod-1
```

### List all instances
```bash
./scripts/list-instances.sh
```

Shows status of all instances including:
- Orchestrator status and port
- Worker status
- Valkey status and port

## Instance Data

Each instance stores its data in:
```
data/<instance-name>/
├── orchestrator.pid
├── orchestrator.log
├── worker.pid
└── worker.log
```

Each instance also gets its own environment file:
```
.env.<instance-name>
```

## Port Assignment Strategy

To avoid conflicts when running multiple instances:

1. **Orchestrator ports**: Use sequential ports starting from 3001
   - Instance 1: 3001
   - Instance 2: 3002
   - Instance 3: 3003
   - etc.

2. **Redis/Valkey ports**: Use sequential ports starting from 6380
   - Instance 1: 6380
   - Instance 2: 6381
   - Instance 3: 6382
   - etc.

## Docker Container Naming

Each instance creates uniquely named containers:
- Container name: `claude-orchestrator-valkey-<instance-name>`
- Docker Compose project: `claude-orchestrator-<instance-name>`

This allows all instances to run simultaneously without conflicts.

## Example: Running 3 Instances

```bash
# Build once
pnpm build

# Start three instances
pnpm start:instance dev 3001 6380
pnpm start:instance staging 3002 6381
pnpm start:instance prod 3003 6382

# Check status
pnpm list

# Test each instance
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health

# Stop all instances
pnpm stop:instance dev
pnpm stop:instance staging
pnpm stop:instance prod
```

## Cleanup

To completely clean up all instances:

```bash
# List and stop all instances
pnpm list
pnpm stop:instance <each-instance>

# Remove all instance data
rm -rf data/*/
rm -f .env.*
```