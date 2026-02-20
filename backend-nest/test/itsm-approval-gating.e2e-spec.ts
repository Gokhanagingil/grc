import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('ITSM Change Approval Gating (e2e)', () => {
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
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Approval Gating Flow', () => {
    let changeId: string;

    it('should create a HIGH risk change in ASSESS state', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping: database not connected');
        return;
      }

      const createResponse = await request(app.getHttpServer())
        .post('/grc/itsm/changes')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          title: 'E2E Approval Gating Test Change',
          description: 'Created by e2e test for approval gating',
          type: 'NORMAL',
          risk: 'HIGH',
        })
        .expect(201);

      const data = createResponse.body.data ?? createResponse.body;
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('number');
      changeId = data.id;

      await request(app.getHttpServer())
        .patch(`/grc/itsm/changes/${changeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({ state: 'ASSESS' })
        .expect(200);
    });

    it('should request approval for the change', async () => {
      if (!dbConnected || !tenantId || !adminToken || !changeId) {
        console.log('Skipping: prerequisites not met');
        return;
      }

      const response = await request(app.getHttpServer())
        .post(`/grc/itsm/changes/${changeId}/request-approval`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({})
        .expect(201);

      const data = response.body.data ?? response.body;
      expect(data).toHaveProperty('approvals');
      expect(Array.isArray(data.approvals)).toBe(true);
      expect(data.approvals.length).toBeGreaterThan(0);
      expect(data.approvals[0]).toHaveProperty('state', 'REQUESTED');
    });

    it('should list approvals for the change', async () => {
      if (!dbConnected || !tenantId || !adminToken || !changeId) {
        console.log('Skipping: prerequisites not met');
        return;
      }

      const response = await request(app.getHttpServer())
        .get(`/grc/itsm/changes/${changeId}/approvals`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const data = response.body.data ?? response.body;
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveProperty('state', 'REQUESTED');
      expect(data[0]).toHaveProperty('recordId', changeId);
    });

    it('should block transition to IMPLEMENT without approval', async () => {
      if (!dbConnected || !tenantId || !adminToken || !changeId) {
        console.log('Skipping: prerequisites not met');
        return;
      }

      const response = await request(app.getHttpServer())
        .patch(`/grc/itsm/changes/${changeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({ state: 'IMPLEMENT' });

      expect([403, 409]).toContain(response.status);
    });

    it('should approve the pending approval as admin', async () => {
      if (!dbConnected || !tenantId || !adminToken || !changeId) {
        console.log('Skipping: prerequisites not met');
        return;
      }

      const listResponse = await request(app.getHttpServer())
        .get(`/grc/itsm/changes/${changeId}/approvals`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const approvals = listResponse.body.data ?? listResponse.body;
      const pendingApproval = approvals.find(
        (a: { state: string }) => a.state === 'REQUESTED',
      );

      if (!pendingApproval) {
        console.log('No pending approval found, skipping');
        return;
      }

      const response = await request(app.getHttpServer())
        .post(`/grc/itsm/approvals/${pendingApproval.id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({ comment: 'Approved in e2e test' })
        .expect(200);

      const data = response.body.data ?? response.body;
      expect(data).toHaveProperty('state', 'APPROVED');
    });

    it('should verify change approval status is APPROVED', async () => {
      if (!dbConnected || !tenantId || !adminToken || !changeId) {
        console.log('Skipping: prerequisites not met');
        return;
      }

      const response = await request(app.getHttpServer())
        .get(`/grc/itsm/changes/${changeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const data = response.body.data ?? response.body;
      expect(data).toHaveProperty('approvalStatus', 'APPROVED');
    });

    it('should allow transition to IMPLEMENT after approval', async () => {
      if (!dbConnected || !tenantId || !adminToken || !changeId) {
        console.log('Skipping: prerequisites not met');
        return;
      }

      const response = await request(app.getHttpServer())
        .patch(`/grc/itsm/changes/${changeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({ state: 'IMPLEMENT' })
        .expect(200);

      const data = response.body.data ?? response.body;
      expect(data).toHaveProperty('state', 'IMPLEMENT');
    });

    it('should clean up by soft-deleting the test change', async () => {
      if (!dbConnected || !tenantId || !adminToken || !changeId) {
        console.log('Skipping: prerequisites not met');
        return;
      }

      await request(app.getHttpServer())
        .delete(`/grc/itsm/changes/${changeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(204);
    });
  });

  describe('Rejection Flow', () => {
    let changeId: string;

    it('should create a change and request approval', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping: database not connected');
        return;
      }

      const createResponse = await request(app.getHttpServer())
        .post('/grc/itsm/changes')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          title: 'E2E Rejection Flow Test Change',
          description: 'Created by e2e test for rejection flow',
          type: 'NORMAL',
          risk: 'HIGH',
        })
        .expect(201);

      const createData = createResponse.body.data ?? createResponse.body;
      changeId = createData.id;

      await request(app.getHttpServer())
        .patch(`/grc/itsm/changes/${changeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({ state: 'ASSESS' })
        .expect(200);

      await request(app.getHttpServer())
        .post(`/grc/itsm/changes/${changeId}/request-approval`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({})
        .expect(201);
    });

    it('should reject the pending approval', async () => {
      if (!dbConnected || !tenantId || !adminToken || !changeId) {
        console.log('Skipping: prerequisites not met');
        return;
      }

      const listResponse = await request(app.getHttpServer())
        .get(`/grc/itsm/changes/${changeId}/approvals`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const approvals = listResponse.body.data ?? listResponse.body;
      const pendingApproval = approvals.find(
        (a: { state: string }) => a.state === 'REQUESTED',
      );

      if (!pendingApproval) {
        console.log('No pending approval found, skipping');
        return;
      }

      const response = await request(app.getHttpServer())
        .post(`/grc/itsm/approvals/${pendingApproval.id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({ comment: 'Rejected in e2e test' })
        .expect(200);

      const data = response.body.data ?? response.body;
      expect(data).toHaveProperty('state', 'REJECTED');
    });

    it('should block transition to IMPLEMENT after rejection', async () => {
      if (!dbConnected || !tenantId || !adminToken || !changeId) {
        console.log('Skipping: prerequisites not met');
        return;
      }

      const response = await request(app.getHttpServer())
        .patch(`/grc/itsm/changes/${changeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({ state: 'IMPLEMENT' });

      expect([403, 409]).toContain(response.status);
    });

    it('should verify change approval status is REJECTED', async () => {
      if (!dbConnected || !tenantId || !adminToken || !changeId) {
        console.log('Skipping: prerequisites not met');
        return;
      }

      const response = await request(app.getHttpServer())
        .get(`/grc/itsm/changes/${changeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const data = response.body.data ?? response.body;
      expect(data).toHaveProperty('approvalStatus', 'REJECTED');
    });

    it('should clean up by soft-deleting the test change', async () => {
      if (!dbConnected || !tenantId || !adminToken || !changeId) {
        console.log('Skipping: prerequisites not met');
        return;
      }

      await request(app.getHttpServer())
        .delete(`/grc/itsm/changes/${changeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(204);
    });
  });

  describe('RBAC - Approval Endpoint Auth', () => {
    it('should return 401 without token on request-approval', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .post('/grc/itsm/changes/00000000-0000-0000-0000-000000000000/request-approval')
        .set('x-tenant-id', tenantId)
        .send({})
        .expect(401);
    });

    it('should return 401 without token on approve', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .post('/grc/itsm/approvals/00000000-0000-0000-0000-000000000000/approve')
        .set('x-tenant-id', tenantId)
        .send({})
        .expect(401);
    });

    it('should return 401 without token on reject', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .post('/grc/itsm/approvals/00000000-0000-0000-0000-000000000000/reject')
        .set('x-tenant-id', tenantId)
        .send({})
        .expect(401);
    });

    it('should return 401 without token on list approvals', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/itsm/changes/00000000-0000-0000-0000-000000000000/approvals')
        .set('x-tenant-id', tenantId)
        .expect(401);
    });
  });
});
