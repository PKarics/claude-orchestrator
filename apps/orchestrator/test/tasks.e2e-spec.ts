import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { TaskStatus } from '@claude-orchestrator/shared';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TaskEntity } from '../src/modules/tasks/entities/task.entity';
import { Repository } from 'typeorm';

describe('TasksController (e2e)', () => {
  let app: INestApplication;
  let taskRepository: Repository<TaskEntity>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Enable validation pipes like in main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();

    taskRepository = moduleFixture.get<Repository<TaskEntity>>(
      getRepositoryToken(TaskEntity),
    );
  });

  afterAll(async () => {
    // Clean up database
    await taskRepository.clear();
    await app.close();
  });

  beforeEach(async () => {
    // Clean database before each test
    await taskRepository.clear();
  });

  describe('/tasks (POST)', () => {
    it('should create a new task', () => {
      return request(app.getHttpServer())
        .post('/tasks')
        .send({
          prompt: 'test prompt',
        })
        .expect(202)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.status).toBe(TaskStatus.QUEUED);
        });
    });

    it('should reject invalid task data - missing prompt', () => {
      return request(app.getHttpServer())
        .post('/tasks')
        .send({})
        .expect(400);
    });

    it('should reject empty prompt', () => {
      return request(app.getHttpServer())
        .post('/tasks')
        .send({
          prompt: '',
        })
        .expect(400);
    });

    it('should reject extra fields', () => {
      return request(app.getHttpServer())
        .post('/tasks')
        .send({
          prompt: 'test prompt',
          extraField: 'should be rejected',
        })
        .expect(400);
    });
  });

  describe('/tasks (GET)', () => {
    beforeEach(async () => {
      // Create test tasks
      for (let i = 0; i < 15; i++) {
        await taskRepository.save({
          prompt: `test prompt ${i}`,
          status: i < 5 ? TaskStatus.QUEUED : i < 10 ? TaskStatus.RUNNING : TaskStatus.COMPLETED,
        });
      }
    });

    it('should return paginated tasks', () => {
      return request(app.getHttpServer())
        .get('/tasks')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('tasks');
          expect(res.body).toHaveProperty('total', 15);
          expect(res.body).toHaveProperty('page', 1);
          expect(res.body).toHaveProperty('limit', 10);
          expect(res.body).toHaveProperty('totalPages', 2);
          expect(res.body.tasks).toHaveLength(10);
        });
    });

    it('should return second page', () => {
      return request(app.getHttpServer())
        .get('/tasks?page=2')
        .expect(200)
        .expect((res) => {
          expect(res.body.tasks).toHaveLength(5);
          expect(res.body.page).toBe(2);
        });
    });

    it('should filter by status', () => {
      return request(app.getHttpServer())
        .get(`/tasks?status=${TaskStatus.QUEUED}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.total).toBe(5);
          expect(res.body.tasks.every((t: TaskEntity) => t.status === TaskStatus.QUEUED)).toBe(true);
        });
    });

    it('should handle custom page size', () => {
      return request(app.getHttpServer())
        .get('/tasks?limit=5')
        .expect(200)
        .expect((res) => {
          expect(res.body.tasks).toHaveLength(5);
          expect(res.body.limit).toBe(5);
          expect(res.body.totalPages).toBe(3);
        });
    });

    it('should return tasks in descending order by createdAt', async () => {
      const response = await request(app.getHttpServer())
        .get('/tasks')
        .expect(200);

      const tasks = response.body.tasks;
      for (let i = 1; i < tasks.length; i++) {
        const prevDate = new Date(tasks[i - 1].createdAt);
        const currDate = new Date(tasks[i].createdAt);
        expect(prevDate >= currDate).toBe(true);
      }
    });
  });

  describe('/tasks/stats (GET)', () => {
    beforeEach(async () => {
      // Create tasks with different statuses
      await taskRepository.save({ prompt: 'test 1', status: TaskStatus.QUEUED });
      await taskRepository.save({ prompt: 'test 2', status: TaskStatus.QUEUED });
      await taskRepository.save({ prompt: 'test 3', status: TaskStatus.RUNNING });
      await taskRepository.save({ prompt: 'test 4', status: TaskStatus.COMPLETED });
      await taskRepository.save({ prompt: 'test 5', status: TaskStatus.FAILED });
    });

    it('should return task statistics', () => {
      return request(app.getHttpServer())
        .get('/tasks/stats')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('database');
          expect(res.body).toHaveProperty('queue');
          expect(res.body.database).toEqual({
            total: 5,
            queued: 2,
            running: 1,
            completed: 1,
            failed: 1,
          });
        });
    });

    it('should return zero statistics when no tasks exist', async () => {
      await taskRepository.clear();

      return request(app.getHttpServer())
        .get('/tasks/stats')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('database');
          expect(res.body).toHaveProperty('queue');
          expect(res.body.database).toEqual({
            total: 0,
            queued: 0,
            running: 0,
            completed: 0,
            failed: 0,
          });
        });
    });
  });

  describe('/tasks/:id (GET)', () => {
    it('should return a task by id', async () => {
      const task = await taskRepository.save({
        prompt: 'test prompt',
        status: TaskStatus.QUEUED,
      });

      return request(app.getHttpServer())
        .get(`/tasks/${task.id}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(task.id);
          expect(res.body.prompt).toBe('test prompt');
        });
    });

    it('should return 404 for non-existent task', () => {
      return request(app.getHttpServer())
        .get('/tasks/non-existent-id')
        .expect(404);
    });

    it('should return 400 for invalid UUID', () => {
      return request(app.getHttpServer())
        .get('/tasks/invalid-uuid')
        .expect(400);
    });
  });

  describe('/tasks/:id (DELETE)', () => {
    it('should delete a completed task', async () => {
      const task = await taskRepository.save({
        prompt: 'test prompt',
        status: TaskStatus.COMPLETED,
      });

      await request(app.getHttpServer())
        .delete(`/tasks/${task.id}`)
        .expect(204);

      const deletedTask = await taskRepository.findOne({ where: { id: task.id } });
      expect(deletedTask).toBeNull();
    });

    it('should delete a failed task', async () => {
      const task = await taskRepository.save({
        prompt: 'test prompt',
        status: TaskStatus.FAILED,
      });

      await request(app.getHttpServer())
        .delete(`/tasks/${task.id}`)
        .expect(204);

      const deletedTask = await taskRepository.findOne({ where: { id: task.id } });
      expect(deletedTask).toBeNull();
    });

    it('should not delete a queued task', async () => {
      const task = await taskRepository.save({
        prompt: 'test prompt',
        status: TaskStatus.QUEUED,
      });

      return request(app.getHttpServer())
        .delete(`/tasks/${task.id}`)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('Can only delete completed or failed tasks');
        });
    });

    it('should not delete a running task', async () => {
      const task = await taskRepository.save({
        prompt: 'test prompt',
        status: TaskStatus.RUNNING,
      });

      return request(app.getHttpServer())
        .delete(`/tasks/${task.id}`)
        .expect(400);
    });

    it('should return 404 when deleting non-existent task', () => {
      return request(app.getHttpServer())
        .delete('/tasks/non-existent-id')
        .expect(404);
    });

    it('should return 400 for invalid UUID', () => {
      return request(app.getHttpServer())
        .delete('/tasks/invalid-uuid')
        .expect(400);
    });
  });
});