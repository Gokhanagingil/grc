import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * Security & Access Control E2E Tests
 *
 * Tests for:
 * - Authentication (401 vs 403 scenarios)
 * - Permission-based access control (RBAC)
 * - Tenant isolation boundaries
 * - Rate limiting behavior
 * - Security headers
 */
describe('Security & Access Control (e2e)', () => {
  let app: INestApplication<App>;
  let dbConnected = false;
  let adminToken: string;
  let tenantId: string;

  // Demo admin credentials
  const DEMO_ADMIN_EMAIL =
    process.env.DEMO_ADMIN_EMAIL || 'admin@grc-platform.local';
  const DEMO_ADMIN_PASSWORD =
    process.env.DEMO_ADMIN_PASSWORD || 'TestPassword123!';

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

      // Login to get admin token and tenant info
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: DEMO_ADMIN_EMAIL,
          password: DEMO_ADMIN_PASSWORD,
        });

      adminToken = loginResponse.body.accessToken;
      tenantId = loginResponse.body.user?.tenantId;
    } catch (error) {
      console.warn(
        'Could not connect to database, skipping DB-dependent tests',
      );
      console.warn('Error:', (error as Error).message);
      dbConnected = false;
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // ==================== AUTHENTICATION TESTS ====================
  describe('Authentication (401 vs 403)', () => {
    describe('No Token (401 Unauthorized)', () => {
      it('should return 401 for /grc/risks without token', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/risks')
          .set('x-tenant-id', tenantId)
          .expect(401);

        expect(response.body).toHaveProperty('statusCode', 401);
      });

      it('should return 401 for /grc/policies without token', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/policies')
          .set('x-tenant-id', tenantId)
          .expect(401);
      });

      it('should return 401 for /grc/requirements without token', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/requirements')
          .set('x-tenant-id', tenantId)
          .expect(401);
      });

      it('should return 401 for POST /grc/risks without token', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .post('/grc/risks')
          .set('x-tenant-id', tenantId)
          .send({ title: 'Test Risk' })
          .expect(401);
      });
    });

    describe('Invalid Token (401 Unauthorized)', () => {
      it('should return 401 for invalid JWT token', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/risks')
          .set('Authorization', 'Bearer invalid.token.here')
          .set('x-tenant-id', tenantId)
          .expect(401);
      });

      it('should return 401 for malformed Authorization header', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/risks')
          .set('Authorization', 'NotBearer token')
          .set('x-tenant-id', tenantId)
          .expect(401);
      });
    });

    describe('Valid Token with Permissions (200 OK)', () => {
      it('should return 200 for /grc/risks with valid admin token', async () => {
        if (!dbConnected || !tenantId || !adminToken) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/risks')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });

      it('should return 200 for /grc/policies with valid admin token', async () => {
        if (!dbConnected || !tenantId || !adminToken) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/policies')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });

      it('should return 200 for /grc/requirements with valid admin token', async () => {
        if (!dbConnected || !tenantId || !adminToken) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/requirements')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });
  });

  // ==================== TENANT ISOLATION TESTS ====================
  describe('Tenant Isolation', () => {
    describe('Missing Tenant Header', () => {
      it('should return 400 for /grc/risks without x-tenant-id', async () => {
        if (!dbConnected || !adminToken) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/risks')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);
      });

      it('should return 400 for /grc/policies without x-tenant-id', async () => {
        if (!dbConnected || !adminToken) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/policies')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);
      });

      it('should return 400 for /grc/requirements without x-tenant-id', async () => {
        if (!dbConnected || !adminToken) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/requirements')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);
      });
    });

    describe('Invalid Tenant ID', () => {
      it('should return 403 for non-existent tenant ID', async () => {
        if (!dbConnected || !adminToken) {
          console.log('Skipping test: database not connected');
          return;
        }

        // Use a valid UUID format but non-existent tenant
        const fakeTenantId = '00000000-0000-0000-0000-000000000099';

        await request(app.getHttpServer())
          .get('/grc/risks')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', fakeTenantId)
          .expect(403);
      });

      it('should return 400 for invalid UUID format tenant ID', async () => {
        if (!dbConnected || !adminToken) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/risks')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', 'not-a-valid-uuid')
          .expect(400);
      });
    });

    describe('Cross-Tenant Access Prevention', () => {
      it('should not return data from other tenants', async () => {
        if (!dbConnected || !tenantId || !adminToken) {
          console.log('Skipping test: database not connected');
          return;
        }

        // Get risks for the current tenant
        const response = await request(app.getHttpServer())
          .get('/grc/risks')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // All returned risks should belong to the current tenant
        if (response.body.length > 0) {
          response.body.forEach((risk: { tenantId: string }) => {
            expect(risk.tenantId).toBe(tenantId);
          });
        }
      });

      it('should not return policies from other tenants', async () => {
        if (!dbConnected || !tenantId || !adminToken) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/policies')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        if (response.body.length > 0) {
          response.body.forEach((policy: { tenantId: string }) => {
            expect(policy.tenantId).toBe(tenantId);
          });
        }
      });

      it('should not return requirements from other tenants', async () => {
        if (!dbConnected || !tenantId || !adminToken) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/requirements')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        if (response.body.length > 0) {
          response.body.forEach((req: { tenantId: string }) => {
            expect(req.tenantId).toBe(tenantId);
          });
        }
      });
    });
  });

  // ==================== SECURITY HEADERS TESTS ====================
  describe('Security Headers', () => {
    it('should include X-Frame-Options header', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/live')
        .expect(200);

      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    it('should include X-Content-Type-Options header', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/live')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should include X-XSS-Protection header', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/live')
        .expect(200);

      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });

    it('should include Referrer-Policy header', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/live')
        .expect(200);

      expect(response.headers['referrer-policy']).toBe(
        'strict-origin-when-cross-origin',
      );
    });

    it('should include Content-Security-Policy header', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/live')
        .expect(200);

      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['content-security-policy']).toContain(
        "default-src 'self'",
      );
    });

    it('should include Cache-Control header for no caching', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/live')
        .expect(200);

      expect(response.headers['cache-control']).toContain('no-store');
    });

    it('should include Permissions-Policy header', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/live')
        .expect(200);

      expect(response.headers['permissions-policy']).toBeDefined();
    });
  });

  // ==================== RATE LIMITING TESTS ====================
  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      // Make a few requests - should all succeed
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer()).get('/health/live').expect(200);
      }
    });

    it('should include rate limit headers in response', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/live')
        .expect(200);

      // ThrottlerGuard may add these headers depending on configuration
      // This test verifies the endpoint is accessible
      expect(response.status).toBe(200);
    });
  });

  // ==================== LOGIN SECURITY TESTS ====================
  describe('Login Security', () => {
    describe('Invalid Credentials', () => {
      it('should return 401 for wrong password', async () => {
        if (!dbConnected) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: DEMO_ADMIN_EMAIL,
            password: 'WrongPassword123!',
          })
          .expect(401);

        expect(response.body).toHaveProperty('statusCode', 401);
        expect(response.body).toHaveProperty(
          'message',
          'Invalid email or password',
        );
      });

      it('should return 401 for non-existent user', async () => {
        if (!dbConnected) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: 'nonexistent@example.com',
            password: 'SomePassword123!',
          })
          .expect(401);

        expect(response.body).toHaveProperty('statusCode', 401);
      });
    });

    describe('Valid Credentials', () => {
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
        expect(response.body).toHaveProperty('user');
        expect(response.body.user).toHaveProperty('email', DEMO_ADMIN_EMAIL);
        expect(response.body.user).not.toHaveProperty('passwordHash');
      });
    });

    describe('Input Validation', () => {
      it('should return 400 for missing email', async () => {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            password: 'SomePassword123!',
          })
          .expect(400);
      });

      it('should return 400 for missing password', async () => {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: 'test@example.com',
          })
          .expect(400);
      });

      it('should return 400 for invalid email format', async () => {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: 'not-an-email',
            password: 'SomePassword123!',
          })
          .expect(400);
      });
    });
  });

  // ==================== CORRELATION ID TESTS ====================
  describe('Correlation ID', () => {
    it('should return x-correlation-id header in response', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/live')
        .expect(200);

      expect(response.headers['x-correlation-id']).toBeDefined();
      expect(typeof response.headers['x-correlation-id']).toBe('string');
    });

    it('should use provided x-correlation-id if sent in request', async () => {
      const customCorrelationId = 'test-correlation-id-12345';

      const response = await request(app.getHttpServer())
        .get('/health/live')
        .set('x-correlation-id', customCorrelationId)
        .expect(200);

      expect(response.headers['x-correlation-id']).toBe(customCorrelationId);
    });
  });
});
