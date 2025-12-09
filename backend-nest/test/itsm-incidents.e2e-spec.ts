import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('ITSM Incidents CRUD Operations (e2e)', () => {
  let app: INestApplication<App>;
  let dbConnected = false;
  let adminToken: string;
  let tenantId: string;
  let seedIncidentId: string;

  const DEMO_ADMIN_EMAIL =
    process.env.DEMO_ADMIN_EMAIL || 'admin@grc-platform.local';
  const DEMO_ADMIN_PASSWORD =
    process.env.DEMO_ADMIN_PASSWORD || 'TestPassword123!';

  // Helper function to create an incident
  const createIncident = async (data: {
    shortDescription: string;
    description?: string;
    category?: string;
    impact?: string;
    urgency?: string;
    source?: string;
    assignmentGroup?: string;
  }) => {
    const response = await request(app.getHttpServer())
      .post('/itsm/incidents')
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

      // Create a seed incident for tests that need existing data
      if (adminToken && tenantId) {
        const seedResponse = await createIncident({
          shortDescription: 'Seed Incident for E2E Tests',
          description: 'This incident is created as seed data for E2E tests',
          category: 'software',
          impact: 'medium',
          urgency: 'medium',
          source: 'user',
          assignmentGroup: 'IT Support',
        });

        if (seedResponse.status === 201) {
          const seedData = seedResponse.body.data ?? seedResponse.body;
          seedIncidentId = seedData.id;
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

  describe('ITSM Incidents', () => {
    describe('GET /itsm/incidents', () => {
      it('should return list of incidents with valid auth', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/itsm/incidents')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        // Response format: { success: true, data: [...], meta: { page, pageSize, total, totalPages } }
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      it('should return 401 without token', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/itsm/incidents')
          .set('x-tenant-id', tenantId)
          .expect(401);
      });

      it('should return 400 without x-tenant-id header', async () => {
        if (!dbConnected) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/itsm/incidents')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);
      });
    });

    describe('POST /itsm/incidents', () => {
      it('should create a new incident with valid data', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const newIncident = {
          shortDescription: 'Test Incident - E2E Create',
          description: 'A test incident created by e2e tests',
          category: 'software',
          impact: 'medium',
          urgency: 'medium',
          source: 'user',
          assignmentGroup: 'IT Support',
        };

        const response = await request(app.getHttpServer())
          .post('/itsm/incidents')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(newIncident)
          .expect(201);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('number');
        expect(data.number).toMatch(/^INC\d{6}$/);
        expect(data).toHaveProperty(
          'shortDescription',
          newIncident.shortDescription,
        );
        expect(data).toHaveProperty('tenantId', tenantId);
        expect(data).toHaveProperty('isDeleted', false);
        expect(data).toHaveProperty('status', 'open');
        expect(data).toHaveProperty('priority', 'p3');
      });

      it('should return 400 without required shortDescription field', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const invalidIncident = {
          description: 'Missing short description',
        };

        await request(app.getHttpServer())
          .post('/itsm/incidents')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(invalidIncident)
          .expect(400);
      });

      it('should calculate priority based on impact and urgency', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const highPriorityIncident = {
          shortDescription: 'High Priority Incident - E2E',
          impact: 'high',
          urgency: 'high',
        };

        const response = await request(app.getHttpServer())
          .post('/itsm/incidents')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(highPriorityIncident)
          .expect(201);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('priority', 'p1');
      });
    });

    describe('GET /itsm/incidents/:id', () => {
      it('should return a specific incident by ID', async () => {
        if (!dbConnected || !tenantId || !seedIncidentId) {
          console.log(
            'Skipping test: database not connected or no seed incident',
          );
          return;
        }

        const response = await request(app.getHttpServer())
          .get(`/itsm/incidents/${seedIncidentId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id', seedIncidentId);
        expect(data).toHaveProperty(
          'shortDescription',
          'Seed Incident for E2E Tests',
        );
      });

      it('should return 404 for non-existent incident', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/itsm/incidents/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(404);
      });
    });

    describe('PATCH /itsm/incidents/:id', () => {
      it('should update an existing incident', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        // Create a new incident for this test
        const createResponse = await createIncident({
          shortDescription: 'Incident to Update - E2E',
        });
        expect(createResponse.status).toBe(201);
        const createData = createResponse.body.data ?? createResponse.body;
        const incidentId = createData.id;

        const updateData = {
          shortDescription: 'Incident Updated - E2E',
          status: 'in_progress',
        };

        const response = await request(app.getHttpServer())
          .patch(`/itsm/incidents/${incidentId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(updateData)
          .expect(200);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id', incidentId);
        expect(data).toHaveProperty(
          'shortDescription',
          updateData.shortDescription,
        );
        expect(data).toHaveProperty('status', updateData.status);
      });

      it('should recalculate priority when impact/urgency changes', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        // Create a new incident for this test
        const createResponse = await createIncident({
          shortDescription: 'Incident for Priority Recalc - E2E',
          impact: 'low',
          urgency: 'low',
        });
        expect(createResponse.status).toBe(201);
        const createData = createResponse.body.data ?? createResponse.body;
        const incidentId = createData.id;

        const updateData = {
          impact: 'high',
          urgency: 'high',
        };

        const response = await request(app.getHttpServer())
          .patch(`/itsm/incidents/${incidentId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(updateData)
          .expect(200);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('priority', 'p1');
      });

      it('should return 404 for non-existent incident', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .patch('/itsm/incidents/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({ shortDescription: 'Updated' })
          .expect(404);
      });
    });

    describe('POST /itsm/incidents/:id/resolve', () => {
      it('should resolve an incident', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        // Create a new incident for this test
        const createResponse = await createIncident({
          shortDescription: 'Incident to Resolve - E2E',
        });
        expect(createResponse.status).toBe(201);
        const createData = createResponse.body.data ?? createResponse.body;
        const incidentId = createData.id;

        // POST endpoints return 201 by default in NestJS
        const response = await request(app.getHttpServer())
          .post(`/itsm/incidents/${incidentId}/resolve`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({ resolutionNotes: 'Issue resolved by E2E test' })
          .expect(201);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('status', 'resolved');
        expect(data).toHaveProperty(
          'resolutionNotes',
          'Issue resolved by E2E test',
        );
        expect(data).toHaveProperty('resolvedAt');
      });
    });

    describe('POST /itsm/incidents/:id/close', () => {
      it('should close a resolved incident', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        // Create a new incident for this test
        const createResponse = await createIncident({
          shortDescription: 'Incident to Close - E2E',
        });
        expect(createResponse.status).toBe(201);
        const createData = createResponse.body.data ?? createResponse.body;
        const incidentId = createData.id;

        // First resolve the incident (POST returns 201 by default)
        await request(app.getHttpServer())
          .post(`/itsm/incidents/${incidentId}/resolve`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({ resolutionNotes: 'Resolved for close test' })
          .expect(201);

        // Then close it (POST returns 201 by default)
        const response = await request(app.getHttpServer())
          .post(`/itsm/incidents/${incidentId}/close`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(201);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('status', 'closed');
      });

      it('should return 404 when trying to close a non-resolved incident', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        // Create a new incident for this test
        const createResponse = await createIncident({
          shortDescription: 'Incident to test close validation - E2E',
        });
        expect(createResponse.status).toBe(201);
        const createData = createResponse.body.data ?? createResponse.body;

        await request(app.getHttpServer())
          .post(`/itsm/incidents/${createData.id}/close`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(404);
      });
    });

    describe('DELETE /itsm/incidents/:id', () => {
      it('should soft delete an incident', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        // Create a new incident for this test
        const createResponse = await createIncident({
          shortDescription: 'Incident to delete - E2E',
        });
        expect(createResponse.status).toBe(201);
        const createData = createResponse.body.data ?? createResponse.body;

        await request(app.getHttpServer())
          .delete(`/itsm/incidents/${createData.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(204);
      });

      it('should not return deleted incident in list', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        // Create a new incident for this test
        const createResponse = await createIncident({
          shortDescription: 'Incident to delete and verify - E2E',
        });
        expect(createResponse.status).toBe(201);
        const createData = createResponse.body.data ?? createResponse.body;
        const incidentId = createData.id;

        // Delete the incident
        await request(app.getHttpServer())
          .delete(`/itsm/incidents/${incidentId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(204);

        // Verify it's not in the list
        const response = await request(app.getHttpServer())
          .get('/itsm/incidents')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const data = response.body.data ?? response.body;
        const items = data.items ?? data;
        const deletedIncident = items.find(
          (i: { id: string }) => i.id === incidentId,
        );
        expect(deletedIncident).toBeUndefined();
      });

      it('should return 404 when trying to get deleted incident', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        // Create a new incident for this test
        const createResponse = await createIncident({
          shortDescription: 'Incident to delete and get - E2E',
        });
        expect(createResponse.status).toBe(201);
        const createData = createResponse.body.data ?? createResponse.body;
        const incidentId = createData.id;

        // Delete the incident
        await request(app.getHttpServer())
          .delete(`/itsm/incidents/${incidentId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(204);

        // Try to get the deleted incident
        await request(app.getHttpServer())
          .get(`/itsm/incidents/${incidentId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(404);
      });
    });

    describe('GET /itsm/incidents/statistics', () => {
      it('should return incident statistics', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/itsm/incidents/statistics')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('total');
        expect(data).toHaveProperty('byStatus');
        expect(data).toHaveProperty('byPriority');
        expect(data).toHaveProperty('byCategory');
      });
    });

    describe('Filtering and Pagination', () => {
      it('should filter incidents by status', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/itsm/incidents?status=open')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const data = response.body.data ?? response.body;
        const items = data.items ?? data;
        items.forEach((incident: { status: string }) => {
          expect(incident.status).toBe('open');
        });
      });

      it('should filter incidents by priority', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/itsm/incidents?priority=p1')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const data = response.body.data ?? response.body;
        const items = data.items ?? data;
        items.forEach((incident: { priority: string }) => {
          expect(incident.priority).toBe('p1');
        });
      });

      it('should support pagination', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/itsm/incidents?page=1&pageSize=5')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Pagination info is in response.body.meta, not data
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('meta');
        expect(response.body.meta).toHaveProperty('page', 1);
        expect(response.body.meta).toHaveProperty('pageSize', 5);
        expect(response.body.meta).toHaveProperty('total');
        expect(response.body.meta).toHaveProperty('totalPages');
      });

      it('should support search', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/itsm/incidents?search=E2E')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);
      });
    });

    describe('Tenant Isolation', () => {
      it('should reject access for different tenant', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        // Use a different tenant ID that the user doesn't have access to
        const differentTenantId = '00000000-0000-0000-0000-000000000099';

        // TenantGuard should reject requests for tenants the user doesn't belong to
        await request(app.getHttpServer())
          .get('/itsm/incidents')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', differentTenantId)
          .expect(403);
      });
    });
  });
});
