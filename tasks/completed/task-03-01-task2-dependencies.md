# TASK-003-01: Task 2 Dependencies for Queue Integration

**Type:** Subtask of TASK-003
**Priority:** High
**Story Points:** 3
**Sprint:** Core Infrastructure
**Dependencies:** None (minimal Task 2 implementation)

## Description

This task documents the minimal Task 2 (Database Layer) components needed to implement Task 3 (Queue Integration). Since Task 2 is being developed in parallel, we need to implement only the essential database components required for queue integration.

## Acceptance Criteria

- [ ] TypeORM configured with SQLite
- [ ] Task entity created with required fields
- [ ] TasksService with basic CRUD operations (create, update, findOne)
- [ ] TasksModule configured
- [ ] AppModule configured with TypeORM

## Components Required from Task 2

### 1. Database Configuration
- `src/config/database.config.ts` - TypeORM configuration
- Environment variables for database path

### 2. Task Entity
- `src/modules/tasks/entities/task.entity.ts`
- Fields: id, status, code, prompt, timeout, workerId, result, errorMessage, createdAt, startedAt, completedAt

### 3. DTOs (minimal set)
- `src/modules/tasks/dto/create-task.dto.ts` - For task creation
- `src/modules/tasks/dto/update-task.dto.ts` - For updating task status/results

### 4. TasksService (minimal implementation)
- `create(dto: CreateTaskDto)` - Create new task
- `update(id: string, dto: UpdateTaskDto)` - Update task
- `findOne(id: string)` - Find task by ID

### 5. TasksModule
- Module configuration with TypeORM repository
- Export TasksService for use by QueueService

### 6. AppModule Updates
- Import TypeOrmModule with configuration
- Import TasksModule

## What's NOT Needed Yet

These Task 2 components can be implemented later:
- TasksController REST endpoints
- Pagination/filtering in findAll
- Statistics endpoint
- Delete operation
- Query DTOs
- Validation pipes

## Implementation Order

1. Install TypeORM dependencies
2. Create database configuration
3. Create Task entity
4. Create minimal DTOs
5. Create TasksService with 3 methods (create, update, findOne)
6. Create TasksModule
7. Update AppModule

## Dependencies Installation

```bash
cd apps/orchestrator
pnpm add typeorm sqlite3 @nestjs/typeorm class-validator class-transformer uuid
pnpm add -D @types/uuid
```

## Testing

After implementation, verify:
- TypeORM connects to SQLite successfully
- Task entity can be created and saved
- Task can be updated (especially status field)
- AppModule starts without errors

## Definition of Done

- All minimal components from Task 2 are implemented
- Task 3 queue integration can proceed without blockers
- Database operations work correctly
- No need to implement full REST API yet