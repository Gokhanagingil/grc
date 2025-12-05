import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Multi-Tenancy (e2e)', () => {
  let app: INestApplication<App>;
  let dbConnected = false;
  let adminToken: string;
  let tenantId: string;

  // Demo admin credentials from environment variables (set in test/setup.ts)
  const DEMO_ADMIN_EMAIL =
    process.env.DEMO_ADMIN_EMAIL || 'admin@grc-platform.local';
  const DEMO_ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD || 'changeme';

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
      tenantId = loginResponse.body.user.tenantId;
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

  describe('GET /tenants/health', () => {
    it('should return health status without authentication', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/tenants/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('module', 'tenants');
      expect(response.body).toHaveProperty('tenantCount');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /tenants/current', () => {
    it('should return current tenant when valid token and tenant header provided', async () => {
      if (!dbConnected || !tenantId) {
        console.log(
          'Skipping test: database not connected or tenant not available',
        );
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/tenants/current')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('tenant');
      expect(response.body.tenant).toHaveProperty('id', tenantId);
      expect(response.body.tenant).toHaveProperty('name');
      expect(response.body).toHaveProperty('requestedBy');
      expect(response.body.requestedBy).toHaveProperty(
        'email',
        DEMO_ADMIN_EMAIL,
      );
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return 401 without token', async () => {
      if (!dbConnected || !tenantId) {
        console.log(
          'Skipping test: database not connected or tenant not available',
        );
        return;
      }

      await request(app.getHttpServer())
        .get('/tenants/current')
        .set('x-tenant-id', tenantId)
        .expect(401);
    });

    it('should return 400 without x-tenant-id header', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/tenants/current')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('x-tenant-id');
    });

    it('should return 400 with invalid x-tenant-id format', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/tenants/current')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', 'invalid-uuid')
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('UUID');
    });

    it('should return 403 when user does not belong to tenant', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      // Use a valid UUID format but one that doesn't exist
      const fakeTenantId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app.getHttpServer())
        .get('/tenants/current')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', fakeTenantId)
        .expect(403);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('does not belong to tenant');
    });
  });

  describe('GET /tenants/users', () => {
    it('should return users for the current tenant', async () => {
      if (!dbConnected || !tenantId) {
        console.log(
          'Skipping test: database not connected or tenant not available',
        );
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/tenants/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('tenantId', tenantId);
      expect(response.body).toHaveProperty('users');
      expect(Array.isArray(response.body.users)).toBe(true);
      expect(response.body).toHaveProperty('count');
      expect(response.body.count).toBeGreaterThanOrEqual(1);
      expect(response.body).toHaveProperty('timestamp');

      // Verify the admin user is in the list
      const adminUser = response.body.users.find(
        (u: any) => u.email === DEMO_ADMIN_EMAIL,
      );
      expect(adminUser).toBeDefined();
      expect(adminUser).toHaveProperty('role', 'admin');
    });

    it('should return 401 without token', async () => {
      if (!dbConnected || !tenantId) {
        console.log(
          'Skipping test: database not connected or tenant not available',
        );
        return;
      }

      await request(app.getHttpServer())
        .get('/tenants/users')
        .set('x-tenant-id', tenantId)
        .expect(401);
    });

    it('should return 403 when user does not belong to tenant', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      const fakeTenantId = '00000000-0000-0000-0000-000000000000';

      await request(app.getHttpServer())
        .get('/tenants/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', fakeTenantId)
        .expect(403);
    });
  });

  describe('Tenant context in JWT', () => {
    it('should include tenantId in user response after login', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: DEMO_ADMIN_EMAIL,
          password: DEMO_ADMIN_PASSWORD,
        })
        .expect(201);

      expect(loginResponse.body).toHaveProperty('user');
      expect(loginResponse.body.user).toHaveProperty('tenantId');
      expect(loginResponse.body.user.tenantId).toBeTruthy();
    });
  });
});
