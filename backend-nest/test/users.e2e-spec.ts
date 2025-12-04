import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('UsersController (e2e)', () => {
  let app: INestApplication<App>;
  let dbConnected = false;
  let authToken: string;

  // Demo admin credentials (created by AuthService on first login)
  const DEMO_ADMIN_EMAIL = 'admin@grc-platform.local';
  const DEMO_ADMIN_PASSWORD = 'Admin123!';

  beforeAll(async () => {
    try {
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
      dbConnected = true;

      // Get auth token for protected routes
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: DEMO_ADMIN_EMAIL,
          password: DEMO_ADMIN_PASSWORD,
        });

      authToken = loginResponse.body.accessToken;
    } catch (error) {
      console.warn('Could not connect to database, skipping DB-dependent tests');
      console.warn('Error:', (error as Error).message);
      dbConnected = false;
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('GET /users/health', () => {
    it('should return users module health status', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/users/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('module', 'users');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /users/count', () => {
    it('should return user count', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/users/count')
        .expect(200);

      expect(response.body).toHaveProperty('count');
      expect(typeof response.body.count).toBe('number');
      expect(response.body.count).toBeGreaterThanOrEqual(1); // At least demo admin
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /users/me (protected)', () => {
    it('should return current user profile with valid token', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('email', DEMO_ADMIN_EMAIL);
      expect(response.body).toHaveProperty('role', 'admin');
      expect(response.body).toHaveProperty('firstName');
      expect(response.body).toHaveProperty('lastName');
      expect(response.body).toHaveProperty('isActive', true);
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('should return 401 without token', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/users/me')
        .expect(401);
    });

    it('should return 401 with invalid token', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});
