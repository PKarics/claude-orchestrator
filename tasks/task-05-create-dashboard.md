# Task 05: Create Simple Dashboard UI

**Difficulty:** Beginner-Intermediate
**Estimated Time:** 3-4 hours
**Prerequisites:** Task 04 completed, basic HTML/CSS/JavaScript knowledge

## Goal

Create a simple web dashboard to monitor tasks, workers, and queue statistics in real-time.

## Learning Objectives

By completing this task, you will learn:
- How to create a simple single-page application
- How to fetch and display API data
- How to implement auto-refresh for real-time monitoring
- How to style a dashboard with CSS
- How to deploy static HTML/JS

## Step-by-Step Instructions

### Step 1: Create Dashboard Structure

```bash
cd apps/dashboard
mkdir -p public/css public/js
```

### Step 2: Create HTML Structure

```bash
cat > public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Claude Orchestrator Dashboard</title>
    <link rel="stylesheet" href="/css/styles.css">
</head>
<body>
    <div class="container">
        <!-- Header -->
        <header class="header">
            <h1>🤖 Claude Orchestrator</h1>
            <div class="header-stats">
                <span class="status" id="status">●</span>
                <span id="lastUpdate">Last updated: Never</span>
            </div>
        </header>

        <!-- Statistics Cards -->
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Total Tasks</div>
                <div class="stat-value" id="totalTasks">-</div>
            </div>
            <div class="stat-card queued">
                <div class="stat-label">Queued</div>
                <div class="stat-value" id="queuedTasks">-</div>
            </div>
            <div class="stat-card running">
                <div class="stat-label">Running</div>
                <div class="stat-value" id="runningTasks">-</div>
            </div>
            <div class="stat-card completed">
                <div class="stat-label">Completed</div>
                <div class="stat-value" id="completedTasks">-</div>
            </div>
            <div class="stat-card failed">
                <div class="stat-label">Failed</div>
                <div class="stat-value" id="failedTasks">-</div>
            </div>
        </div>

        <!-- Queue Stats -->
        <div class="section">
            <h2>📬 Queue Status</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-label">Waiting</div>
                    <div class="stat-value" id="queueWaiting">-</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Active</div>
                    <div class="stat-value" id="queueActive">-</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Completed</div>
                    <div class="stat-value" id="queueCompleted">-</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Failed</div>
                    <div class="stat-value" id="queueFailed">-</div>
                </div>
            </div>
        </div>

        <!-- Workers -->
        <div class="section">
            <h2>👷 Active Workers</h2>
            <div id="workersList" class="workers-list">
                <p class="loading">Loading workers...</p>
            </div>
        </div>

        <!-- Recent Tasks -->
        <div class="section">
            <h2>📋 Recent Tasks</h2>
            <div class="table-container">
                <table class="tasks-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Status</th>
                            <th>Prompt</th>
                            <th>Worker</th>
                            <th>Created</th>
                            <th>Duration</th>
                        </tr>
                    </thead>
                    <tbody id="tasksTableBody">
                        <tr>
                            <td colspan="6" class="loading">Loading tasks...</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Create Task Form -->
        <div class="section">
            <h2>➕ Create New Task</h2>
            <form id="createTaskForm" class="task-form">
                <div class="form-group">
                    <label for="taskCode">Code:</label>
                    <textarea
                        id="taskCode"
                        name="code"
                        rows="4"
                        placeholder="console.log('Hello, World!');"
                        required
                    ></textarea>
                </div>
                <div class="form-group">
                    <label for="taskPrompt">Prompt:</label>
                    <input
                        type="text"
                        id="taskPrompt"
                        name="prompt"
                        placeholder="Describe what this code does"
                        required
                    />
                </div>
                <div class="form-group">
                    <label for="taskTimeout">Timeout (seconds):</label>
                    <input
                        type="number"
                        id="taskTimeout"
                        name="timeout"
                        value="60"
                        min="1"
                        max="3600"
                    />
                </div>
                <button type="submit" class="btn-primary">Create Task</button>
                <div id="taskFormMessage" class="form-message"></div>
            </form>
        </div>
    </div>

    <script src="/js/app.js"></script>
</body>
</html>
EOF
```

### Step 3: Create CSS Styles

```bash
cat > public/css/styles.css << 'EOF'
:root {
    --primary-color: #4A90E2;
    --success-color: #50C878;
    --warning-color: #FFB347;
    --danger-color: #FF6B6B;
    --neutral-color: #E6E6FA;
    --bg-color: #F5F7FA;
    --card-bg: #FFFFFF;
    --text-color: #333333;
    --text-light: #666666;
    --border-color: #E0E0E0;
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background-color: var(--bg-color);
    color: var(--text-color);
    line-height: 1.6;
}

.container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 20px;
}

/* Header */
.header {
    background: var(--card-bg);
    padding: 30px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    margin-bottom: 30px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.header h1 {
    font-size: 2rem;
    color: var(--primary-color);
}

.header-stats {
    display: flex;
    align-items: center;
    gap: 15px;
    color: var(--text-light);
    font-size: 0.9rem;
}

.status {
    font-size: 1.5rem;
    color: var(--success-color);
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

/* Stats Grid */
.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
}

.stat-card {
    background: var(--card-bg);
    padding: 25px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    border-left: 4px solid var(--primary-color);
}

.stat-card.queued {
    border-left-color: var(--warning-color);
}

.stat-card.running {
    border-left-color: var(--primary-color);
}

.stat-card.completed {
    border-left-color: var(--success-color);
}

.stat-card.failed {
    border-left-color: var(--danger-color);
}

.stat-label {
    font-size: 0.85rem;
    color: var(--text-light);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
}

.stat-value {
    font-size: 2rem;
    font-weight: bold;
    color: var(--text-color);
}

/* Sections */
.section {
    background: var(--card-bg);
    padding: 30px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    margin-bottom: 30px;
}

.section h2 {
    margin-bottom: 20px;
    color: var(--primary-color);
    font-size: 1.5rem;
}

/* Workers List */
.workers-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 15px;
}

.worker-card {
    background: var(--bg-color);
    padding: 15px;
    border-radius: 8px;
    border-left: 3px solid var(--success-color);
}

.worker-card.stale {
    border-left-color: var(--warning-color);
}

.worker-id {
    font-weight: bold;
    margin-bottom: 8px;
}

.worker-info {
    font-size: 0.85rem;
    color: var(--text-light);
}

/* Tasks Table */
.table-container {
    overflow-x: auto;
}

.tasks-table {
    width: 100%;
    border-collapse: collapse;
}

.tasks-table th {
    background: var(--bg-color);
    padding: 12px;
    text-align: left;
    font-weight: 600;
    color: var(--text-color);
    border-bottom: 2px solid var(--border-color);
}

.tasks-table td {
    padding: 12px;
    border-bottom: 1px solid var(--border-color);
}

.tasks-table tr:hover {
    background: var(--bg-color);
}

.task-id {
    font-family: monospace;
    font-size: 0.85rem;
    color: var(--text-light);
}

.status-badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
}

.status-badge.queued {
    background: var(--warning-color);
    color: white;
}

.status-badge.running {
    background: var(--primary-color);
    color: white;
}

.status-badge.completed {
    background: var(--success-color);
    color: white;
}

.status-badge.failed {
    background: var(--danger-color);
    color: white;
}

/* Form */
.task-form {
    max-width: 600px;
}

.form-group {
    margin-bottom: 20px;
}

.form-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: var(--text-color);
}

.form-group input,
.form-group textarea {
    width: 100%;
    padding: 10px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-family: inherit;
    font-size: 0.95rem;
}

.form-group textarea {
    font-family: 'Courier New', monospace;
    resize: vertical;
}

.btn-primary {
    background: var(--primary-color);
    color: white;
    padding: 12px 24px;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.3s;
}

.btn-primary:hover {
    background: #3A7BC8;
}

.form-message {
    margin-top: 15px;
    padding: 10px;
    border-radius: 6px;
    display: none;
}

.form-message.success {
    background: var(--success-color);
    color: white;
    display: block;
}

.form-message.error {
    background: var(--danger-color);
    color: white;
    display: block;
}

.loading {
    text-align: center;
    color: var(--text-light);
    padding: 20px;
}

/* Responsive */
@media (max-width: 768px) {
    .header {
        flex-direction: column;
        text-align: center;
    }

    .stats-grid {
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    }
}
EOF
```

### Step 4: Create JavaScript Application

```bash
cat > public/js/app.js << 'EOF'
// Configuration
const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : ''; // Use relative URL in production

const REFRESH_INTERVAL = 5000; // 5 seconds

// State
let refreshTimer = null;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard initializing...');

    // Initial load
    loadDashboardData();

    // Set up auto-refresh
    refreshTimer = setInterval(loadDashboardData, REFRESH_INTERVAL);

    // Set up form submission
    setupTaskForm();
});

/**
 * Load all dashboard data
 */
async function loadDashboardData() {
    try {
        await Promise.all([
            loadStats(),
            loadWorkers(),
            loadRecentTasks(),
        ]);

        updateLastUpdateTime();
        updateStatus(true);
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
        updateStatus(false);
    }
}

/**
 * Load task statistics
 */
async function loadStats() {
    const response = await fetch(`${API_URL}/tasks/stats`);
    const data = await response.json();

    // Database stats
    document.getElementById('totalTasks').textContent = data.database.total;
    document.getElementById('queuedTasks').textContent = data.database.queued;
    document.getElementById('runningTasks').textContent = data.database.running;
    document.getElementById('completedTasks').textContent = data.database.completed;
    document.getElementById('failedTasks').textContent = data.database.failed;

    // Queue stats
    document.getElementById('queueWaiting').textContent = data.queue.waiting;
    document.getElementById('queueActive').textContent = data.queue.active;
    document.getElementById('queueCompleted').textContent = data.queue.completed;
    document.getElementById('queueFailed').textContent = data.queue.failed;
}

/**
 * Load active workers
 */
async function loadWorkers() {
    try {
        const response = await fetch(`${API_URL}/workers`);
        const data = await response.json();

        const workersList = document.getElementById('workersList');

        if (!data.workers || data.workers.length === 0) {
            workersList.innerHTML = '<p class="loading">No active workers</p>';
            return;
        }

        workersList.innerHTML = data.workers.map(worker => `
            <div class="worker-card ${worker.status}">
                <div class="worker-id">${worker.id}</div>
                <div class="worker-info">
                    Type: ${worker.type}<br>
                    Last seen: ${formatTimeAgo(worker.lastHeartbeat)}<br>
                    Tasks: ${worker.tasksCompleted || 0}
                </div>
            </div>
        `).join('');
    } catch (error) {
        document.getElementById('workersList').innerHTML =
            '<p class="loading">Failed to load workers</p>';
    }
}

/**
 * Load recent tasks
 */
async function loadRecentTasks() {
    const response = await fetch(`${API_URL}/tasks?limit=10`);
    const data = await response.json();

    const tbody = document.getElementById('tasksTableBody');

    if (!data.tasks || data.tasks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">No tasks yet</td></tr>';
        return;
    }

    tbody.innerHTML = data.tasks.map(task => {
        const duration = task.completedAt
            ? formatDuration(new Date(task.createdAt), new Date(task.completedAt))
            : '-';

        return `
            <tr>
                <td class="task-id" title="${task.id}">${task.id.substring(0, 8)}...</td>
                <td><span class="status-badge ${task.status}">${task.status}</span></td>
                <td>${truncate(task.prompt, 50)}</td>
                <td>${task.workerId || '-'}</td>
                <td>${formatTimeAgo(task.createdAt)}</td>
                <td>${duration}</td>
            </tr>
        `;
    }).join('');
}

/**
 * Set up task creation form
 */
function setupTaskForm() {
    const form = document.getElementById('createTaskForm');
    const message = document.getElementById('taskFormMessage');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = {
            code: document.getElementById('taskCode').value,
            prompt: document.getElementById('taskPrompt').value,
            timeout: parseInt(document.getElementById('taskTimeout').value),
        };

        try {
            const response = await fetch(`${API_URL}/tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                throw new Error('Failed to create task');
            }

            const task = await response.json();

            // Show success message
            message.textContent = `Task created successfully! ID: ${task.id}`;
            message.className = 'form-message success';

            // Reset form
            form.reset();

            // Refresh dashboard
            loadDashboardData();

            // Hide message after 5 seconds
            setTimeout(() => {
                message.style.display = 'none';
            }, 5000);
        } catch (error) {
            message.textContent = `Error: ${error.message}`;
            message.className = 'form-message error';
        }
    });
}

/**
 * Update last update time
 */
function updateLastUpdateTime() {
    const now = new Date();
    document.getElementById('lastUpdate').textContent =
        `Last updated: ${now.toLocaleTimeString()}`;
}

/**
 * Update connection status indicator
 */
function updateStatus(connected) {
    const status = document.getElementById('status');
    status.style.color = connected
        ? 'var(--success-color)'
        : 'var(--danger-color)';
}

/**
 * Format time ago (e.g., "2 minutes ago")
 */
function formatTimeAgo(timestamp) {
    const now = new Date();
    const then = new Date(timestamp);
    const seconds = Math.floor((now - then) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Format duration between two dates
 */
function formatDuration(start, end) {
    const ms = end - start;
    const seconds = Math.floor(ms / 1000);

    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

/**
 * Truncate string
 */
function truncate(str, length) {
    return str.length > length ? str.substring(0, length) + '...' : str;
}
EOF
```

### Step 5: Create Simple HTTP Server

```bash
cat > server.js << 'EOF'
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const PUBLIC_DIR = path.join(__dirname, 'public');

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
    let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url);
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'text/plain';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('404 - File Not Found');
            } else {
                res.writeHead(500);
                res.end('500 - Internal Server Error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

server.listen(PORT, () => {
    console.log(`📊 Dashboard server running at http://localhost:${PORT}`);
});
EOF
```

### Step 6: Update package.json

```bash
cat > package.json << 'EOF'
{
  "name": "@apps/dashboard",
  "version": "0.1.0",
  "scripts": {
    "dev": "node server.js",
    "start": "node server.js"
  },
  "devDependencies": {}
}
EOF
```

### Step 7: Test Dashboard

```bash
# Start orchestrator (terminal 1)
cd apps/orchestrator
pnpm dev

# Start worker (terminal 2)
cd apps/worker
pnpm dev

# Start dashboard (terminal 3)
cd apps/dashboard
pnpm dev

# Open browser
open http://localhost:3001
```

You should see:
- Real-time statistics
- Active workers
- Recent tasks
- Task creation form

### Step 8: Update Docker Configuration

```bash
# Update dashboard Dockerfile
cat > Dockerfile << 'EOF'
FROM node:20-alpine

WORKDIR /app

COPY package.json server.js ./
COPY public ./public

EXPOSE 3001

CMD ["node", "server.js"]
EOF
```

### Step 9: Create README for Dashboard

```bash
cat > README.md << 'EOF'
# Claude Orchestrator Dashboard

Simple web dashboard for monitoring the Claude Orchestrator system.

## Features

- ✅ Real-time task statistics
- ✅ Active worker monitoring
- ✅ Recent task list
- ✅ Task creation form
- ✅ Auto-refresh every 5 seconds

## Running Locally

```bash
pnpm dev
```

Then open http://localhost:3001

## Building for Production

```bash
docker build -t dashboard .
docker run -p 3001:3001 dashboard
```

## Configuration

Edit `API_URL` in `public/js/app.js` to point to your orchestrator.
EOF
```

## Verification Checklist

- [ ] Dashboard loads successfully
- [ ] Statistics display correctly
- [ ] Auto-refresh works (stats update every 5s)
- [ ] Active workers shown
- [ ] Recent tasks table populated
- [ ] Can create tasks via form
- [ ] Status indicator shows green when connected
- [ ] Responsive design works on mobile

## Common Issues

### Issue: CORS errors
**Solution:** The orchestrator already has CORS enabled. If issues persist, check that orchestrator is running.

### Issue: Dashboard shows old data
**Solution:** Check browser console for errors. Verify API_URL is correct.

### Issue: Can't create tasks
**Solution:** Check that API_KEY is not required (or add it to requests).

## Next Steps

Proceed to **Task 06: Deploy to Cloud**

You now have a complete working system with UI! 🎉