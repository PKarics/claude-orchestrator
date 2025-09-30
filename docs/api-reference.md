# API Reference

This document provides a comprehensive reference for the Claude Orchestrator REST API.

## Base URL

```
http://localhost:8000
```

For production deployments, replace with your orchestrator's hostname.

## Authentication

All API endpoints (except `/health`) require authentication using an API key.

### API Key Header
```
Authorization: Bearer YOUR_API_KEY
```

### Example with curl
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:8000/tasks
```

---

## Endpoints

### Health Check

#### `GET /health`

Check if the orchestrator service is healthy and can connect to its dependencies.

**Authentication:** Not required

**Response (200 OK):**
```json
{
  "status": "healthy",
  "redis_connected": true,
  "database_connected": true,
  "active_workers": 2,
  "version": "0.1.0"
}
```

**Response Fields:**
- `status` (string): Overall health status ("healthy" or "unhealthy")
- `redis_connected` (boolean): Whether Redis connection is working
- `database_connected` (boolean): Whether SQLite database is accessible
- `active_workers` (integer): Number of workers with recent heartbeats
- `version` (string): Orchestrator version

**Error Response (503 Service Unavailable):**
```json
{
  "status": "unhealthy",
  "redis_connected": false,
  "database_connected": true,
  "active_workers": 0,
  "error": "Cannot connect to Redis"
}
```

**Example:**
```bash
curl http://localhost:8000/health
```

---

### Create Task

#### `POST /tasks`

Submit a new task for execution by available workers.

**Authentication:** Required

**Request Body:**
```json
{
  "code": "print('Hello, World!')",
  "prompt": "Execute this Python code",
  "timeout": 300,
  "priority": "normal"
}
```

**Request Fields:**
- `code` (string, required): Code to execute
- `prompt` (string, required): Description of what the code should do
- `timeout` (integer, optional): Maximum execution time in seconds (default: 300)
- `priority` (string, optional): Task priority - "low", "normal", "high" (default: "normal")

**Response (202 Accepted):**
```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "created_at": "2025-01-15T10:30:00Z",
  "queue_position": 3
}
```

**Response Fields:**
- `task_id` (string): Unique identifier for the task (UUID format)
- `status` (string): Initial task status (always "queued")
- `created_at` (string): ISO 8601 timestamp of task creation
- `queue_position` (integer): Position in queue (1 = next to be processed)

**Error Responses:**

**400 Bad Request** - Invalid request data
```json
{
  "error": "validation_error",
  "message": "Field 'code' is required",
  "details": {
    "field": "code",
    "issue": "missing_field"
  }
}
```

**401 Unauthorized** - Missing or invalid API key
```json
{
  "error": "unauthorized",
  "message": "Invalid or missing API key"
}
```

**Example:**
```bash
curl -X POST http://localhost:8000/tasks \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "import time; time.sleep(5); print(\"Done!\")",
    "prompt": "Sleep for 5 seconds then print",
    "timeout": 10
  }'
```

---

### Get Task Status

#### `GET /tasks/{task_id}`

Retrieve the current status and results of a specific task.

**Authentication:** Required

**URL Parameters:**
- `task_id` (string, required): The UUID of the task

**Response (200 OK) - Queued Task:**
```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "code": "print('Hello, World!')",
  "prompt": "Execute this Python code",
  "created_at": "2025-01-15T10:30:00Z",
  "queue_position": 2
}
```

**Response (200 OK) - Running Task:**
```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "running",
  "code": "print('Hello, World!')",
  "prompt": "Execute this Python code",
  "worker_id": "cloud-worker-1",
  "created_at": "2025-01-15T10:30:00Z",
  "started_at": "2025-01-15T10:30:05Z"
}
```

**Response (200 OK) - Completed Task:**
```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "code": "print('Hello, World!')",
  "prompt": "Execute this Python code",
  "worker_id": "local-worker-abc",
  "result": {
    "stdout": "Hello, World!\n",
    "stderr": "",
    "exit_code": 0
  },
  "created_at": "2025-01-15T10:30:00Z",
  "started_at": "2025-01-15T10:30:05Z",
  "completed_at": "2025-01-15T10:30:10Z",
  "execution_time_ms": 5234
}
```

**Response (200 OK) - Failed Task:**
```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "failed",
  "code": "print(undefined_variable)",
  "prompt": "Execute this Python code",
  "worker_id": "cloud-worker-2",
  "error_message": "NameError: name 'undefined_variable' is not defined",
  "result": {
    "stdout": "",
    "stderr": "Traceback (most recent call last)...",
    "exit_code": 1
  },
  "created_at": "2025-01-15T10:30:00Z",
  "started_at": "2025-01-15T10:30:05Z",
  "completed_at": "2025-01-15T10:30:08Z",
  "execution_time_ms": 3120
}
```

**Status Values:**
- `queued`: Task is waiting for a worker
- `running`: Task is currently being executed by a worker
- `completed`: Task finished successfully
- `failed`: Task execution failed or timed out

**Error Response (404 Not Found):**
```json
{
  "error": "not_found",
  "message": "Task with ID '550e8400-...' not found"
}
```

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:8000/tasks/550e8400-e29b-41d4-a716-446655440000
```

---

### List Tasks

#### `GET /tasks`

Retrieve a list of tasks with optional filtering and pagination.

**Authentication:** Required

**Query Parameters:**
- `status` (string, optional): Filter by status - "queued", "running", "completed", "failed"
- `limit` (integer, optional): Maximum number of results (default: 50, max: 500)
- `offset` (integer, optional): Number of results to skip for pagination (default: 0)
- `sort` (string, optional): Sort field - "created_at", "completed_at" (default: "created_at")
- `order` (string, optional): Sort order - "asc", "desc" (default: "desc")

**Response (200 OK):**
```json
{
  "tasks": [
    {
      "task_id": "550e8400-e29b-41d4-a716-446655440000",
      "status": "completed",
      "worker_id": "local-worker-1",
      "created_at": "2025-01-15T10:30:00Z",
      "completed_at": "2025-01-15T10:30:10Z"
    },
    {
      "task_id": "661f9511-f3ac-52e5-b827-557766551111",
      "status": "running",
      "worker_id": "cloud-worker-1",
      "created_at": "2025-01-15T10:29:50Z",
      "started_at": "2025-01-15T10:29:55Z"
    }
  ],
  "total": 42,
  "limit": 50,
  "offset": 0,
  "has_more": false
}
```

**Response Fields:**
- `tasks` (array): Array of task summary objects
- `total` (integer): Total number of tasks matching the filter
- `limit` (integer): Number of results per page
- `offset` (integer): Current offset
- `has_more` (boolean): Whether there are more results available

**Example - Get all completed tasks:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "http://localhost:8000/tasks?status=completed&limit=20"
```

**Example - Pagination:**
```bash
# First page
curl "http://localhost:8000/tasks?limit=10&offset=0"

# Second page
curl "http://localhost:8000/tasks?limit=10&offset=10"
```

---

### List Workers

#### `GET /workers`

Retrieve a list of all active workers and their status.

**Authentication:** Required

**Response (200 OK):**
```json
{
  "workers": [
    {
      "worker_id": "cloud-worker-1",
      "type": "cloud",
      "status": "active",
      "last_heartbeat": "2025-01-15T10:30:45Z",
      "started_at": "2025-01-15T09:00:00Z",
      "tasks_completed": 127,
      "current_task_id": "550e8400-e29b-41d4-a716-446655440000"
    },
    {
      "worker_id": "local-worker-abc",
      "type": "local",
      "status": "active",
      "last_heartbeat": "2025-01-15T10:30:43Z",
      "started_at": "2025-01-15T10:00:00Z",
      "tasks_completed": 23,
      "current_task_id": null
    },
    {
      "worker_id": "cloud-worker-2",
      "type": "cloud",
      "status": "stale",
      "last_heartbeat": "2025-01-15T10:29:00Z",
      "started_at": "2025-01-15T09:00:00Z",
      "tasks_completed": 89,
      "current_task_id": null
    }
  ],
  "total_workers": 3,
  "active_workers": 2,
  "cloud_workers": 2,
  "local_workers": 1
}
```

**Worker Status Values:**
- `active`: Worker sent heartbeat within last 30 seconds
- `stale`: Worker hasn't sent heartbeat for 30-60 seconds
- `dead`: Worker hasn't sent heartbeat for over 60 seconds (typically not shown)

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:8000/workers
```

---

### Delete Task

#### `DELETE /tasks/{task_id}`

Delete a task and its results from the system.

**Authentication:** Required

**URL Parameters:**
- `task_id` (string, required): The UUID of the task to delete

**Notes:**
- Only tasks with status "completed" or "failed" can be deleted
- Tasks with status "queued" or "running" cannot be deleted

**Response (204 No Content):**
```
(empty response body)
```

**Error Response (400 Bad Request):**
```json
{
  "error": "invalid_operation",
  "message": "Cannot delete task with status 'running'"
}
```

**Error Response (404 Not Found):**
```json
{
  "error": "not_found",
  "message": "Task with ID '550e8400-...' not found"
}
```

**Example:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:8000/tasks/550e8400-e29b-41d4-a716-446655440000
```

---

### Statistics

#### `GET /stats`

Get overall system statistics and metrics.

**Authentication:** Required

**Response (200 OK):**
```json
{
  "tasks": {
    "total": 1523,
    "queued": 12,
    "running": 5,
    "completed": 1450,
    "failed": 56
  },
  "workers": {
    "total": 8,
    "active": 7,
    "cloud": 5,
    "local": 3
  },
  "performance": {
    "avg_execution_time_ms": 8234,
    "avg_queue_time_ms": 2341,
    "tasks_per_minute": 12.5,
    "success_rate": 0.963
  },
  "queue": {
    "depth": 12,
    "oldest_task_age_seconds": 45
  },
  "uptime_seconds": 86400
}
```

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:8000/stats
```

---

## Error Responses

All error responses follow a consistent format:

```json
{
  "error": "error_code",
  "message": "Human-readable error message",
  "details": {
    "additional": "context"
  }
}
```

### Common HTTP Status Codes

- **200 OK**: Request succeeded
- **202 Accepted**: Task accepted for processing
- **204 No Content**: Resource deleted successfully
- **400 Bad Request**: Invalid request data
- **401 Unauthorized**: Missing or invalid authentication
- **404 Not Found**: Resource not found
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error
- **503 Service Unavailable**: Service temporarily unavailable

### Common Error Codes

- `validation_error`: Request data failed validation
- `unauthorized`: Authentication failed
- `not_found`: Requested resource doesn't exist
- `invalid_operation`: Operation not allowed in current state
- `rate_limit_exceeded`: Too many requests
- `internal_error`: Unexpected server error
- `service_unavailable`: Dependency (Redis/DB) unavailable

---

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Default Limit:** 100 requests per minute per API key
- **Burst Allowance:** 20 requests

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1642251600
```

**Rate Limit Exceeded Response (429):**
```json
{
  "error": "rate_limit_exceeded",
  "message": "Rate limit exceeded. Try again in 30 seconds.",
  "retry_after": 30
}
```

---

## Pagination

List endpoints support pagination using `limit` and `offset` parameters.

**Example Request:**
```bash
curl "http://localhost:8000/tasks?limit=20&offset=40"
```

**Response includes pagination metadata:**
```json
{
  "tasks": [...],
  "total": 150,
  "limit": 20,
  "offset": 40,
  "has_more": true
}
```

**Calculating pages:**
- Current page: `offset / limit + 1`
- Total pages: `ceil(total / limit)`
- Next page offset: `offset + limit`
- Previous page offset: `max(0, offset - limit)`

---

## Filtering and Sorting

### Filtering Tasks by Status
```bash
# Get only failed tasks
curl "http://localhost:8000/tasks?status=failed"

# Get only running tasks
curl "http://localhost:8000/tasks?status=running"
```

### Sorting Results
```bash
# Sort by creation time (newest first)
curl "http://localhost:8000/tasks?sort=created_at&order=desc"

# Sort by completion time (oldest first)
curl "http://localhost:8000/tasks?sort=completed_at&order=asc&status=completed"
```

---

## Webhooks (Future Feature)

*Note: Webhooks are not yet implemented in the PoC version.*

When implemented, webhooks will allow you to receive real-time notifications when task status changes.

**Configuration:**
```json
{
  "webhook_url": "https://your-app.com/webhooks/task-completed",
  "events": ["task.completed", "task.failed"]
}
```

**Webhook Payload:**
```json
{
  "event": "task.completed",
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "timestamp": "2025-01-15T10:30:15Z",
  "data": {
    "execution_time_ms": 5234,
    "worker_id": "cloud-worker-1"
  }
}
```

---

## Code Examples

### Python (using requests)

```python
import requests
import time

API_KEY = "your_api_key_here"
BASE_URL = "http://localhost:8000"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# Submit a task
task_data = {
    "code": "print('Hello from Python!')",
    "prompt": "Execute Python code",
    "timeout": 60
}

response = requests.post(f"{BASE_URL}/tasks", json=task_data, headers=headers)
task_id = response.json()["task_id"]
print(f"Task submitted: {task_id}")

# Poll for completion
while True:
    response = requests.get(f"{BASE_URL}/tasks/{task_id}", headers=headers)
    task = response.json()
    status = task["status"]
    print(f"Status: {status}")

    if status in ["completed", "failed"]:
        print(f"Result: {task.get('result')}")
        break

    time.sleep(2)
```

### JavaScript (using fetch)

```javascript
const API_KEY = "your_api_key_here";
const BASE_URL = "http://localhost:8000";

const headers = {
    "Authorization": `Bearer ${API_KEY}`,
    "Content-Type": "application/json"
};

// Submit a task
async function submitTask() {
    const taskData = {
        code: "console.log('Hello from JavaScript!')",
        prompt: "Execute JavaScript code",
        timeout: 60
    };

    const response = await fetch(`${BASE_URL}/tasks`, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(taskData)
    });

    const result = await response.json();
    return result.task_id;
}

// Poll for completion
async function waitForTask(taskId) {
    while (true) {
        const response = await fetch(`${BASE_URL}/tasks/${taskId}`, {
            headers: headers
        });

        const task = await response.json();
        console.log(`Status: ${task.status}`);

        if (task.status === "completed" || task.status === "failed") {
            console.log(`Result:`, task.result);
            return task;
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}

// Usage
submitTask()
    .then(taskId => waitForTask(taskId))
    .catch(err => console.error(err));
```

### Bash (using curl)

```bash
#!/bin/bash

API_KEY="your_api_key_here"
BASE_URL="http://localhost:8000"

# Submit task
task_response=$(curl -s -X POST "$BASE_URL/tasks" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "echo \"Hello from Bash!\"",
    "prompt": "Execute bash command"
  }')

task_id=$(echo $task_response | jq -r '.task_id')
echo "Task submitted: $task_id"

# Poll for completion
while true; do
  task_status=$(curl -s "$BASE_URL/tasks/$task_id" \
    -H "Authorization: Bearer $API_KEY")

  status=$(echo $task_status | jq -r '.status')
  echo "Status: $status"

  if [ "$status" = "completed" ] || [ "$status" = "failed" ]; then
    echo $task_status | jq '.result'
    break
  fi

  sleep 2
done
```

---

## Best Practices

### 1. Handle Errors Gracefully
Always check HTTP status codes and handle errors appropriately:

```python
response = requests.post(url, json=data, headers=headers)
if response.status_code == 202:
    # Success
    task_id = response.json()["task_id"]
elif response.status_code == 400:
    # Validation error
    error = response.json()
    print(f"Validation error: {error['message']}")
elif response.status_code == 429:
    # Rate limited
    retry_after = int(response.headers.get('Retry-After', 60))
    time.sleep(retry_after)
```

### 2. Use Exponential Backoff for Polling
```python
def wait_for_task(task_id, max_wait=300):
    wait_time = 1
    total_wait = 0

    while total_wait < max_wait:
        task = get_task_status(task_id)
        if task['status'] in ['completed', 'failed']:
            return task

        time.sleep(wait_time)
        total_wait += wait_time
        wait_time = min(wait_time * 2, 30)  # Max 30 seconds

    raise TimeoutError("Task did not complete in time")
```

### 3. Implement Retry Logic
```python
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry

session = requests.Session()
retry = Retry(
    total=3,
    backoff_factor=1,
    status_forcelist=[500, 502, 503, 504]
)
adapter = HTTPAdapter(max_retries=retry)
session.mount('http://', adapter)
```

### 4. Use Connection Pooling
```python
# Reuse session for multiple requests
session = requests.Session()
session.headers.update({"Authorization": f"Bearer {API_KEY}"})

# Make multiple requests with same session
for i in range(100):
    response = session.post(url, json=task_data)
```

### 5. Validate Input Before Submission
```python
def validate_task(code, prompt):
    if not code or not code.strip():
        raise ValueError("Code cannot be empty")
    if len(code) > 100000:  # 100KB limit
        raise ValueError("Code too large")
    if not prompt:
        raise ValueError("Prompt is required")
    return True
```

---

## Versioning

The API uses semantic versioning. The current version is included in:

- Response headers: `X-API-Version: 0.1.0`
- Health endpoint: `/health` response includes `version` field

**Breaking changes will be communicated via:**
- Version number increment (e.g., 0.1.0 → 1.0.0)
- Deprecation warnings in response headers
- Migration guide in documentation

---

## Support

For issues or questions about the API:
- Check the [Getting Started Guide](getting-started.md)
- Review [Architecture Overview](architecture-overview.md)
- Open an issue on GitHub
- Contact the development team