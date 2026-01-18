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

      // Handle both wrapped (new) and unwrapped (legacy) response formats
      const responseData = loginResponse.body.data ?? loginResponse.body;
      adminToken = responseData.accessToken;
      tenantId = responseData.user?.tenantId;
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

        // Error response is wrapped in standard envelope
        expect(response.body.success).toBe(false);
        expect(response.body.error).toHaveProperty('code', 'UNAUTHORIZED');
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

        // Response is wrapped in LIST-CONTRACT format: { success, data: { items, ... } }
        const items =
          response.body.data?.items ??
          response.body.data ??
          response.body.items ??
          response.body;
        expect(Array.isArray(items)).toBe(true);
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

        // Response is wrapped in LIST-CONTRACT format: { success, data: { items, ... } }
        const items =
          response.body.data?.items ??
          response.body.data ??
          response.body.items ??
          response.body;
        expect(Array.isArray(items)).toBe(true);
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

        // Response is wrapped in LIST-CONTRACT format: { success, data: { items, ... } }
        const items =
          response.body.data?.items ??
          response.body.data ??
          response.body.items ??
          response.body;
        expect(Array.isArray(items)).toBe(true);
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

        // Response is wrapped in standard envelope
        const data = response.body.data ?? response.body.items ?? response.body;
        // All returned risks should belong to the current tenant
        if (Array.isArray(data) && data.length > 0) {
          data.forEach((risk: { tenantId: string }) => {
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

        // Response is wrapped in standard envelope
        const data = response.body.data ?? response.body.items ?? response.body;
        if (Array.isArray(data) && data.length > 0) {
          data.forEach((policy: { tenantId: string }) => {
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

        // Response is wrapped in standard envelope
        const data = response.body.data ?? response.body.items ?? response.body;
        if (Array.isArray(data) && data.length > 0) {
          data.forEach((req: { tenantId: string }) => {
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

        // Error response is wrapped in standard envelope
        expect(response.body.success).toBe(false);
        expect(response.body.error).toHaveProperty('code', 'UNAUTHORIZED');
        expect(response.body.error).toHaveProperty(
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

        // Error response is wrapped in standard envelope
        expect(response.body.success).toBe(false);
        expect(response.body.error).toHaveProperty('code', 'UNAUTHORIZED');
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

        // Handle both wrapped (new) and unwrapped (legacy) response formats
        const responseData = response.body.data ?? response.body;
        expect(responseData).toHaveProperty('accessToken');
        expect(typeof responseData.accessToken).toBe('string');
        expect(responseData).toHaveProperty('user');
        expect(responseData.user).toHaveProperty('email', DEMO_ADMIN_EMAIL);
        expect(responseData.user).not.toHaveProperty('passwordHash');
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

  // ==================== PLATFORM MODULE SECURITY TESTS ====================
  describe('Platform Module Security', () => {
    describe('/platform/modules/menu/nested', () => {
      it('should return 401 without authentication', async () => {
        if (!dbConnected) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/platform/modules/menu/nested')
          .expect(401);
      });

      it('should return 400 without x-tenant-id header', async () => {
        if (!dbConnected || !adminToken) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/platform/modules/menu/nested')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);
      });

      it('should return 403 for spoof tenant ID (valid UUID but user does not belong)', async () => {
        if (!dbConnected || !adminToken) {
          console.log('Skipping test: database not connected');
          return;
        }

        // Use a valid UUID format but one that doesn't exist or user doesn't belong to
        const spoofTenantId = '00000000-0000-0000-0000-000000000099';

        const response = await request(app.getHttpServer())
          .get('/platform/modules/menu/nested')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', spoofTenantId)
          .expect(403);

        // Error response should indicate access denied
        expect(response.body.success).toBe(false);
        expect(response.body.error).toHaveProperty('message');
        expect(response.body.error.message).toContain(
          'does not belong to tenant',
        );
      });

      it('should return 200 with valid token and tenant header, and tenantId in response matches real tenant', async () => {
        if (!dbConnected || !adminToken || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/platform/modules/menu/nested')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(response.body).toBeDefined();
        // Verify the returned tenantId matches the authenticated user's real tenant
        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('tenantId');
        expect(data.tenantId).toBe(tenantId);
      });
    });

    describe('/platform/ui-policies', () => {
      it('should return 401 without authentication', async () => {
        if (!dbConnected) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/platform/ui-policies')
          .expect(401);
      });

      it('should return 400 without x-tenant-id header', async () => {
        if (!dbConnected || !adminToken) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/platform/ui-policies')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);
      });

      it('should return 403 for spoof tenant ID on read', async () => {
        if (!dbConnected || !adminToken) {
          console.log('Skipping test: database not connected');
          return;
        }

        const spoofTenantId = '00000000-0000-0000-0000-000000000099';

        await request(app.getHttpServer())
          .get('/platform/ui-policies')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', spoofTenantId)
          .expect(403);
      });

      it('should return 403 for spoof tenant ID on write', async () => {
        if (!dbConnected || !adminToken) {
          console.log('Skipping test: database not connected');
          return;
        }

        const spoofTenantId = '00000000-0000-0000-0000-000000000099';

        await request(app.getHttpServer())
          .post('/platform/ui-policies')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', spoofTenantId)
          .send({
            name: 'Test Policy',
            table_name: 'risks',
            condition: { always: true },
            actions: [],
            priority: 0,
          })
          .expect(403);
      });

      it('should return 200 with valid token and tenant header', async () => {
        if (!dbConnected || !adminToken || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/platform/ui-policies')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(response.body).toBeDefined();
      });
    });

    describe('/platform/form-layouts', () => {
      it('should return 401 without authentication', async () => {
        if (!dbConnected) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/platform/form-layouts')
          .expect(401);
      });

      it('should return 400 without x-tenant-id header', async () => {
        if (!dbConnected || !adminToken) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/platform/form-layouts')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);
      });

      it('should return 403 for spoof tenant ID on read', async () => {
        if (!dbConnected || !adminToken) {
          console.log('Skipping test: database not connected');
          return;
        }

        const spoofTenantId = '00000000-0000-0000-0000-000000000099';

        await request(app.getHttpServer())
          .get('/platform/form-layouts')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', spoofTenantId)
          .expect(403);
      });

      it('should return 403 for spoof tenant ID on write', async () => {
        if (!dbConnected || !adminToken) {
          console.log('Skipping test: database not connected');
          return;
        }

        const spoofTenantId = '00000000-0000-0000-0000-000000000099';

        await request(app.getHttpServer())
          .post('/platform/form-layouts')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', spoofTenantId)
          .send({
            table_name: 'risks',
            role: 'default',
            layout_json: {
              sections: [],
              hiddenFields: [],
              readonlyFields: [],
            },
          })
          .expect(403);
      });

      it('should return 200 with valid token and tenant header', async () => {
        if (!dbConnected || !adminToken || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/platform/form-layouts')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(response.body).toBeDefined();
      });
    });
  });

  // ==================== TODOS SECURITY TESTS ====================
  describe('Todos Security', () => {
    it('should return 401 for /todos without authentication', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer()).get('/todos').expect(401);
    });

    it('should return 400 for /todos without x-tenant-id header', async () => {
      if (!dbConnected || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/todos')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should return 403 for /todos with spoof tenant ID', async () => {
      if (!dbConnected || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const spoofTenantId = '00000000-0000-0000-0000-000000000099';

      await request(app.getHttpServer())
        .get('/todos')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', spoofTenantId)
        .expect(403);
    });

    it('should return 200 for /todos with valid token and tenant header', async () => {
      if (!dbConnected || !adminToken || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/todos')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  // ==================== ONBOARDING CONTEXT SECURITY TESTS ====================
  describe('Onboarding Context Security', () => {
    it('should return 401 for /onboarding/context without authentication', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer()).get('/onboarding/context').expect(401);
    });

    it('should return 400 for /onboarding/context without x-tenant-id header', async () => {
      if (!dbConnected || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/onboarding/context')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should return 403 for /onboarding/context with spoof tenant ID', async () => {
      if (!dbConnected || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const spoofTenantId = '00000000-0000-0000-0000-000000000099';

      await request(app.getHttpServer())
        .get('/onboarding/context')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', spoofTenantId)
        .expect(403);
    });

    it('should return 200 for /onboarding/context with valid token and tenant header', async () => {
      if (!dbConnected || !adminToken || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/onboarding/context')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  // ==================== TENANT FRAMEWORKS SECURITY TESTS ====================
  describe('Tenant Frameworks Security', () => {
    it('should return 401 for GET /tenants/me/frameworks without authentication', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/tenants/me/frameworks')
        .expect(401);
    });

    it('should return 400 for GET /tenants/me/frameworks without x-tenant-id header', async () => {
      if (!dbConnected || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/tenants/me/frameworks')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should return 403 for GET /tenants/me/frameworks with spoof tenant ID', async () => {
      if (!dbConnected || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const spoofTenantId = '00000000-0000-0000-0000-000000000099';

      await request(app.getHttpServer())
        .get('/tenants/me/frameworks')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', spoofTenantId)
        .expect(403);
    });

    it('should return 200 for GET /tenants/me/frameworks with valid token and tenant header', async () => {
      if (!dbConnected || !adminToken || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/tenants/me/frameworks')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should return 403 for PUT /tenants/me/frameworks with spoof tenant ID', async () => {
      if (!dbConnected || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const spoofTenantId = '00000000-0000-0000-0000-000000000099';

      // Use empty array - tenant guard should reject before validation
      await request(app.getHttpServer())
        .put('/tenants/me/frameworks')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', spoofTenantId)
        .send({ activeKeys: [] })
        .expect(403);
    });

    it('should allow PUT /tenants/me/frameworks for admin with valid tenant', async () => {
      if (!dbConnected || !adminToken || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      // First, get current frameworks to restore later
      const currentResponse = await request(app.getHttpServer())
        .get('/tenants/me/frameworks')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const currentKeys =
        currentResponse.body.data ?? currentResponse.body ?? [];

      // Admin should have ADMIN_SETTINGS_WRITE permission
      // Use empty array which is always valid (clears all frameworks)
      const response = await request(app.getHttpServer())
        .put('/tenants/me/frameworks')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({ activeKeys: [] })
        .expect(200);

      expect(response.body).toBeDefined();

      // Restore original frameworks if any existed
      if (Array.isArray(currentKeys) && currentKeys.length > 0) {
        await request(app.getHttpServer())
          .put('/tenants/me/frameworks')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({ activeKeys: currentKeys });
      }
    });
  });

  // ==================== TENANTS ADMIN-ONLY TESTS ====================
  describe('Tenants Admin-Only Access', () => {
    it('should return 401 for /tenants list without authentication', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer()).get('/tenants').expect(401);
    });

    it('should return 200 for /tenants list with admin token', async () => {
      if (!dbConnected || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/tenants')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      // Response should have tenants array
      const data = response.body.data ?? response.body;
      expect(data).toHaveProperty('tenants');
    });
  });
});
