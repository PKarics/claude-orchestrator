# AAI-001: Setup Project Structure and Configuration

**Type:** Task
**Priority:** High
**Story Points:** 3
**Sprint:** Setup Phase

## Description

Initialize NestJS monorepo with pnpm workspaces, create basic project structure, and configure development environment.

## Acceptance Criteria

- [ ] Monorepo structure created with apps/ and packages/ directories
- [ ] Git repository initialized with .gitignore
- [ ] pnpm workspace configured
- [ ] Shared types package created and compiles
- [ ] Orchestrator NestJS app scaffolded
- [ ] Worker app scaffolded
- [ ] Environment configuration files created (.env.example, .env)
- [ ] Docker Compose file created for Redis
- [ ] All dependencies installed successfully
- [ ] Orchestrator starts on port 3000
- [ ] Health endpoint returns 200 OK

## Technical Specification

### Required Directory Structure
```
claude-orchestrator/
├── apps/
│   ├── orchestrator/
│   ├── worker/
│   └── dashboard/
├── packages/
│   └── shared/
├── docs/
├── tasks/
├── scripts/
└── data/
```

### Technology Stack
- Node.js 20+
- TypeScript 5.3+
- pnpm 8+
- NestJS 10
- Docker

## Implementation

### 1. Create Directory Structure

```bash
cd ~/dev
mkdir -p claude-orchestrator/{apps/{orchestrator,worker,dashboard},packages/shared,docs,tasks,scripts,data}
cd claude-orchestrator
git init
```

### 2. Setup .gitignore

```
node_modules/
dist/
.env
.env.local
*.log
data/tasks.db
coverage/
```

### 3. Configure pnpm Workspace

`pnpm-workspace.yaml`:
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

Root `package.json`:
```json
{
  "name": "claude-orchestrator",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "pnpm -r build",
    "dev": "pnpm -r --parallel dev"
  }
}
```

### 4. Create Shared Types Package

`packages/shared/src/index.ts`:
```typescript
export enum TaskStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface Task {
  id: string;
  status: TaskStatus;
  code: string;
  prompt: string;
  timeout: number;
  createdAt: Date;
  workerId?: string;
  result?: TaskResult;
}

export interface TaskResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}
```

### 5. Scaffold Orchestrator

```bash
cd apps/orchestrator
pnpm add @nestjs/common @nestjs/core @nestjs/platform-express
pnpm add -D @nestjs/cli typescript
```

Create minimal `src/main.ts` and `src/app.module.ts`.

### 6. Scaffold Worker

```bash
cd apps/worker
pnpm add ioredis bullmq dotenv
pnpm add -D typescript tsx
```

### 7. Create Environment Files

`.env.example` with all required variables.

### 8. Create Docker Compose

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
```

## Testing

```bash
# Build shared package
cd packages/shared && pnpm build

# Start orchestrator
cd apps/orchestrator && pnpm dev

# Test endpoint
curl http://localhost:3000/health
```

## Subtasks

- [ ] AAI-001-1: Create directory structure and initialize git
- [ ] AAI-001-2: Configure pnpm workspace
- [ ] AAI-001-3: Create shared types package
- [ ] AAI-001-4: Setup orchestrator app with NestJS
- [ ] AAI-001-5: Setup worker app structure
- [ ] AAI-001-6: Create configuration files
- [ ] AAI-001-7: Verify all components start successfully

## Definition of Done

- Code compiles without errors
- Orchestrator responds to HTTP requests
- All acceptance criteria met
- Changes committed to git