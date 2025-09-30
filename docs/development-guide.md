# Development Guide

This guide provides detailed information for developers working on the Claude Orchestrator project.

## Table of Contents

1. [Development Environment Setup](#development-environment-setup)
2. [Project Structure](#project-structure)
3. [Code Style and Standards](#code-style-and-standards)
4. [Architecture Deep Dive](#architecture-deep-dive)
5. [Database Schema](#database-schema)
6. [Redis Data Structures](#redis-data-structures)
7. [Testing Strategy](#testing-strategy)
8. [Debugging Tips](#debugging-tips)
9. [Performance Optimization](#performance-optimization)
10. [Deployment Guide](#deployment-guide)
11. [Contributing Guidelines](#contributing-guidelines)

---

## Development Environment Setup

### Prerequisites

- Python 3.11 or higher
- Docker Desktop
- Git
- VS Code (recommended) or your preferred IDE

### Initial Setup

```bash
# Clone repository
cd ~/dev
git clone <repository-url> claude-orchestrator
cd claude-orchestrator

# Create Python virtual environment for orchestrator
cd src/orchestrator
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
pip install -r requirements-dev.txt  # Development dependencies

# Create virtual environment for worker
cd ../worker
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-dev.txt

# Copy environment template
cd ../..
cp .env.example .env

# Edit .env with your local configuration
nano .env
```

### VS Code Setup

Install recommended extensions:
```json
{
  "recommendations": [
    "ms-python.python",
    "ms-python.vscode-pylance",
    "ms-python.black-formatter",
    "ms-python.isort",
    "charliermarsh.ruff",
    "redhat.vscode-yaml",
    "ms-azuretools.vscode-docker"
  ]
}
```

Configure workspace settings (`.vscode/settings.json`):
```json
{
  "python.linting.enabled": true,
  "python.linting.pylintEnabled": false,
  "python.linting.flake8Enabled": true,
  "python.formatting.provider": "black",
  "python.testing.pytestEnabled": true,
  "python.testing.unittestEnabled": false,
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports": true
  }
}
```

---

## Project Structure

```
claude-orchestrator/
├── .github/                    # GitHub Actions workflows
│   └── workflows/
│       ├── test.yml           # Run tests on PR
│       └── deploy.yml         # Deploy on merge to main
├── docs/                       # Documentation
│   ├── architecture-overview.md
│   ├── getting-started.md
│   ├── api-reference.md
│   └── development-guide.md
├── tasks/                      # Implementation task guides
│   ├── task-01-setup-project.md
│   ├── task-02-orchestrator-core.md
│   └── ...
├── src/
│   ├── orchestrator/           # Orchestrator service
│   │   ├── __init__.py
│   │   ├── main.py            # FastAPI app entry point
│   │   ├── api/               # API route handlers
│   │   │   ├── __init__.py
│   │   │   ├── tasks.py       # Task endpoints
│   │   │   ├── workers.py     # Worker endpoints
│   │   │   └── health.py      # Health check
│   │   ├── models/            # Data models
│   │   │   ├── __init__.py
│   │   │   ├── task.py        # Task model
│   │   │   └── worker.py      # Worker model
│   │   ├── services/          # Business logic
│   │   │   ├── __init__.py
│   │   │   ├── task_service.py
│   │   │   ├── worker_service.py
│   │   │   └── result_processor.py
│   │   ├── database.py        # SQLite operations
│   │   ├── redis_client.py    # Redis operations
│   │   ├── config.py          # Configuration management
│   │   ├── requirements.txt   # Production dependencies
│   │   ├── requirements-dev.txt  # Development dependencies
│   │   └── Dockerfile
│   ├── worker/                 # Worker script
│   │   ├── __init__.py
│   │   ├── worker.py          # Main worker loop
│   │   ├── executor.py        # Task execution logic
│   │   ├── heartbeat.py       # Heartbeat management
│   │   ├── config.py          # Worker configuration
│   │   ├── requirements.txt
│   │   ├── requirements-dev.txt
│   │   └── Dockerfile
│   └── dashboard/              # Simple web dashboard
│       ├── index.html
│       ├── app.js
│       ├── styles.css
│       └── Dockerfile
├── scripts/                    # Utility scripts
│   ├── setup.sh               # Initial setup script
│   ├── test-api.sh            # API testing script
│   ├── seed-tasks.sh          # Create test tasks
│   └── cleanup.sh             # Clean up data/logs
├── tests/                      # Test files
│   ├── __init__.py
│   ├── conftest.py            # Pytest fixtures
│   ├── orchestrator/
│   │   ├── test_api.py
│   │   ├── test_database.py
│   │   ├── test_redis.py
│   │   └── test_services.py
│   └── worker/
│       ├── test_worker.py
│       └── test_executor.py
├── data/                       # Runtime data (gitignored)
│   ├── tasks.db               # SQLite database
│   └── logs/                  # Log files
├── .env.example               # Environment template
├── .env                       # Local environment (gitignored)
├── .gitignore
├── docker-compose.yml         # Local development
├── docker-compose.prod.yml    # Production deployment
├── README.md
└── pyproject.toml             # Python project config
```

---

## Code Style and Standards

### Python Code Style

We follow PEP 8 with some modifications:

- **Line length:** 88 characters (Black default)
- **Indentation:** 4 spaces
- **Quotes:** Double quotes for strings
- **Import order:** Standard library, third-party, local (isort)

### Formatting Tools

```bash
# Format code with Black
black src/

# Sort imports with isort
isort src/

# Lint with Ruff
ruff check src/

# Type check with mypy
mypy src/
```

### Type Hints

Always use type hints for function parameters and return values:

```python
from typing import Optional, List, Dict, Any

def create_task(
    code: str,
    prompt: str,
    timeout: int = 300
) -> Dict[str, Any]:
    """Create a new task.

    Args:
        code: The code to execute
        prompt: Description of the task
        timeout: Maximum execution time in seconds

    Returns:
        Dictionary containing task_id and status

    Raises:
        ValueError: If code or prompt is empty
    """
    if not code or not prompt:
        raise ValueError("Code and prompt are required")

    # Implementation...
    return {"task_id": "...", "status": "queued"}
```

### Docstrings

Use Google-style docstrings:

```python
def process_result(task_id: str, result: Dict[str, Any]) -> None:
    """Process task result and update database.

    This function takes a task result from Redis, validates it,
    updates the task status in SQLite, and logs the completion.

    Args:
        task_id: Unique identifier for the task
        result: Dictionary containing execution results with keys:
            - stdout: Standard output
            - stderr: Standard error
            - exit_code: Process exit code

    Raises:
        ValueError: If result is missing required fields
        DatabaseError: If database update fails

    Example:
        >>> result = {"stdout": "Hello", "stderr": "", "exit_code": 0}
        >>> process_result("task-123", result)
    """
    pass
```

### Logging

Use structured logging with appropriate levels:

```python
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

# Info: Normal operations
logger.info("Task created", extra={
    "task_id": task_id,
    "worker_id": worker_id,
    "timestamp": datetime.utcnow().isoformat()
})

# Warning: Unexpected but handled situations
logger.warning("Worker heartbeat late", extra={
    "worker_id": worker_id,
    "last_heartbeat": last_heartbeat,
    "threshold_seconds": 30
})

# Error: Operation failures
logger.error("Failed to update database", extra={
    "task_id": task_id,
    "error": str(error)
}, exc_info=True)

# Debug: Detailed information for troubleshooting
logger.debug("Redis command executed", extra={
    "command": "BLPOP",
    "key": "task:pending",
    "timeout": 5
})
```

### Error Handling

Use specific exceptions and provide context:

```python
class TaskError(Exception):
    """Base exception for task-related errors."""
    pass

class TaskNotFoundError(TaskError):
    """Raised when a task cannot be found."""
    pass

class TaskTimeoutError(TaskError):
    """Raised when a task exceeds its timeout."""
    pass

# Usage
try:
    task = get_task(task_id)
    if task is None:
        raise TaskNotFoundError(f"Task {task_id} not found")
except TaskNotFoundError as e:
    logger.error("Task retrieval failed", exc_info=True)
    return {"error": "not_found", "message": str(e)}, 404
except Exception as e:
    logger.error("Unexpected error", exc_info=True)
    return {"error": "internal_error", "message": "An error occurred"}, 500
```

---

## Architecture Deep Dive

### Orchestrator Components

#### 1. FastAPI Application (`main.py`)

```python
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from api import tasks, workers, health
from services.result_processor import ResultProcessor
from database import init_db
from redis_client import init_redis

app = FastAPI(title="Claude Orchestrator", version="0.1.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
app.include_router(workers.router, prefix="/workers", tags=["workers"])
app.include_router(health.router, tags=["health"])

@app.on_event("startup")
async def startup_event():
    """Initialize dependencies on startup."""
    init_db()
    init_redis()
    # Start background result processor
    result_processor = ResultProcessor()
    result_processor.start()

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up on shutdown."""
    # Stop background tasks
    pass

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

#### 2. Database Layer (`database.py`)

```python
import sqlite3
from contextlib import contextmanager
from typing import Optional, List, Dict, Any
import json
from datetime import datetime

DATABASE_PATH = "data/tasks.db"

def init_db():
    """Initialize database schema."""
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                status TEXT NOT NULL,
                code TEXT NOT NULL,
                prompt TEXT NOT NULL,
                result TEXT,
                worker_id TEXT,
                error_message TEXT,
                timeout INTEGER DEFAULT 300,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                started_at TIMESTAMP,
                completed_at TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_status
            ON tasks(status)
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_created_at
            ON tasks(created_at DESC)
        """)

@contextmanager
def get_db():
    """Context manager for database connections."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row  # Enable column access by name
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def create_task(task_id: str, code: str, prompt: str, timeout: int = 300) -> Dict[str, Any]:
    """Create a new task in database."""
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO tasks (id, status, code, prompt, timeout)
            VALUES (?, ?, ?, ?, ?)
            """,
            (task_id, "queued", code, prompt, timeout)
        )
    return get_task(task_id)

def get_task(task_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve a task by ID."""
    with get_db() as conn:
        cursor = conn.execute(
            "SELECT * FROM tasks WHERE id = ?",
            (task_id,)
        )
        row = cursor.fetchone()
        if row:
            return dict(row)
        return None

def update_task_status(
    task_id: str,
    status: str,
    worker_id: Optional[str] = None,
    result: Optional[Dict[str, Any]] = None,
    error_message: Optional[str] = None
):
    """Update task status and related fields."""
    with get_db() as conn:
        updates = ["status = ?"]
        params = [status]

        if worker_id:
            updates.append("worker_id = ?")
            params.append(worker_id)

        if status == "running":
            updates.append("started_at = CURRENT_TIMESTAMP")
        elif status in ["completed", "failed"]:
            updates.append("completed_at = CURRENT_TIMESTAMP")

        if result:
            updates.append("result = ?")
            params.append(json.dumps(result))

        if error_message:
            updates.append("error_message = ?")
            params.append(error_message)

        params.append(task_id)

        conn.execute(
            f"UPDATE tasks SET {', '.join(updates)} WHERE id = ?",
            params
        )
```

#### 3. Redis Client (`redis_client.py`)

```python
import redis
import json
from typing import Optional, Dict, Any, List
from config import settings

redis_client: Optional[redis.Redis] = None

def init_redis():
    """Initialize Redis connection."""
    global redis_client
    redis_client = redis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        password=settings.REDIS_PASSWORD,
        decode_responses=True
    )
    # Test connection
    redis_client.ping()

def enqueue_task(task_id: str, task_data: Dict[str, Any]) -> int:
    """Add task to pending queue.

    Returns:
        Position in queue (1-indexed)
    """
    task_json = json.dumps(task_data)
    return redis_client.rpush("task:pending", task_json)

def dequeue_task(timeout: int = 5) -> Optional[Dict[str, Any]]:
    """Remove and return task from pending queue (blocking).

    Args:
        timeout: Seconds to wait for a task

    Returns:
        Task data dictionary or None if timeout
    """
    result = redis_client.blpop("task:pending", timeout=timeout)
    if result:
        _, task_json = result
        return json.loads(task_json)
    return None

def enqueue_result(result_data: Dict[str, Any]):
    """Add result to result queue."""
    result_json = json.dumps(result_data)
    redis_client.rpush("task:results", result_json)

def dequeue_result(timeout: int = 5) -> Optional[Dict[str, Any]]:
    """Remove and return result from result queue (blocking)."""
    result = redis_client.blpop("task:results", timeout=timeout)
    if result:
        _, result_json = result
        return json.loads(result_json)
    return None

def set_worker_heartbeat(worker_id: str, ttl: int = 30):
    """Update worker heartbeat with TTL."""
    key = f"worker:{worker_id}:heartbeat"
    redis_client.setex(key, ttl, str(int(time.time())))

def get_active_workers() -> List[str]:
    """Get list of workers with active heartbeats."""
    pattern = "worker:*:heartbeat"
    keys = redis_client.keys(pattern)
    # Extract worker_id from keys
    workers = [key.split(":")[1] for key in keys]
    return workers

def get_queue_depth() -> int:
    """Get number of pending tasks."""
    return redis_client.llen("task:pending")
```

### Worker Components

#### Worker Main Loop (`worker.py`)

```python
import time
import logging
from typing import Optional
from redis_client import dequeue_task, enqueue_result, set_worker_heartbeat
from executor import execute_task
from config import settings

logger = logging.getLogger(__name__)

class Worker:
    def __init__(self, worker_id: str, worker_type: str = "local"):
        self.worker_id = worker_id
        self.worker_type = worker_type
        self.running = False

    def start(self):
        """Start worker main loop."""
        self.running = True
        logger.info(f"Worker {self.worker_id} starting...")

        while self.running:
            try:
                # Send heartbeat
                set_worker_heartbeat(self.worker_id)

                # Poll for task
                task = dequeue_task(timeout=settings.POLL_INTERVAL)

                if task:
                    logger.info(f"Received task {task['task_id']}")
                    self.process_task(task)
                else:
                    logger.debug("No tasks available")

            except KeyboardInterrupt:
                logger.info("Worker stopping...")
                self.running = False
            except Exception as e:
                logger.error(f"Worker error: {e}", exc_info=True)
                time.sleep(5)  # Back off on error

    def process_task(self, task: dict):
        """Process a single task."""
        task_id = task["task_id"]
        code = task["code"]
        timeout = task.get("timeout", 300)

        try:
            # Execute task
            result = execute_task(code, timeout)

            # Report success
            enqueue_result({
                "task_id": task_id,
                "worker_id": self.worker_id,
                "status": "completed",
                "result": result
            })

            logger.info(f"Task {task_id} completed successfully")

        except TimeoutError:
            # Report timeout
            enqueue_result({
                "task_id": task_id,
                "worker_id": self.worker_id,
                "status": "failed",
                "error_message": f"Task exceeded timeout of {timeout}s"
            })
            logger.warning(f"Task {task_id} timed out")

        except Exception as e:
            # Report failure
            enqueue_result({
                "task_id": task_id,
                "worker_id": self.worker_id,
                "status": "failed",
                "error_message": str(e)
            })
            logger.error(f"Task {task_id} failed: {e}", exc_info=True)

if __name__ == "__main__":
    worker = Worker(
        worker_id=settings.WORKER_ID,
        worker_type=settings.WORKER_TYPE
    )
    worker.start()
```

#### Task Executor (`executor.py`)

```python
import subprocess
import tempfile
import os
from typing import Dict, Any

def execute_task(code: str, timeout: int = 300) -> Dict[str, Any]:
    """Execute code and return results.

    Args:
        code: Code to execute
        timeout: Maximum execution time in seconds

    Returns:
        Dictionary with stdout, stderr, and exit_code

    Raises:
        TimeoutError: If execution exceeds timeout
        subprocess.SubprocessError: If execution fails
    """
    # Create temporary file for code
    with tempfile.NamedTemporaryFile(
        mode='w',
        suffix='.py',
        delete=False
    ) as f:
        f.write(code)
        temp_file = f.name

    try:
        # Execute code
        process = subprocess.run(
            ["python", temp_file],
            capture_output=True,
            text=True,
            timeout=timeout
        )

        return {
            "stdout": process.stdout,
            "stderr": process.stderr,
            "exit_code": process.returncode
        }

    except subprocess.TimeoutExpired:
        raise TimeoutError(f"Execution exceeded {timeout} seconds")

    finally:
        # Clean up temp file
        if os.path.exists(temp_file):
            os.remove(temp_file)
```

---

## Database Schema

### Tasks Table

```sql
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,              -- UUID format
    status TEXT NOT NULL,             -- queued, running, completed, failed
    code TEXT NOT NULL,               -- Code to execute
    prompt TEXT NOT NULL,             -- Task description
    result TEXT,                      -- JSON string of execution results
    worker_id TEXT,                   -- Which worker processed this
    error_message TEXT,               -- Error details if failed
    timeout INTEGER DEFAULT 300,      -- Maximum execution time (seconds)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,             -- When execution began
    completed_at TIMESTAMP            -- When execution finished
);

-- Indexes for performance
CREATE INDEX idx_status ON tasks(status);
CREATE INDEX idx_created_at ON tasks(created_at DESC);
CREATE INDEX idx_worker_id ON tasks(worker_id);
```

### Queries for Common Operations

```sql
-- Get pending task count
SELECT COUNT(*) FROM tasks WHERE status = 'queued';

-- Get task statistics
SELECT
    status,
    COUNT(*) as count,
    AVG(
        CAST((julianday(completed_at) - julianday(started_at)) * 86400000 AS INTEGER)
    ) as avg_execution_ms
FROM tasks
WHERE completed_at IS NOT NULL
GROUP BY status;

-- Get worker performance
SELECT
    worker_id,
    COUNT(*) as tasks_completed,
    AVG(
        CAST((julianday(completed_at) - julianday(started_at)) * 86400000 AS INTEGER)
    ) as avg_execution_ms
FROM tasks
WHERE status = 'completed'
GROUP BY worker_id
ORDER BY tasks_completed DESC;

-- Clean up old completed tasks (older than 7 days)
DELETE FROM tasks
WHERE status IN ('completed', 'failed')
AND completed_at < datetime('now', '-7 days');
```

---

## Redis Data Structures

### Task Queue (List)
```
Key: task:pending
Type: List
Operations:
  - RPUSH: Add task to end of queue
  - BLPOP: Remove task from front (blocking)
  - LLEN: Get queue depth
  - LRANGE: Peek at queue contents (debugging)

Example:
> RPUSH task:pending '{"task_id": "123", "code": "print(1)"}'
> BLPOP task:pending 5  # Wait up to 5 seconds
```

### Result Queue (List)
```
Key: task:results
Type: List
Operations:
  - RPUSH: Worker adds result
  - BLPOP: Orchestrator retrieves result

Example:
> RPUSH task:results '{"task_id": "123", "status": "completed"}'
```

### Worker Heartbeats (Keys with TTL)
```
Key: worker:{worker_id}:heartbeat
Type: String
TTL: 30 seconds
Operations:
  - SETEX: Update heartbeat with TTL
  - EXISTS: Check if worker is alive
  - KEYS: Find all active workers

Example:
> SETEX worker:cloud-1:heartbeat 30 "1642251600"
> KEYS worker:*:heartbeat
```

### Worker Info (Hash)
```
Key: worker:{worker_id}:info
Type: Hash
Fields:
  - type: cloud|local
  - started_at: timestamp
  - tasks_completed: counter

Example:
> HSET worker:cloud-1:info type cloud started_at 1642251600
> HINCRBY worker:cloud-1:info tasks_completed 1
```

---

## Testing Strategy

### Unit Tests

Test individual functions in isolation:

```python
# tests/orchestrator/test_database.py
import pytest
from orchestrator.database import create_task, get_task, update_task_status

def test_create_task():
    """Test creating a new task."""
    task_id = "test-123"
    task = create_task(task_id, "print(1)", "Test task")

    assert task["id"] == task_id
    assert task["status"] == "queued"
    assert task["code"] == "print(1)"

def test_get_nonexistent_task():
    """Test retrieving non-existent task returns None."""
    task = get_task("nonexistent")
    assert task is None

def test_update_task_status():
    """Test updating task status."""
    task_id = "test-456"
    create_task(task_id, "print(2)", "Test")

    update_task_status(task_id, "running", worker_id="worker-1")
    task = get_task(task_id)

    assert task["status"] == "running"
    assert task["worker_id"] == "worker-1"
    assert task["started_at"] is not None
```

### Integration Tests

Test multiple components working together:

```python
# tests/orchestrator/test_api.py
from fastapi.testclient import TestClient
from orchestrator.main import app

client = TestClient(app)

def test_submit_and_retrieve_task():
    """Test full task submission and retrieval flow."""
    # Submit task
    response = client.post(
        "/tasks",
        json={"code": "print('test')", "prompt": "Test task"}
    )
    assert response.status_code == 202
    task_id = response.json()["task_id"]

    # Retrieve task
    response = client.get(f"/tasks/{task_id}")
    assert response.status_code == 200
    assert response.json()["status"] == "queued"
```

### End-to-End Tests

Test complete system including Redis:

```python
# tests/test_e2e.py
import time
import pytest
from orchestrator.redis_client import enqueue_task, dequeue_result
from worker.worker import Worker

def test_task_execution_e2e():
    """Test task from submission to completion."""
    # Enqueue task
    task_id = "e2e-test"
    enqueue_task(task_id, {
        "task_id": task_id,
        "code": "print('e2e test')",
        "timeout": 60
    })

    # Start worker in background thread
    worker = Worker("test-worker")
    worker_thread = threading.Thread(target=worker.start)
    worker_thread.start()

    # Wait for result
    result = dequeue_result(timeout=30)
    worker.running = False
    worker_thread.join()

    # Verify result
    assert result["task_id"] == task_id
    assert result["status"] == "completed"
    assert "e2e test" in result["result"]["stdout"]
```

### Running Tests

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/orchestrator/test_api.py

# Run with coverage
pytest --cov=src --cov-report=html

# Run with verbose output
pytest -v

# Run specific test
pytest tests/orchestrator/test_api.py::test_submit_task

# Run tests matching pattern
pytest -k "test_task"
```

---

## Debugging Tips

### Debug Orchestrator

```bash
# Run with debug logging
LOG_LEVEL=DEBUG uvicorn main:app --reload

# Use Python debugger
import pdb; pdb.set_trace()

# Or use breakpoint() (Python 3.7+)
breakpoint()
```

### Debug Worker

```bash
# Run with debug logging
LOG_LEVEL=DEBUG python worker.py --worker-id debug-worker

# Print Redis commands
redis-cli MONITOR
```

### Debug Redis Issues

```bash
# Connect to Redis CLI
redis-cli -h localhost -p 6379 -a password

# Check queue contents
LRANGE task:pending 0 -1
LRANGE task:results 0 -1

# Check worker heartbeats
KEYS worker:*:heartbeat
TTL worker:cloud-1:heartbeat

# Monitor all commands
MONITOR

# Check memory usage
INFO memory

# Clear all data (careful!)
FLUSHALL
```

### Debug SQLite Issues

```bash
# Open database
sqlite3 data/tasks.db

# Check schema
.schema tasks

# Query tasks
SELECT * FROM tasks ORDER BY created_at DESC LIMIT 10;

# Check for locks
.timeout 5000

# Enable detailed error messages
.echo on
.headers on
.mode column
```

---

## Performance Optimization

### Database Optimization

```python
# Use transactions for bulk inserts
with get_db() as conn:
    for task in tasks:
        conn.execute("INSERT INTO tasks (...) VALUES (...)", task)
    # Commit happens automatically

# Use indexes
CREATE INDEX idx_status_created ON tasks(status, created_at DESC);

# VACUUM database periodically
VACUUM;

# Analyze query plans
EXPLAIN QUERY PLAN SELECT * FROM tasks WHERE status = 'queued';
```

### Redis Optimization

```python
# Use pipelines for multiple commands
pipe = redis_client.pipeline()
for task in tasks:
    pipe.rpush("task:pending", json.dumps(task))
pipe.execute()

# Use connection pooling (automatic with redis-py)

# Monitor slow commands
redis-cli --latency
redis-cli --latency-history
```

### API Optimization

```python
# Use async endpoints for I/O operations
from fastapi import FastAPI
import asyncio

@app.get("/tasks")
async def list_tasks():
    # This doesn't block other requests
    tasks = await asyncio.to_thread(get_all_tasks)
    return tasks

# Add caching
from fastapi_cache import FastAPICache
from fastapi_cache.decorator import cache

@app.get("/stats")
@cache(expire=60)  # Cache for 60 seconds
async def get_stats():
    return calculate_stats()
```

---

## Deployment Guide

### Docker Build

```bash
# Build orchestrator image
cd src/orchestrator
docker build -t claude-orchestrator:latest .

# Build worker image
cd src/worker
docker build -t claude-worker:latest .

# Test images locally
docker run -p 8000:8000 claude-orchestrator:latest
docker run claude-worker:latest
```

### Production Deployment

See detailed deployment guides in the tasks folder for specific platforms:
- AWS (EC2, ECS, Lambda)
- DigitalOcean
- fly.io
- Kubernetes

---

## Contributing Guidelines

### Branching Strategy

- `main`: Production-ready code
- `develop`: Development branch
- `feature/*`: New features
- `bugfix/*`: Bug fixes
- `hotfix/*`: Urgent production fixes

### Pull Request Process

1. Create feature branch from `develop`
2. Implement changes with tests
3. Run tests and linting locally
4. Create PR with descriptive title and description
5. Request code review
6. Address review comments
7. Merge after approval

### Code Review Checklist

- [ ] Code follows style guide
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No security vulnerabilities
- [ ] Performance considered
- [ ] Error handling implemented
- [ ] Logging added appropriately

---

For additional help, see the [Getting Started Guide](getting-started.md) or [API Reference](api-reference.md).