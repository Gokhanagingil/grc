import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * CMDB Service Portfolio Access Control E2E Tests (PR-B1)
 *
 * Tests for:
 * - PermissionsGuard on CMDB Service and Offering endpoints
 * - Tenant isolation for Service Portfolio resources
 * - Cross-tenant access prevention
 * - LIST-CONTRACT response format
 */
describe('CMDB Service Portfolio Access Control (e2e)', () => {
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

  // ==================== SERVICES — AUTH ====================
  describe('CMDB Services — Authentication', () => {
    it('should return 401 for GET /grc/cmdb/services without token', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/cmdb/services')
        .set('x-tenant-id', tenantId)
        .expect(401);
    });

    it('should return 401 for POST /grc/cmdb/services without token', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .post('/grc/cmdb/services')
        .set('x-tenant-id', tenantId)
        .send({ name: 'test', type: 'business_service' })
        .expect(401);
    });

    it('should return 401 for DELETE /grc/cmdb/services/:id without token', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .delete('/grc/cmdb/services/00000000-0000-0000-0000-000000000099')
        .set('x-tenant-id', tenantId)
        .expect(401);
    });
  });

  // ==================== SERVICES — ADMIN READ ====================
  describe('CMDB Services — Admin Read Access', () => {
    it('should return 200 for GET /grc/cmdb/services with admin token', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/cmdb/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const data = response.body.data ?? response.body;
      const items = data.items ?? data;
      expect(Array.isArray(items)).toBe(true);
    });

    it('should return LIST-CONTRACT format for GET /grc/cmdb/services', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/cmdb/services')
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

  // ==================== SERVICES — CRUD ====================
  describe('CMDB Services — CRUD Operations', () => {
    let createdServiceId: string;

    it('should return 201 for POST /grc/cmdb/services with admin token', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const uniqueName = `test_service_${Date.now()}`;
      const response = await request(app.getHttpServer())
        .post('/grc/cmdb/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          name: uniqueName,
          type: 'business_service',
          status: 'planned',
          description: 'Created by e2e test',
        })
        .expect(201);

      const created = response.body.data ?? response.body;
      expect(created).toHaveProperty('id');
      expect(created.name).toBe(uniqueName);
      expect(created.type).toBe('business_service');
      createdServiceId = created.id;
    });

    it('should return 200 for GET /grc/cmdb/services/:id with admin token', async () => {
      if (!dbConnected || !tenantId || !adminToken || !createdServiceId) {
        console.log('Skipping test: database not connected or no service created');
        return;
      }

      const response = await request(app.getHttpServer())
        .get(`/grc/cmdb/services/${createdServiceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const svc = response.body.data ?? response.body;
      expect(svc.id).toBe(createdServiceId);
    });

    it('should return 200 for PATCH /grc/cmdb/services/:id with admin token', async () => {
      if (!dbConnected || !tenantId || !adminToken || !createdServiceId) {
        console.log('Skipping test: database not connected or no service created');
        return;
      }

      const response = await request(app.getHttpServer())
        .patch(`/grc/cmdb/services/${createdServiceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({ status: 'live' })
        .expect(200);

      const updated = response.body.data ?? response.body;
      expect(updated.status).toBe('live');
    });

    it('should return 204 for DELETE /grc/cmdb/services/:id with admin token', async () => {
      if (!dbConnected || !tenantId || !adminToken || !createdServiceId) {
        console.log('Skipping test: database not connected or no service created');
        return;
      }

      await request(app.getHttpServer())
        .delete(`/grc/cmdb/services/${createdServiceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/grc/cmdb/services/${createdServiceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(404);
    });
  });

  // ==================== SERVICES — TENANT ISOLATION ====================
  describe('CMDB Services — Tenant Isolation', () => {
    it('should return 400 for GET /grc/cmdb/services without x-tenant-id', async () => {
      if (!dbConnected || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/cmdb/services')
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
        .get('/grc/cmdb/services')
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
        .get('/grc/cmdb/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', 'not-a-valid-uuid')
        .expect(400);
    });

    it('should only return services belonging to current tenant', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/cmdb/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const data = response.body.data ?? response.body;
      const items = data.items ?? data;
      if (Array.isArray(items) && items.length > 0) {
        items.forEach((svc: { tenantId: string }) => {
          expect(svc.tenantId).toBe(tenantId);
        });
      }
    });
  });

  // ==================== OFFERINGS — AUTH + TENANT ====================
  describe('CMDB Service Offerings — Authentication & Tenant Isolation', () => {
    it('should return 401 for GET /grc/cmdb/service-offerings without token', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/cmdb/service-offerings')
        .set('x-tenant-id', tenantId)
        .expect(401);
    });

    it('should return 200 for GET /grc/cmdb/service-offerings with admin token', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/cmdb/service-offerings')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const data = response.body.data ?? response.body;
      expect(data).toHaveProperty('items');
      expect(data).toHaveProperty('total');
    });

    it('should return 403 for cross-tenant GET /grc/cmdb/service-offerings', async () => {
      if (!dbConnected || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const fakeTenantId = '00000000-0000-0000-0000-000000000099';

      await request(app.getHttpServer())
        .get('/grc/cmdb/service-offerings')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', fakeTenantId)
        .expect(403);
    });
  });

  // ==================== OFFERINGS — CRUD WITH SERVICE SCOPING ====================
  describe('CMDB Service Offerings — CRUD with Service Scoping', () => {
    let serviceId: string;
    let offeringId: string;

    beforeAll(async () => {
      if (!dbConnected || !tenantId || !adminToken) return;

      const uniqueName = `test_svc_for_off_${Date.now()}`;
      const svcRes = await request(app.getHttpServer())
        .post('/grc/cmdb/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          name: uniqueName,
          type: 'technical_service',
          status: 'planned',
        });

      const svc = svcRes.body.data ?? svcRes.body;
      serviceId = svc.id;
    });

    afterAll(async () => {
      if (!dbConnected || !tenantId || !adminToken || !serviceId) return;

      await request(app.getHttpServer())
        .delete(`/grc/cmdb/services/${serviceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);
    });

    it('should create an offering under the service', async () => {
      if (!dbConnected || !tenantId || !adminToken || !serviceId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      const uniqueName = `test_offering_${Date.now()}`;
      const response = await request(app.getHttpServer())
        .post('/grc/cmdb/service-offerings')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          serviceId,
          name: uniqueName,
          status: 'planned',
          supportHours: '8x5',
        })
        .expect(201);

      const created = response.body.data ?? response.body;
      expect(created).toHaveProperty('id');
      expect(created.serviceId).toBe(serviceId);
      expect(created.name).toBe(uniqueName);
      offeringId = created.id;
    });

    it('should get the offering by ID', async () => {
      if (!dbConnected || !tenantId || !adminToken || !offeringId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      const response = await request(app.getHttpServer())
        .get(`/grc/cmdb/service-offerings/${offeringId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const off = response.body.data ?? response.body;
      expect(off.id).toBe(offeringId);
      expect(off.serviceId).toBe(serviceId);
    });

    it('should update the offering', async () => {
      if (!dbConnected || !tenantId || !adminToken || !offeringId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      const response = await request(app.getHttpServer())
        .patch(`/grc/cmdb/service-offerings/${offeringId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({ status: 'live', supportHours: '24x7' })
        .expect(200);

      const updated = response.body.data ?? response.body;
      expect(updated.status).toBe('live');
    });

    it('should delete the offering', async () => {
      if (!dbConnected || !tenantId || !adminToken || !offeringId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      await request(app.getHttpServer())
        .delete(`/grc/cmdb/service-offerings/${offeringId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/grc/cmdb/service-offerings/${offeringId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(404);
    });
  });
});
