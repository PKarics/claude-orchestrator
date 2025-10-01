# Claude Orchestrator Dashboard

A modern React + TypeScript + Vite dashboard for monitoring and managing multiple Claude Orchestrator instances.

## Features

- **Multi-Instance Support**: Connect to and switch between multiple orchestrator instances
- **Real-time Statistics**: View task counts (total, queued, running, completed)
- **Worker Monitoring**: See active workers and their heartbeat status
- **Task List**: View the 10 most recent tasks with status
- **Task Creation**: Submit new tasks directly from the dashboard
- **Auto-refresh**: Data updates automatically every 5 seconds
- **Responsive Design**: Works on desktop and mobile devices
- **TypeScript**: Fully typed for better developer experience

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Fast build tool and dev server
- **CSS Modules** - Component-scoped styling

## Running the Dashboard

### Development Mode
```bash
# From the dashboard directory
pnpm dev

# Or from project root
cd apps/dashboard && pnpm dev
```

### Production Mode
```bash
# Build and start
pnpm build
pnpm start
```

The dashboard will be available at http://localhost:3001 (or the port specified via PORT environment variable).

## Adding Instances

1. Click the "+ Add" button in the top-right corner
2. Enter the orchestrator port (e.g., 3000)
3. Click "Add" to save the instance
4. Select the instance from the dropdown to view its data

Instances are persisted in browser localStorage.

## Prerequisites

- The orchestrator must be running on the configured port
- CORS must be enabled in the orchestrator for localhost origins

## Project Structure

```
apps/dashboard/
├── src/
│   ├── components/
│   │   ├── InstanceSelector.tsx    # Multi-instance selector
│   │   ├── StatsCards.tsx          # Statistics cards
│   │   ├── WorkersList.tsx         # Active workers list
│   │   ├── TasksTable.tsx          # Recent tasks table
│   │   └── CreateTaskForm.tsx      # Task creation form
│   ├── services/
│   │   └── api.ts                  # API service layer
│   ├── types.ts                    # TypeScript type definitions
│   ├── App.tsx                     # Main app component
│   ├── App.css                     # Global styles
│   └── main.tsx                    # Entry point
├── index.html                      # HTML template
├── vite.config.ts                  # Vite configuration
├── tsconfig.json                   # TypeScript configuration
└── package.json
```

## API Endpoints Used

- `GET /health` - System health check
- `GET /tasks/stats` - Task and queue statistics
- `GET /tasks?limit=10` - Recent tasks
- `GET /workers` - Active workers
- `POST /tasks` - Create new task

## Environment Variables

- `PORT` - Server port (default: 3001)

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode with hot reload
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```
