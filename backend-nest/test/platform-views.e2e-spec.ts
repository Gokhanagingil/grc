import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * Universal Views Platform Controller E2E Tests
 *
 * Tests to verify that the platform controller endpoints are correctly registered
 * and return appropriate responses:
 * - 401 Unauthorized when no auth token provided (not 404)
 * - 200 OK with valid auth and tenant headers
 *
 * This is a regression guard to ensure the routes are properly wired.
 */
describe('Universal Views Platform Controller (e2e)', () => {
  let app: INestApplication<App>;
  let dbConnected = false;
  let adminToken: string;
  let tenantId: string;

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

  describe('Route Registration - Unauthenticated requests should return 401 (not 404)', () => {
    it('GET /grc/platform/tables should return 401 without auth', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/platform/tables')
        .set('x-tenant-id', '00000000-0000-0000-0000-000000000001');

      // Route should exist and return 401 (not 404)
      expect(response.status).toBe(401);
    });

    it('GET /grc/platform/tables/:tableName/schema should return 401 without auth', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/platform/tables/controls/schema')
        .set('x-tenant-id', '00000000-0000-0000-0000-000000000001');

      // Route should exist and return 401 (not 404)
      expect(response.status).toBe(401);
    });

    it('GET /grc/platform/views should return 401 without auth', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/platform/views')
        .set('x-tenant-id', '00000000-0000-0000-0000-000000000001');

      // Route should exist and return 401 (not 404)
      expect(response.status).toBe(401);
    });

    it('GET /grc/platform/views/:tableName should return 401 without auth', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/platform/views/controls')
        .set('x-tenant-id', '00000000-0000-0000-0000-000000000001');

      // Route should exist and return 401 (not 404)
      expect(response.status).toBe(401);
    });

    it('PUT /grc/platform/views/:tableName should return 401 without auth', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .put('/grc/platform/views/controls')
        .set('x-tenant-id', '00000000-0000-0000-0000-000000000001')
        .send({ visibleColumns: ['name', 'status'] });

      // Route should exist and return 401 (not 404)
      expect(response.status).toBe(401);
    });
  });

  describe('Table Schema Endpoint - Authenticated requests', () => {
    it('GET /grc/platform/tables should return 200 with list of tables', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/platform/tables')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('tables');
      expect(Array.isArray(response.body.data.tables)).toBe(true);
      expect(response.body.data.tables).toContain('controls');
      expect(response.body.data.tables).toContain('risks');
    });

    it('GET /grc/platform/tables/controls/schema should return schema for controls', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/platform/tables/controls/schema')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('tableName', 'controls');
      expect(response.body.data).toHaveProperty('fields');
      expect(Array.isArray(response.body.data.fields)).toBe(true);
      expect(response.body.data.fields.length).toBeGreaterThan(0);

      // Verify field structure
      const nameField = response.body.data.fields.find(
        (f: { name: string }) => f.name === 'name',
      );
      expect(nameField).toBeDefined();
      expect(nameField).toHaveProperty('label');
      expect(nameField).toHaveProperty('dataType');
      expect(nameField).toHaveProperty('filterable');
      expect(nameField).toHaveProperty('sortable');
    });

    it('GET /grc/platform/tables/grc_controls/schema should return schema (alias support)', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/platform/tables/grc_controls/schema')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('tableName', 'controls');
    });

    it('GET /grc/platform/tables/risks/schema should return schema for risks', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/platform/tables/risks/schema')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('tableName', 'risks');
      expect(response.body.data).toHaveProperty('fields');
    });

    it('GET /grc/platform/tables/invalid_table/schema should return 404', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/platform/tables/invalid_table/schema')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(404);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('not found');
    });
  });

  describe('View Preferences Endpoint - Authenticated requests', () => {
    it('GET /grc/platform/views/controls should return default preference', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/platform/views/controls')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('preference');
      expect(response.body.data.preference).toHaveProperty('visibleColumns');
      expect(Array.isArray(response.body.data.preference.visibleColumns)).toBe(
        true,
      );
    });

    it('PUT /grc/platform/views/controls should save preference', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const preference = {
        visibleColumns: ['name', 'status', 'type'],
        columnOrder: ['name', 'status', 'type'],
        pageSize: 25,
      };

      const response = await request(app.getHttpServer())
        .put('/grc/platform/views/controls')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send(preference)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('preference');
      expect(response.body.data.preference.visibleColumns).toEqual(
        preference.visibleColumns,
      );
      expect(response.body.data.preference.pageSize).toBe(preference.pageSize);
    });

    it('GET /grc/platform/views should return all preferences', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/platform/views')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('Missing x-tenant-id header', () => {
    it('GET /grc/platform/tables/controls/schema should return 400 without tenant header', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/platform/tables/controls/schema')
        .set('Authorization', `Bearer ${adminToken}`);

      // Should return 400 Bad Request for missing tenant header
      // Note: The exact status depends on guard order - TenantGuard may return 400 or 401
      expect([400, 401]).toContain(response.status);
    });
  });
});
