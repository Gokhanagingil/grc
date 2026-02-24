import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * CMDB Service-CI Mapping Access Control E2E Tests (PR-B2)
 *
 * Tests for:
 * - Link/unlink service-CI relationships
 * - Tenant isolation for service-CI mappings
 * - Authentication requirements
 * - LIST-CONTRACT response format
 */
describe('CMDB Service-CI Mapping Access Control (e2e)', () => {
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

  // ==================== AUTH ====================
  describe('Service-CI Mapping — Authentication', () => {
    it('should return 401 for POST link without token', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .post(
          '/grc/cmdb/services/00000000-0000-0000-0000-000000000001/cis/00000000-0000-0000-0000-000000000001',
        )
        .set('x-tenant-id', tenantId)
        .send({ relationshipType: 'depends_on' })
        .expect(401);
    });

    it('should return 401 for DELETE unlink without token', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .delete(
          '/grc/cmdb/services/00000000-0000-0000-0000-000000000001/cis/00000000-0000-0000-0000-000000000001',
        )
        .set('x-tenant-id', tenantId)
        .expect(401);
    });

    it('should return 401 for GET CIs for service without token', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/cmdb/services/00000000-0000-0000-0000-000000000001/cis')
        .set('x-tenant-id', tenantId)
        .expect(401);
    });

    it('should return 401 for GET services for CI without token', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/cmdb/cis/00000000-0000-0000-0000-000000000001/services')
        .set('x-tenant-id', tenantId)
        .expect(401);
    });
  });

  // ==================== TENANT ISOLATION ====================
  describe('Service-CI Mapping — Tenant Isolation', () => {
    it('should return 400 for link without x-tenant-id', async () => {
      if (!dbConnected || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .post(
          '/grc/cmdb/services/00000000-0000-0000-0000-000000000001/cis/00000000-0000-0000-0000-000000000001',
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ relationshipType: 'depends_on' })
        .expect(400);
    });

    it('should return 403 for link with wrong tenant', async () => {
      if (!dbConnected || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const fakeTenantId = '00000000-0000-0000-0000-000000000099';

      await request(app.getHttpServer())
        .post(
          '/grc/cmdb/services/00000000-0000-0000-0000-000000000001/cis/00000000-0000-0000-0000-000000000001',
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', fakeTenantId)
        .send({ relationshipType: 'depends_on' })
        .expect(403);
    });

    it('should return 403 for GET CIs for service with wrong tenant', async () => {
      if (!dbConnected || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const fakeTenantId = '00000000-0000-0000-0000-000000000099';

      await request(app.getHttpServer())
        .get('/grc/cmdb/services/00000000-0000-0000-0000-000000000001/cis')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', fakeTenantId)
        .expect(403);
    });

    it('should return 403 for GET services for CI with wrong tenant', async () => {
      if (!dbConnected || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const fakeTenantId = '00000000-0000-0000-0000-000000000099';

      await request(app.getHttpServer())
        .get('/grc/cmdb/cis/00000000-0000-0000-0000-000000000001/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', fakeTenantId)
        .expect(403);
    });
  });

  // ==================== LINK / UNLINK + LIST ====================
  describe('Service-CI Mapping — Link, List, Unlink', () => {
    let serviceId: string;
    let ciId: string;

    beforeAll(async () => {
      if (!dbConnected || !tenantId || !adminToken) return;

      const svcRes = await request(app.getHttpServer())
        .post('/grc/cmdb/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          name: `test_svc_ci_link_${Date.now()}`,
          type: 'business_service',
          status: 'planned',
        });
      const svc = svcRes.body.data ?? svcRes.body;
      serviceId = svc.id;

      const cisRes = await request(app.getHttpServer())
        .get('/grc/cmdb/cis')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);
      const cisData = cisRes.body.data ?? cisRes.body;
      const cis = cisData.items ?? cisData;
      if (Array.isArray(cis) && cis.length > 0) {
        ciId = cis[0].id;
      }
    });

    afterAll(async () => {
      if (!dbConnected || !tenantId || !adminToken || !serviceId) return;

      await request(app.getHttpServer())
        .delete(`/grc/cmdb/services/${serviceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);
    });

    it('should link a CI to a service', async () => {
      if (!dbConnected || !tenantId || !adminToken || !serviceId || !ciId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      const response = await request(app.getHttpServer())
        .post(`/grc/cmdb/services/${serviceId}/cis/${ciId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({ relationshipType: 'depends_on' })
        .expect(201);

      const created = response.body.data ?? response.body;
      expect(created).toHaveProperty('id');
      expect(created.serviceId).toBe(serviceId);
      expect(created.ciId).toBe(ciId);
      expect(created.relationshipType).toBe('depends_on');
    });

    it('should list CIs for service with LIST-CONTRACT format', async () => {
      if (!dbConnected || !tenantId || !adminToken || !serviceId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      const response = await request(app.getHttpServer())
        .get(`/grc/cmdb/services/${serviceId}/cis`)
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

      if (ciId) {
        expect(data.total).toBeGreaterThanOrEqual(1);
        const linked = data.items.find(
          (item: { ciId: string }) => item.ciId === ciId,
        );
        expect(linked).toBeDefined();
      }
    });

    it('should list services for CI with LIST-CONTRACT format', async () => {
      if (!dbConnected || !tenantId || !adminToken || !ciId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      const response = await request(app.getHttpServer())
        .get(`/grc/cmdb/cis/${ciId}/services`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const data = response.body.data ?? response.body;
      expect(data).toHaveProperty('items');
      expect(data).toHaveProperty('total');
      expect(Array.isArray(data.items)).toBe(true);

      if (serviceId) {
        const linked = data.items.find(
          (item: { serviceId: string }) => item.serviceId === serviceId,
        );
        expect(linked).toBeDefined();
      }
    });

    it('should reject duplicate link', async () => {
      if (!dbConnected || !tenantId || !adminToken || !serviceId || !ciId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      const response = await request(app.getHttpServer())
        .post(`/grc/cmdb/services/${serviceId}/cis/${ciId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({ relationshipType: 'depends_on' });

      expect([400, 409, 500]).toContain(response.status);
    });

    it('should unlink a CI from a service', async () => {
      if (!dbConnected || !tenantId || !adminToken || !serviceId || !ciId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      await request(app.getHttpServer())
        .delete(
          `/grc/cmdb/services/${serviceId}/cis/${ciId}?relationshipType=depends_on`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(204);

      const response = await request(app.getHttpServer())
        .get(`/grc/cmdb/services/${serviceId}/cis`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const data = response.body.data ?? response.body;
      const items = data.items ?? data;
      const stillLinked = Array.isArray(items)
        ? items.find(
            (item: { ciId: string; relationshipType: string }) =>
              item.ciId === ciId && item.relationshipType === 'depends_on',
          )
        : undefined;
      expect(stillLinked).toBeUndefined();
    });
  });
});
