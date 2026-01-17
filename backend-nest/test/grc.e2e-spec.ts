import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('GRC CRUD Operations (e2e)', () => {
  let app: INestApplication<App>;
  let dbConnected = false;
  let adminToken: string;
  let tenantId: string;

  // Demo admin credentials
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

  // ==================== RISKS ====================
  describe('GRC Risks', () => {
    let createdRiskId: string;

    describe('GET /grc/risks', () => {
      it('should return list of risks with valid auth', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/risks')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in LIST-CONTRACT format: { success, data: { items, total, page, pageSize, totalPages } }
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('items');
        expect(Array.isArray(response.body.data.items)).toBe(true);
      });

      it('should return 401 without token', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/risks')
          .set('x-tenant-id', tenantId)
          .expect(401);
      });

      it('should return 400 without x-tenant-id header', async () => {
        if (!dbConnected) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/risks')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);
      });
    });

    describe('POST /grc/risks', () => {
      it('should create a new risk with valid data', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const newRisk = {
          title: 'Test Risk - E2E',
          description: 'A test risk created by e2e tests',
          category: 'Testing',
          severity: 'high',
          likelihood: 'possible',
          status: 'identified',
        };

        const response = await request(app.getHttpServer())
          .post('/grc/risks')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(newRisk)
          .expect(201);

        // Response is wrapped in standard envelope
        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('title', newRisk.title);
        expect(data).toHaveProperty('tenantId', tenantId);
        expect(data).toHaveProperty('isDeleted', false);

        createdRiskId = data.id;
      });

      it('should return 400 without required title field', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const invalidRisk = {
          description: 'Missing title',
        };

        await request(app.getHttpServer())
          .post('/grc/risks')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(invalidRisk)
          .expect(400);
      });
    });

    describe('GET /grc/risks/:id', () => {
      it('should return a specific risk by ID', async () => {
        if (!dbConnected || !tenantId || !createdRiskId) {
          console.log(
            'Skipping test: database not connected or no risk created',
          );
          return;
        }

        const response = await request(app.getHttpServer())
          .get(`/grc/risks/${createdRiskId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in standard envelope
        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id', createdRiskId);
        expect(data).toHaveProperty('title', 'Test Risk - E2E');
      });

      it('should return 404 for non-existent risk', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/risks/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(404);
      });
    });

    describe('PATCH /grc/risks/:id', () => {
      it('should update an existing risk', async () => {
        if (!dbConnected || !tenantId || !createdRiskId) {
          console.log(
            'Skipping test: database not connected or no risk created',
          );
          return;
        }

        const updateData = {
          title: 'Test Risk - E2E Updated',
          severity: 'critical',
        };

        const response = await request(app.getHttpServer())
          .patch(`/grc/risks/${createdRiskId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(updateData)
          .expect(200);

        // Response is wrapped in standard envelope
        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id', createdRiskId);
        expect(data).toHaveProperty('title', updateData.title);
        expect(data).toHaveProperty('severity', updateData.severity);
      });

      it('should return 404 for non-existent risk', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .patch('/grc/risks/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({ title: 'Updated' })
          .expect(404);
      });
    });

    describe('DELETE /grc/risks/:id', () => {
      it('should soft delete a risk', async () => {
        if (!dbConnected || !tenantId || !createdRiskId) {
          console.log(
            'Skipping test: database not connected or no risk created',
          );
          return;
        }

        await request(app.getHttpServer())
          .delete(`/grc/risks/${createdRiskId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(204);
      });

      it('should not return deleted risk in list', async () => {
        if (!dbConnected || !tenantId || !createdRiskId) {
          console.log(
            'Skipping test: database not connected or no risk created',
          );
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/risks')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in LIST-CONTRACT format: { success, data: { items, total, page, pageSize, totalPages } }
        const items =
          response.body.data?.items ?? response.body.data ?? response.body;
        const deletedRisk = items.find(
          (r: { id: string }) => r.id === createdRiskId,
        );
        expect(deletedRisk).toBeUndefined();
      });

      it('should return 404 when trying to get deleted risk', async () => {
        if (!dbConnected || !tenantId || !createdRiskId) {
          console.log(
            'Skipping test: database not connected or no risk created',
          );
          return;
        }

        await request(app.getHttpServer())
          .get(`/grc/risks/${createdRiskId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(404);
      });
    });

    describe('GET /grc/risks/statistics', () => {
      it('should return risk statistics', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/risks/statistics')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in standard envelope
        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('total');
        expect(data).toHaveProperty('bySeverity');
        expect(data).toHaveProperty('byStatus');
      });
    });
  });

  // ==================== POLICIES ====================
  describe('GRC Policies', () => {
    let createdPolicyId: string;

    describe('GET /grc/policies', () => {
      it('should return list of policies with valid auth', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/policies')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in LIST-CONTRACT format: { success, data: { items, total, page, pageSize, totalPages } }
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('items');
        expect(Array.isArray(response.body.data.items)).toBe(true);
      });
    });

    describe('POST /grc/policies', () => {
      it('should create a new policy with valid data', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const newPolicy = {
          name: 'Test Policy - E2E',
          code: 'POL-E2E-001',
          version: '1.0',
          status: 'draft',
          category: 'Testing',
          summary: 'A test policy created by e2e tests',
        };

        const response = await request(app.getHttpServer())
          .post('/grc/policies')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(newPolicy)
          .expect(201);

        // Response is wrapped in standard envelope
        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('name', newPolicy.name);
        expect(data).toHaveProperty('tenantId', tenantId);
        expect(data).toHaveProperty('isDeleted', false);

        createdPolicyId = data.id;
      });

      it('should return 400 without required name field', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const invalidPolicy = {
          code: 'POL-INVALID',
        };

        await request(app.getHttpServer())
          .post('/grc/policies')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(invalidPolicy)
          .expect(400);
      });
    });

    describe('PATCH /grc/policies/:id', () => {
      it('should update an existing policy', async () => {
        if (!dbConnected || !tenantId || !createdPolicyId) {
          console.log(
            'Skipping test: database not connected or no policy created',
          );
          return;
        }

        const updateData = {
          name: 'Test Policy - E2E Updated',
          status: 'active',
        };

        const response = await request(app.getHttpServer())
          .patch(`/grc/policies/${createdPolicyId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(updateData)
          .expect(200);

        // Response is wrapped in standard envelope
        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id', createdPolicyId);
        expect(data).toHaveProperty('name', updateData.name);
        expect(data).toHaveProperty('status', updateData.status);
      });
    });

    describe('DELETE /grc/policies/:id', () => {
      it('should soft delete a policy', async () => {
        if (!dbConnected || !tenantId || !createdPolicyId) {
          console.log(
            'Skipping test: database not connected or no policy created',
          );
          return;
        }

        await request(app.getHttpServer())
          .delete(`/grc/policies/${createdPolicyId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(204);
      });

      it('should not return deleted policy in list', async () => {
        if (!dbConnected || !tenantId || !createdPolicyId) {
          console.log(
            'Skipping test: database not connected or no policy created',
          );
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/policies')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in LIST-CONTRACT format: { success, data: { items, total, page, pageSize, totalPages } }
        const items =
          response.body.data?.items ?? response.body.data ?? response.body;
        const deletedPolicy = items.find(
          (p: { id: string }) => p.id === createdPolicyId,
        );
        expect(deletedPolicy).toBeUndefined();
      });
    });
  });

  // ==================== REQUIREMENTS ====================
  describe('GRC Requirements', () => {
    let createdRequirementId: string;

    describe('GET /grc/requirements', () => {
      it('should return list of requirements with valid auth', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/requirements')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in LIST-CONTRACT format: { success, data: { items, total, page, pageSize, totalPages } }
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('items');
        expect(Array.isArray(response.body.data.items)).toBe(true);
      });
    });

    describe('POST /grc/requirements', () => {
      it('should create a new requirement with valid data', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const newRequirement = {
          framework: 'iso27001',
          referenceCode: 'A.E2E.1',
          title: 'Test Requirement - E2E',
          description: 'A test requirement created by e2e tests',
          category: 'Testing',
          priority: 'High',
          status: 'Pending',
        };

        const response = await request(app.getHttpServer())
          .post('/grc/requirements')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(newRequirement)
          .expect(201);

        // Response is wrapped in standard envelope
        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('title', newRequirement.title);
        expect(data).toHaveProperty('tenantId', tenantId);
        expect(data).toHaveProperty('isDeleted', false);

        createdRequirementId = data.id;
      });

      it('should return 400 without required fields', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const invalidRequirement = {
          description: 'Missing required fields',
        };

        await request(app.getHttpServer())
          .post('/grc/requirements')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(invalidRequirement)
          .expect(400);
      });
    });

    describe('PATCH /grc/requirements/:id', () => {
      it('should update an existing requirement', async () => {
        if (!dbConnected || !tenantId || !createdRequirementId) {
          console.log(
            'Skipping test: database not connected or no requirement created',
          );
          return;
        }

        const updateData = {
          title: 'Test Requirement - E2E Updated',
          status: 'Compliant',
        };

        const response = await request(app.getHttpServer())
          .patch(`/grc/requirements/${createdRequirementId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(updateData)
          .expect(200);

        // Response is wrapped in standard envelope
        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id', createdRequirementId);
        expect(data).toHaveProperty('title', updateData.title);
        expect(data).toHaveProperty('status', updateData.status);
      });
    });

    describe('DELETE /grc/requirements/:id', () => {
      it('should soft delete a requirement', async () => {
        if (!dbConnected || !tenantId || !createdRequirementId) {
          console.log(
            'Skipping test: database not connected or no requirement created',
          );
          return;
        }

        await request(app.getHttpServer())
          .delete(`/grc/requirements/${createdRequirementId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(204);
      });

      it('should not return deleted requirement in list', async () => {
        if (!dbConnected || !tenantId || !createdRequirementId) {
          console.log(
            'Skipping test: database not connected or no requirement created',
          );
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/requirements')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in LIST-CONTRACT format: { success, data: { items, total, page, pageSize, totalPages } }
        const items =
          response.body.data?.items ?? response.body.data ?? response.body;
        const deletedRequirement = items.find(
          (r: { id: string }) => r.id === createdRequirementId,
        );
        expect(deletedRequirement).toBeUndefined();
      });
    });

    describe('GET /grc/requirements/statistics', () => {
      it('should return requirement statistics', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/requirements/statistics')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in standard envelope
        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('total');
        expect(data).toHaveProperty('byFramework');
        expect(data).toHaveProperty('byStatus');
      });
    });

    describe('GET /grc/requirements/frameworks', () => {
      it('should return list of frameworks', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/requirements/frameworks')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in standard envelope
        const data = response.body.data ?? response.body;
        expect(Array.isArray(data)).toBe(true);
      });
    });

    describe('GET /grc/requirements/filters', () => {
      it('should return filter options with valid auth', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/requirements/filters')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response should contain filter arrays
        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('families');
        expect(data).toHaveProperty('versions');
        expect(data).toHaveProperty('domains');
        expect(data).toHaveProperty('categories');
        expect(data).toHaveProperty('hierarchyLevels');
        expect(Array.isArray(data.families)).toBe(true);
        expect(Array.isArray(data.versions)).toBe(true);
        expect(Array.isArray(data.domains)).toBe(true);
        expect(Array.isArray(data.categories)).toBe(true);
        expect(Array.isArray(data.hierarchyLevels)).toBe(true);
      });

      it('should return 401 without token', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/requirements/filters')
          .set('x-tenant-id', tenantId)
          .expect(401);
      });

      it('should return 400 without x-tenant-id header', async () => {
        if (!dbConnected) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/requirements/filters')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);
      });
    });
  });

  // ==================== AUDITS ====================
  describe('GRC Audits', () => {
    let createdAuditId: string;

    describe('GET /grc/audits', () => {
      it('should return list of audits with valid auth', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/audits')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in standard envelope: { success, data, meta }
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
      });

      it('should return 401 without token', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/audits')
          .set('x-tenant-id', tenantId)
          .expect(401);
      });

      it('should return 400 without x-tenant-id header', async () => {
        if (!dbConnected) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/audits')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);
      });
    });

    describe('GET /grc/audits/can/create', () => {
      it('should return allowed status for admin user', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/audits/can/create')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response may be wrapped in standard envelope or returned directly
        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('allowed', true);
      });
    });

    describe('POST /grc/audits', () => {
      it('should create a new audit with valid data', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const newAudit = {
          name: 'Test Audit - E2E',
          description: 'A test audit created by e2e tests',
          auditType: 'internal',
          status: 'planned',
          riskLevel: 'medium',
          department: 'Engineering',
        };

        const response = await request(app.getHttpServer())
          .post('/grc/audits')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(newAudit)
          .expect(201);

        // Response is wrapped in standard envelope
        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('name', newAudit.name);
        expect(data).toHaveProperty('tenantId', tenantId);
        expect(data).toHaveProperty('isDeleted', false);

        createdAuditId = data.id;
      });

      it('should return 400 without required name field', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const invalidAudit = {
          description: 'Missing name',
          auditType: 'internal',
        };

        await request(app.getHttpServer())
          .post('/grc/audits')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(invalidAudit)
          .expect(400);
      });
    });

    describe('GET /grc/audits/:id', () => {
      it('should return a specific audit by ID', async () => {
        if (!dbConnected || !tenantId || !createdAuditId) {
          console.log(
            'Skipping test: database not connected or no audit created',
          );
          return;
        }

        const response = await request(app.getHttpServer())
          .get(`/grc/audits/${createdAuditId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in standard envelope
        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id', createdAuditId);
        expect(data).toHaveProperty('name', 'Test Audit - E2E');
      });

      it('should return 404 for non-existent audit', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/audits/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(404);
      });
    });

    describe('PATCH /grc/audits/:id', () => {
      it('should update an existing audit', async () => {
        if (!dbConnected || !tenantId || !createdAuditId) {
          console.log(
            'Skipping test: database not connected or no audit created',
          );
          return;
        }

        const updateData = {
          name: 'Test Audit - E2E Updated',
          status: 'in_progress',
        };

        const response = await request(app.getHttpServer())
          .patch(`/grc/audits/${createdAuditId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(updateData)
          .expect(200);

        // Response is wrapped in standard envelope
        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id', createdAuditId);
        expect(data).toHaveProperty('name', updateData.name);
        expect(data).toHaveProperty('status', updateData.status);
      });

      it('should return 404 for non-existent audit', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .patch('/grc/audits/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({ name: 'Updated' })
          .expect(404);
      });
    });

    describe('DELETE /grc/audits/:id', () => {
      it('should soft delete an audit', async () => {
        if (!dbConnected || !tenantId || !createdAuditId) {
          console.log(
            'Skipping test: database not connected or no audit created',
          );
          return;
        }

        await request(app.getHttpServer())
          .delete(`/grc/audits/${createdAuditId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(204);
      });

      it('should return 404 when trying to get deleted audit', async () => {
        if (!dbConnected || !tenantId || !createdAuditId) {
          console.log(
            'Skipping test: database not connected or no audit created',
          );
          return;
        }

        await request(app.getHttpServer())
          .get(`/grc/audits/${createdAuditId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(404);
      });
    });

    describe('GET /grc/audits/statistics', () => {
      it('should return audit statistics', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/audits/statistics')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in standard envelope
        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('total');
        expect(data).toHaveProperty('byStatus');
        expect(data).toHaveProperty('byType');
        expect(data).toHaveProperty('byRiskLevel');
      });
    });
  });

  // ==================== EVIDENCE ====================
  describe('GRC Evidence', () => {
    let createdEvidenceId: string;
    let existingControlId: string;

    describe('GET /grc/evidence', () => {
      it('should return list of evidence with valid auth', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/evidence')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in LIST-CONTRACT format: { success, data: { items, total, page, pageSize, totalPages } }
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('items');
        expect(Array.isArray(response.body.data.items)).toBe(true);
      });

      it('should return 401 without token', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/evidence')
          .set('x-tenant-id', tenantId)
          .expect(401);
      });

      it('should return 400 without x-tenant-id header', async () => {
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

    describe('POST /grc/evidence', () => {
      it('should create a new evidence with valid data', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const newEvidence = {
          name: 'Test Evidence - E2E',
          description: 'A test evidence created by e2e tests',
          type: 'document',
          sourceType: 'manual',
          status: 'draft',
          location: '/documents/test-evidence.pdf',
          tags: ['test', 'e2e'],
        };

        const response = await request(app.getHttpServer())
          .post('/grc/evidence')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(newEvidence)
          .expect(201);

        // Response is wrapped in standard envelope
        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('name', newEvidence.name);
        expect(data).toHaveProperty('tenantId', tenantId);
        expect(data).toHaveProperty('isDeleted', false);

        createdEvidenceId = data.id;
      });

      it('should return 400 without required name field', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const invalidEvidence = {
          description: 'Missing name',
        };

        await request(app.getHttpServer())
          .post('/grc/evidence')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(invalidEvidence)
          .expect(400);
      });
    });

    describe('GET /grc/evidence/:id', () => {
      it('should return a specific evidence by ID', async () => {
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

        // Response is wrapped in standard envelope
        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id', createdEvidenceId);
        expect(data).toHaveProperty('name', 'Test Evidence - E2E');
      });

      it('should return 404 for non-existent evidence', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/evidence/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(404);
      });
    });

    describe('PATCH /grc/evidence/:id', () => {
      it('should update an existing evidence', async () => {
        if (!dbConnected || !tenantId || !createdEvidenceId) {
          console.log(
            'Skipping test: database not connected or no evidence created',
          );
          return;
        }

        const updateData = {
          name: 'Test Evidence - E2E Updated',
          status: 'approved',
        };

        const response = await request(app.getHttpServer())
          .patch(`/grc/evidence/${createdEvidenceId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(updateData)
          .expect(200);

        // Response is wrapped in standard envelope
        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id', createdEvidenceId);
        expect(data).toHaveProperty('name', updateData.name);
        expect(data).toHaveProperty('status', updateData.status);
      });

      it('should return 404 for non-existent evidence', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .patch('/grc/evidence/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({ name: 'Updated' })
          .expect(404);
      });
    });

    describe('Control Linkage', () => {
      it('should get existing control for linkage test', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        // Get an existing control to link to
        const response = await request(app.getHttpServer())
          .get('/grc/controls')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const items =
          response.body.data?.items ?? response.body.data ?? response.body;
        if (Array.isArray(items) && items.length > 0) {
          existingControlId = items[0].id;
        }
      });

      it('should link evidence to control', async () => {
        if (
          !dbConnected ||
          !tenantId ||
          !createdEvidenceId ||
          !existingControlId
        ) {
          console.log(
            'Skipping test: database not connected or no evidence/control available',
          );
          return;
        }

        await request(app.getHttpServer())
          .post(
            `/grc/evidence/${createdEvidenceId}/controls/${existingControlId}`,
          )
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(201);
      });

      it('should get linked controls for evidence', async () => {
        if (!dbConnected || !tenantId || !createdEvidenceId) {
          console.log(
            'Skipping test: database not connected or no evidence created',
          );
          return;
        }

        const response = await request(app.getHttpServer())
          .get(`/grc/evidence/${createdEvidenceId}/controls`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response should contain linked controls
        const data = response.body.data ?? response.body;
        expect(Array.isArray(data)).toBe(true);
        if (existingControlId) {
          expect(
            data.some((c: { id: string }) => c.id === existingControlId),
          ).toBe(true);
        }
      });

      it('should unlink evidence from control', async () => {
        if (
          !dbConnected ||
          !tenantId ||
          !createdEvidenceId ||
          !existingControlId
        ) {
          console.log(
            'Skipping test: database not connected or no evidence/control available',
          );
          return;
        }

        await request(app.getHttpServer())
          .delete(
            `/grc/evidence/${createdEvidenceId}/controls/${existingControlId}`,
          )
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(204);
      });

      it('should return 404 when unlinking non-linked control', async () => {
        if (!dbConnected || !tenantId || !createdEvidenceId) {
          console.log(
            'Skipping test: database not connected or no evidence created',
          );
          return;
        }

        // Try to unlink a control that is not linked (should return 404)
        await request(app.getHttpServer())
          .delete(
            `/grc/evidence/${createdEvidenceId}/controls/00000000-0000-0000-0000-000000000000`,
          )
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(404);
      });
    });

    describe('DELETE /grc/evidence/:id', () => {
      it('should soft delete an evidence', async () => {
        if (!dbConnected || !tenantId || !createdEvidenceId) {
          console.log(
            'Skipping test: database not connected or no evidence created',
          );
          return;
        }

        await request(app.getHttpServer())
          .delete(`/grc/evidence/${createdEvidenceId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(204);
      });

      it('should not return deleted evidence in list', async () => {
        if (!dbConnected || !tenantId || !createdEvidenceId) {
          console.log(
            'Skipping test: database not connected or no evidence created',
          );
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/evidence')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in LIST-CONTRACT format: { success, data: { items, total, page, pageSize, totalPages } }
        const items =
          response.body.data?.items ?? response.body.data ?? response.body;
        const deletedEvidence = items.find(
          (e: { id: string }) => e.id === createdEvidenceId,
        );
        expect(deletedEvidence).toBeUndefined();
      });

      it('should return 404 when trying to get deleted evidence', async () => {
        if (!dbConnected || !tenantId || !createdEvidenceId) {
          console.log(
            'Skipping test: database not connected or no evidence created',
          );
          return;
        }

        await request(app.getHttpServer())
          .get(`/grc/evidence/${createdEvidenceId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(404);
      });
    });
  });

  // ==================== PROCESS VIOLATIONS ====================
  describe('GRC Process Violations', () => {
    describe('GET /grc/process-violations', () => {
      it('should return list of process violations with valid auth', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/process-violations')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in LIST-CONTRACT format: { success, data: { items, total, page, pageSize, totalPages } }
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('items');
        expect(Array.isArray(response.body.data.items)).toBe(true);
      });

      it('should return 401 without token', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/process-violations')
          .set('x-tenant-id', tenantId)
          .expect(401);
      });

      it('should return 400 without x-tenant-id header', async () => {
        if (!dbConnected) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/process-violations')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);
      });

      it('should filter violations by status (lowercase)', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        // Test with lowercase status values (backend expects lowercase)
        const response = await request(app.getHttpServer())
          .get('/grc/process-violations?status=open')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('items');
        expect(Array.isArray(response.body.data.items)).toBe(true);
      });

      it('should filter violations by severity (lowercase)', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        // Test with lowercase severity values (backend expects lowercase)
        const response = await request(app.getHttpServer())
          .get('/grc/process-violations?severity=high')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('items');
        expect(Array.isArray(response.body.data.items)).toBe(true);
      });
    });

    describe('PATCH /grc/process-violations/:id', () => {
      it('should return 404 for non-existent violation', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .patch('/grc/process-violations/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({ status: 'in_progress' })
          .expect(404);
      });

      it('should reject invalid status values', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .patch('/grc/process-violations/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({ status: 'INVALID_STATUS' })
          .expect(400);
      });
    });

    describe('PATCH /grc/process-violations/:id/link-risk', () => {
      it('should return 404 for non-existent violation when linking risk', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        // Use valid UUID v4 format (13th char must be '4', 17th char must be '8', '9', 'a', or 'b')
        await request(app.getHttpServer())
          .patch(
            '/grc/process-violations/00000000-0000-4000-a000-000000000000/link-risk',
          )
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({ riskId: '00000000-0000-4000-a000-000000000001' })
          .expect(404);
      });
    });
  });

  // ==================== TENANT ISOLATION ====================
  describe('Tenant Isolation', () => {
    let isolationTestRiskId: string;
    const fakeTenantId = '00000000-0000-0000-0000-000000000099';

    describe('Cross-tenant access prevention for Risks', () => {
      it('should create a risk for isolation testing', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const newRisk = {
          title: 'Isolation Test Risk',
          description: 'A risk created for tenant isolation testing',
          category: 'Security',
          severity: 'high',
          likelihood: 'possible',
          status: 'identified',
        };

        const response = await request(app.getHttpServer())
          .post('/grc/risks')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(newRisk)
          .expect(201);

        // Response is wrapped in standard envelope
        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('tenantId', tenantId);
        isolationTestRiskId = data.id;
      });

      it('should return 403 when accessing risk with fake tenant ID', async () => {
        if (!dbConnected || !tenantId || !isolationTestRiskId) {
          console.log(
            'Skipping test: database not connected or no risk created',
          );
          return;
        }

        // Attempt to access the risk with a different tenant ID
        // TenantGuard should reject this request with 403 (user doesn't belong to fake tenant)
        await request(app.getHttpServer())
          .get(`/grc/risks/${isolationTestRiskId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', fakeTenantId)
          .expect(403);
      });

      it('should return 403 when updating risk with fake tenant ID', async () => {
        if (!dbConnected || !tenantId || !isolationTestRiskId) {
          console.log(
            'Skipping test: database not connected or no risk created',
          );
          return;
        }

        await request(app.getHttpServer())
          .patch(`/grc/risks/${isolationTestRiskId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', fakeTenantId)
          .send({ title: 'Hacked Risk Title' })
          .expect(403);
      });

      it('should return 403 when deleting risk with fake tenant ID', async () => {
        if (!dbConnected || !tenantId || !isolationTestRiskId) {
          console.log(
            'Skipping test: database not connected or no risk created',
          );
          return;
        }

        await request(app.getHttpServer())
          .delete(`/grc/risks/${isolationTestRiskId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', fakeTenantId)
          .expect(403);
      });

      it('should not include risk in list when using fake tenant ID', async () => {
        if (!dbConnected || !tenantId || !isolationTestRiskId) {
          console.log(
            'Skipping test: database not connected or no risk created',
          );
          return;
        }

        // This should return 403 because user doesn't belong to fake tenant
        await request(app.getHttpServer())
          .get('/grc/risks')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', fakeTenantId)
          .expect(403);
      });

      it('should clean up isolation test risk', async () => {
        if (!dbConnected || !tenantId || !isolationTestRiskId) {
          console.log(
            'Skipping test: database not connected or no risk created',
          );
          return;
        }

        // Clean up by deleting the test risk with correct tenant
        await request(app.getHttpServer())
          .delete(`/grc/risks/${isolationTestRiskId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(204);
      });
    });

    describe('Cross-tenant access prevention for Policies', () => {
      let isolationTestPolicyId: string;

      it('should create a policy for isolation testing', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const newPolicy = {
          name: 'Isolation Test Policy',
          code: 'POL-ISO-001',
          version: '1.0',
          status: 'draft',
          category: 'Security',
        };

        const response = await request(app.getHttpServer())
          .post('/grc/policies')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(newPolicy)
          .expect(201);

        // Response is wrapped in standard envelope
        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('tenantId', tenantId);
        isolationTestPolicyId = data.id;
      });

      it('should return 403 when accessing policy with fake tenant ID', async () => {
        if (!dbConnected || !tenantId || !isolationTestPolicyId) {
          console.log(
            'Skipping test: database not connected or no policy created',
          );
          return;
        }

        await request(app.getHttpServer())
          .get(`/grc/policies/${isolationTestPolicyId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', fakeTenantId)
          .expect(403);
      });

      it('should return 403 when updating policy with fake tenant ID', async () => {
        if (!dbConnected || !tenantId || !isolationTestPolicyId) {
          console.log(
            'Skipping test: database not connected or no policy created',
          );
          return;
        }

        await request(app.getHttpServer())
          .patch(`/grc/policies/${isolationTestPolicyId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', fakeTenantId)
          .send({ name: 'Hacked Policy Name' })
          .expect(403);
      });

      it('should clean up isolation test policy', async () => {
        if (!dbConnected || !tenantId || !isolationTestPolicyId) {
          console.log(
            'Skipping test: database not connected or no policy created',
          );
          return;
        }

        await request(app.getHttpServer())
          .delete(`/grc/policies/${isolationTestPolicyId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(204);
      });
    });

    describe('Cross-tenant access prevention for Requirements', () => {
      let isolationTestRequirementId: string;

      it('should create a requirement for isolation testing', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const newRequirement = {
          framework: 'iso27001',
          referenceCode: 'A.ISO.TEST',
          title: 'Isolation Test Requirement',
          description: 'A requirement created for tenant isolation testing',
          category: 'Security',
          priority: 'High',
          status: 'Pending',
        };

        const response = await request(app.getHttpServer())
          .post('/grc/requirements')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(newRequirement)
          .expect(201);

        // Response is wrapped in standard envelope
        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('tenantId', tenantId);
        isolationTestRequirementId = data.id;
      });

      it('should return 403 when accessing requirement with fake tenant ID', async () => {
        if (!dbConnected || !tenantId || !isolationTestRequirementId) {
          console.log(
            'Skipping test: database not connected or no requirement created',
          );
          return;
        }

        await request(app.getHttpServer())
          .get(`/grc/requirements/${isolationTestRequirementId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', fakeTenantId)
          .expect(403);
      });

      it('should return 403 when updating requirement with fake tenant ID', async () => {
        if (!dbConnected || !tenantId || !isolationTestRequirementId) {
          console.log(
            'Skipping test: database not connected or no requirement created',
          );
          return;
        }

        await request(app.getHttpServer())
          .patch(`/grc/requirements/${isolationTestRequirementId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', fakeTenantId)
          .send({ title: 'Hacked Requirement Title' })
          .expect(403);
      });

      it('should clean up isolation test requirement', async () => {
        if (!dbConnected || !tenantId || !isolationTestRequirementId) {
          console.log(
            'Skipping test: database not connected or no requirement created',
          );
          return;
        }

        await request(app.getHttpServer())
          .delete(`/grc/requirements/${isolationTestRequirementId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(204);
      });
    });

    describe('Invalid tenant ID handling', () => {
      it('should return 400 for invalid UUID format in x-tenant-id', async () => {
        if (!dbConnected) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/risks')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', 'invalid-uuid-format')
          .expect(400);
      });

      it('should return 400 when x-tenant-id header is missing', async () => {
        if (!dbConnected) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/risks')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);
      });
    });
  });

  // ==================== CONTROL TESTS (Test Definitions) ====================
  describe('GRC Control Tests', () => {
    let createdControlTestId: string;
    let testControlId: string;

    // First create a control to link tests to
    beforeAll(async () => {
      if (!dbConnected || !tenantId) return;

      const newControl = {
        name: 'Test Control for Control Tests - E2E',
        code: 'CTL-E2E-CT-001',
        description: 'A test control for control test e2e tests',
        status: 'IMPLEMENTED',
      };

      const response = await request(app.getHttpServer())
        .post('/grc/controls')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send(newControl);

      const data = response.body.data ?? response.body;
      testControlId = data?.id;
    });

    describe('GET /grc/control-tests', () => {
      it('should return list of control tests with valid auth', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/control-tests')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('items');
        expect(Array.isArray(response.body.data.items)).toBe(true);
      });

      it('should return 401 without token', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/control-tests')
          .set('x-tenant-id', tenantId)
          .expect(401);
      });

      it('should support search with q parameter', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/control-tests?q=test')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('items');
      });
    });

    describe('POST /grc/control-tests', () => {
      it('should create a new control test with valid data', async () => {
        if (!dbConnected || !tenantId || !testControlId) {
          console.log(
            'Skipping test: database not connected or no control created',
          );
          return;
        }

        const newControlTest = {
          controlId: testControlId,
          name: 'Test Control Test - E2E',
          description: 'A test control test created by e2e tests',
          testType: 'DESIGN',
          status: 'PLANNED',
        };

        const response = await request(app.getHttpServer())
          .post('/grc/control-tests')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(newControlTest)
          .expect(201);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('name', newControlTest.name);
        expect(data).toHaveProperty('tenantId', tenantId);
        expect(data).toHaveProperty('controlId', testControlId);

        createdControlTestId = data.id;
      });

      it('should return 400 without required controlId field', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const invalidControlTest = {
          name: 'Missing controlId',
        };

        await request(app.getHttpServer())
          .post('/grc/control-tests')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(invalidControlTest)
          .expect(400);
      });
    });

    describe('GET /grc/control-tests/:id', () => {
      it('should return a specific control test by ID', async () => {
        if (!dbConnected || !tenantId || !createdControlTestId) {
          console.log(
            'Skipping test: database not connected or no control test created',
          );
          return;
        }

        const response = await request(app.getHttpServer())
          .get(`/grc/control-tests/${createdControlTestId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id', createdControlTestId);
        expect(data).toHaveProperty('name', 'Test Control Test - E2E');
      });

      it('should return 404 for non-existent control test', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/control-tests/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(404);
      });
    });

    describe('PATCH /grc/control-tests/:id', () => {
      it('should update an existing control test', async () => {
        if (!dbConnected || !tenantId || !createdControlTestId) {
          console.log(
            'Skipping test: database not connected or no control test created',
          );
          return;
        }

        const updateData = {
          name: 'Test Control Test - E2E Updated',
          description: 'Updated description',
        };

        const response = await request(app.getHttpServer())
          .patch(`/grc/control-tests/${createdControlTestId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(updateData)
          .expect(200);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id', createdControlTestId);
        expect(data).toHaveProperty('name', updateData.name);
      });
    });

    describe('GET /grc/controls/:controlId/tests (nested endpoint)', () => {
      it('should return tests for a specific control', async () => {
        if (!dbConnected || !tenantId || !testControlId) {
          console.log(
            'Skipping test: database not connected or no control created',
          );
          return;
        }

        const response = await request(app.getHttpServer())
          .get(`/grc/controls/${testControlId}/tests`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('items');
        expect(Array.isArray(response.body.data.items)).toBe(true);
      });
    });

    describe('DELETE /grc/control-tests/:id', () => {
      it('should soft delete a control test', async () => {
        if (!dbConnected || !tenantId || !createdControlTestId) {
          console.log(
            'Skipping test: database not connected or no control test created',
          );
          return;
        }

        await request(app.getHttpServer())
          .delete(`/grc/control-tests/${createdControlTestId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(204);
      });

      it('should not return deleted control test in list', async () => {
        if (!dbConnected || !tenantId || !createdControlTestId) {
          console.log(
            'Skipping test: database not connected or no control test created',
          );
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/control-tests')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const items =
          response.body.data?.items ?? response.body.data ?? response.body;
        const deletedControlTest = items.find(
          (ct: { id: string }) => ct.id === createdControlTestId,
        );
        expect(deletedControlTest).toBeUndefined();
      });
    });

    // Cleanup
    afterAll(async () => {
      if (!dbConnected || !tenantId || !testControlId) return;

      await request(app.getHttpServer())
        .delete(`/grc/controls/${testControlId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);
    });
  });

  // ==================== TEST RESULTS ====================
  describe('GRC Test Results', () => {
    let createdTestResultId: string;
    let testControlId: string;
    let testControlTestId: string;

    // First create a control and control test to link results to
    beforeAll(async () => {
      if (!dbConnected || !tenantId) return;

      // Create control
      const controlResponse = await request(app.getHttpServer())
        .post('/grc/controls')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          name: 'Test Control for Test Results - E2E',
          code: 'CTL-E2E-TR-001',
          description: 'A test control for test result e2e tests',
          status: 'IMPLEMENTED',
        });

      const controlData = controlResponse.body.data ?? controlResponse.body;
      testControlId = controlData?.id;

      if (!testControlId) return;

      // Create control test
      const controlTestResponse = await request(app.getHttpServer())
        .post('/grc/control-tests')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          controlId: testControlId,
          name: 'Test Control Test for Results - E2E',
          description: 'A test control test for test result e2e tests',
          testType: 'DESIGN',
          status: 'IN_PROGRESS',
        });

      const controlTestData =
        controlTestResponse.body.data ?? controlTestResponse.body;
      testControlTestId = controlTestData?.id;
    });

    describe('GET /grc/test-results', () => {
      it('should return list of test results with valid auth', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/test-results')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('items');
        expect(Array.isArray(response.body.data.items)).toBe(true);
      });

      it('should return 401 without token', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/test-results')
          .set('x-tenant-id', tenantId)
          .expect(401);
      });
    });

    describe('POST /grc/test-results', () => {
      it('should create a new test result with valid data', async () => {
        if (!dbConnected || !tenantId || !testControlTestId) {
          console.log(
            'Skipping test: database not connected or no control test created',
          );
          return;
        }

        const newTestResult = {
          controlTestId: testControlTestId,
          name: 'Test Result - E2E',
          result: 'PASS',
          effectivenessRating: 'EFFECTIVE',
          resultDetails: 'Test passed successfully',
        };

        const response = await request(app.getHttpServer())
          .post('/grc/test-results')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(newTestResult)
          .expect(201);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('name', newTestResult.name);
        expect(data).toHaveProperty('tenantId', tenantId);
        expect(data).toHaveProperty('controlTestId', testControlTestId);

        createdTestResultId = data.id;
      });

      it('should return 400 without required controlTestId field', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const invalidTestResult = {
          name: 'Missing controlTestId',
          result: 'PASS',
        };

        await request(app.getHttpServer())
          .post('/grc/test-results')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(invalidTestResult)
          .expect(400);
      });
    });

    describe('GET /grc/test-results/:id', () => {
      it('should return a specific test result by ID', async () => {
        if (!dbConnected || !tenantId || !createdTestResultId) {
          console.log(
            'Skipping test: database not connected or no test result created',
          );
          return;
        }

        const response = await request(app.getHttpServer())
          .get(`/grc/test-results/${createdTestResultId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id', createdTestResultId);
        expect(data).toHaveProperty('name', 'Test Result - E2E');
      });

      it('should return 404 for non-existent test result', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/test-results/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(404);
      });
    });

    describe('PATCH /grc/test-results/:id', () => {
      it('should update an existing test result', async () => {
        if (!dbConnected || !tenantId || !createdTestResultId) {
          console.log(
            'Skipping test: database not connected or no test result created',
          );
          return;
        }

        const updateData = {
          name: 'Test Result - E2E Updated',
          resultDetails: 'Updated test details',
        };

        const response = await request(app.getHttpServer())
          .patch(`/grc/test-results/${createdTestResultId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(updateData)
          .expect(200);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id', createdTestResultId);
        expect(data).toHaveProperty('name', updateData.name);
      });
    });

    describe('GET /grc/control-tests/:testId/results (nested endpoint)', () => {
      it('should return results for a specific control test', async () => {
        if (!dbConnected || !tenantId || !testControlTestId) {
          console.log(
            'Skipping test: database not connected or no control test created',
          );
          return;
        }

        const response = await request(app.getHttpServer())
          .get(`/grc/control-tests/${testControlTestId}/results`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('items');
        expect(Array.isArray(response.body.data.items)).toBe(true);
      });
    });

    describe('DELETE /grc/test-results/:id', () => {
      it('should soft delete a test result', async () => {
        if (!dbConnected || !tenantId || !createdTestResultId) {
          console.log(
            'Skipping test: database not connected or no test result created',
          );
          return;
        }

        await request(app.getHttpServer())
          .delete(`/grc/test-results/${createdTestResultId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(204);
      });

      it('should not return deleted test result in list', async () => {
        if (!dbConnected || !tenantId || !createdTestResultId) {
          console.log(
            'Skipping test: database not connected or no test result created',
          );
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/test-results')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const items =
          response.body.data?.items ?? response.body.data ?? response.body;
        const deletedTestResult = items.find(
          (tr: { id: string }) => tr.id === createdTestResultId,
        );
        expect(deletedTestResult).toBeUndefined();
      });
    });

    // Cleanup
    afterAll(async () => {
      if (!dbConnected || !tenantId) return;

      if (testControlTestId) {
        await request(app.getHttpServer())
          .delete(`/grc/control-tests/${testControlTestId}`)
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
  });
});
