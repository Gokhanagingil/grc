import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * CMDB Access Control E2E Tests (PR-A.1)
 *
 * Tests for:
 * - PermissionsGuard on CMDB CI Class endpoints
 * - Tenant isolation for CMDB resources
 * - Cross-tenant access prevention
 */
describe('CMDB Access Control (e2e)', () => {
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

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: DEMO_ADMIN_EMAIL,
          password: DEMO_ADMIN_PASSWORD,
        });

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

  // ==================== CMDB CI CLASSES — AUTH ====================
  describe('CMDB CI Classes — Authentication', () => {
    it('should return 401 for GET /grc/cmdb/classes without token', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/cmdb/classes')
        .set('x-tenant-id', tenantId)
        .expect(401);
    });

    it('should return 401 for POST /grc/cmdb/classes without token', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .post('/grc/cmdb/classes')
        .set('x-tenant-id', tenantId)
        .send({ name: 'test', label: 'Test' })
        .expect(401);
    });

    it('should return 401 for DELETE /grc/cmdb/classes/:id without token', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .delete('/grc/cmdb/classes/00000000-0000-0000-0000-000000000099')
        .set('x-tenant-id', tenantId)
        .expect(401);
    });
  });

  // ==================== CMDB CI CLASSES — ADMIN READ ====================
  describe('CMDB CI Classes — Admin Read Access', () => {
    it('should return 200 for GET /grc/cmdb/classes with admin token', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/cmdb/classes')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const data = response.body.data ?? response.body;
      const items = data.items ?? data;
      expect(Array.isArray(items)).toBe(true);
    });

    it('should return LIST-CONTRACT format for GET /grc/cmdb/classes', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/cmdb/classes')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const data = response.body.data ?? response.body;
      expect(data).toHaveProperty('items');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('page');
      expect(data).toHaveProperty('pageSize');
      expect(data).toHaveProperty('totalPages');
      expect(Array.isArray(data.items)).toBe(true);
      expect(typeof data.total).toBe('number');
    });
  });

  // ==================== CMDB CI CLASSES — WRITE REQUIRES PERMISSION ====================
  describe('CMDB CI Classes — Write Permission Enforcement', () => {
    it('should return 201 for POST /grc/cmdb/classes with admin token', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const uniqueName = `test_class_${Date.now()}`;
      const response = await request(app.getHttpServer())
        .post('/grc/cmdb/classes')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          name: uniqueName,
          label: 'Test Class',
          description: 'Created by e2e test',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(uniqueName);

      // Clean up: soft-delete the created class
      if (response.body.id) {
        await request(app.getHttpServer())
          .delete(`/grc/cmdb/classes/${response.body.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(204);
      }
    });

    it('should return 200 for PATCH /grc/cmdb/classes/:id with admin token', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      // Create a class to update
      const uniqueName = `test_update_${Date.now()}`;
      const createRes = await request(app.getHttpServer())
        .post('/grc/cmdb/classes')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({ name: uniqueName, label: 'Before Update' })
        .expect(201);

      const classId = createRes.body.id;

      const updateRes = await request(app.getHttpServer())
        .patch(`/grc/cmdb/classes/${classId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({ label: 'After Update' })
        .expect(200);

      expect(updateRes.body.label).toBe('After Update');

      // Clean up
      await request(app.getHttpServer())
        .delete(`/grc/cmdb/classes/${classId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(204);
    });

    it('should return 204 for DELETE /grc/cmdb/classes/:id with admin token', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      // Create a class to delete
      const uniqueName = `test_delete_${Date.now()}`;
      const createRes = await request(app.getHttpServer())
        .post('/grc/cmdb/classes')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({ name: uniqueName, label: 'To Delete' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/grc/cmdb/classes/${createRes.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(204);

      // Verify it's gone (soft-deleted)
      await request(app.getHttpServer())
        .get(`/grc/cmdb/classes/${createRes.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(404);
    });
  });

  // ==================== CMDB CI CLASSES — TENANT ISOLATION ====================
  describe('CMDB CI Classes — Tenant Isolation', () => {
    it('should return 400 for GET /grc/cmdb/classes without x-tenant-id', async () => {
      if (!dbConnected || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/cmdb/classes')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should return 403 for non-existent tenant ID', async () => {
      if (!dbConnected || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const fakeTenantId = '00000000-0000-0000-0000-000000000099';

      await request(app.getHttpServer())
        .get('/grc/cmdb/classes')
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
        .get('/grc/cmdb/classes')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', 'not-a-valid-uuid')
        .expect(400);
    });

    it('should only return classes belonging to current tenant', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/cmdb/classes')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const data = response.body.data ?? response.body;
      const items = data.items ?? data;
      if (Array.isArray(items) && items.length > 0) {
        items.forEach((cls: { tenantId: string }) => {
          expect(cls.tenantId).toBe(tenantId);
        });
      }
    });
  });

  // ==================== CMDB CIs — AUTH + TENANT ====================
  describe('CMDB CIs — Authentication & Tenant Isolation', () => {
    it('should return 401 for GET /grc/cmdb/cis without token', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/cmdb/cis')
        .set('x-tenant-id', tenantId)
        .expect(401);
    });

    it('should return 200 for GET /grc/cmdb/cis with admin token', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/cmdb/cis')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const data = response.body.data ?? response.body;
      expect(data).toHaveProperty('items');
      expect(data).toHaveProperty('total');
    });

    it('should return 400 for POST /grc/cmdb/cis without x-tenant-id', async () => {
      if (!dbConnected || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .post('/grc/cmdb/cis')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'test-ci',
          classId: '00000000-0000-0000-0000-000000000001',
        })
        .expect(400);
    });

    it('should return 403 for cross-tenant GET /grc/cmdb/cis', async () => {
      if (!dbConnected || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const fakeTenantId = '00000000-0000-0000-0000-000000000099';

      await request(app.getHttpServer())
        .get('/grc/cmdb/cis')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', fakeTenantId)
        .expect(403);
    });
  });

  // ==================== CMDB RELATIONSHIPS — AUTH + TENANT ====================
  describe('CMDB Relationships — Authentication & Tenant Isolation', () => {
    it('should return 401 for GET /grc/cmdb/relationships without token', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/cmdb/relationships')
        .set('x-tenant-id', tenantId)
        .expect(401);
    });

    it('should return 200 for GET /grc/cmdb/relationships with admin token', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/cmdb/relationships')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const data = response.body.data ?? response.body;
      expect(data).toHaveProperty('items');
      expect(data).toHaveProperty('total');
    });

    it('should return 403 for cross-tenant GET /grc/cmdb/relationships', async () => {
      if (!dbConnected || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const fakeTenantId = '00000000-0000-0000-0000-000000000099';

      await request(app.getHttpServer())
        .get('/grc/cmdb/relationships')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', fakeTenantId)
        .expect(403);
    });
  });
});
