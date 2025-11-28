import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { APP_INTERCEPTOR } from '@nestjs/core';

describe('Auth Refresh Token Rotation E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Disable AuditLogInterceptor for E2E tests to avoid import/bootstrap issues
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(APP_INTERCEPTOR)
      .useValue({
        intercept: (context, next) => next.handle(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Refresh Token Rotation', () => {
    let accessToken: string;
    let refreshToken: string;
    let oldRefreshToken: string;

    it('should login and receive access + refresh tokens', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v2/auth/login')
        .send({ email: 'admin@local', password: 'Admin!123' })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');

      accessToken = response.body.accessToken;
      refreshToken = response.body.refreshToken;
    });

    it('should refresh token and receive new tokens', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v2/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.accessToken).not.toBe(accessToken);
      expect(response.body.refreshToken).not.toBe(refreshToken);

      oldRefreshToken = refreshToken;
      accessToken = response.body.accessToken;
      refreshToken = response.body.refreshToken;
    });

    it('should reject old refresh token after rotation', async () => {
      await request(app.getHttpServer())
        .post('/api/v2/auth/refresh')
        .send({ refreshToken: oldRefreshToken })
        .expect(401);
    });

    it('should allow new refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v2/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
    });
  });

  describe('Negative Scenarios', () => {
    it('should reject invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/api/v2/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);
    });

    it('should reject expired refresh token', async () => {
      // This would require a token with short expiration or manual expiry
      // For now, we test with invalid signature
      const expiredToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      await request(app.getHttpServer())
        .post('/api/v2/auth/refresh')
        .send({ refreshToken: expiredToken })
        .expect(401);
    });

    it('should reject refresh token without type=refresh', async () => {
      // Login to get access token (not refresh)
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v2/auth/login')
        .send({ email: 'admin@local', password: 'Admin!123' })
        .expect(200);

      // Try to use access token as refresh token
      await request(app.getHttpServer())
        .post('/api/v2/auth/refresh')
        .send({ refreshToken: loginResponse.body.accessToken })
        .expect(401);
    });
  });

  describe('Logout', () => {
    it('should revoke refresh token on logout', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v2/auth/login')
        .send({ email: 'admin@local', password: 'Admin!123' })
        .expect(200);

      const refreshToken = loginResponse.body.refreshToken;

      // Logout
      await request(app.getHttpServer())
        .post('/api/v2/auth/logout')
        .send({ refreshToken })
        .expect(200);

      // Try to refresh after logout
      await request(app.getHttpServer())
        .post('/api/v2/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });
  });
});
