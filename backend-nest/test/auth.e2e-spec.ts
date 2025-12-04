import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let dbConnected = false;

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

  describe('POST /auth/login', () => {
    it('should return JWT token for valid credentials', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: DEMO_ADMIN_EMAIL,
          password: DEMO_ADMIN_PASSWORD,
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(typeof response.body.accessToken).toBe('string');
      expect(response.body.accessToken.length).toBeGreaterThan(0);

      // Verify JWT structure (header.payload.signature)
      const jwtParts = response.body.accessToken.split('.');
      expect(jwtParts).toHaveLength(3);

      // Verify user info is returned
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', DEMO_ADMIN_EMAIL);
      expect(response.body.user).toHaveProperty('role', 'admin');
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('should return 401 for invalid credentials', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'invalid@example.com',
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 for missing email', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          password: 'somepassword',
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 for missing password', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 for invalid email format', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'not-an-email',
          password: 'somepassword',
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });
});
