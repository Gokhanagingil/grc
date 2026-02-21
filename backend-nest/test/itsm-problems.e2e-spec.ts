import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('ITSM Problems CRUD Operations (e2e)', () => {
  let app: INestApplication<App>;
  let dbConnected = false;
  let adminToken: string;
  let tenantId: string;
  let seedProblemId: string;

  const DEMO_ADMIN_EMAIL =
    process.env.DEMO_ADMIN_EMAIL || 'admin@grc-platform.local';
  const DEMO_ADMIN_PASSWORD =
    process.env.DEMO_ADMIN_PASSWORD || 'TestPassword123!';

  // Helper function to create a problem
  const createProblem = async (data: {
    shortDescription: string;
    description?: string;
    category?: string;
    impact?: string;
    urgency?: string;
    source?: string;
  }) => {
    const response = await request(app.getHttpServer())
      .post('/grc/itsm/problems')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-tenant-id', tenantId)
      .send(data);
    return response;
  };

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

      // Login to get token and tenant ID
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: DEMO_ADMIN_EMAIL,
          password: DEMO_ADMIN_PASSWORD,
        });

      const responseData = loginResponse.body.data ?? loginResponse.body;
      adminToken = responseData.accessToken;
      tenantId = responseData.user?.tenantId;

      // Create a seed problem for tests that need existing data
      if (adminToken && tenantId) {
        const seedResponse = await createProblem({
          shortDescription: 'Seed Problem for E2E Tests',
          description: 'This problem is created as seed data for E2E tests',
          category: 'SOFTWARE',
          impact: 'MEDIUM',
          urgency: 'MEDIUM',
          source: 'MANUAL',
        });

        if (seedResponse.status === 201) {
          const seedData = seedResponse.body.data ?? seedResponse.body;
          seedProblemId = seedData.id;
        }
      }
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

  describe('ITSM Problems', () => {
    // ========================================================================
    // List / Read
    // ========================================================================

    describe('GET /grc/itsm/problems', () => {
      it('should return list of problems with valid auth', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/itsm/problems')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(response.body).toHaveProperty('data');
        const data = response.body.data ?? response.body;
        const items = data.items ?? data;
        expect(Array.isArray(items)).toBe(true);
      });

      it('should return 401 without token', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/itsm/problems')
          .set('x-tenant-id', tenantId)
          .expect(401);
      });

      it('should return 400 without x-tenant-id header', async () => {
        if (!dbConnected) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/itsm/problems')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);
      });

      it('should support filtering by state', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/itsm/problems?state=NEW')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(response.body).toHaveProperty('data');
      });

      it('should support filtering by knownError', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/itsm/problems?knownError=false')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(response.body).toHaveProperty('data');
      });

      it('should support search', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/itsm/problems?search=Seed')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(response.body).toHaveProperty('data');
      });
    });

    // ========================================================================
    // Create
    // ========================================================================

    describe('POST /grc/itsm/problems', () => {
      it('should create a new problem with valid data', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const newProblem = {
          shortDescription: 'Test Problem - E2E Create',
          description: 'A test problem created by e2e tests',
          category: 'SOFTWARE',
          impact: 'MEDIUM',
          urgency: 'MEDIUM',
          source: 'MANUAL',
        };

        const response = await request(app.getHttpServer())
          .post('/grc/itsm/problems')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(newProblem)
          .expect(201);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('number');
        expect(data.number).toMatch(/^PRB\d{6}$/);
        expect(data).toHaveProperty(
          'shortDescription',
          newProblem.shortDescription,
        );
        expect(data).toHaveProperty('tenantId', tenantId);
        expect(data).toHaveProperty('isDeleted', false);
        expect(data).toHaveProperty('state', 'NEW');
        expect(data).toHaveProperty('priority', 'P3');
      });

      it('should return 400 without required shortDescription field', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const invalidProblem = {
          description: 'Missing short description',
        };

        await request(app.getHttpServer())
          .post('/grc/itsm/problems')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(invalidProblem)
          .expect(400);
      });

      it('should calculate priority based on impact and urgency', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const highPriorityProblem = {
          shortDescription: 'High Priority Problem - E2E',
          impact: 'HIGH',
          urgency: 'HIGH',
        };

        const response = await request(app.getHttpServer())
          .post('/grc/itsm/problems')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(highPriorityProblem)
          .expect(201);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('priority', 'P1');
      });
    });

    // ========================================================================
    // Detail
    // ========================================================================

    describe('GET /grc/itsm/problems/:id', () => {
      it('should return a specific problem by ID', async () => {
        if (!dbConnected || !tenantId || !seedProblemId) {
          console.log(
            'Skipping test: database not connected or no seed problem',
          );
          return;
        }

        const response = await request(app.getHttpServer())
          .get(`/grc/itsm/problems/${seedProblemId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id', seedProblemId);
        expect(data).toHaveProperty(
          'shortDescription',
          'Seed Problem for E2E Tests',
        );
      });

      it('should return 404 for non-existent problem', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/itsm/problems/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(404);
      });
    });

    // ========================================================================
    // Update
    // ========================================================================

    describe('PATCH /grc/itsm/problems/:id', () => {
      it('should update an existing problem', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        // Create a problem for this test
        const createResponse = await createProblem({
          shortDescription: 'Problem to Update - E2E',
        });
        expect(createResponse.status).toBe(201);
        const createData = createResponse.body.data ?? createResponse.body;
        const problemId = createData.id;

        const updateData = {
          shortDescription: 'Problem Updated - E2E',
          state: 'UNDER_INVESTIGATION',
        };

        const response = await request(app.getHttpServer())
          .patch(`/grc/itsm/problems/${problemId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(updateData)
          .expect(200);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id', problemId);
        expect(data).toHaveProperty(
          'shortDescription',
          updateData.shortDescription,
        );
        expect(data).toHaveProperty('state', updateData.state);
      });

      it('should recalculate priority when impact/urgency changes', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const createResponse = await createProblem({
          shortDescription: 'Problem for Priority Recalc - E2E',
          impact: 'LOW',
          urgency: 'LOW',
        });
        expect(createResponse.status).toBe(201);
        const createData = createResponse.body.data ?? createResponse.body;
        const problemId = createData.id;

        const updateData = {
          impact: 'HIGH',
          urgency: 'HIGH',
        };

        const response = await request(app.getHttpServer())
          .patch(`/grc/itsm/problems/${problemId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(updateData)
          .expect(200);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('priority', 'P1');
      });

      it('should return 404 for non-existent problem', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .patch('/grc/itsm/problems/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({ shortDescription: 'Updated' })
          .expect(404);
      });
    });

    // ========================================================================
    // Soft Delete
    // ========================================================================

    describe('DELETE /grc/itsm/problems/:id', () => {
      it('should soft delete a problem', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const createResponse = await createProblem({
          shortDescription: 'Problem to delete - E2E',
        });
        expect(createResponse.status).toBe(201);
        const createData = createResponse.body.data ?? createResponse.body;

        await request(app.getHttpServer())
          .delete(`/grc/itsm/problems/${createData.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(204);
      });

      it('should return 404 when getting a deleted problem', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const createResponse = await createProblem({
          shortDescription: 'Problem to delete and get - E2E',
        });
        expect(createResponse.status).toBe(201);
        const createData = createResponse.body.data ?? createResponse.body;
        const problemId = createData.id;

        await request(app.getHttpServer())
          .delete(`/grc/itsm/problems/${problemId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(204);

        await request(app.getHttpServer())
          .get(`/grc/itsm/problems/${problemId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(404);
      });
    });

    // ========================================================================
    // Known Error
    // ========================================================================

    describe('Known Error Operations', () => {
      it('should mark a problem as known error', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const createResponse = await createProblem({
          shortDescription: 'Problem for Known Error Test - E2E',
        });
        expect(createResponse.status).toBe(201);
        const createData = createResponse.body.data ?? createResponse.body;

        const response = await request(app.getHttpServer())
          .post(`/grc/itsm/problems/${createData.id}/mark-known-error`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(201);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('knownError', true);
        expect(data).toHaveProperty('state', 'KNOWN_ERROR');
      });

      it('should unmark a known error', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        // Create and mark as known error
        const createResponse = await createProblem({
          shortDescription: 'Problem for Unmark KE Test - E2E',
        });
        expect(createResponse.status).toBe(201);
        const createData = createResponse.body.data ?? createResponse.body;

        await request(app.getHttpServer())
          .post(`/grc/itsm/problems/${createData.id}/mark-known-error`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(201);

        // Unmark
        const response = await request(app.getHttpServer())
          .post(`/grc/itsm/problems/${createData.id}/unmark-known-error`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(201);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('knownError', false);
        expect(data).toHaveProperty('state', 'UNDER_INVESTIGATION');
      });
    });

    // ========================================================================
    // Statistics
    // ========================================================================

    describe('GET /grc/itsm/problems/statistics', () => {
      it('should return problem statistics', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/itsm/problems/statistics')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('total');
        expect(data).toHaveProperty('byState');
        expect(data).toHaveProperty('byPriority');
        expect(data).toHaveProperty('knownErrorCount');
      });
    });

    // ========================================================================
    // Summary
    // ========================================================================

    describe('GET /grc/itsm/problems/:id/summary', () => {
      it('should return rollup summary for a problem', async () => {
        if (!dbConnected || !tenantId || !seedProblemId) {
          console.log(
            'Skipping test: database not connected or no seed problem',
          );
          return;
        }

        const response = await request(app.getHttpServer())
          .get(`/grc/itsm/problems/${seedProblemId}/summary`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('incidentCount');
        expect(data).toHaveProperty('openIncidentCount');
        expect(data).toHaveProperty('changeCount');
        expect(data).toHaveProperty('permanentFixCount');
      });
    });

    // ========================================================================
    // RCA
    // ========================================================================

    describe('GET /grc/itsm/problems/:id/rca', () => {
      it('should return RCA entries for a problem', async () => {
        if (!dbConnected || !tenantId || !seedProblemId) {
          console.log(
            'Skipping test: database not connected or no seed problem',
          );
          return;
        }

        const response = await request(app.getHttpServer())
          .get(`/grc/itsm/problems/${seedProblemId}/rca`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('problemId', seedProblemId);
        expect(data).toHaveProperty('rcaEntries');
        expect(Array.isArray(data.rcaEntries)).toBe(true);
      });
    });

    // ========================================================================
    // Linked Incidents
    // ========================================================================

    describe('Incident Linking', () => {
      it('should list linked incidents (empty initially)', async () => {
        if (!dbConnected || !tenantId || !seedProblemId) {
          console.log(
            'Skipping test: database not connected or no seed problem',
          );
          return;
        }

        const response = await request(app.getHttpServer())
          .get(`/grc/itsm/problems/${seedProblemId}/incidents`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const data = response.body.data ?? response.body;
        expect(Array.isArray(data)).toBe(true);
      });
    });

    // ========================================================================
    // Linked Changes
    // ========================================================================

    describe('Change Linking', () => {
      it('should list linked changes (empty initially)', async () => {
        if (!dbConnected || !tenantId || !seedProblemId) {
          console.log(
            'Skipping test: database not connected or no seed problem',
          );
          return;
        }

        const response = await request(app.getHttpServer())
          .get(`/grc/itsm/problems/${seedProblemId}/changes`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const data = response.body.data ?? response.body;
        expect(Array.isArray(data)).toBe(true);
      });
    });
  });
});
