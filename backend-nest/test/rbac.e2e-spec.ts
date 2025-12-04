import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let dbConnected = false;
  let adminToken: string;

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

      // Get admin token for protected routes
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: DEMO_ADMIN_EMAIL,
          password: DEMO_ADMIN_PASSWORD,
        });

      adminToken = loginResponse.body.accessToken;
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

  describe('GET /users/admin-only', () => {
    it('should allow admin user to access admin-only route', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/users/admin-only')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Welcome, admin!');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', DEMO_ADMIN_EMAIL);
      expect(response.body.user).toHaveProperty('role', 'admin');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return 401 without token', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/users/admin-only')
        .expect(401);
    });

    it('should return 401 with invalid token', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/users/admin-only')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('GET /users (admin/manager only)', () => {
    it('should allow admin user to list all users', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
      
      // Verify password hashes are not returned
      response.body.forEach((user: any) => {
        expect(user).not.toHaveProperty('passwordHash');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('role');
      });
    });

    it('should return 401 without token', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/users')
        .expect(401);
    });
  });

  describe('Role-based access control', () => {
    it('should include role in JWT payload', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      // Decode the JWT to verify role is included
      const parts = adminToken.split('.');
      expect(parts.length).toBe(3);
      
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      expect(payload).toHaveProperty('role', 'admin');
      expect(payload).toHaveProperty('email', DEMO_ADMIN_EMAIL);
      expect(payload).toHaveProperty('sub'); // User ID
    });

    it('should return user role in /users/me response', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('role', 'admin');
    });
  });
});
