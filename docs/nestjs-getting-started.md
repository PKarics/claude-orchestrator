# Getting Started with Claude Orchestrator (NestJS/TypeScript)

This guide will help you set up and run the Claude Orchestrator system built with NestJS and TypeScript.

## Prerequisites

### Required Software
- **Node.js 20+** - [Download](https://nodejs.org/)
- **pnpm 8+** - Fast, efficient package manager
- **Docker & Docker Compose** - [Download](https://www.docker.com/products/docker-desktop/)
- **Git** - [Download](https://git-scm.com/downloads)

### Verify Installations
```bash
node --version  # Should be v20.x.x or higher
pnpm --version  # Should be 8.x.x or higher
docker --version
docker compose version
git --version
```

### Install pnpm (if needed)
```bash
npm install -g pnpm
```

## Quick Start (5 Minutes)

### 1. Clone and Setup
```bash
# Clone the repository
git clone git@github.com:PKarics/claude-orchestrator.git
cd claude-orchestrator

# Run setup script
chmod +x scripts/setup.sh
./scripts/setup.sh
```

The setup script will:
- ✅ Check Node.js and pnpm installation
- ✅ Install all dependencies
- ✅ Build shared packages
- ✅ Create `.env` file from template
- ✅ Create data directories

### 2. Configure Environment
```bash
# Edit .env file
nano .env

# Change these values:
# - REDIS_PASSWORD (use a strong password)
# - API_KEY (use a secure random string)
# - DB_PASSWORD (if using PostgreSQL)
```

### 3. Start Redis
```bash
# Start Redis in Docker
docker compose up redis -d

# Verify Redis is running
docker compose ps
```

### 4. Start Orchestrator
```bash
# In terminal 1
cd apps/orchestrator
pnpm dev
```

You should see:
```
🚀 Orchestrator running on http://localhost:3000
📚 API docs available at http://localhost:3000/api
```

### 5. Start Worker
```bash
# In terminal 2
cd apps/worker
pnpm dev
```

You should see:
```
🚀 Worker starting...
✅ Worker running
```

### 6. Test the API
```bash
# In terminal 3
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "version": "0.1.0"
}
```

### 7. View API Documentation
Open your browser and navigate to:
```
http://localhost:3000/api
```

You'll see interactive Swagger API documentation.

## Project Structure

```
claude-orchestrator/
├── apps/
│   ├── orchestrator/           # NestJS API service
│   │   ├── src/
│   │   │   ├── main.ts        # Application entry point
│   │   │   ├── app.module.ts  # Root module
│   │   │   ├── config/        # Configuration
│   │   │   └── modules/       # Feature modules
│   │   │       ├── tasks/     # Task management
│   │   │       ├── workers/   # Worker tracking
│   │   │       └── health/    # Health checks
│   │   ├── test/              # Tests
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   ├── worker/                 # Worker application
│   │   ├── src/
│   │   │   ├── index.ts       # Worker entry point
│   │   │   ├── worker.ts      # Main worker class
│   │   │   ├── executor.ts    # Task execution
│   │   │   └── heartbeat.ts   # Heartbeat management
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   └── dashboard/              # React dashboard (future)
│
├── packages/
│   └── shared/                 # Shared TypeScript types
│       ├── src/
│       │   └── index.ts       # Shared types & interfaces
│       ├── package.json
│       └── tsconfig.json
│
├── docs/                       # Documentation
├── tasks/                      # Implementation guides
├── scripts/                    # Utility scripts
├── data/                       # Runtime data (gitignored)
│   ├── tasks.db               # SQLite database
│   └── logs/                  # Log files
│
├── pnpm-workspace.yaml         # pnpm workspace config
├── package.json                # Root package.json
├── docker-compose.yml          # Docker services
├── .env                        # Environment variables (gitignored)
└── .env.example               # Environment template
```

## Development Workflow

### Installing Dependencies
```bash
# Install all dependencies
pnpm install

# Install for specific app
pnpm --filter @apps/orchestrator install
```

### Building

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @shared/types build
pnpm --filter @apps/orchestrator build
```

### Running in Development Mode
```bash
# Run all apps in parallel (separate terminals recommended)
pnpm dev

# Or run individually:
cd apps/orchestrator && pnpm dev
cd apps/worker && pnpm dev
```

### Testing
```bash
# Run all tests
pnpm test

# Run tests for specific app
cd apps/orchestrator && pnpm test

# Run tests in watch mode
pnpm test:watch

# Generate coverage report
pnpm test:cov
```

### Linting and Formatting
```bash
# Lint all code
pnpm lint

# Format all code
pnpm format

# Fix linting issues
cd apps/orchestrator && pnpm lint --fix
```

## Working with the Monorepo

### Understanding pnpm Workspaces

The project uses pnpm workspaces to manage multiple packages:

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

**Benefits:**
- Shared dependencies (saves disk space)
- Easy cross-package imports
- Consistent dependency versions
- Fast installations

### Importing Shared Types

In orchestrator or worker:
```typescript
import { Task, TaskStatus, CreateTaskDto } from '@shared/types';

const task: Task = {
  id: '123',
  status: TaskStatus.QUEUED,
  // ...
};
```

### Adding Dependencies

```bash
# Add to orchestrator
cd apps/orchestrator
pnpm add express

# Add to worker
cd apps/worker
pnpm add axios

# Add to shared
cd packages/shared
pnpm add zod

# Add dev dependency
pnpm add -D @types/express
```

### Running Scripts Across Workspace

```bash
# Run script in all packages
pnpm -r build        # Recursive build
pnpm -r test         # Run all tests

# Run script in parallel
pnpm -r --parallel dev

# Run script in specific package
pnpm --filter @apps/orchestrator dev
pnpm --filter @apps/worker build
```

## Docker Usage

### Development (Redis only)
```bash
# Start Redis
docker compose up redis -d

# Stop Redis
docker compose down
```

### Production (All services)
```bash
# Build and start all services
docker compose --profile production up -d --build

# View logs
docker compose logs -f orchestrator
docker compose logs -f redis

# Stop all services
docker compose --profile production down
```

### Using PostgreSQL (Production)
```bash
# Start PostgreSQL
docker compose --profile production up postgres -d

# Update .env
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=orchestrator
DB_PASSWORD=your_password
DB_DATABASE=orchestrator
```

## Environment Variables

### Orchestrator (.env)
```bash
# Server
PORT=3000
NODE_ENV=development

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Database (SQLite for dev)
DB_TYPE=sqlite
DB_DATABASE=./data/tasks.db

# Database (PostgreSQL for prod)
# DB_TYPE=postgres
# DB_HOST=localhost
# DB_PORT=5432
# DB_USERNAME=orchestrator
# DB_PASSWORD=your_db_password
# DB_DATABASE=orchestrator

# API Security
API_KEY=your_api_key

# Logging
LOG_LEVEL=info

# Queue
QUEUE_NAME=claude-tasks
MAX_CONCURRENT_JOBS=5
```

### Worker (.env)
```bash
# Worker Identity
WORKER_ID=local-worker-1
WORKER_TYPE=local

# Redis (same as orchestrator)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Worker Behavior
POLL_INTERVAL=5
HEARTBEAT_INTERVAL=10

# Logging
LOG_LEVEL=info
```

## API Usage Examples

### Submit a Task
```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_api_key" \
  -d '{
    "code": "console.log(\"Hello, World!\")",
    "prompt": "Execute this code",
    "timeout": 60
  }'
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "createdAt": "2025-01-15T10:30:00.000Z"
}
```

### Get Task Status
```bash
curl http://localhost:3000/tasks/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer your_api_key"
```

### List All Tasks
```bash
curl http://localhost:3000/tasks \
  -H "Authorization: Bearer your_api_key"
```

### Get Active Workers
```bash
curl http://localhost:3000/workers \
  -H "Authorization: Bearer your_api_key"
```

## Troubleshooting

### Port Already in Use
```bash
# Check what's using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change port in .env
PORT=3001
```

### Cannot Connect to Redis
```bash
# Check if Redis is running
docker compose ps redis

# Check Redis logs
docker compose logs redis

# Test Redis connection
redis-cli -h localhost -p 6379 -a your_password ping
# Should respond: PONG
```

### TypeScript Errors
```bash
# Rebuild shared package
cd packages/shared
pnpm build

# Clear TypeScript cache
rm -rf apps/*/tsconfig.tsbuildinfo

# Reinstall dependencies
pnpm install
```

### Worker Not Picking Up Tasks
```bash
# Check worker logs
cd apps/worker
pnpm dev

# Verify Redis connection in worker logs
# Verify tasks are in queue (use Redis CLI)
redis-cli -a your_password
> LLEN task:pending
```

### Database Locked (SQLite)
```bash
# Stop all orchestrator instances
pkill -f "nest start"

# Remove lock file
rm data/tasks.db-journal

# For production, use PostgreSQL instead
```

## Testing the Complete Flow

### 1. Submit Multiple Tasks
```bash
# Create test script
cat > test-flow.sh << 'EOF'
#!/bin/bash
API_URL="http://localhost:3000"
API_KEY="your_api_key"

for i in {1..5}; do
  echo "Submitting task $i..."
  curl -s -X POST "$API_URL/tasks" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $API_KEY" \
    -d "{
      \"code\": \"console.log('Task $i: ' + (${i} * ${i}))\",
      \"prompt\": \"Calculate square of $i\"
    }" | jq '.id'
  sleep 1
done
EOF

chmod +x test-flow.sh
./test-flow.sh
```

### 2. Monitor Task Execution
```bash
# Watch task count
watch -n 1 'curl -s http://localhost:3000/tasks \
  -H "Authorization: Bearer your_api_key" | jq ".total"'
```

### 3. Check Worker Activity
```bash
# View worker logs
cd apps/worker
pnpm dev
# You should see tasks being processed
```

## Next Steps

1. **Read Architecture Documentation** - [architecture-overview.md](architecture-overview.md)
2. **Explore API Documentation** - http://localhost:3000/api
3. **Follow Implementation Tasks** - [tasks/](../tasks/)
4. **Customize Configuration** - Adapt to your needs
5. **Deploy to Production** - See deployment guides

## Development Tips

### Hot Reload
Both orchestrator and worker support hot reload in development mode:
- Changes to `.ts` files automatically restart the service
- No need to manually restart during development

### Debugging in VS Code
Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Orchestrator",
      "runtimeArgs": ["-r", "ts-node/register"],
      "args": ["apps/orchestrator/src/main.ts"],
      "cwd": "${workspaceFolder}",
      "internalConsoleOptions": "openOnSessionStart"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Worker",
      "runtimeArgs": ["-r", "ts-node/register"],
      "args": ["apps/worker/src/index.ts"],
      "cwd": "${workspaceFolder}"
    }
  ]
}
```

### TypeScript Path Aliases
Configure in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@shared/*": ["../packages/shared/src/*"],
      "@config/*": ["./src/config/*"]
    }
  }
}
```

## Performance Optimization

### For Development
```bash
# Use tsx for faster TypeScript execution
pnpm add -D tsx

# Update package.json scripts
"dev": "tsx watch src/main.ts"
```

### For Production
```bash
# Build with optimizations
pnpm build

# Use PM2 for process management
npm install -g pm2
pm2 start dist/main.js --name orchestrator
pm2 start dist/index.js --name worker
```

## Getting Help

- **Documentation:** [docs/](../docs/)
- **Tasks:** [tasks/](../tasks/) - Step-by-step implementation guides
- **Issues:** GitHub Issues
- **API Docs:** http://localhost:3000/api

## Summary Checklist

✅ Node.js 20+ installed
✅ pnpm installed
✅ Dependencies installed
✅ `.env` configured
✅ Redis running
✅ Orchestrator starts successfully
✅ Worker connects and runs
✅ API responds to `/health`
✅ Swagger docs accessible

Ready to develop! 🚀