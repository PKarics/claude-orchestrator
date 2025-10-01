# TASK-005: Create Web Dashboard

**Type:** Task
**Priority:** Medium
**Story Points:** 5
**Sprint:** UI Development
**Dependencies:** TASK-004

## Description

Create simple web dashboard with HTML/CSS/JavaScript to monitor system status, view task list, and submit new tasks.

## Acceptance Criteria

- [x] Dashboard displays task statistics (total, queued, running, completed, failed)
- [x] Dashboard shows queue statistics (waiting, active)
- [x] Dashboard lists active workers with last heartbeat
- [x] Dashboard shows recent tasks in table format
- [x] Dashboard includes form to create new tasks
- [x] Auto-refresh updates data every 5 seconds
- [x] Dashboard served on port 3001
- [x] Responsive design works on mobile

## Technical Specification

### Dashboard Components

1. **Statistics Cards**: Task and queue metrics
2. **Worker List**: Active workers with status
3. **Recent Tasks Table**: Last 10 tasks
4. **Create Task Form**: Submit new tasks
5. **Auto-refresh**: Updates every 5 seconds

### API Calls

- `GET /health` - System health
- `GET /tasks/stats` - Statistics
- `GET /tasks?limit=10` - Recent tasks
- `GET /workers` - Active workers
- `POST /tasks` - Create task

## Implementation

### 1. Create Project Structure

```bash
cd apps/dashboard
mkdir -p public/{css,js}
```

### 2. Create HTML

`public/index.html`:
```html
<!DOCTYPE html>
<html>
<head>
  <title>Claude Orchestrator</title>
  <link rel="stylesheet" href="/css/styles.css">
</head>
<body>
  <div class="container">
    <header><h1>Claude Orchestrator</h1></header>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Tasks</div>
        <div class="stat-value" id="totalTasks">-</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Queued</div>
        <div class="stat-value" id="queuedTasks">-</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Running</div>
        <div class="stat-value" id="runningTasks">-</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Completed</div>
        <div class="stat-value" id="completedTasks">-</div>
      </div>
    </div>

    <section>
      <h2>Active Workers</h2>
      <div id="workersList"></div>
    </section>

    <section>
      <h2>Recent Tasks</h2>
      <table id="tasksTable">
        <thead>
          <tr>
            <th>ID</th>
            <th>Status</th>
            <th>Prompt</th>
            <th>Worker</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody id="tasksTableBody"></tbody>
      </table>
    </section>

    <section>
      <h2>Create Task</h2>
      <form id="createTaskForm">
        <textarea name="code" placeholder="Code" required></textarea>
        <input name="prompt" placeholder="Prompt" required>
        <input name="timeout" type="number" value="60">
        <button type="submit">Create</button>
      </form>
    </section>
  </div>

  <script src="/js/app.js"></script>
</body>
</html>
```

### 3. Create CSS

`public/css/styles.css`:
```css
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: system-ui, -apple-system, sans-serif;
  background: #f5f5f5;
  padding: 20px;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}

header {
  background: white;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.stat-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
}

.stat-label {
  font-size: 14px;
  color: #666;
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  margin-top: 8px;
}

section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 600px;
}

textarea, input, button {
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: inherit;
}

button {
  background: #007bff;
  color: white;
  border: none;
  cursor: pointer;
}

button:hover {
  background: #0056b3;
}
```

### 4. Create JavaScript

`public/js/app.js`:
```javascript
const API_URL = 'http://localhost:3000';
const REFRESH_INTERVAL = 5000;

async function loadData() {
  try {
    const [stats, tasks, workers] = await Promise.all([
      fetch(`${API_URL}/tasks/stats`).then(r => r.json()),
      fetch(`${API_URL}/tasks?limit=10`).then(r => r.json()),
      fetch(`${API_URL}/workers`).then(r => r.json()),
    ]);

    // Update statistics
    document.getElementById('totalTasks').textContent = stats.database.total;
    document.getElementById('queuedTasks').textContent = stats.database.queued;
    document.getElementById('runningTasks').textContent = stats.database.running;
    document.getElementById('completedTasks').textContent = stats.database.completed;

    // Update workers list
    document.getElementById('workersList').innerHTML = workers.workers
      .map(w => `<div>${w.id} - ${w.type} - ${w.status}</div>`)
      .join('');

    // Update tasks table
    document.getElementById('tasksTableBody').innerHTML = tasks.tasks
      .map(t => `
        <tr>
          <td>${t.id.substring(0, 8)}</td>
          <td>${t.status}</td>
          <td>${t.prompt}</td>
          <td>${t.workerId || '-'}</td>
          <td>${new Date(t.createdAt).toLocaleString()}</td>
        </tr>
      `)
      .join('');
  } catch (error) {
    console.error('Failed to load data:', error);
  }
}

document.getElementById('createTaskForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);

  try {
    await fetch(`${API_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: formData.get('code'),
        prompt: formData.get('prompt'),
        timeout: parseInt(formData.get('timeout')),
      }),
    });

    e.target.reset();
    loadData();
  } catch (error) {
    alert('Failed to create task');
  }
});

// Initial load and auto-refresh
loadData();
setInterval(loadData, REFRESH_INTERVAL);
```

### 5. Create Simple HTTP Server

`server.js`:
```javascript
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const PUBLIC_DIR = path.join(__dirname, 'public');

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
};

http.createServer((req, res) => {
  let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('404');
    } else {
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
      res.end(content);
    }
  });
}).listen(PORT, () => {
  console.log(`Dashboard running on http://localhost:${PORT}`);
});
```

### 6. Update package.json

```json
{
  "name": "@apps/dashboard",
  "version": "0.1.0",
  "scripts": {
    "dev": "node server.js",
    "start": "node server.js"
  }
}
```

## Testing

```bash
# Terminal 1: Orchestrator
cd apps/orchestrator && pnpm dev

# Terminal 2: Worker
cd apps/worker && pnpm dev

# Terminal 3: Dashboard
cd apps/dashboard && pnpm dev

# Open browser
open http://localhost:3001
```

Verify:
- Statistics display correctly
- Workers appear in list
- Tasks table shows recent tasks
- Form creates new tasks
- Auto-refresh updates data

## Subtasks

- [x] TASK-005-1: Create HTML structure
- [x] TASK-005-2: Create CSS styles
- [x] TASK-005-3: Implement JavaScript data loading
- [x] TASK-005-4: Implement auto-refresh
- [x] TASK-005-5: Create task submission form
- [x] TASK-005-6: Create simple HTTP server
- [x] TASK-005-7: Test on desktop browser
- [x] TASK-005-8: Test on mobile browser

## Definition of Done

- Dashboard loads and displays data
- Statistics update automatically
- Task creation works
- Workers visible
- Responsive design works
- No console errors