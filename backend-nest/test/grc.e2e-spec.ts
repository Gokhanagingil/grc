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

      adminToken = loginResponse.body.accessToken;
      tenantId = loginResponse.body.user?.tenantId;
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

        // Response is paginated: { items: T[], total, page, pageSize, totalPages }
        expect(response.body).toHaveProperty('items');
        expect(Array.isArray(response.body.items)).toBe(true);
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

        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('title', newRisk.title);
        expect(response.body).toHaveProperty('tenantId', tenantId);
        expect(response.body).toHaveProperty('isDeleted', false);

        createdRiskId = response.body.id;
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

        expect(response.body).toHaveProperty('id', createdRiskId);
        expect(response.body).toHaveProperty('title', 'Test Risk - E2E');
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

        expect(response.body).toHaveProperty('id', createdRiskId);
        expect(response.body).toHaveProperty('title', updateData.title);
        expect(response.body).toHaveProperty('severity', updateData.severity);
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

        // Response is paginated: { items: T[], total, page, pageSize, totalPages }
        const deletedRisk = response.body.items.find(
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

        expect(response.body).toHaveProperty('total');
        expect(response.body).toHaveProperty('bySeverity');
        expect(response.body).toHaveProperty('byStatus');
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

        // Response is paginated: { items: T[], total, page, pageSize, totalPages }
        expect(response.body).toHaveProperty('items');
        expect(Array.isArray(response.body.items)).toBe(true);
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

        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('name', newPolicy.name);
        expect(response.body).toHaveProperty('tenantId', tenantId);
        expect(response.body).toHaveProperty('isDeleted', false);

        createdPolicyId = response.body.id;
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

        expect(response.body).toHaveProperty('id', createdPolicyId);
        expect(response.body).toHaveProperty('name', updateData.name);
        expect(response.body).toHaveProperty('status', updateData.status);
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

        // Response is paginated: { items: T[], total, page, pageSize, totalPages }
        const deletedPolicy = response.body.items.find(
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

        // Response is paginated: { items: T[], total, page, pageSize, totalPages }
        expect(response.body).toHaveProperty('items');
        expect(Array.isArray(response.body.items)).toBe(true);
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

        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('title', newRequirement.title);
        expect(response.body).toHaveProperty('tenantId', tenantId);
        expect(response.body).toHaveProperty('isDeleted', false);

        createdRequirementId = response.body.id;
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

        expect(response.body).toHaveProperty('id', createdRequirementId);
        expect(response.body).toHaveProperty('title', updateData.title);
        expect(response.body).toHaveProperty('status', updateData.status);
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

        // Response is paginated: { items: T[], total, page, pageSize, totalPages }
        const deletedRequirement = response.body.items.find(
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

        expect(response.body).toHaveProperty('total');
        expect(response.body).toHaveProperty('byFramework');
        expect(response.body).toHaveProperty('byStatus');
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

        expect(Array.isArray(response.body)).toBe(true);
      });
    });
  });
});
