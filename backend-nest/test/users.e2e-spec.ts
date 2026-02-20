import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('UsersController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let tenantId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    // Login to get auth token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin@grc-platform.local',
        password: 'TestPassword123!',
      });

    if (loginResponse.body.success && loginResponse.body.data) {
      authToken = loginResponse.body.data.accessToken;
      tenantId = loginResponse.body.data.user?.tenantId;
    } else if (loginResponse.body.accessToken) {
      authToken = loginResponse.body.accessToken;
      tenantId = loginResponse.body.user?.tenantId;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/users (GET)', () => {
    it('should return 401 without auth token', () => {
      return request(app.getHttpServer()).get('/users').expect(401);
    });

    it('should return users list with valid auth token', async () => {
      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId || '')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('users');
      expect(response.body.data).toHaveProperty('pagination');
    });

    it('should support pagination parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/users?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId || '')
        .expect(200);

      expect(response.body.data.pagination.limit).toBe(5);
      expect(response.body.data.pagination.page).toBe(1);
    });
  });

  describe('/users/me (GET)', () => {
    it('should return current user profile', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('email');
      expect(response.body.data).not.toHaveProperty('passwordHash');
    });

    it('should return 401 without auth token', () => {
      return request(app.getHttpServer()).get('/users/me').expect(401);
    });
  });

  describe('/users/health (GET)', () => {
    it('should return health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/health')
        .expect(200);

      expect(response.body.data).toHaveProperty('status', 'ok');
      expect(response.body.data).toHaveProperty('module', 'users');
    });
  });

  describe('/users/count (GET)', () => {
    it('should return user count', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/count')
        .expect(200);

      expect(response.body.data).toHaveProperty('count');
      expect(typeof response.body.data.count).toBe('number');
    });
  });

  describe('/users/statistics/overview (GET)', () => {
    it('should return 401 without auth token', () => {
      return request(app.getHttpServer())
        .get('/users/statistics/overview')
        .expect(401);
    });

    it('should return user statistics with valid auth token', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/statistics/overview')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId || '')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('admins');
      expect(response.body.data).toHaveProperty('managers');
      expect(response.body.data).toHaveProperty('users');
      expect(response.body.data).toHaveProperty('inactive');
    });
  });

  describe('/users/departments/list (GET)', () => {
    it('should return 401 without auth token', () => {
      return request(app.getHttpServer())
        .get('/users/departments/list')
        .expect(401);
    });

    it('should return departments list with valid auth token', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/departments/list')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId || '')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('User CRUD Operations', () => {
    let createdUserId: string;

    it('should create a new user (POST /users)', async () => {
      const newUser = {
        email: `test-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User',
        department: 'Engineering',
        role: 'user',
      };

      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId || '')
        .send(newUser)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('email', newUser.email);
      expect(response.body.data).not.toHaveProperty('passwordHash');

      createdUserId = response.body.data.id;
    });

    it('should get user by ID (GET /users/:id)', async () => {
      if (!createdUserId) {
        return;
      }

      const response = await request(app.getHttpServer())
        .get(`/users/${createdUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId || '')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id', createdUserId);
    });

    it('should update user (PATCH /users/:id)', async () => {
      if (!createdUserId) {
        return;
      }

      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
      };

      const response = await request(app.getHttpServer())
        .patch(`/users/${createdUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId || '')
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('firstName', 'Updated');
      expect(response.body.data).toHaveProperty('lastName', 'Name');
    });

    it('should update user role (PUT /users/:id/role)', async () => {
      if (!createdUserId) {
        return;
      }

      const response = await request(app.getHttpServer())
        .put(`/users/${createdUserId}/role`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId || '')
        .send({ role: 'manager' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('role', 'manager');
    });

    it('should deactivate user (PUT /users/:id/deactivate)', async () => {
      if (!createdUserId) {
        return;
      }

      const response = await request(app.getHttpServer())
        .put(`/users/${createdUserId}/deactivate`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId || '')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('message');
    });

    it('should activate user (PUT /users/:id/activate)', async () => {
      if (!createdUserId) {
        return;
      }

      const response = await request(app.getHttpServer())
        .put(`/users/${createdUserId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId || '')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('message');
    });

    it('should delete user (DELETE /users/:id)', async () => {
      if (!createdUserId) {
        return;
      }

      await request(app.getHttpServer())
        .delete(`/users/${createdUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId || '')
        .expect(204);
    });
  });

  describe('Validation', () => {
    it('should reject invalid email format', async () => {
      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId || '')
        .send({
          email: 'invalid-email',
          password: 'TestPassword123!',
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should reject short password', async () => {
      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId || '')
        .send({
          email: 'valid@example.com',
          password: '123',
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });
});
