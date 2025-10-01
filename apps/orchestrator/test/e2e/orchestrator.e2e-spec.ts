import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { TaskStatus } from '@claude-orchestrator/shared';

/**
 * End-to-End Tests for Orchestrator API
 *
 * These tests verify the HTTP API endpoints work correctly.
 * They use an in-memory SQLite database and mock Redis connections.
 *
 * Note: These tests do NOT require Redis to be running.
 * For full integration tests with Redis, see worker-integration.e2e-spec.ts
 */
describe('Orchestrator API E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  }, 15000);

  describe('/health (GET)', () => {
    it('should return health status', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
          expect(res.body).toHaveProperty('uptime');
        });
    });
  });

  describe('/tasks (POST)', () => {
    it('should create a new task', () => {
      return request(app.getHttpServer())
        .post('/tasks')
        .send({
          code: 'console.log("test")',
          prompt: 'Test prompt',
        })
        .expect(202)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('status', TaskStatus.QUEUED);
          expect(res.body).toHaveProperty('createdAt');
        });
    });

    it('should create a task with custom timeout', () => {
      return request(app.getHttpServer())
        .post('/tasks')
        .send({
          code: 'console.log("test")',
          prompt: 'Test prompt',
          timeout: 600,
        })
        .expect(202)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.status).toBe(TaskStatus.QUEUED);
        });
    });

    it('should reject task without code', () => {
      return request(app.getHttpServer())
        .post('/tasks')
        .send({
          prompt: 'Test prompt',
        })
        .expect(400);
    });

    it('should reject task without prompt', () => {
      return request(app.getHttpServer())
        .post('/tasks')
        .send({
          code: 'console.log("test")',
        })
        .expect(400);
    });

    it('should reject task with invalid timeout', () => {
      return request(app.getHttpServer())
        .post('/tasks')
        .send({
          code: 'console.log("test")',
          prompt: 'Test prompt',
          timeout: 'invalid',
        })
        .expect(400);
    });

    it('should reject task with timeout too high', () => {
      return request(app.getHttpServer())
        .post('/tasks')
        .send({
          code: 'console.log("test")',
          prompt: 'Test prompt',
          timeout: 5000,
        })
        .expect(400);
    });
  });

  describe('/tasks (GET)', () => {
    let createdTaskId: string;

    beforeAll(async () => {
      // Create a test task
      const response = await request(app.getHttpServer())
        .post('/tasks')
        .send({
          code: 'console.log("list test")',
          prompt: 'List test prompt',
        });
      createdTaskId = response.body.id;
    });

    it('should list all tasks', () => {
      return request(app.getHttpServer())
        .get('/tasks')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('tasks');
          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('page');
          expect(res.body).toHaveProperty('limit');
          expect(res.body).toHaveProperty('totalPages');
          expect(Array.isArray(res.body.tasks)).toBe(true);
        });
    });

    it('should support pagination', () => {
      return request(app.getHttpServer())
        .get('/tasks?page=1&limit=5')
        .expect(200)
        .expect((res) => {
          expect(res.body.page).toBe(1);
          expect(res.body.limit).toBe(5);
        });
    });

    it('should filter by status', () => {
      return request(app.getHttpServer())
        .get(`/tasks?status=${TaskStatus.QUEUED}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.tasks.every((t: any) => t.status === TaskStatus.QUEUED)).toBe(true);
        });
    });
  });

  describe('/tasks/:id (GET)', () => {
    let testTaskId: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post('/tasks')
        .send({
          code: 'console.log("get test")',
          prompt: 'Get test prompt',
        });
      testTaskId = response.body.id;
    });

    it('should get a task by id', () => {
      return request(app.getHttpServer())
        .get(`/tasks/${testTaskId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(testTaskId);
          expect(res.body).toHaveProperty('code');
          expect(res.body).toHaveProperty('prompt');
          expect(res.body).toHaveProperty('status');
          expect(res.body).toHaveProperty('createdAt');
        });
    });

    it('should return 404 for non-existent task', () => {
      return request(app.getHttpServer())
        .get('/tasks/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });

    it('should return 400 for invalid UUID', () => {
      return request(app.getHttpServer())
        .get('/tasks/invalid-id')
        .expect(400);
    });
  });

  describe('/tasks/stats (GET)', () => {
    it('should return statistics', () => {
      return request(app.getHttpServer())
        .get('/tasks/stats')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('database');
          expect(res.body).toHaveProperty('queue');
          expect(res.body.database).toHaveProperty('total');
          expect(res.body.database).toHaveProperty('queued');
          expect(res.body.database).toHaveProperty('running');
          expect(res.body.database).toHaveProperty('completed');
          expect(res.body.database).toHaveProperty('failed');
        });
    });
  });

  describe('/tasks/:id (DELETE)', () => {
    it('should not delete queued task', async () => {
      const response = await request(app.getHttpServer())
        .post('/tasks')
        .send({
          code: 'console.log("delete test")',
          prompt: 'Delete test prompt',
        });

      return request(app.getHttpServer())
        .delete(`/tasks/${response.body.id}`)
        .expect(400);
    });

    it('should return 404 for non-existent task', () => {
      return request(app.getHttpServer())
        .delete('/tasks/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });

    it('should return 400 for invalid UUID', () => {
      return request(app.getHttpServer())
        .delete('/tasks/invalid-id')
        .expect(400);
    });
  });

  describe('Error handling', () => {
    it('should handle malformed JSON', () => {
      return request(app.getHttpServer())
        .post('/tasks')
        .set('Content-Type', 'application/json')
        .send('{"invalid json')
        .expect(400);
    });

    it('should reject unknown properties', () => {
      return request(app.getHttpServer())
        .post('/tasks')
        .send({
          code: 'console.log("test")',
          prompt: 'Test prompt',
          unknownField: 'should be rejected',
        })
        .expect(400);
    });
  });
});
