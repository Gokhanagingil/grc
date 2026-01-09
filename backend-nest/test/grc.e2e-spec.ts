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
});
