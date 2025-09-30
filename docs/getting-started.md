# Getting Started with Claude Orchestrator

This guide will help you set up and run the Claude Orchestrator system for the first time.

## Prerequisites

Before you begin, ensure you have the following installed on your machine:

### Required Software
- **Python 3.11+** - [Download](https://www.python.org/downloads/)
- **Docker & Docker Compose** - [Download](https://www.docker.com/products/docker-desktop/)
- **Git** - [Download](https://git-scm.com/downloads/)

### Optional but Recommended
- **Postman** or **curl** - For testing API endpoints
- **Redis CLI** - For debugging Redis operations
- **VS Code** - Recommended code editor

### Verify Installations
```bash
python --version  # Should be 3.11+
docker --version
docker compose version
git --version
```

## Quick Start (5 Minutes)

### 1. Clone the Repository
```bash
cd ~/dev
git clone <repository-url> claude-orchestrator
cd claude-orchestrator
```

### 2. Start the Orchestrator
```bash
# Start Redis and Orchestrator services
docker compose up -d

# Check if services are running
docker compose ps
```

You should see:
- `orchestrator` running on port 8000
- `redis` running on port 6379
- `dashboard` running on port 3000

### 3. Start a Local Worker
```bash
# In a new terminal
cd ~/dev/claude-orchestrator
python src/worker/worker.py
```

### 4. Submit Your First Task
```bash
curl -X POST http://localhost:8000/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "code": "print(\"Hello from Claude Orchestrator!\")",
    "prompt": "Execute this Python code"
  }'
```

You'll receive a response like:
```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "created_at": "2025-01-15T10:30:00Z"
}
```

### 5. Check Task Status
```bash
# Replace {task_id} with the ID from previous step
curl http://localhost:8000/tasks/{task_id}
```

### 6. View Dashboard
Open your browser and navigate to:
```
http://localhost:3000
```

You should see the dashboard with task statistics and active workers.

## Detailed Setup

### Project Structure
```
claude-orchestrator/
├── docs/                       # Documentation
│   ├── architecture-overview.md
│   ├── getting-started.md
│   ├── api-reference.md
│   └── development-guide.md
├── tasks/                      # Implementation tasks
│   ├── task-01-setup-project.md
│   ├── task-02-orchestrator.md
│   └── ...
├── src/
│   ├── orchestrator/           # Orchestrator service
│   │   ├── main.py            # FastAPI app
│   │   ├── models.py          # Data models
│   │   ├── database.py        # SQLite operations
│   │   ├── redis_client.py    # Redis operations
│   │   └── requirements.txt   # Python dependencies
│   └── worker/                 # Worker script
│       ├── worker.py          # Main worker logic
│       ├── executor.py        # Task execution
│       └── requirements.txt   # Python dependencies
├── scripts/                    # Utility scripts
│   ├── setup.sh               # Initial setup
│   └── test-api.sh            # API testing
├── tests/                      # Test files
│   ├── test_orchestrator.py
│   └── test_worker.py
├── docker-compose.yml          # Docker services
├── .env.example               # Environment variables template
└── README.md                  # Project overview
```

### Environment Setup

#### 1. Create Virtual Environment
```bash
# For orchestrator
cd src/orchestrator
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

#### 2. Configure Environment Variables
```bash
# Copy example environment file
cp .env.example .env

# Edit .env file
nano .env
```

Example `.env` file:
```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password_here

# Orchestrator Configuration
ORCHESTRATOR_HOST=0.0.0.0
ORCHESTRATOR_PORT=8000
DATABASE_PATH=./data/tasks.db

# Worker Configuration
WORKER_ID=local-worker-1
WORKER_TYPE=local
POLL_INTERVAL=5
HEARTBEAT_INTERVAL=10

# API Security
API_KEY=your_secret_api_key_here

# Logging
LOG_LEVEL=INFO
```

#### 3. Initialize Database
```bash
cd src/orchestrator
python -c "from database import init_db; init_db()"
```

### Running Components Individually

#### Start Redis (Standalone)
```bash
docker run -d \
  --name redis \
  -p 6379:6379 \
  redis:7-alpine \
  redis-server --requirepass your_redis_password_here
```

#### Start Orchestrator (Development Mode)
```bash
cd src/orchestrator
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The orchestrator will start with auto-reload enabled (changes to code will restart the server).

#### Start Worker (Development Mode)
```bash
cd src/worker
source venv/bin/activate
python worker.py --worker-id local-dev-1
```

### Docker Compose Setup (Recommended)

#### Understanding docker-compose.yml
```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --requirepass ${REDIS_PASSWORD}

  orchestrator:
    build: ./src/orchestrator
    ports:
      - "8000:8000"
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - REDIS_PASSWORD=${REDIS_PASSWORD}
    depends_on:
      - redis
    volumes:
      - ./data:/app/data

  dashboard:
    build: ./src/dashboard
    ports:
      - "3000:3000"
    environment:
      - ORCHESTRATOR_URL=http://orchestrator:8000
    depends_on:
      - orchestrator

volumes:
  redis_data:
```

#### Docker Compose Commands
```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f orchestrator
docker compose logs -f redis

# Stop all services
docker compose down

# Rebuild after code changes
docker compose up -d --build

# View service status
docker compose ps

# Execute command in container
docker compose exec orchestrator python -c "print('Hello')"
```

## Testing Your Setup

### 1. Health Check
```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "redis_connected": true,
  "database_connected": true,
  "active_workers": 1
}
```

### 2. Submit Test Task
```bash
# Create a test script
cat > test_task.json << 'EOF'
{
  "code": "import time\nprint('Starting task...')\ntime.sleep(2)\nprint('Task completed!')",
  "prompt": "Execute this Python code with delay"
}
EOF

# Submit task
curl -X POST http://localhost:8000/tasks \
  -H "Content-Type: application/json" \
  -d @test_task.json
```

### 3. Monitor Task Progress
```bash
# Get task status (replace {task_id})
curl http://localhost:8000/tasks/{task_id}

# List all tasks
curl http://localhost:8000/tasks

# List only pending tasks
curl "http://localhost:8000/tasks?status=pending"
```

### 4. Check Active Workers
```bash
curl http://localhost:8000/workers
```

Expected response:
```json
{
  "workers": [
    {
      "worker_id": "local-worker-1",
      "type": "local",
      "last_heartbeat": "2025-01-15T10:30:45Z",
      "status": "active"
    }
  ]
}
```

## Running Multiple Workers

### Start Multiple Local Workers
```bash
# Terminal 1
python src/worker/worker.py --worker-id local-worker-1

# Terminal 2
python src/worker/worker.py --worker-id local-worker-2

# Terminal 3
python src/worker/worker.py --worker-id local-worker-3
```

### Verify All Workers Are Active
```bash
curl http://localhost:8000/workers | jq '.workers | length'
# Should output: 3
```

### Load Test with Multiple Tasks
```bash
# Submit 10 tasks simultaneously
for i in {1..10}; do
  curl -X POST http://localhost:8000/tasks \
    -H "Content-Type: application/json" \
    -d "{\"code\": \"print('Task $i')\", \"prompt\": \"Task $i\"}" &
done
wait

# Check task distribution
curl http://localhost:8000/tasks | jq '.tasks[] | {task_id, worker_id, status}'
```

## Troubleshooting

### Redis Connection Failed
**Error:** `redis.exceptions.ConnectionError: Error connecting to Redis`

**Solutions:**
1. Check if Redis is running:
   ```bash
   docker compose ps redis
   ```
2. Verify Redis password in `.env` file
3. Test Redis connection:
   ```bash
   redis-cli -h localhost -p 6379 -a your_password ping
   # Should respond: PONG
   ```

### Worker Not Picking Up Tasks
**Symptoms:** Tasks stay in "queued" status

**Solutions:**
1. Check if worker is running:
   ```bash
   ps aux | grep worker.py
   ```
2. Check worker logs for errors
3. Verify worker heartbeat:
   ```bash
   curl http://localhost:8000/workers
   ```
4. Check Redis queue:
   ```bash
   redis-cli -a your_password LLEN task:pending
   # Should show number of pending tasks
   ```

### Port Already in Use
**Error:** `Address already in use: 8000`

**Solutions:**
1. Find process using the port:
   ```bash
   lsof -i :8000
   ```
2. Kill the process:
   ```bash
   kill -9 <PID>
   ```
3. Or use a different port:
   ```bash
   ORCHESTRATOR_PORT=8001 uvicorn main:app
   ```

### Database Locked
**Error:** `sqlite3.OperationalError: database is locked`

**Solutions:**
1. Only run one orchestrator instance with SQLite
2. Check for stale database locks:
   ```bash
   rm data/tasks.db-journal
   ```
3. For production, migrate to PostgreSQL

### Task Timeout
**Symptoms:** Task marked as failed after some time

**Solutions:**
1. Increase timeout in task submission:
   ```json
   {
     "code": "...",
     "prompt": "...",
     "timeout": 600
   }
   ```
2. Check worker logs for execution errors
3. Verify task code is valid

## Development Workflow

### Making Code Changes

#### Orchestrator Changes
```bash
# 1. Make changes to src/orchestrator/*.py
# 2. If running with uvicorn --reload, it auto-restarts
# 3. If using Docker Compose:
docker compose restart orchestrator
```

#### Worker Changes
```bash
# 1. Make changes to src/worker/*.py
# 2. Stop worker (Ctrl+C)
# 3. Restart worker:
python src/worker/worker.py
```

### Running Tests
```bash
# Install test dependencies
pip install pytest pytest-asyncio httpx

# Run all tests
pytest tests/

# Run specific test file
pytest tests/test_orchestrator.py

# Run with coverage
pytest --cov=src tests/
```

### Debugging

#### Enable Debug Logging
```bash
# In .env file
LOG_LEVEL=DEBUG

# Or via environment variable
LOG_LEVEL=DEBUG python src/worker/worker.py
```

#### Inspect Redis Data
```bash
# Connect to Redis CLI
redis-cli -h localhost -p 6379 -a your_password

# Check pending tasks
LRANGE task:pending 0 -1

# Check results
LRANGE task:results 0 -1

# Check worker heartbeats
KEYS worker:*:heartbeat
```

#### Inspect SQLite Database
```bash
sqlite3 data/tasks.db

# Show all tasks
SELECT * FROM tasks;

# Show tasks by status
SELECT id, status, created_at, completed_at FROM tasks WHERE status = 'completed';

# Exit
.quit
```

## Next Steps

Now that you have the basic setup running, you can:

1. **Read the Architecture Overview** - [architecture-overview.md](architecture-overview.md)
2. **Explore API Reference** - [api-reference.md](api-reference.md)
3. **Follow Development Guide** - [development-guide.md](development-guide.md)
4. **Deploy Cloud Worker** - See task-06 in [tasks/](../tasks/)
5. **Customize for Your Needs** - Extend with new features

## Common Use Cases

### Use Case 1: Batch Processing
Submit multiple tasks and wait for all to complete:
```bash
# submit-batch.sh
for i in {1..100}; do
  curl -s -X POST http://localhost:8000/tasks \
    -H "Content-Type: application/json" \
    -d "{\"code\": \"print($i * $i)\", \"prompt\": \"Calculate square\"}" \
    | jq -r '.task_id'
done > task_ids.txt

# Wait for completion
while true; do
  completed=$(curl -s "http://localhost:8000/tasks?status=completed" | jq '.total')
  echo "Completed: $completed / 100"
  [ $completed -eq 100 ] && break
  sleep 5
done
```

### Use Case 2: Development Testing
Run a local worker for testing during development:
```bash
# Start in debug mode with custom ID
LOG_LEVEL=DEBUG python src/worker/worker.py \
  --worker-id dev-$(whoami) \
  --poll-interval 1
```

### Use Case 3: Production Deployment
Deploy orchestrator and cloud worker to production:
```bash
# Build production images
docker build -t orchestrator:prod ./src/orchestrator
docker build -t worker:prod ./src/worker

# Push to registry
docker tag orchestrator:prod registry.example.com/orchestrator:latest
docker push registry.example.com/orchestrator:latest

# Deploy to production
# (See deployment documentation)
```

## Getting Help

- **Documentation:** Check [docs/](../docs/) folder
- **Issues:** Open an issue on GitHub
- **Tasks:** Detailed implementation guides in [tasks/](../tasks/)
- **API Reference:** Full API documentation in [api-reference.md](api-reference.md)

## Summary Checklist

✅ Python 3.11+ installed
✅ Docker & Docker Compose installed
✅ Repository cloned
✅ Environment variables configured
✅ Docker services running
✅ Local worker started
✅ Test task submitted successfully
✅ Dashboard accessible
✅ Health check passing

If all items are checked, you're ready to start development! 🎉