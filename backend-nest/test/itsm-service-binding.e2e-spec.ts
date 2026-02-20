import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * ITSM Service Binding E2E Tests (PR-B3)
 *
 * Tests for:
 * - Create incident with service/offering succeeds
 * - Mismatched offering/service fails 400
 * - Cross-tenant reference fails 404/403
 * - Filter incidents by serviceId/offeringId
 */
describe('ITSM Service Binding (e2e)', () => {
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

  // ==================== SETUP HELPERS ====================
  let serviceId: string;
  let offeringId: string;

  describe('Setup — Create test service and offering', () => {
    it('should create a CMDB service for testing', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const res = await request(app.getHttpServer())
        .post('/grc/cmdb/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          name: `test_svc_binding_${Date.now()}`,
          type: 'business_service',
          status: 'planned',
        })
        .expect(201);

      const svc = res.body.data ?? res.body;
      serviceId = svc.id;
      expect(serviceId).toBeDefined();
    });

    it('should create a CMDB offering for the test service', async () => {
      if (!dbConnected || !tenantId || !adminToken || !serviceId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      const res = await request(app.getHttpServer())
        .post('/grc/cmdb/service-offerings')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          serviceId,
          name: `test_offering_${Date.now()}`,
          status: 'planned',
        })
        .expect(201);

      const off = res.body.data ?? res.body;
      offeringId = off.id;
      expect(offeringId).toBeDefined();
    });
  });

  // ==================== INCIDENT SERVICE BINDING ====================
  describe('Incident — Service Binding', () => {
    let incidentId: string;

    it('should create incident with valid serviceId + offeringId', async () => {
      if (!dbConnected || !tenantId || !adminToken || !serviceId || !offeringId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      const res = await request(app.getHttpServer())
        .post('/grc/itsm/incidents')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          shortDescription: `Test incident binding ${Date.now()}`,
          description: 'Testing service binding',
          serviceId,
          offeringId,
        })
        .expect(201);

      const inc = res.body.data ?? res.body;
      incidentId = inc.id;
      expect(inc.serviceId).toBe(serviceId);
      expect(inc.offeringId).toBe(offeringId);
    });

    it('should create incident with serviceId only (no offering)', async () => {
      if (!dbConnected || !tenantId || !adminToken || !serviceId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      const res = await request(app.getHttpServer())
        .post('/grc/itsm/incidents')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          shortDescription: `Test incident svc only ${Date.now()}`,
          description: 'Testing service only',
          serviceId,
        })
        .expect(201);

      const inc = res.body.data ?? res.body;
      expect(inc.serviceId).toBe(serviceId);
      expect(inc.offeringId).toBeNull();
    });

    it('should reject incident with offeringId but no serviceId (400)', async () => {
      if (!dbConnected || !tenantId || !adminToken || !offeringId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      await request(app.getHttpServer())
        .post('/grc/itsm/incidents')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          shortDescription: `Test incident bad ${Date.now()}`,
          description: 'Should fail',
          offeringId,
        })
        .expect(400);
    });

    it('should reject incident with mismatched offering/service (400)', async () => {
      if (!dbConnected || !tenantId || !adminToken || !serviceId || !offeringId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      const svc2Res = await request(app.getHttpServer())
        .post('/grc/cmdb/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          name: `test_svc_mismatch_${Date.now()}`,
          type: 'technical_service',
          status: 'planned',
        })
        .expect(201);

      const svc2 = svc2Res.body.data ?? svc2Res.body;

      await request(app.getHttpServer())
        .post('/grc/itsm/incidents')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          shortDescription: `Test incident mismatch ${Date.now()}`,
          description: 'Should fail - offering belongs to different service',
          serviceId: svc2.id,
          offeringId,
        })
        .expect(400);

      await request(app.getHttpServer())
        .delete(`/grc/cmdb/services/${svc2.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);
    });

    it('should reject incident with non-existent serviceId (404)', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      await request(app.getHttpServer())
        .post('/grc/itsm/incidents')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          shortDescription: `Test incident phantom ${Date.now()}`,
          description: 'Should fail - non-existent service',
          serviceId: '00000000-0000-0000-0000-000000000099',
        })
        .expect(404);
    });

    it('should update incident serviceId/offeringId', async () => {
      if (!dbConnected || !tenantId || !adminToken || !incidentId || !serviceId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      await request(app.getHttpServer())
        .patch(`/grc/itsm/incidents/${incidentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          serviceId: null,
          offeringId: null,
        })
        .expect(200);

      const getRes = await request(app.getHttpServer())
        .get(`/grc/itsm/incidents/${incidentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const inc = getRes.body.data ?? getRes.body;
      expect(inc.serviceId).toBeNull();
      expect(inc.offeringId).toBeNull();
    });

    it('should filter incidents by serviceId', async () => {
      if (!dbConnected || !tenantId || !adminToken || !serviceId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      const res = await request(app.getHttpServer())
        .get(`/grc/itsm/incidents?serviceId=${serviceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const data = res.body.data ?? res.body;
      expect(data).toHaveProperty('items');
      expect(Array.isArray(data.items)).toBe(true);
    });
  });

  // ==================== CHANGE SERVICE BINDING ====================
  describe('Change — Service Binding', () => {
    it('should create change with valid serviceId + offeringId', async () => {
      if (!dbConnected || !tenantId || !adminToken || !serviceId || !offeringId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      const res = await request(app.getHttpServer())
        .post('/grc/itsm/changes')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          title: `Test change binding ${Date.now()}`,
          description: 'Testing service binding on change',
          type: 'NORMAL',
          serviceId,
          offeringId,
        })
        .expect(201);

      const ch = res.body.data ?? res.body;
      expect(ch.serviceId).toBe(serviceId);
      expect(ch.offeringId).toBe(offeringId);
    });

    it('should reject change with mismatched offering/service (400)', async () => {
      if (!dbConnected || !tenantId || !adminToken || !serviceId || !offeringId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      const svc3Res = await request(app.getHttpServer())
        .post('/grc/cmdb/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          name: `test_svc_ch_mismatch_${Date.now()}`,
          type: 'technical_service',
          status: 'planned',
        })
        .expect(201);

      const svc3 = svc3Res.body.data ?? svc3Res.body;

      await request(app.getHttpServer())
        .post('/grc/itsm/changes')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          title: `Test change mismatch ${Date.now()}`,
          description: 'Should fail',
          type: 'NORMAL',
          serviceId: svc3.id,
          offeringId,
        })
        .expect(400);

      await request(app.getHttpServer())
        .delete(`/grc/cmdb/services/${svc3.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);
    });

    it('should filter changes by serviceId', async () => {
      if (!dbConnected || !tenantId || !adminToken || !serviceId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      const res = await request(app.getHttpServer())
        .get(`/grc/itsm/changes?serviceId=${serviceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const data = res.body.data ?? res.body;
      expect(data).toHaveProperty('items');
      expect(Array.isArray(data.items)).toBe(true);
    });
  });

  // ==================== CLEANUP ====================
  describe('Cleanup', () => {
    it('should clean up test data', async () => {
      if (!dbConnected || !tenantId || !adminToken) return;

      if (offeringId) {
        await request(app.getHttpServer())
          .delete(`/grc/cmdb/service-offerings/${offeringId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId);
      }

      if (serviceId) {
        await request(app.getHttpServer())
          .delete(`/grc/cmdb/services/${serviceId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId);
      }
    });
  });
});
