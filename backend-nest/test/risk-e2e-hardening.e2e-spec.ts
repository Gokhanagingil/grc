import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * Risk E2E Hardening Tests
 *
 * Tests for:
 * - Tenant isolation for risks (create with tenant A, ensure tenant B cannot access)
 * - Treatment actions CRUD lifecycle
 * - Heatmap aggregation correctness
 * - Link/unlink controls (note: basic tests exist in grc.e2e-spec.ts)
 *
 * @see PR #329 for context on requested E2E coverage
 */
describe('Risk E2E Hardening (e2e)', () => {
  let app: INestApplication<App>;
  let dbConnected = false;
  let adminToken: string;
  let tenantId: string;

  // Demo admin credentials
  const DEMO_ADMIN_EMAIL =
    process.env.DEMO_ADMIN_EMAIL || 'admin@grc-platform.local';
  const DEMO_ADMIN_PASSWORD =
    process.env.DEMO_ADMIN_PASSWORD || 'TestPassword123!';

  // Fake tenant ID for cross-tenant isolation tests
  const FAKE_TENANT_ID = '99999999-9999-9999-9999-999999999999';

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

  // ==================== TENANT ISOLATION TESTS ====================
  describe('Tenant Isolation - Cross-Tenant Risk Access Prevention', () => {
    let testRiskId: string;

    beforeAll(async () => {
      if (!dbConnected || !tenantId) return;

      // Create a test risk for isolation tests
      const riskResponse = await request(app.getHttpServer())
        .post('/grc/risks')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          title: 'Tenant Isolation Test Risk',
          description: 'Risk for testing tenant isolation',
          category: 'Testing',
          severity: 'high',
          likelihood: 'possible',
          status: 'identified',
        });

      const riskData = riskResponse.body.data ?? riskResponse.body;
      testRiskId = riskData?.id;
    });

    afterAll(async () => {
      if (!dbConnected || !tenantId || !testRiskId) return;

      // Clean up: delete created risk
      await request(app.getHttpServer())
        .delete(`/grc/risks/${testRiskId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);
    });

    it('should NOT allow reading a risk from another tenant (GET /grc/risks/:id)', async () => {
      if (!dbConnected || !tenantId || !testRiskId) {
        console.log('Skipping test: database not connected or no risk created');
        return;
      }

      // Try to access risk with a different tenant ID
      const response = await request(app.getHttpServer())
        .get(`/grc/risks/${testRiskId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', FAKE_TENANT_ID);

      // Should return 404 (not found in that tenant) or 403 (forbidden)
      expect([403, 404]).toContain(response.status);
    });

    it('should NOT allow updating a risk from another tenant (PATCH /grc/risks/:id)', async () => {
      if (!dbConnected || !tenantId || !testRiskId) {
        console.log('Skipping test: database not connected or no risk created');
        return;
      }

      // Try to update risk with a different tenant ID
      const response = await request(app.getHttpServer())
        .patch(`/grc/risks/${testRiskId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', FAKE_TENANT_ID)
        .send({
          title: 'Cross-tenant attack attempt',
          severity: 'critical',
        });

      // Should return 404 (not found in that tenant) or 403 (forbidden)
      expect([403, 404]).toContain(response.status);
    });

    it('should NOT allow deleting a risk from another tenant (DELETE /grc/risks/:id)', async () => {
      if (!dbConnected || !tenantId || !testRiskId) {
        console.log('Skipping test: database not connected or no risk created');
        return;
      }

      // Try to delete risk with a different tenant ID
      const response = await request(app.getHttpServer())
        .delete(`/grc/risks/${testRiskId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', FAKE_TENANT_ID);

      // Should return 404 (not found in that tenant) or 403 (forbidden)
      expect([403, 404]).toContain(response.status);
    });

    it('should return empty list when querying risks with wrong tenant ID', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      // Query risks with a different tenant ID
      const response = await request(app.getHttpServer())
        .get('/grc/risks')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', FAKE_TENANT_ID);

      // Should return empty list (no risks for that tenant) or 403
      if (response.status === 200) {
        const data = response.body.data ?? response.body;
        const items = data.items ?? data;
        expect(Array.isArray(items) ? items.length : 0).toBe(0);
      } else {
        expect([403]).toContain(response.status);
      }
    });

    it('should verify risk still exists in original tenant after cross-tenant access attempts', async () => {
      if (!dbConnected || !tenantId || !testRiskId) {
        console.log('Skipping test: database not connected or no risk created');
        return;
      }

      // Verify the risk is still accessible with correct tenant
      const response = await request(app.getHttpServer())
        .get(`/grc/risks/${testRiskId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const data = response.body.data ?? response.body;
      expect(data.id).toBe(testRiskId);
      expect(data.title).toBe('Tenant Isolation Test Risk');
    });
  });

  // ==================== TREATMENT ACTIONS CRUD TESTS ====================
  describe('Treatment Actions CRUD Lifecycle', () => {
    let testRiskId: string;
    let testActionId: string;

    beforeAll(async () => {
      if (!dbConnected || !tenantId) return;

      // Create a test risk for treatment action tests
      const riskResponse = await request(app.getHttpServer())
        .post('/grc/risks')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          title: 'Treatment Actions Test Risk',
          description: 'Risk for testing treatment actions CRUD',
          category: 'Testing',
          severity: 'high',
          likelihood: 'likely',
          status: 'identified',
        });

      const riskData = riskResponse.body.data ?? riskResponse.body;
      testRiskId = riskData?.id;
    });

    afterAll(async () => {
      if (!dbConnected || !tenantId || !testRiskId) return;

      // Clean up: delete created risk (cascades to treatment actions)
      await request(app.getHttpServer())
        .delete(`/grc/risks/${testRiskId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);
    });

    describe('POST /grc/risks/:riskId/treatment/actions', () => {
      it('should create a new treatment action', async () => {
        if (!dbConnected || !tenantId || !testRiskId) {
          console.log(
            'Skipping test: database not connected or no risk created',
          );
          return;
        }

        const newAction = {
          title: 'Implement security controls',
          description: 'Deploy firewall and IDS/IPS systems',
          status: 'PLANNED',
          ownerDisplayName: 'Security Team',
          dueDate: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
          ).toISOString(), // 30 days from now
          progressPct: 0,
        };

        const response = await request(app.getHttpServer())
          .post(`/grc/risks/${testRiskId}/treatment/actions`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(newAction)
          .expect(201);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id');
        expect(data.title).toBe(newAction.title);
        expect(data.description).toBe(newAction.description);
        expect(data.status).toBe('PLANNED');
        expect(data.progressPct).toBe(0);

        testActionId = data.id;
      });

      it('should return 400 without required title field', async () => {
        if (!dbConnected || !tenantId || !testRiskId) {
          console.log(
            'Skipping test: database not connected or no risk created',
          );
          return;
        }

        const invalidAction = {
          description: 'Missing title',
        };

        await request(app.getHttpServer())
          .post(`/grc/risks/${testRiskId}/treatment/actions`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(invalidAction)
          .expect(400);
      });

      it('should return 404 for non-existent risk', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .post(
            '/grc/risks/00000000-0000-0000-0000-000000000000/treatment/actions',
          )
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({ title: 'Test action' })
          .expect(404);
      });
    });

    describe('GET /grc/risks/:riskId/treatment/actions', () => {
      it('should return list of treatment actions for a risk', async () => {
        if (!dbConnected || !tenantId || !testRiskId) {
          console.log(
            'Skipping test: database not connected or no risk created',
          );
          return;
        }

        const response = await request(app.getHttpServer())
          .get(`/grc/risks/${testRiskId}/treatment/actions`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);

        // Should contain the created action
        if (testActionId) {
          const action = response.body.data.find(
            (a: { id: string }) => a.id === testActionId,
          );
          expect(action).toBeDefined();
        }
      });
    });

    describe('GET /grc/risks/:riskId/treatment/actions/:actionId', () => {
      it('should return a specific treatment action', async () => {
        if (!dbConnected || !tenantId || !testRiskId || !testActionId) {
          console.log(
            'Skipping test: database not connected or no action created',
          );
          return;
        }

        const response = await request(app.getHttpServer())
          .get(`/grc/risks/${testRiskId}/treatment/actions/${testActionId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const data = response.body.data ?? response.body;
        expect(data.id).toBe(testActionId);
        expect(data.title).toBe('Implement security controls');
      });

      it('should return 404 for non-existent action', async () => {
        if (!dbConnected || !tenantId || !testRiskId) {
          console.log(
            'Skipping test: database not connected or no risk created',
          );
          return;
        }

        await request(app.getHttpServer())
          .get(
            `/grc/risks/${testRiskId}/treatment/actions/00000000-0000-0000-0000-000000000000`,
          )
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(404);
      });
    });

    describe('PATCH /grc/risks/:riskId/treatment/actions/:actionId', () => {
      it('should update treatment action status to IN_PROGRESS', async () => {
        if (!dbConnected || !tenantId || !testRiskId || !testActionId) {
          console.log(
            'Skipping test: database not connected or no action created',
          );
          return;
        }

        const updateData = {
          status: 'IN_PROGRESS',
          progressPct: 25,
        };

        const response = await request(app.getHttpServer())
          .patch(`/grc/risks/${testRiskId}/treatment/actions/${testActionId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(updateData)
          .expect(200);

        const data = response.body.data ?? response.body;
        expect(data.status).toBe('IN_PROGRESS');
        expect(data.progressPct).toBe(25);
      });

      it('should update treatment action status to COMPLETED and auto-set completedAt', async () => {
        if (!dbConnected || !tenantId || !testRiskId || !testActionId) {
          console.log(
            'Skipping test: database not connected or no action created',
          );
          return;
        }

        const updateData = {
          status: 'COMPLETED',
        };

        const response = await request(app.getHttpServer())
          .patch(`/grc/risks/${testRiskId}/treatment/actions/${testActionId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(updateData)
          .expect(200);

        const data = response.body.data ?? response.body;
        expect(data.status).toBe('COMPLETED');
        expect(data.progressPct).toBe(100); // Auto-set to 100 when completed
        expect(data.completedAt).toBeDefined();
      });

      it('should return 404 for non-existent action', async () => {
        if (!dbConnected || !tenantId || !testRiskId) {
          console.log(
            'Skipping test: database not connected or no risk created',
          );
          return;
        }

        await request(app.getHttpServer())
          .patch(
            `/grc/risks/${testRiskId}/treatment/actions/00000000-0000-0000-0000-000000000000`,
          )
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({ status: 'IN_PROGRESS' })
          .expect(404);
      });
    });

    describe('DELETE /grc/risks/:riskId/treatment/actions/:actionId', () => {
      it('should soft delete a treatment action', async () => {
        if (!dbConnected || !tenantId || !testRiskId || !testActionId) {
          console.log(
            'Skipping test: database not connected or no action created',
          );
          return;
        }

        await request(app.getHttpServer())
          .delete(`/grc/risks/${testRiskId}/treatment/actions/${testActionId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(204);
      });

      it('should not return deleted action in list', async () => {
        if (!dbConnected || !tenantId || !testRiskId || !testActionId) {
          console.log(
            'Skipping test: database not connected or no action created',
          );
          return;
        }

        const response = await request(app.getHttpServer())
          .get(`/grc/risks/${testRiskId}/treatment/actions`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const deletedAction = response.body.data.find(
          (a: { id: string }) => a.id === testActionId,
        );
        expect(deletedAction).toBeUndefined();
      });

      it('should return 404 when trying to get deleted action', async () => {
        if (!dbConnected || !tenantId || !testRiskId || !testActionId) {
          console.log(
            'Skipping test: database not connected or no action created',
          );
          return;
        }

        await request(app.getHttpServer())
          .get(`/grc/risks/${testRiskId}/treatment/actions/${testActionId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(404);
      });
    });

    describe('GET /grc/risks/:riskId/treatment/summary', () => {
      it('should return treatment action summary counts', async () => {
        if (!dbConnected || !tenantId || !testRiskId) {
          console.log(
            'Skipping test: database not connected or no risk created',
          );
          return;
        }

        const response = await request(app.getHttpServer())
          .get(`/grc/risks/${testRiskId}/treatment/summary`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('total');
        expect(data).toHaveProperty('completed');
        expect(data).toHaveProperty('inProgress');
        expect(data).toHaveProperty('planned');
        expect(typeof data.total).toBe('number');
        expect(typeof data.completed).toBe('number');
        expect(typeof data.inProgress).toBe('number');
        expect(typeof data.planned).toBe('number');
      });
    });
  });

  // ==================== HEATMAP AGGREGATION TESTS ====================
  describe('Heatmap Aggregation and Drill-Down', () => {
    const createdRiskIds: string[] = [];

    // Known likelihood/impact pairs for testing heatmap aggregation
    const testRisks = [
      {
        title: 'Heatmap Test Risk 1',
        inherentLikelihood: 3,
        inherentImpact: 4,
      }, // L3, I4
      {
        title: 'Heatmap Test Risk 2',
        inherentLikelihood: 3,
        inherentImpact: 4,
      }, // L3, I4 (same cell)
      {
        title: 'Heatmap Test Risk 3',
        inherentLikelihood: 5,
        inherentImpact: 5,
      }, // L5, I5 (critical)
      {
        title: 'Heatmap Test Risk 4',
        inherentLikelihood: 1,
        inherentImpact: 1,
      }, // L1, I1 (low)
    ];

    beforeAll(async () => {
      if (!dbConnected || !tenantId) return;

      // Create test risks with known likelihood/impact values
      for (const riskData of testRisks) {
        const response = await request(app.getHttpServer())
          .post('/grc/risks')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({
            title: riskData.title,
            description: 'Risk for heatmap testing',
            category: 'Testing',
            severity: 'medium',
            likelihood: 'possible',
            status: 'identified',
            inherentLikelihood: riskData.inherentLikelihood,
            inherentImpact: riskData.inherentImpact,
          });

        const data = response.body.data ?? response.body;
        if (data?.id) {
          createdRiskIds.push(data.id);
        }
      }
    });

    afterAll(async () => {
      if (!dbConnected || !tenantId) return;

      // Clean up: delete created risks
      for (const riskId of createdRiskIds) {
        await request(app.getHttpServer())
          .delete(`/grc/risks/${riskId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId);
      }
    });

    describe('GET /grc/risks/heatmap', () => {
      it('should return heatmap data with inherent and residual grids', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/risks/heatmap')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('inherent');
        expect(response.body.data).toHaveProperty('residual');

        // Verify grid structure (5x5 = 25 cells)
        expect(Array.isArray(response.body.data.inherent)).toBe(true);
        expect(response.body.data.inherent.length).toBe(25);
        expect(Array.isArray(response.body.data.residual)).toBe(true);
        expect(response.body.data.residual.length).toBe(25);
      });

      it('should have correct cell structure with likelihood, impact, count, and band', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/risks/heatmap')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const firstCell = response.body.data.inherent[0];
        expect(firstCell).toHaveProperty('likelihood');
        expect(firstCell).toHaveProperty('impact');
        expect(firstCell).toHaveProperty('count');
        expect(firstCell).toHaveProperty('band');
        expect(typeof firstCell.likelihood).toBe('number');
        expect(typeof firstCell.impact).toBe('number');
        expect(typeof firstCell.count).toBe('number');
        expect(typeof firstCell.band).toBe('string');
      });

      it('should aggregate risks correctly in heatmap cells', async () => {
        if (!dbConnected || !tenantId || createdRiskIds.length < 4) {
          console.log(
            'Skipping test: database not connected or risks not created',
          );
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/risks/heatmap')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const inherentGrid = response.body.data.inherent;

        // Find cell for L3, I4 (index = (3-1)*5 + (4-1) = 13)
        const l3i4Cell = inherentGrid.find(
          (c: { likelihood: number; impact: number }) =>
            c.likelihood === 3 && c.impact === 4,
        );
        expect(l3i4Cell).toBeDefined();
        // Should have at least 2 risks (we created 2 with L3, I4)
        expect(l3i4Cell.count).toBeGreaterThanOrEqual(2);

        // Find cell for L5, I5 (critical)
        const l5i5Cell = inherentGrid.find(
          (c: { likelihood: number; impact: number }) =>
            c.likelihood === 5 && c.impact === 5,
        );
        expect(l5i5Cell).toBeDefined();
        expect(l5i5Cell.count).toBeGreaterThanOrEqual(1);
        expect(l5i5Cell.band).toBe('critical');

        // Find cell for L1, I1 (low)
        const l1i1Cell = inherentGrid.find(
          (c: { likelihood: number; impact: number }) =>
            c.likelihood === 1 && c.impact === 1,
        );
        expect(l1i1Cell).toBeDefined();
        expect(l1i1Cell.count).toBeGreaterThanOrEqual(1);
        expect(l1i1Cell.band).toBe('low');
      });
    });

    describe('Heatmap Drill-Down (Filter by likelihood/impact)', () => {
      it('should filter risks by likelihood parameter', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/risks')
          .query({ likelihood: 'possible' }) // Maps to likelihood level 3
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const data = response.body.data ?? response.body;
        const items = data.items ?? data;

        // All returned risks should have likelihood = 'possible'
        if (Array.isArray(items) && items.length > 0) {
          items.forEach((risk: { likelihood: string }) => {
            expect(risk.likelihood).toBe('possible');
          });
        }
      });

      it('should filter risks by impact parameter', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/risks')
          .query({ impact: 'high' })
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const data = response.body.data ?? response.body;
        const items = data.items ?? data;

        // All returned risks should have impact = 'high'
        if (Array.isArray(items) && items.length > 0) {
          items.forEach((risk: { impact: string }) => {
            expect(risk.impact).toBe('high');
          });
        }
      });

      it('should filter risks by both likelihood and impact', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/risks')
          .query({ likelihood: 'possible', impact: 'high' })
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const data = response.body.data ?? response.body;
        const items = data.items ?? data;

        // All returned risks should match both filters
        if (Array.isArray(items) && items.length > 0) {
          items.forEach((risk: { likelihood: string; impact: string }) => {
            expect(risk.likelihood).toBe('possible');
            expect(risk.impact).toBe('high');
          });
        }
      });
    });
  });

  // ==================== LINK/UNLINK CONTROLS TESTS ====================
  // Note: Basic link/unlink tests exist in grc.e2e-spec.ts (lines 318-491)
  // These tests add additional coverage for edge cases and tenant isolation
  describe('Risk-Control Link/Unlink - Additional Coverage', () => {
    let testRiskId: string;
    let testControlId: string;

    beforeAll(async () => {
      if (!dbConnected || !tenantId) return;

      // Create a test risk
      const riskResponse = await request(app.getHttpServer())
        .post('/grc/risks')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          title: 'Control Link Test Risk',
          description: 'Risk for testing control linking',
          category: 'Testing',
          severity: 'high',
          likelihood: 'possible',
          status: 'identified',
        });

      const riskData = riskResponse.body.data ?? riskResponse.body;
      testRiskId = riskData?.id;

      // Create a test control
      const controlResponse = await request(app.getHttpServer())
        .post('/grc/controls')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          name: 'Test Control for Risk Linking',
          code: `CTL-LINK-${Date.now()}`,
          description: 'Control for testing risk-control linking',
          category: 'Testing',
          status: 'implemented',
        });

      const controlData = controlResponse.body.data ?? controlResponse.body;
      testControlId = controlData?.id;
    });

    afterAll(async () => {
      if (!dbConnected || !tenantId) return;

      // Clean up
      if (testRiskId) {
        await request(app.getHttpServer())
          .delete(`/grc/risks/${testRiskId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId);
      }
      if (testControlId) {
        await request(app.getHttpServer())
          .delete(`/grc/controls/${testControlId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId);
      }
    });

    it('should NOT allow linking control from another tenant', async () => {
      if (!dbConnected || !tenantId || !testRiskId || !testControlId) {
        console.log(
          'Skipping test: database not connected or entities not created',
        );
        return;
      }

      // Try to link control with a different tenant ID
      const response = await request(app.getHttpServer())
        .post(`/grc/risks/${testRiskId}/controls/${testControlId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', FAKE_TENANT_ID);

      // Should return 404 (risk not found in that tenant) or 403 (forbidden)
      expect([403, 404]).toContain(response.status);
    });

    it('should link and verify control appears in linked controls list', async () => {
      if (!dbConnected || !tenantId || !testRiskId || !testControlId) {
        console.log(
          'Skipping test: database not connected or entities not created',
        );
        return;
      }

      // Link the control
      await request(app.getHttpServer())
        .post(`/grc/risks/${testRiskId}/controls/${testControlId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      // Verify it appears in the list
      const response = await request(app.getHttpServer())
        .get(`/grc/risks/${testRiskId}/controls/list`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);

      const linkedControl = response.body.data.find(
        (c: { id: string }) => c.id === testControlId,
      );
      expect(linkedControl).toBeDefined();
    });

    it('should unlink control and verify it no longer appears in list', async () => {
      if (!dbConnected || !tenantId || !testRiskId || !testControlId) {
        console.log(
          'Skipping test: database not connected or entities not created',
        );
        return;
      }

      // Unlink the control
      await request(app.getHttpServer())
        .delete(`/grc/risks/${testRiskId}/controls/${testControlId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(204);

      // Verify it no longer appears in the list
      const response = await request(app.getHttpServer())
        .get(`/grc/risks/${testRiskId}/controls/list`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const linkedControl = response.body.data.find(
        (c: { id: string }) => c.id === testControlId,
      );
      expect(linkedControl).toBeUndefined();
    });
  });
});
