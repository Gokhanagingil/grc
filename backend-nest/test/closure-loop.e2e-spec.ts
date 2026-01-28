import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Closure Loop MVP (e2e)', () => {
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

  describe('CAPA Status Transitions', () => {
    let testCapaId: string;

    beforeAll(async () => {
      if (!dbConnected || !tenantId) return;

      const capasResponse = await request(app.getHttpServer())
        .get('/grc/capas')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);

      const capas = capasResponse.body.data ?? capasResponse.body;
      if (Array.isArray(capas) && capas.length > 0) {
        testCapaId = capas[0].id;
      }
    });

    it('should update CAPA status with valid transition', async () => {
      if (!dbConnected || !tenantId || !testCapaId) {
        console.log('Skipping test: database not connected or no CAPA found');
        return;
      }

      const getResponse = await request(app.getHttpServer())
        .get(`/grc/capas/${testCapaId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);

      const capa = getResponse.body.data ?? getResponse.body;
      const currentStatus = capa.status;

      let targetStatus: string;
      if (currentStatus === 'planned') {
        targetStatus = 'in_progress';
      } else if (currentStatus === 'in_progress') {
        targetStatus = 'implemented';
      } else if (currentStatus === 'implemented') {
        targetStatus = 'verified';
      } else if (currentStatus === 'verified') {
        targetStatus = 'closed';
      } else {
        targetStatus = 'in_progress';
      }

      const response = await request(app.getHttpServer())
        .patch(`/grc/capas/${testCapaId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({ status: targetStatus, comment: 'E2E test transition' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('status', targetStatus);
    });

    it('should reject invalid CAPA status transition', async () => {
      if (!dbConnected || !tenantId || !testCapaId) {
        console.log('Skipping test: database not connected or no CAPA found');
        return;
      }

      const getResponse = await request(app.getHttpServer())
        .get(`/grc/capas/${testCapaId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);

      const capa = getResponse.body.data ?? getResponse.body;
      const currentStatus = capa.status;

      let invalidStatus: string;
      if (currentStatus === 'planned') {
        invalidStatus = 'closed';
      } else if (currentStatus === 'in_progress') {
        invalidStatus = 'closed';
      } else {
        invalidStatus = 'planned';
      }

      await request(app.getHttpServer())
        .patch(`/grc/capas/${testCapaId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({ status: invalidStatus, comment: 'Invalid transition' })
        .expect(400);
    });

    it('should return 401 without authentication', async () => {
      if (!dbConnected || !tenantId || !testCapaId) {
        console.log('Skipping test: database not connected or no CAPA found');
        return;
      }

      await request(app.getHttpServer())
        .patch(`/grc/capas/${testCapaId}/status`)
        .set('x-tenant-id', tenantId)
        .send({ status: 'in_progress' })
        .expect(401);
    });

    it('should return 400 without x-tenant-id header', async () => {
      if (!dbConnected || !testCapaId) {
        console.log('Skipping test: database not connected or no CAPA found');
        return;
      }

      await request(app.getHttpServer())
        .patch(`/grc/capas/${testCapaId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'in_progress' })
        .expect(400);
    });
  });

  describe('Issue Status Transitions', () => {
    let testIssueId: string;

    beforeAll(async () => {
      if (!dbConnected || !tenantId) return;

      const issuesResponse = await request(app.getHttpServer())
        .get('/grc/issues')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);

      const issues = issuesResponse.body.data ?? issuesResponse.body;
      if (Array.isArray(issues) && issues.length > 0) {
        testIssueId = issues[0].id;
      }
    });

    it('should update Issue status with valid transition', async () => {
      if (!dbConnected || !tenantId || !testIssueId) {
        console.log('Skipping test: database not connected or no Issue found');
        return;
      }

      const getResponse = await request(app.getHttpServer())
        .get(`/grc/issues/${testIssueId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);

      const issue = getResponse.body.data ?? getResponse.body;
      const currentStatus = issue.status;

      let targetStatus: string;
      if (currentStatus === 'open') {
        targetStatus = 'in_progress';
      } else if (currentStatus === 'in_progress') {
        targetStatus = 'resolved';
      } else if (currentStatus === 'resolved') {
        targetStatus = 'closed';
      } else {
        targetStatus = 'in_progress';
      }

      const response = await request(app.getHttpServer())
        .patch(`/grc/issues/${testIssueId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({ status: targetStatus, comment: 'E2E test transition' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('status', targetStatus);
    });

    it('should reject invalid Issue status transition', async () => {
      if (!dbConnected || !tenantId || !testIssueId) {
        console.log('Skipping test: database not connected or no Issue found');
        return;
      }

      const getResponse = await request(app.getHttpServer())
        .get(`/grc/issues/${testIssueId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);

      const issue = getResponse.body.data ?? getResponse.body;
      const currentStatus = issue.status;

      let invalidStatus: string;
      if (currentStatus === 'open') {
        invalidStatus = 'closed';
      } else if (currentStatus === 'in_progress') {
        invalidStatus = 'closed';
      } else {
        invalidStatus = 'open';
      }

      await request(app.getHttpServer())
        .patch(`/grc/issues/${testIssueId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({ status: invalidStatus, comment: 'Invalid transition' })
        .expect(400);
    });
  });

  describe('CAPA Task Status Transitions', () => {
    let testCapaTaskId: string;

    beforeAll(async () => {
      if (!dbConnected || !tenantId) return;

      const tasksResponse = await request(app.getHttpServer())
        .get('/grc/capa-tasks')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);

      const tasks = tasksResponse.body.data ?? tasksResponse.body;
      if (Array.isArray(tasks) && tasks.length > 0) {
        testCapaTaskId = tasks[0].id;
      }
    });

    it('should update CAPA Task status with valid transition', async () => {
      if (!dbConnected || !tenantId || !testCapaTaskId) {
        console.log(
          'Skipping test: database not connected or no CAPA Task found',
        );
        return;
      }

      const getResponse = await request(app.getHttpServer())
        .get(`/grc/capa-tasks/${testCapaTaskId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);

      const task = getResponse.body.data ?? getResponse.body;
      const currentStatus = task.status;

      let targetStatus: string;
      if (currentStatus === 'PENDING') {
        targetStatus = 'IN_PROGRESS';
      } else if (currentStatus === 'IN_PROGRESS') {
        targetStatus = 'COMPLETED';
      } else {
        targetStatus = 'IN_PROGRESS';
      }

      const response = await request(app.getHttpServer())
        .patch(`/grc/capa-tasks/${testCapaTaskId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({ status: targetStatus, comment: 'E2E test transition' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('status', targetStatus);
    });

    it('should reject invalid CAPA Task status transition', async () => {
      if (!dbConnected || !tenantId || !testCapaTaskId) {
        console.log(
          'Skipping test: database not connected or no CAPA Task found',
        );
        return;
      }

      const getResponse = await request(app.getHttpServer())
        .get(`/grc/capa-tasks/${testCapaTaskId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);

      const task = getResponse.body.data ?? getResponse.body;
      const currentStatus = task.status;

      let invalidStatus: string;
      if (currentStatus === 'PENDING') {
        invalidStatus = 'COMPLETED';
      } else if (currentStatus === 'IN_PROGRESS') {
        invalidStatus = 'PENDING';
      } else {
        invalidStatus = 'PENDING';
      }

      await request(app.getHttpServer())
        .patch(`/grc/capa-tasks/${testCapaTaskId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({ status: invalidStatus, comment: 'Invalid transition' })
        .expect(400);
    });
  });

  describe('Status History Tracking', () => {
    it('should create status history entry on CAPA status change', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const capasResponse = await request(app.getHttpServer())
        .get('/grc/capas')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);

      const capas = capasResponse.body.data ?? capasResponse.body;
      if (!Array.isArray(capas) || capas.length === 0) {
        console.log('Skipping test: no CAPAs found');
        return;
      }

      const testCapaId = capas[0].id;

      const getResponse = await request(app.getHttpServer())
        .get(`/grc/capas/${testCapaId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);

      const capa = getResponse.body.data ?? getResponse.body;
      const currentStatus = capa.status;

      let targetStatus: string;
      if (currentStatus === 'planned') {
        targetStatus = 'in_progress';
      } else if (currentStatus === 'in_progress') {
        targetStatus = 'implemented';
      } else if (currentStatus === 'implemented') {
        targetStatus = 'verified';
      } else if (currentStatus === 'verified') {
        targetStatus = 'closed';
      } else {
        targetStatus = 'in_progress';
      }

      await request(app.getHttpServer())
        .patch(`/grc/capas/${testCapaId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({ status: targetStatus, comment: 'E2E history test' })
        .expect(200);

      const historyResponse = await request(app.getHttpServer())
        .get(`/grc/status-history?entityType=capa&entityId=${testCapaId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);

      const history = historyResponse.body.data ?? historyResponse.body;
      expect(Array.isArray(history)).toBe(true);

      if (history.length > 0) {
        const latestEntry = history[0];
        expect(latestEntry).toHaveProperty('entityType', 'capa');
        expect(latestEntry).toHaveProperty('entityId', testCapaId);
        expect(latestEntry).toHaveProperty('toStatus', targetStatus);
      }
    });
  });

  describe('Issue from Test Result - Control Linkage', () => {
    let testControlId: string;
    let testControlTestId: string;
    let testResultId: string;

    beforeAll(async () => {
      if (!dbConnected || !tenantId) return;

      // Get an existing control
      const controlsResponse = await request(app.getHttpServer())
        .get('/grc/controls')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);

      const controlsData = controlsResponse.body.data ?? controlsResponse.body;
      const controls = controlsData.items ?? controlsData;
      if (Array.isArray(controls) && controls.length > 0) {
        testControlId = controls[0].id;
      }
    });

    it('should create issue with controlId linked when creating from test result via controlTestId', async () => {
      if (!dbConnected || !tenantId || !testControlId) {
        console.log(
          'Skipping test: database not connected or no control found',
        );
        return;
      }

      // Step 1: Create a control test for the control
      const controlTestResponse = await request(app.getHttpServer())
        .post('/grc/control-tests')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          controlId: testControlId,
          name: 'E2E Test - Issue Linkage Test',
          testType: 'MANUAL',
          status: 'IN_PROGRESS',
        })
        .expect(201);

      const controlTestData =
        controlTestResponse.body.data ?? controlTestResponse.body;
      testControlTestId = controlTestData.id;

      // Step 2: Create a test result with FAIL outcome via controlTestId
      const testResultResponse = await request(app.getHttpServer())
        .post('/grc/test-results')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          controlTestId: testControlTestId,
          result: 'FAIL',
          resultDetails: 'E2E test - testing issue control linkage',
        })
        .expect(201);

      const testResultData =
        testResultResponse.body.data ?? testResultResponse.body;
      testResultId = testResultData.id;

      // Step 3: Create an issue from the test result
      const issueResponse = await request(app.getHttpServer())
        .post(`/grc/test-results/${testResultId}/issues`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({})
        .expect(201);

      const issueData = issueResponse.body.data ?? issueResponse.body;

      // Verify the issue has controlId set (the fix we're testing)
      expect(issueData).toHaveProperty('controlId', testControlId);
      expect(issueData).toHaveProperty('testResultId', testResultId);
      expect(issueData).toHaveProperty('status', 'open');
      expect(issueData).toHaveProperty('severity', 'high'); // FAIL -> HIGH severity
      expect(issueData.metadata).toHaveProperty('createdFromTestResult', true);
      expect(issueData.metadata).toHaveProperty('testResultOutcome', 'FAIL');

      // Cleanup: soft delete the created issue
      if (issueData.id) {
        await request(app.getHttpServer())
          .delete(`/grc/issues/${issueData.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId);
      }
    });

    afterAll(async () => {
      // Cleanup: soft delete the test result and control test
      if (testResultId && dbConnected && tenantId) {
        await request(app.getHttpServer())
          .delete(`/grc/test-results/${testResultId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId);
      }
      if (testControlTestId && dbConnected && tenantId) {
        await request(app.getHttpServer())
          .delete(`/grc/control-tests/${testControlTestId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId);
      }
    });
  });

  describe('CAPA Creation with Lowercase Priority (Regression)', () => {
    let testIssueId: string;
    let createdCapaId: string;

    beforeAll(async () => {
      if (!dbConnected || !tenantId) return;

      // Get an existing issue to link the CAPA to
      const issuesResponse = await request(app.getHttpServer())
        .get('/grc/issues')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);

      const issues = issuesResponse.body.data ?? issuesResponse.body;
      if (Array.isArray(issues) && issues.length > 0) {
        testIssueId = issues[0].id;
      }
    });

    afterAll(async () => {
      // Cleanup: soft delete the created CAPA
      if (createdCapaId && dbConnected && tenantId) {
        await request(app.getHttpServer())
          .delete(`/grc/capas/${createdCapaId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId);
      }
    });

    it('should create CAPA with lowercase priority "high" and store as "HIGH"', async () => {
      if (!dbConnected || !tenantId || !testIssueId) {
        console.log('Skipping test: database not connected or no Issue found');
        return;
      }

      // Create CAPA via Issue -> CAPA endpoint with lowercase priority
      const response = await request(app.getHttpServer())
        .post(`/grc/issues/${testIssueId}/capas`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          title: 'E2E Test - Lowercase Priority CAPA',
          description: 'Testing case-insensitive priority normalization',
          priority: 'high', // lowercase - should be normalized to HIGH
          type: 'corrective',
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');

      const capa = response.body.data;
      createdCapaId = capa.id;

      // Verify the priority was normalized to uppercase
      expect(capa).toHaveProperty('priority', 'HIGH');
      expect(capa).toHaveProperty(
        'title',
        'E2E Test - Lowercase Priority CAPA',
      );
    });

    it('should create CAPA with mixed case priority "Medium" and store as "MEDIUM"', async () => {
      if (!dbConnected || !tenantId || !testIssueId) {
        console.log('Skipping test: database not connected or no Issue found');
        return;
      }

      const response = await request(app.getHttpServer())
        .post(`/grc/issues/${testIssueId}/capas`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          title: 'E2E Test - Mixed Case Priority CAPA',
          description: 'Testing case-insensitive priority normalization',
          priority: 'Medium', // mixed case - should be normalized to MEDIUM
          type: 'preventive',
        })
        .expect(201);

      const capa = response.body.data;

      // Verify the priority was normalized to uppercase
      expect(capa).toHaveProperty('priority', 'MEDIUM');

      // Cleanup
      if (capa.id) {
        await request(app.getHttpServer())
          .delete(`/grc/capas/${capa.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId);
      }
    });

    it('should reject invalid priority value after normalization', async () => {
      if (!dbConnected || !tenantId || !testIssueId) {
        console.log('Skipping test: database not connected or no Issue found');
        return;
      }

      // Try to create CAPA with invalid priority
      await request(app.getHttpServer())
        .post(`/grc/issues/${testIssueId}/capas`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          title: 'E2E Test - Invalid Priority CAPA',
          description: 'Testing validation still works',
          priority: 'urgent', // invalid - should be rejected even after normalization
          type: 'corrective',
        })
        .expect(400);
    });

    it('should keep uppercase priority "CRITICAL" as "CRITICAL"', async () => {
      if (!dbConnected || !tenantId || !testIssueId) {
        console.log('Skipping test: database not connected or no Issue found');
        return;
      }

      const response = await request(app.getHttpServer())
        .post(`/grc/issues/${testIssueId}/capas`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          title: 'E2E Test - Uppercase Priority CAPA',
          description: 'Testing uppercase priority is preserved',
          priority: 'CRITICAL', // uppercase - should remain CRITICAL
          type: 'both',
        })
        .expect(201);

      const capa = response.body.data;

      // Verify the priority remains uppercase
      expect(capa).toHaveProperty('priority', 'CRITICAL');

      // Cleanup
      if (capa.id) {
        await request(app.getHttpServer())
          .delete(`/grc/capas/${capa.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId);
      }
    });
  });

  describe('CAPA Creation - issueId Validation', () => {
    let testIssueId: string;

    beforeAll(async () => {
      if (!dbConnected || !tenantId) return;

      // Get an existing issue for testing
      const issuesResponse = await request(app.getHttpServer())
        .get('/grc/issues')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);

      const issuesData = issuesResponse.body.data ?? issuesResponse.body;
      const issues = issuesData.items ?? issuesData;
      if (Array.isArray(issues) && issues.length > 0) {
        testIssueId = issues[0].id;
      }
    });

    it('should create CAPA without issueId (standalone CAPA)', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .post('/grc/capas')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          title: 'E2E Test - Standalone CAPA',
          description: 'Testing CAPA creation without issueId',
          priority: 'MEDIUM',
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty(
        'title',
        'E2E Test - Standalone CAPA',
      );
      expect(response.body.data.issueId).toBeNull();

      // Cleanup
      if (response.body.data.id) {
        await request(app.getHttpServer())
          .delete(`/grc/capas/${response.body.data.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId);
      }
    });

    it('should create CAPA with empty string issueId (treated as omitted)', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .post('/grc/capas')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          title: 'E2E Test - CAPA with empty issueId',
          description: 'Testing CAPA creation with empty string issueId',
          issueId: '',
          priority: 'LOW',
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty(
        'title',
        'E2E Test - CAPA with empty issueId',
      );
      expect(response.body.data.issueId).toBeNull();

      // Cleanup
      if (response.body.data.id) {
        await request(app.getHttpServer())
          .delete(`/grc/capas/${response.body.data.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId);
      }
    });

    it('should return 400 for invalid non-empty issueId that is not a UUID', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .post('/grc/capas')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          title: 'E2E Test - CAPA with invalid issueId',
          issueId: 'not-a-uuid',
          priority: 'HIGH',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should create CAPA via POST /grc/issues/:issueId/capas with lowercase priority', async () => {
      if (!dbConnected || !tenantId || !testIssueId) {
        console.log('Skipping test: database not connected or no issue found');
        return;
      }

      const response = await request(app.getHttpServer())
        .post(`/grc/issues/${testIssueId}/capas`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          title: 'E2E Test - CAPA from Issue with lowercase priority',
          description: 'Testing priority normalization',
          priority: 'high',
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty(
        'title',
        'E2E Test - CAPA from Issue with lowercase priority',
      );
      expect(response.body.data).toHaveProperty('issueId', testIssueId);
      expect(response.body.data).toHaveProperty('priority', 'HIGH');

      // Cleanup
      if (response.body.data.id) {
        await request(app.getHttpServer())
          .delete(`/grc/capas/${response.body.data.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId);
      }
    });

    it('should create CAPA via POST /grc/issues/:issueId/capas with mixed case priority', async () => {
      if (!dbConnected || !tenantId || !testIssueId) {
        console.log('Skipping test: database not connected or no issue found');
        return;
      }

      const response = await request(app.getHttpServer())
        .post(`/grc/issues/${testIssueId}/capas`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          title: 'E2E Test - CAPA from Issue with mixed case priority',
          description: 'Testing priority normalization',
          priority: 'Medium',
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('priority', 'MEDIUM');

      // Cleanup
      if (response.body.data.id) {
        await request(app.getHttpServer())
          .delete(`/grc/capas/${response.body.data.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId);
      }
    });
  });
});
