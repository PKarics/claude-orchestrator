# AAI-007: Implement Testing Suite

**Type:** Task
**Priority:** High
**Story Points:** 5
**Sprint:** Quality Assurance
**Dependencies:** AAI-004

## Description

Implement comprehensive test suite including unit tests for services, integration tests for API endpoints, and end-to-end tests for the complete system workflow.

## Acceptance Criteria

- [ ] Unit tests for TasksService with 80%+ coverage
- [ ] Unit tests for QueueService
- [ ] Integration tests for all API endpoints
- [ ] End-to-end test for complete task flow
- [ ] All tests pass successfully
- [ ] Test coverage report generated
- [ ] CI/CD workflow configured (optional)

## Technical Specification

### Test Types

1. **Unit Tests**: Test services in isolation with mocked dependencies
2. **Integration Tests**: Test API endpoints with real database
3. **E2E Tests**: Test complete flow from task creation to completion

### Test Framework

- Jest for unit and integration tests
- Supertest for HTTP testing
- Test database separate from development

## Implementation

### 1. Configure Jest

`apps/orchestrator/jest.config.js`:
```javascript
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.spec.ts',
    '!**/node_modules/**',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};
```

### 2. Write Unit Tests for TasksService

`src/modules/tasks/tasks.service.spec.ts`:
```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TasksService } from './tasks.service';
import { TaskEntity } from './entities/task.entity';

describe('TasksService', () => {
  let service: TasksService;
  let repository: any;

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        TasksService,
        {
          provide: getRepositoryToken(TaskEntity),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get(TasksService);
    repository = module.get(getRepositoryToken(TaskEntity));
  });

  describe('create', () => {
    it('should create a task', async () => {
      const dto = { code: 'test', prompt: 'test', timeout: 60 };
      const task = { id: '123', ...dto, status: 'queued' };

      repository.create.mockReturnValue(task);
      repository.save.mockResolvedValue(task);

      const result = await service.create(dto);

      expect(result).toEqual(task);
      expect(repository.create).toHaveBeenCalledWith({
        ...dto,
        status: 'queued',
      });
    });
  });

  describe('findOne', () => {
    it('should return task when found', async () => {
      const task = { id: '123', status: 'queued' };
      repository.findOne.mockResolvedValue(task);

      const result = await service.findOne('123');

      expect(result).toEqual(task);
    });

    it('should throw NotFoundException when not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne('999')).rejects.toThrow();
    });
  });

  describe('getStatistics', () => {
    it('should return statistics', async () => {
      repository.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(80)
        .mockResolvedValueOnce(5);

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
```

### 3. Write Integration Tests

`test/tasks.e2e-spec.ts`:
```typescript
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Tasks API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/tasks (POST)', () => {
    it('should create a task', () => {
      return request(app.getHttpServer())
        .post('/tasks')
        .send({
          code: 'console.log("test")',
          prompt: 'test',
          timeout: 60,
        })
        .expect(202)
        .expect((res) => {
          expect(res.body.id).toBeDefined();
          expect(res.body.status).toBe('queued');
        });
    });

    it('should reject invalid task', () => {
      return request(app.getHttpServer())
        .post('/tasks')
        .send({ code: '', prompt: 'invalid' })
        .expect(400);
    });
  });

  describe('/tasks (GET)', () => {
    it('should list tasks', () => {
      return request(app.getHttpServer())
        .get('/tasks')
        .expect(200)
        .expect((res) => {
          expect(res.body.tasks).toBeDefined();
          expect(Array.isArray(res.body.tasks)).toBe(true);
        });
    });
  });

  describe('/tasks/:id (GET)', () => {
    it('should get task by id', async () => {
      // Create task first
      const createRes = await request(app.getHttpServer())
        .post('/tasks')
        .send({ code: 'test', prompt: 'test' });

      const taskId = createRes.body.id;

      return request(app.getHttpServer())
        .get(`/tasks/${taskId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(taskId);
        });
    });

    it('should return 404 for invalid id', () => {
      return request(app.getHttpServer())
        .get('/tasks/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  describe('/tasks/stats (GET)', () => {
    it('should return statistics', () => {
      return request(app.getHttpServer())
        .get('/tasks/stats')
        .expect(200)
        .expect((res) => {
          expect(res.body.database).toBeDefined();
          expect(res.body.queue).toBeDefined();
        });
    });
  });
});
```

### 4. Write E2E System Test

`scripts/test-e2e.sh`:
```bash
#!/bin/bash
set -e

API_URL="${API_URL:-http://localhost:3000}"

echo "Running E2E System Test"

# Create task
echo "Creating task..."
TASK_ID=$(curl -s -X POST $API_URL/tasks \
  -H "Content-Type: application/json" \
  -d '{"code":"console.log(2+2)","prompt":"test"}' \
  | jq -r '.id')

echo "Task ID: $TASK_ID"

# Wait for completion
echo "Waiting for completion..."
for i in {1..30}; do
  STATUS=$(curl -s $API_URL/tasks/$TASK_ID | jq -r '.status')
  echo "Status: $STATUS"

  if [ "$STATUS" = "completed" ]; then
    echo "✅ Task completed successfully"
    curl -s $API_URL/tasks/$TASK_ID | jq .
    exit 0
  elif [ "$STATUS" = "failed" ]; then
    echo "❌ Task failed"
    exit 1
  fi

  sleep 2
done

echo "❌ Timeout waiting for completion"
exit 1
```

### 5. Add Test Scripts

`package.json`:
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "test:all": "npm run test && npm run test:e2e"
  }
}
```

### 6. Install Test Dependencies

```bash
cd apps/orchestrator
pnpm add -D @nestjs/testing jest ts-jest supertest @types/jest @types/supertest
```

## Running Tests

```bash
# Unit tests
pnpm test

# With coverage
pnpm test:cov

# Integration tests
pnpm test:e2e

# E2E system test (requires running system)
docker compose up -d
cd apps/orchestrator && pnpm dev &
cd apps/worker && pnpm dev &
sleep 5
./scripts/test-e2e.sh
```

## CI/CD Configuration (Optional)

`.github/workflows/test.yml`:
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm -r build
      - run: pnpm -r test
      - run: pnpm -r test:e2e
```

## Subtasks

- [ ] AAI-007-1: Configure Jest
- [ ] AAI-007-2: Write TasksService unit tests
- [ ] AAI-007-3: Write QueueService unit tests
- [ ] AAI-007-4: Write API integration tests
- [ ] AAI-007-5: Create E2E system test script
- [ ] AAI-007-6: Generate coverage report
- [ ] AAI-007-7: Configure CI/CD (optional)
- [ ] AAI-007-8: Document testing procedures

## Definition of Done

- All unit tests pass
- All integration tests pass
- E2E test passes with running system
- Coverage >80%
- Tests run in CI/CD
- Test documentation complete