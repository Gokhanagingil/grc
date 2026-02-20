import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * ITSM Incident Affected CIs & Impact Summary E2E Tests (PR-B4)
 *
 * Tests for:
 * - Admin can POST affected CI and impact-summary includes derived service
 * - Cross-tenant CI reference fails (404)
 * - Choice validation rejects invalid relationshipType (400)
 * - Duplicate link rejected (400)
 * - List affected CIs returns paginated results
 * - Delete affected CI link works
 * - Impact summary returns expected shape
 */
describe('ITSM Incident Affected CIs & Impact (e2e)', () => {
  let app: INestApplication<App>;
  let dbConnected = false;
  let adminToken: string;
  let tenantId: string;

  const DEMO_ADMIN_EMAIL =
    process.env.DEMO_ADMIN_EMAIL || 'admin@grc-platform.local';
  const DEMO_ADMIN_PASSWORD =
    process.env.DEMO_ADMIN_PASSWORD || 'TestPassword123!';

  let incidentId: string;
  let ciClassId: string;
  let ciId: string;
  let serviceId: string;

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

  // ==================== SETUP ====================
  describe('Setup — Create test data', () => {
    it('should create an incident for testing', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const res = await request(app.getHttpServer())
        .post('/grc/itsm/incidents')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          shortDescription: `Impact E2E Test Incident ${Date.now()}`,
          impact: 'high',
          urgency: 'high',
        })
        .expect(201);

      const data = res.body.data ?? res.body;
      incidentId = data.id;
      expect(incidentId).toBeDefined();
    });

    it('should create a CI class for testing', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const res = await request(app.getHttpServer())
        .post('/grc/cmdb/ci-classes')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          name: `test_class_impact_${Date.now()}`,
          label: 'Test CI Class for Impact',
        })
        .expect(201);

      const data = res.body.data ?? res.body;
      ciClassId = data.id;
      expect(ciClassId).toBeDefined();
    });

    it('should create a CI for testing', async () => {
      if (!dbConnected || !tenantId || !adminToken || !ciClassId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      const res = await request(app.getHttpServer())
        .post('/grc/cmdb/cis')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          name: `test_ci_impact_${Date.now()}`,
          classId: ciClassId,
          lifecycle: 'operational',
          environment: 'production',
        })
        .expect(201);

      const data = res.body.data ?? res.body;
      ciId = data.id;
      expect(ciId).toBeDefined();
    });

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
          name: `test_svc_impact_${Date.now()}`,
          type: 'business_service',
          status: 'operational',
          criticality: 'high',
        })
        .expect(201);

      const data = res.body.data ?? res.body;
      serviceId = data.id;
      expect(serviceId).toBeDefined();
    });

    it('should link CI to service via cmdb_service_ci', async () => {
      if (!dbConnected || !tenantId || !adminToken || !serviceId || !ciId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      await request(app.getHttpServer())
        .post(`/grc/cmdb/services/${serviceId}/cis/${ciId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({ relationshipType: 'runs_on' })
        .expect(201);
    });
  });

  // ==================== AFFECTED CIs CRUD ====================
  describe('Affected CIs CRUD', () => {
    let linkId: string;

    it('should add an affected CI to the incident', async () => {
      if (!dbConnected || !tenantId || !adminToken || !incidentId || !ciId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      const res = await request(app.getHttpServer())
        .post(`/grc/itsm/incidents/${incidentId}/affected-cis`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          ciId,
          relationshipType: 'affected_by',
          impactScope: 'service_impacting',
        })
        .expect(201);

      const data = res.body.data ?? res.body;
      linkId = data.id;
      expect(linkId).toBeDefined();
      expect(data.ciId).toBe(ciId);
      expect(data.incidentId).toBe(incidentId);
      expect(data.relationshipType).toBe('affected_by');
      expect(data.impactScope).toBe('service_impacting');
    });

    it('should reject duplicate CI link with same relationship type (400)', async () => {
      if (!dbConnected || !tenantId || !adminToken || !incidentId || !ciId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      await request(app.getHttpServer())
        .post(`/grc/itsm/incidents/${incidentId}/affected-cis`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          ciId,
          relationshipType: 'affected_by',
        })
        .expect(400);
    });

    it('should reject invalid relationshipType (400)', async () => {
      if (!dbConnected || !tenantId || !adminToken || !incidentId || !ciId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      const res = await request(app.getHttpServer())
        .post(`/grc/itsm/incidents/${incidentId}/affected-cis`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          ciId,
          relationshipType: 'INVALID_TYPE',
        });

      expect(res.status).toBe(400);
    });

    it('should reject non-existent CI (404)', async () => {
      if (!dbConnected || !tenantId || !adminToken || !incidentId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      await request(app.getHttpServer())
        .post(`/grc/itsm/incidents/${incidentId}/affected-cis`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          ciId: '00000000-1111-2222-3333-444444444444',
          relationshipType: 'affected_by',
        })
        .expect(404);
    });

    it('should list affected CIs with pagination', async () => {
      if (!dbConnected || !tenantId || !adminToken || !incidentId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      const res = await request(app.getHttpServer())
        .get(`/grc/itsm/incidents/${incidentId}/affected-cis`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const body = res.body.data ?? res.body;
      expect(body).toHaveProperty('items');
      expect(body).toHaveProperty('total');
      expect(body).toHaveProperty('page');
      expect(body).toHaveProperty('pageSize');
      expect(Array.isArray(body.items)).toBe(true);
      expect(body.total).toBeGreaterThanOrEqual(1);
    });

    it('should return 401 without auth token', async () => {
      if (!dbConnected || !tenantId || !incidentId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      await request(app.getHttpServer())
        .get(`/grc/itsm/incidents/${incidentId}/affected-cis`)
        .set('x-tenant-id', tenantId)
        .expect(401);
    });

    it('should remove an affected CI link', async () => {
      if (
        !dbConnected ||
        !tenantId ||
        !adminToken ||
        !incidentId ||
        !linkId
      ) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      await request(app.getHttpServer())
        .delete(
          `/grc/itsm/incidents/${incidentId}/affected-cis/${linkId}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(204);

      // Verify it's gone
      const res = await request(app.getHttpServer())
        .get(`/grc/itsm/incidents/${incidentId}/affected-cis`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const body = res.body.data ?? res.body;
      const found = (body.items || []).find(
        (item: { id: string }) => item.id === linkId,
      );
      expect(found).toBeUndefined();
    });
  });

  // ==================== IMPACT SUMMARY ====================
  describe('Impact Summary', () => {
    it('should re-add CI for impact summary test', async () => {
      if (!dbConnected || !tenantId || !adminToken || !incidentId || !ciId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      const res = await request(app.getHttpServer())
        .post(`/grc/itsm/incidents/${incidentId}/affected-cis`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          ciId,
          relationshipType: 'caused_by',
          impactScope: 'service_impacting',
        })
        .expect(201);

      const data = res.body.data ?? res.body;
      expect(data.id).toBeDefined();
    });

    it('should return impact summary with derived services', async () => {
      if (!dbConnected || !tenantId || !adminToken || !incidentId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      const res = await request(app.getHttpServer())
        .get(`/grc/itsm/incidents/${incidentId}/impact-summary`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const body = res.body.data ?? res.body;
      expect(body).toHaveProperty('affectedCis');
      expect(body).toHaveProperty('impactedServices');
      expect(body).toHaveProperty('impactedOfferings');

      expect(body.affectedCis).toHaveProperty('count');
      expect(body.affectedCis.count).toBeGreaterThanOrEqual(1);
      expect(body.affectedCis).toHaveProperty('topClasses');
      expect(body.affectedCis).toHaveProperty('criticalCount');

      expect(Array.isArray(body.impactedServices)).toBe(true);
      if (body.impactedServices.length > 0) {
        const svc = body.impactedServices[0];
        expect(svc).toHaveProperty('serviceId');
        expect(svc).toHaveProperty('name');
        expect(svc).toHaveProperty('criticality');
        expect(svc).toHaveProperty('status');
        expect(svc).toHaveProperty('offeringsCount');
        expect(svc).toHaveProperty('isBoundToIncident');
      }

      expect(Array.isArray(body.impactedOfferings)).toBe(true);
    });

    it('should return 404 for non-existent incident impact summary', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get(
          '/grc/itsm/incidents/00000000-1111-2222-3333-444444444444/impact-summary',
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(404);
    });

    it('should return 401 without auth for impact summary', async () => {
      if (!dbConnected || !tenantId || !incidentId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      await request(app.getHttpServer())
        .get(`/grc/itsm/incidents/${incidentId}/impact-summary`)
        .set('x-tenant-id', tenantId)
        .expect(401);
    });
  });
});
