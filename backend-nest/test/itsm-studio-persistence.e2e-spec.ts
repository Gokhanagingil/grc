import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * ITSM Studio Persistence E2E Tests
 *
 * Verifies that UI Policies, UI Actions, and SLA Definitions can be
 * created and listed correctly for the same tenant.
 */
describe('ITSM Studio Persistence (e2e)', () => {
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

  describe('UI Policies — Create + List', () => {
    let createdPolicyId: string;

    afterAll(async () => {
      if (createdPolicyId && dbConnected && adminToken && tenantId) {
        await request(app.getHttpServer())
          .delete(`/grc/itsm/ui-policies/policies/${createdPolicyId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId);
      }
    });

    it('should create a UI policy and return 201', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const uniqueName = `test_policy_${Date.now()}`;
      const response = await request(app.getHttpServer())
        .post('/grc/itsm/ui-policies')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          name: uniqueName,
          tableName: 'itsm_incidents',
          fieldEffects: [
            {
              field: 'status',
              visible: true,
              mandatory: false,
              readOnly: false,
            },
          ],
          isActive: true,
          order: 100,
        })
        .expect(201);

      const created = response.body.data ?? response.body;
      expect(created).toHaveProperty('id');
      expect(created.name).toBe(uniqueName);
      createdPolicyId = created.id;
    });

    it('should list UI policies and include the created policy', async () => {
      if (!dbConnected || !tenantId || !adminToken || !createdPolicyId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/itsm/ui-policies')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const data = response.body.data ?? response.body;
      const items = Array.isArray(data) ? data : (data.items ?? []);
      expect(items.some((p: { id: string }) => p.id === createdPolicyId)).toBe(
        true,
      );
    });
  });

  describe('UI Actions — Create + List', () => {
    let createdActionId: string;

    afterAll(async () => {
      if (createdActionId && dbConnected && adminToken && tenantId) {
        await request(app.getHttpServer())
          .delete(`/grc/itsm/ui-policies/actions/${createdActionId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId);
      }
    });

    it('should create a UI action and return 201', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const uniqueName = `test_action_${Date.now()}`;
      const response = await request(app.getHttpServer())
        .post('/grc/itsm/ui-policies/actions')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          name: uniqueName,
          label: 'Test Action',
          tableName: 'itsm_incidents',
          style: 'secondary',
          order: 100,
          isActive: true,
        })
        .expect(201);

      const created = response.body.data ?? response.body;
      expect(created).toHaveProperty('id');
      expect(created.name).toBe(uniqueName);
      createdActionId = created.id;
    });

    it('should list UI actions and include the created action', async () => {
      if (!dbConnected || !tenantId || !adminToken || !createdActionId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/itsm/ui-policies/actions')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const data = response.body.data ?? response.body;
      const items = Array.isArray(data) ? data : (data.items ?? []);
      expect(items.some((a: { id: string }) => a.id === createdActionId)).toBe(
        true,
      );
    });
  });

  describe('SLA Definitions — Create + List', () => {
    let createdSlaId: string;

    afterAll(async () => {
      if (createdSlaId && dbConnected && adminToken && tenantId) {
        await request(app.getHttpServer())
          .delete(`/grc/itsm/sla/definitions/${createdSlaId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId);
      }
    });

    it('should create an SLA definition and return 201', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const uniqueName = `test_sla_${Date.now()}`;
      const response = await request(app.getHttpServer())
        .post('/grc/itsm/sla/definitions')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          name: uniqueName,
          metric: 'RESOLUTION_TIME',
          targetSeconds: 14400,
          schedule: '24X7',
          stopOnStates: ['resolved', 'closed'],
          isActive: true,
          order: 0,
        })
        .expect(201);

      const created = response.body.data ?? response.body;
      expect(created).toHaveProperty('id');
      expect(created.name).toBe(uniqueName);
      createdSlaId = created.id;
    });

    it('should list SLA definitions and include the created SLA', async () => {
      if (!dbConnected || !tenantId || !adminToken || !createdSlaId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/itsm/sla/definitions')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const data = response.body.data ?? response.body;
      const items = Array.isArray(data) ? data : (data.items ?? []);
      expect(items.some((s: { id: string }) => s.id === createdSlaId)).toBe(
        true,
      );
    });

    it('should return paginated response for SLA definitions', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/itsm/sla/definitions')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const data = response.body.data ?? response.body;
      expect(data).toHaveProperty('items');
      expect(data).toHaveProperty('total');
      expect(Array.isArray(data.items)).toBe(true);
    });
  });
});
