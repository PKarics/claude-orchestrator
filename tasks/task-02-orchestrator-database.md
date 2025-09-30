# Task 02: Implement Database Layer with TypeORM

**Difficulty:** Beginner-Intermediate
**Estimated Time:** 3-4 hours
**Prerequisites:** Task 01 completed, basic understanding of databases and ORMs

## Goal

Implement the database layer using TypeORM with SQLite for development. Create Task entity, repository pattern, and database migrations.

## Learning Objectives

By completing this task, you will learn:
- How to set up TypeORM with NestJS
- How to create database entities with decorators
- How to use TypeORM repositories for database operations
- How to create and run migrations
- How to implement the repository pattern in NestJS

## Step-by-Step Instructions

### Step 1: Install TypeORM Dependencies

```bash
cd apps/orchestrator

# TypeORM and database drivers are already in package.json
# But let's verify they're installed
pnpm install

# Verify installation
pnpm list typeorm sqlite3 @nestjs/typeorm
```

### Step 2: Create Database Configuration Module

```bash
# Create config directory
mkdir -p src/config

# Create database configuration
cat > src/config/database.config.ts << 'EOF'
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const dbType = configService.get<string>('DB_TYPE', 'sqlite');

  if (dbType === 'sqlite') {
    return {
      type: 'sqlite',
      database: configService.get<string>('DB_DATABASE', './data/tasks.db'),
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      synchronize: configService.get<string>('NODE_ENV') === 'development',
      logging: configService.get<string>('LOG_LEVEL') === 'debug',
    };
  }

  // PostgreSQL configuration for production
  return {
    type: 'postgres',
    host: configService.get<string>('DB_HOST', 'localhost'),
    port: configService.get<number>('DB_PORT', 5432),
    username: configService.get<string>('DB_USERNAME', 'orchestrator'),
    password: configService.get<string>('DB_PASSWORD'),
    database: configService.get<string>('DB_DATABASE', 'orchestrator'),
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: false, // Always use migrations in production
    logging: configService.get<string>('LOG_LEVEL') === 'debug',
  };
};
EOF
```

**What this does:**
- Exports a function that returns TypeORM configuration
- Supports both SQLite (dev) and PostgreSQL (prod)
- Uses environment variables from ConfigService
- Auto-discovers entities using glob pattern
- Enables synchronize only in development
- Enables logging when LOG_LEVEL is debug

### Step 3: Create Task Entity

```bash
# Create entities directory
mkdir -p src/modules/tasks/entities

# Create task entity
cat > src/modules/tasks/entities/task.entity.ts << 'EOF'
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { TaskStatus } from '@shared/types';

@Entity('tasks')
@Index(['status'])
@Index(['createdAt'])
export class TaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: TaskStatus.QUEUED,
  })
  @Index()
  status: TaskStatus;

  @Column('text')
  code: string;

  @Column('text')
  prompt: string;

  @Column({
    type: 'int',
    default: 300,
  })
  timeout: number;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  workerId?: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  result?: string; // JSON string of TaskResult

  @Column({
    type: 'text',
    nullable: true,
  })
  errorMessage?: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({
    type: 'datetime',
    nullable: true,
  })
  startedAt?: Date;

  @Column({
    type: 'datetime',
    nullable: true,
  })
  completedAt?: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
EOF
```

**Entity Decorators Explained:**
- `@Entity('tasks')` - Maps to 'tasks' table
- `@PrimaryGeneratedColumn('uuid')` - Auto-generated UUID primary key
- `@Column()` - Regular column
- `@CreateDateColumn()` - Automatically set on creation
- `@UpdateDateColumn()` - Automatically updated on save
- `@Index()` - Creates database index for faster queries

### Step 4: Create Data Transfer Objects (DTOs)

```bash
# Create DTOs directory
mkdir -p src/modules/tasks/dto

# Create CreateTaskDto
cat > src/modules/tasks/dto/create-task.dto.ts << 'EOF'
import { IsString, IsNotEmpty, IsInt, Min, Max, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTaskDto {
  @ApiProperty({
    description: 'Code to execute',
    example: 'console.log("Hello, World!");',
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    description: 'Description of what the code should do',
    example: 'Print Hello World to console',
  })
  @IsString()
  @IsNotEmpty()
  prompt: string;

  @ApiPropertyOptional({
    description: 'Maximum execution time in seconds',
    example: 300,
    minimum: 1,
    maximum: 3600,
    default: 300,
  })
  @IsInt()
  @Min(1)
  @Max(3600)
  @IsOptional()
  timeout?: number = 300;
}
EOF

# Create UpdateTaskDto
cat > src/modules/tasks/dto/update-task.dto.ts << 'EOF'
import { IsEnum, IsString, IsOptional, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus, TaskResult } from '@shared/types';

export class UpdateTaskDto {
  @ApiPropertyOptional({
    enum: TaskStatus,
    description: 'Task status',
  })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @ApiPropertyOptional({
    description: 'Worker ID that processed the task',
  })
  @IsString()
  @IsOptional()
  workerId?: string;

  @ApiPropertyOptional({
    description: 'Task execution result',
  })
  @IsObject()
  @IsOptional()
  result?: TaskResult;

  @ApiPropertyOptional({
    description: 'Error message if task failed',
  })
  @IsString()
  @IsOptional()
  errorMessage?: string;
}
EOF

# Create QueryTaskDto
cat > src/modules/tasks/dto/query-task.dto.ts << 'EOF'
import { IsEnum, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '@shared/types';

export class QueryTaskDto {
  @ApiPropertyOptional({
    enum: TaskStatus,
    description: 'Filter by task status',
  })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @ApiPropertyOptional({
    description: 'Number of results to return',
    minimum: 1,
    maximum: 500,
    default: 50,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  @IsOptional()
  limit?: number = 50;

  @ApiPropertyOptional({
    description: 'Number of results to skip',
    minimum: 0,
    default: 0,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  offset?: number = 0;
}
EOF
```

**DTO Decorators Explained:**
- `@IsString()`, `@IsInt()` - Type validation
- `@IsNotEmpty()` - Required field
- `@IsOptional()` - Optional field
- `@Min()`, `@Max()` - Range validation
- `@ApiProperty()` - Swagger documentation
- `@Type(() => Number)` - Transform query string to number

### Step 5: Create Tasks Service

```bash
# Create tasks service
cat > src/modules/tasks/tasks.service.ts << 'EOF'
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskEntity } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { TaskStatus, Task, TaskResult } from '@shared/types';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
  ) {}

  /**
   * Create a new task
   */
  async create(createTaskDto: CreateTaskDto): Promise<TaskEntity> {
    const task = this.taskRepository.create({
      ...createTaskDto,
      status: TaskStatus.QUEUED,
    });

    const savedTask = await this.taskRepository.save(task);
    this.logger.log(`Task created: ${savedTask.id}`);

    return savedTask;
  }

  /**
   * Find all tasks with optional filtering and pagination
   */
  async findAll(queryDto: QueryTaskDto): Promise<{
    tasks: TaskEntity[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const { status, limit, offset } = queryDto;

    const queryBuilder = this.taskRepository.createQueryBuilder('task');

    if (status) {
      queryBuilder.where('task.status = :status', { status });
    }

    queryBuilder
      .orderBy('task.createdAt', 'DESC')
      .skip(offset)
      .take(limit);

    const [tasks, total] = await queryBuilder.getManyAndCount();

    return {
      tasks,
      total,
      limit: limit || 50,
      offset: offset || 0,
    };
  }

  /**
   * Find task by ID
   */
  async findOne(id: string): Promise<TaskEntity> {
    const task = await this.taskRepository.findOne({ where: { id } });

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    return task;
  }

  /**
   * Update task
   */
  async update(
    id: string,
    updateTaskDto: UpdateTaskDto,
  ): Promise<TaskEntity> {
    const task = await this.findOne(id);

    // Update status timestamps
    if (updateTaskDto.status) {
      if (updateTaskDto.status === TaskStatus.RUNNING && !task.startedAt) {
        task.startedAt = new Date();
      }
      if (
        (updateTaskDto.status === TaskStatus.COMPLETED ||
          updateTaskDto.status === TaskStatus.FAILED) &&
        !task.completedAt
      ) {
        task.completedAt = new Date();
      }
    }

    // Store result as JSON string
    if (updateTaskDto.result) {
      task.result = JSON.stringify(updateTaskDto.result);
    }

    Object.assign(task, updateTaskDto);

    const updatedTask = await this.taskRepository.save(task);
    this.logger.log(`Task updated: ${id}, status: ${updatedTask.status}`);

    return updatedTask;
  }

  /**
   * Delete task
   */
  async remove(id: string): Promise<void> {
    const task = await this.findOne(id);

    // Only allow deleting completed or failed tasks
    if (
      task.status !== TaskStatus.COMPLETED &&
      task.status !== TaskStatus.FAILED
    ) {
      throw new Error(
        `Cannot delete task with status ${task.status}. Only completed or failed tasks can be deleted.`,
      );
    }

    await this.taskRepository.remove(task);
    this.logger.log(`Task deleted: ${id}`);
  }

  /**
   * Get task statistics
   */
  async getStatistics(): Promise<{
    total: number;
    queued: number;
    running: number;
    completed: number;
    failed: number;
  }> {
    const [total, queued, running, completed, failed] = await Promise.all([
      this.taskRepository.count(),
      this.taskRepository.count({ where: { status: TaskStatus.QUEUED } }),
      this.taskRepository.count({ where: { status: TaskStatus.RUNNING } }),
      this.taskRepository.count({ where: { status: TaskStatus.COMPLETED } }),
      this.taskRepository.count({ where: { status: TaskStatus.FAILED } }),
    ]);

    return { total, queued, running, completed, failed };
  }

  /**
   * Convert entity to Task type with parsed result
   */
  entityToTask(entity: TaskEntity): Task {
    return {
      ...entity,
      result: entity.result ? JSON.parse(entity.result) : undefined,
    };
  }
}
EOF
```

**Service Methods Explained:**
- `create()` - Creates a new task in QUEUED status
- `findAll()` - Lists tasks with filtering and pagination
- `findOne()` - Gets a specific task or throws NotFoundException
- `update()` - Updates task and manages status timestamps
- `remove()` - Deletes completed/failed tasks only
- `getStatistics()` - Returns task counts by status

### Step 6: Create Tasks Controller

```bash
# Create tasks controller
cat > src/modules/tasks/tasks.controller.ts << 'EOF'
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';

@ApiTags('tasks')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Create a new task' })
  @ApiResponse({
    status: 202,
    description: 'Task accepted for processing',
  })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  async create(@Body() createTaskDto: CreateTaskDto) {
    const task = await this.tasksService.create(createTaskDto);
    return {
      id: task.id,
      status: task.status,
      createdAt: task.createdAt,
    };
  }

  @Get()
  @ApiOperation({ summary: 'List all tasks' })
  @ApiQuery({ name: 'status', required: false, enum: ['queued', 'running', 'completed', 'failed'] })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of tasks' })
  async findAll(@Query() queryDto: QueryTaskDto) {
    const result = await this.tasksService.findAll(queryDto);
    return {
      tasks: result.tasks.map(task => this.tasksService.entityToTask(task)),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.offset + result.limit < result.total,
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get task statistics' })
  @ApiResponse({ status: 200, description: 'Task statistics' })
  async getStatistics() {
    return this.tasksService.getStatistics();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get task by ID' })
  @ApiParam({ name: 'id', description: 'Task UUID' })
  @ApiResponse({ status: 200, description: 'Task details' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const task = await this.tasksService.findOne(id);
    return this.tasksService.entityToTask(task);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a task' })
  @ApiParam({ name: 'id', description: 'Task UUID' })
  @ApiResponse({ status: 204, description: 'Task deleted' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete running or queued task',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.tasksService.remove(id);
  }
}
EOF
```

**Controller Decorators Explained:**
- `@Controller('tasks')` - Sets base route to `/tasks`
- `@Get()`, `@Post()`, `@Delete()` - HTTP methods
- `@Body()` - Extracts request body
- `@Param()` - Extracts route parameter
- `@Query()` - Extracts query parameters
- `@ParseUUIDPipe` - Validates UUID format
- `@ApiOperation()`, `@ApiResponse()` - Swagger docs

### Step 7: Create Tasks Module

```bash
# Create tasks module
cat > src/modules/tasks/tasks.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TaskEntity } from './entities/task.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TaskEntity])],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService], // Export for use in other modules
})
export class TasksModule {}
EOF
```

### Step 8: Update App Module

```bash
# Update app.module.ts to include TypeORM and Tasks module
cat > src/app.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getDatabaseConfig } from './config/database.config';
import { HealthModule } from './modules/health/health.module';
import { TasksModule } from './modules/tasks/tasks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        getDatabaseConfig(configService),
    }),
    HealthModule,
    TasksModule,
  ],
})
export class AppModule {}
EOF
```

**Module Configuration Explained:**
- `ConfigModule.forRoot()` - Loads environment variables globally
- `TypeOrmModule.forRootAsync()` - Configures database asynchronously
- `useFactory` - Factory function that receives ConfigService
- `inject` - Dependencies to inject into factory

### Step 9: Update Health Check

```bash
# Update health controller to check database connection
cat > src/modules/health/health.controller.ts << 'EOF'
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  async getHealth() {
    const dbConnected = this.dataSource.isInitialized;

    return {
      status: dbConnected ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      database: {
        connected: dbConnected,
        type: this.dataSource.options.type,
      },
    };
  }
}
EOF
```

### Step 10: Create Database Initialization Script

```bash
# Create data directory
mkdir -p ../../data

# Create database initialization script
cat > src/scripts/init-db.ts << 'EOF'
import { DataSource } from 'typeorm';
import { TaskEntity } from '../modules/tasks/entities/task.entity';

const dataSource = new DataSource({
  type: 'sqlite',
  database: './data/tasks.db',
  entities: [TaskEntity],
  synchronize: true,
});

async function initDatabase() {
  try {
    await dataSource.initialize();
    console.log('✅ Database initialized successfully');
    console.log('📁 Database file: ./data/tasks.db');
    await dataSource.destroy();
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  }
}

initDatabase();
EOF

# Add script to package.json
cat > temp.json << 'EOF'
{
  "scripts": {
    "db:init": "ts-node src/scripts/init-db.ts"
  }
}
EOF

# Merge with existing package.json (manual step)
echo "📝 Add 'db:init' script to package.json scripts section"
```

### Step 11: Test the Database Layer

```bash
# Initialize database
pnpm db:init

# Start the application
pnpm dev
```

In another terminal, test the API:

```bash
# Test health check (should show database connected)
curl http://localhost:3000/health

# Create a task
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "code": "console.log(\"Hello from database test\");",
    "prompt": "Test task",
    "timeout": 60
  }'

# List all tasks
curl http://localhost:3000/tasks

# Get task statistics
curl http://localhost:3000/tasks/stats

# Get specific task (replace {id} with actual task ID)
curl http://localhost:3000/tasks/{id}
```

### Step 12: Write Unit Tests

```bash
# Create test file
cat > src/modules/tasks/tasks.service.spec.ts << 'EOF'
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TasksService } from './tasks.service';
import { TaskEntity } from './entities/task.entity';
import { TaskStatus } from '@shared/types';
import { NotFoundException } from '@nestjs/common';

describe('TasksService', () => {
  let service: TasksService;
  let repository: Repository<TaskEntity>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
    count: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        {
          provide: getRepositoryToken(TaskEntity),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    repository = module.get<Repository<TaskEntity>>(
      getRepositoryToken(TaskEntity),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new task', async () => {
      const createTaskDto = {
        code: 'console.log("test")',
        prompt: 'Test task',
        timeout: 60,
      };

      const mockTask = {
        id: '123',
        ...createTaskDto,
        status: TaskStatus.QUEUED,
        createdAt: new Date(),
      };

      mockRepository.create.mockReturnValue(mockTask);
      mockRepository.save.mockResolvedValue(mockTask);

      const result = await service.create(createTaskDto);

      expect(result).toEqual(mockTask);
      expect(mockRepository.create).toHaveBeenCalledWith({
        ...createTaskDto,
        status: TaskStatus.QUEUED,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(mockTask);
    });
  });

  describe('findOne', () => {
    it('should return a task if found', async () => {
      const mockTask = {
        id: '123',
        status: TaskStatus.QUEUED,
      } as TaskEntity;

      mockRepository.findOne.mockResolvedValue(mockTask);

      const result = await service.findOne('123');

      expect(result).toEqual(mockTask);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: '123' },
      });
    });

    it('should throw NotFoundException if task not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStatistics', () => {
    it('should return task statistics', async () => {
      mockRepository.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(10) // queued
        .mockResolvedValueOnce(5) // running
        .mockResolvedValueOnce(80) // completed
        .mockResolvedValueOnce(5); // failed

      const result = await service.getStatistics();

      expect(result).toEqual({
        total: 100,
        queued: 10,
        running: 5,
        completed: 80,
        failed: 5,
      });
    });
  });
});
EOF

# Run tests
pnpm test
```

## Verification Checklist

- [ ] TypeORM configured and connected to SQLite
- [ ] Task entity created with proper decorators
- [ ] DTOs created with validation decorators
- [ ] TasksService implements CRUD operations
- [ ] TasksController exposes REST endpoints
- [ ] Health check includes database status
- [ ] Database initialized successfully
- [ ] Can create tasks via API
- [ ] Can list tasks via API
- [ ] Can get task by ID
- [ ] Can get task statistics
- [ ] Unit tests pass

## Common Issues

### Issue: Database file not created
**Solution:**
```bash
mkdir -p data
pnpm db:init
```

### Issue: TypeORM entities not found
**Solution:** Check that `entities` glob pattern in database.config.ts matches your file structure

### Issue: Validation not working
**Solution:** Ensure `ValidationPipe` is enabled globally in main.ts:
```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
}));
```

### Issue: Tests failing
**Solution:** Ensure mock repository methods match actual usage

## Testing Your Work

Run this complete test:

```bash
#!/bin/bash
# Save as test-task-02.sh

API_URL="http://localhost:3000"

echo "Testing Task 02: Database Layer"

# Test health
echo "1. Testing health check..."
curl -s $API_URL/health | jq .

# Create task
echo "2. Creating task..."
TASK_ID=$(curl -s -X POST $API_URL/tasks \
  -H "Content-Type: application/json" \
  -d '{"code":"console.log(1+1)","prompt":"Math test","timeout":60}' \
  | jq -r '.id')

echo "Created task: $TASK_ID"

# Get task
echo "3. Getting task..."
curl -s $API_URL/tasks/$TASK_ID | jq .

# List tasks
echo "4. Listing tasks..."
curl -s $API_URL/tasks | jq '.total'

# Get stats
echo "5. Getting statistics..."
curl -s $API_URL/tasks/stats | jq .

echo "✅ All tests passed!"
```

## Next Steps

Proceed to **Task 03: Implement Redis and BullMQ Queue Integration**

You now have a working database layer! 🎉