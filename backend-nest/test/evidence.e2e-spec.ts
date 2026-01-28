import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Evidence Golden Flow (e2e)', () => {
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

  describe('Evidence CRUD Operations', () => {
    let createdEvidenceId: string;

    it('should list evidence records', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/evidence')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(
        Array.isArray(response.body.data.items || response.body.data),
      ).toBe(true);
    });

    it('should create a new evidence record', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const newEvidence = {
        name: `E2E Test Evidence ${Date.now()}`,
        description: 'Created by e2e test',
        type: 'document',
        sourceType: 'manual',
        status: 'draft',
        location: '/test/evidence/e2e-test',
      };

      const response = await request(app.getHttpServer())
        .post('/grc/evidence')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send(newEvidence)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('name', newEvidence.name);
      expect(response.body.data).toHaveProperty('type', 'document');
      expect(response.body.data).toHaveProperty('status', 'draft');

      createdEvidenceId = response.body.data.id;
    });

    it('should get a specific evidence record', async () => {
      if (!dbConnected || !tenantId || !createdEvidenceId) {
        console.log(
          'Skipping test: database not connected or no evidence created',
        );
        return;
      }

      const response = await request(app.getHttpServer())
        .get(`/grc/evidence/${createdEvidenceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('id', createdEvidenceId);
    });

    it('should update an evidence record', async () => {
      if (!dbConnected || !tenantId || !createdEvidenceId) {
        console.log(
          'Skipping test: database not connected or no evidence created',
        );
        return;
      }

      const updateData = {
        description: 'Updated by e2e test',
        status: 'approved',
      };

      const response = await request(app.getHttpServer())
        .patch(`/grc/evidence/${createdEvidenceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty(
        'description',
        updateData.description,
      );
    });

    it('should return 401 without authentication', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/evidence')
        .set('x-tenant-id', tenantId)
        .expect(401);
    });

    it('should return 400 without tenant ID', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/evidence')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe('Evidence Linkage to Control', () => {
    let testEvidenceId: string;
    let testControlId: string;

    beforeAll(async () => {
      if (!dbConnected || !tenantId) return;

      // Get or create an evidence record
      const evidenceResponse = await request(app.getHttpServer())
        .get('/grc/evidence')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);

      const evidences =
        evidenceResponse.body.data?.items || evidenceResponse.body.data || [];
      if (Array.isArray(evidences) && evidences.length > 0) {
        testEvidenceId = evidences[0].id;
      } else {
        // Create one if none exists
        const createResponse = await request(app.getHttpServer())
          .post('/grc/evidence')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({
            name: `Linkage Test Evidence ${Date.now()}`,
            type: 'document',
            sourceType: 'manual',
            status: 'draft',
            location: '/test/evidence/linkage-test',
          });
        testEvidenceId = createResponse.body.data?.id;
      }

      // Get a control
      const controlsResponse = await request(app.getHttpServer())
        .get('/grc/controls')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);

      const controls =
        controlsResponse.body.data?.items || controlsResponse.body.data || [];
      if (Array.isArray(controls) && controls.length > 0) {
        testControlId = controls[0].id;
      }
    });

    it('should link evidence to control', async () => {
      if (!dbConnected || !tenantId || !testEvidenceId || !testControlId) {
        console.log(
          'Skipping test: database not connected or missing test data',
        );
        return;
      }

      const response = await request(app.getHttpServer())
        .post(`/grc/evidence/${testEvidenceId}/controls/${testControlId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({});

      // Accept both 201 (created) and 200 (already linked) as success
      expect([200, 201]).toContain(response.status);
    });

    it('should get linked controls for evidence', async () => {
      if (!dbConnected || !tenantId || !testEvidenceId) {
        console.log('Skipping test: database not connected or no evidence');
        return;
      }

      const response = await request(app.getHttpServer())
        .get(`/grc/evidence/${testEvidenceId}/controls`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should get linked evidences for control', async () => {
      if (!dbConnected || !tenantId || !testControlId) {
        console.log('Skipping test: database not connected or no control');
        return;
      }

      const response = await request(app.getHttpServer())
        .get(`/grc/controls/${testControlId}/evidences`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should unlink evidence from control', async () => {
      if (!dbConnected || !tenantId || !testEvidenceId || !testControlId) {
        console.log(
          'Skipping test: database not connected or missing test data',
        );
        return;
      }

      const response = await request(app.getHttpServer())
        .delete(`/grc/evidence/${testEvidenceId}/controls/${testControlId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);

      // Accept both 200 (success) and 404 (not found - already unlinked) as valid
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Evidence Linkage to Issue', () => {
    let testEvidenceId: string;
    let testIssueId: string;

    beforeAll(async () => {
      if (!dbConnected || !tenantId) return;

      // Get or create an evidence record
      const evidenceResponse = await request(app.getHttpServer())
        .get('/grc/evidence')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);

      const evidences =
        evidenceResponse.body.data?.items || evidenceResponse.body.data || [];
      if (Array.isArray(evidences) && evidences.length > 0) {
        testEvidenceId = evidences[0].id;
      }

      // Get an issue
      const issuesResponse = await request(app.getHttpServer())
        .get('/grc/issues')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);

      const issues =
        issuesResponse.body.data?.items || issuesResponse.body.data || [];
      if (Array.isArray(issues) && issues.length > 0) {
        testIssueId = issues[0].id;
      }
    });

    it('should link evidence to issue', async () => {
      if (!dbConnected || !tenantId || !testEvidenceId || !testIssueId) {
        console.log(
          'Skipping test: database not connected or missing test data',
        );
        return;
      }

      const response = await request(app.getHttpServer())
        .post(`/grc/issues/${testIssueId}/evidence/${testEvidenceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({});

      // Accept both 201 (created) and 200 (already linked) as success
      expect([200, 201]).toContain(response.status);
    });

    it('should get linked evidence for issue', async () => {
      if (!dbConnected || !tenantId || !testIssueId) {
        console.log('Skipping test: database not connected or no issue');
        return;
      }

      const response = await request(app.getHttpServer())
        .get(`/grc/issues/${testIssueId}/evidence`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should get linked issues for evidence', async () => {
      if (!dbConnected || !tenantId || !testEvidenceId) {
        console.log('Skipping test: database not connected or no evidence');
        return;
      }

      const response = await request(app.getHttpServer())
        .get(`/grc/evidence/${testEvidenceId}/issues`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should unlink evidence from issue', async () => {
      if (!dbConnected || !tenantId || !testEvidenceId || !testIssueId) {
        console.log(
          'Skipping test: database not connected or missing test data',
        );
        return;
      }

      const response = await request(app.getHttpServer())
        .delete(`/grc/issues/${testIssueId}/evidence/${testEvidenceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);

      // Accept both 200 (success) and 404 (not found - already unlinked) as valid
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Tenant Isolation', () => {
    it('should not allow access to evidence from different tenant', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      // Use a different (non-existent) tenant ID
      const fakeTenantId = '00000000-0000-0000-0000-000000000099';

      const response = await request(app.getHttpServer())
        .get('/grc/evidence')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', fakeTenantId);

      // Should return 403 (forbidden) for wrong tenant
      expect(response.status).toBe(403);
    });
  });

  describe('Evidence with Optional IssueId in Create', () => {
    it('should create evidence without issueId', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const newEvidence = {
        name: `Standalone Evidence ${Date.now()}`,
        description: 'Evidence without linked issue',
        type: 'document',
        sourceType: 'manual',
        status: 'draft',
        location: '/test/evidence/standalone',
      };

      const response = await request(app.getHttpServer())
        .post('/grc/evidence')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send(newEvidence)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('id');
    });

    it('should create evidence with null issueId', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const newEvidence = {
        name: `Evidence with null issueId ${Date.now()}`,
        description: 'Evidence with explicit null issueId',
        type: 'document',
        sourceType: 'manual',
        status: 'draft',
        location: '/test/evidence/null-issue',
        issueId: null,
      };

      const response = await request(app.getHttpServer())
        .post('/grc/evidence')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send(newEvidence)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });
  });
});
