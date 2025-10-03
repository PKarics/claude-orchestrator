# TASK-002: Implement Database Layer with TypeORM

**Type:** Task
**Priority:** High
**Story Points:** 5
**Sprint:** Core Infrastructure
**Dependencies:** TASK-001

## Description

Implement database layer using TypeORM with SQLite. Create Task entity, repository, service layer, and REST API endpoints for CRUD operations.

## Acceptance Criteria

- [ ] TypeORM configured and connected to SQLite
- [ ] Task entity created with all required fields
- [ ] TasksService implements create, read, update, delete operations
- [ ] TasksController exposes REST endpoints
- [ ] DTOs created with validation
- [ ] Database initialized with tables
- [ ] POST /tasks creates a task
- [ ] GET /tasks lists tasks with pagination
- [ ] GET /tasks/:id returns task by ID
- [ ] GET /tasks/stats returns statistics
- [ ] DELETE /tasks/:id deletes completed tasks only
- [ ] Health endpoint includes database status

## Technical Specification

### Database Schema

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  code TEXT NOT NULL,
  prompt TEXT NOT NULL,
  timeout INTEGER DEFAULT 300,
  worker_id TEXT,
  result TEXT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_status ON tasks(status);
CREATE INDEX idx_created_at ON tasks(created_at DESC);
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /tasks | Create new task |
| GET | /tasks | List tasks (with filters) |
| GET | /tasks/:id | Get task details |
| GET | /tasks/stats | Get statistics |
| DELETE | /tasks/:id | Delete task |

## Implementation

### 1. Install Dependencies

```bash
cd apps/orchestrator
pnpm add typeorm sqlite3 @nestjs/typeorm class-validator class-transformer uuid
pnpm add -D @types/uuid
```

### 2. Create Database Configuration

`src/config/database.config.ts`:
```typescript
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'sqlite',
  database: configService.get('DB_DATABASE', './data/tasks.db'),
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: configService.get('NODE_ENV') === 'development',
  logging: false,
});
```

### 3. Create Task Entity

`src/modules/tasks/entities/task.entity.ts`:
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { TaskStatus } from '@claude-orchestrator/shared';

@Entity('tasks')
@Index(['status'])
export class TaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: TaskStatus.QUEUED })
  status: TaskStatus;

  @Column('text')
  code: string;

  @Column('text')
  prompt: string;

  @Column({ default: 300 })
  timeout: number;

  @Column({ nullable: true })
  workerId?: string;

  @Column({ type: 'text', nullable: true })
  result?: string;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'datetime', nullable: true })
  startedAt?: Date;

  @Column({ type: 'datetime', nullable: true })
  completedAt?: Date;
}
```

### 4. Create DTOs

`src/modules/tasks/dto/create-task.dto.ts`:
```typescript
import { IsString, IsNotEmpty, IsInt, Min, Max, IsOptional } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  prompt: string;

  @IsInt()
  @Min(1)
  @Max(3600)
  @IsOptional()
  timeout?: number = 300;
}
```

### 5. Create TasksService

`src/modules/tasks/tasks.service.ts`:
```typescript
@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
  ) {}

  async create(dto: CreateTaskDto): Promise<TaskEntity> {
    const task = this.taskRepository.create({
      ...dto,
      status: TaskStatus.QUEUED,
    });
    return this.taskRepository.save(task);
  }

  async findAll(query: QueryTaskDto) {
    // Implementation with pagination
  }

  async findOne(id: string): Promise<TaskEntity> {
    const task = await this.taskRepository.findOne({ where: { id } });
    if (!task) throw new NotFoundException();
    return task;
  }

  async update(id: string, dto: UpdateTaskDto): Promise<TaskEntity> {
    // Implementation
  }

  async remove(id: string): Promise<void> {
    // Implementation
  }

  async getStatistics() {
    // Implementation
  }
}
```

### 6. Create TasksController

`src/modules/tasks/tasks.controller.ts`:
```typescript
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  create(@Body() dto: CreateTaskDto) {
    return this.tasksService.create(dto);
  }

  @Get()
  findAll(@Query() query: QueryTaskDto) {
    return this.tasksService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.findOne(id);
  }

  @Get('stats')
  getStats() {
    return this.tasksService.getStatistics();
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.remove(id);
  }
}
```

### 7. Update AppModule

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),
    TasksModule,
  ],
})
export class AppModule {}
```

## Testing

```bash
# Start orchestrator
pnpm dev

# Create task
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"code":"console.log(1)","prompt":"test"}'

# List tasks
curl http://localhost:3000/tasks

# Get stats
curl http://localhost:3000/tasks/stats
```

## Subtasks

- [ ] TASK-002-1: Configure TypeORM with SQLite
- [ ] TASK-002-2: Create Task entity with indexes
- [ ] TASK-002-3: Create DTOs with validation
- [ ] TASK-002-4: Implement TasksService CRUD methods
- [ ] TASK-002-5: Create TasksController REST endpoints
- [ ] TASK-002-6: Update AppModule imports
- [ ] TASK-002-7: Test all endpoints

## Definition of Done

- All CRUD operations work via API
- Database persists tasks correctly
- Validation rejects invalid input
- API documentation shows all endpoints
- Code follows project style guide