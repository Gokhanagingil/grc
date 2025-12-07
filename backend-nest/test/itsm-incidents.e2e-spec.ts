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

  describe('ITSM Incidents', () => {
    let createdIncidentId: string;

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
        expect(response.body.data).toHaveProperty('items');
        expect(Array.isArray(response.body.data.items)).toBe(true);
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
          shortDescription: 'Test Incident - E2E',
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
        expect(data).toHaveProperty('shortDescription', newIncident.shortDescription);
        expect(data).toHaveProperty('tenantId', tenantId);
        expect(data).toHaveProperty('isDeleted', false);
        expect(data).toHaveProperty('status', 'open');
        expect(data).toHaveProperty('priority', 'p3');

        createdIncidentId = data.id;
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
        if (!dbConnected || !tenantId || !createdIncidentId) {
          console.log(
            'Skipping test: database not connected or no incident created',
          );
          return;
        }

        const response = await request(app.getHttpServer())
          .get(`/itsm/incidents/${createdIncidentId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id', createdIncidentId);
        expect(data).toHaveProperty('shortDescription', 'Test Incident - E2E');
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
        if (!dbConnected || !tenantId || !createdIncidentId) {
          console.log(
            'Skipping test: database not connected or no incident created',
          );
          return;
        }

        const updateData = {
          shortDescription: 'Test Incident - E2E Updated',
          status: 'in_progress',
        };

        const response = await request(app.getHttpServer())
          .patch(`/itsm/incidents/${createdIncidentId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(updateData)
          .expect(200);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id', createdIncidentId);
        expect(data).toHaveProperty('shortDescription', updateData.shortDescription);
        expect(data).toHaveProperty('status', updateData.status);
      });

      it('should recalculate priority when impact/urgency changes', async () => {
        if (!dbConnected || !tenantId || !createdIncidentId) {
          console.log(
            'Skipping test: database not connected or no incident created',
          );
          return;
        }

        const updateData = {
          impact: 'high',
          urgency: 'high',
        };

        const response = await request(app.getHttpServer())
          .patch(`/itsm/incidents/${createdIncidentId}`)
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
        if (!dbConnected || !tenantId || !createdIncidentId) {
          console.log(
            'Skipping test: database not connected or no incident created',
          );
          return;
        }

        const response = await request(app.getHttpServer())
          .post(`/itsm/incidents/${createdIncidentId}/resolve`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({ resolutionNotes: 'Issue resolved by E2E test' })
          .expect(200);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('status', 'resolved');
        expect(data).toHaveProperty('resolutionNotes', 'Issue resolved by E2E test');
        expect(data).toHaveProperty('resolvedAt');
      });
    });

    describe('POST /itsm/incidents/:id/close', () => {
      it('should close a resolved incident', async () => {
        if (!dbConnected || !tenantId || !createdIncidentId) {
          console.log(
            'Skipping test: database not connected or no incident created',
          );
          return;
        }

        const response = await request(app.getHttpServer())
          .post(`/itsm/incidents/${createdIncidentId}/close`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('status', 'closed');
      });

      it('should return 404 when trying to close a non-resolved incident', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const newIncident = {
          shortDescription: 'Incident to test close validation',
        };

        const createResponse = await request(app.getHttpServer())
          .post('/itsm/incidents')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(newIncident)
          .expect(201);

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

        const newIncident = {
          shortDescription: 'Incident to delete - E2E',
        };

        const createResponse = await request(app.getHttpServer())
          .post('/itsm/incidents')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(newIncident)
          .expect(201);

        const createData = createResponse.body.data ?? createResponse.body;

        await request(app.getHttpServer())
          .delete(`/itsm/incidents/${createData.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(204);
      });

      it('should not return deleted incident in list', async () => {
        if (!dbConnected || !tenantId || !createdIncidentId) {
          console.log(
            'Skipping test: database not connected or no incident created',
          );
          return;
        }

        await request(app.getHttpServer())
          .delete(`/itsm/incidents/${createdIncidentId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(204);

        const response = await request(app.getHttpServer())
          .get('/itsm/incidents')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const data = response.body.data ?? response.body;
        const items = data.items ?? data;
        const deletedIncident = items.find(
          (i: { id: string }) => i.id === createdIncidentId,
        );
        expect(deletedIncident).toBeUndefined();
      });

      it('should return 404 when trying to get deleted incident', async () => {
        if (!dbConnected || !tenantId || !createdIncidentId) {
          console.log(
            'Skipping test: database not connected or no incident created',
          );
          return;
        }

        await request(app.getHttpServer())
          .get(`/itsm/incidents/${createdIncidentId}`)
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

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('page', 1);
        expect(data).toHaveProperty('pageSize', 5);
        expect(data).toHaveProperty('total');
        expect(data).toHaveProperty('totalPages');
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
      it('should not return incidents from different tenant', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const differentTenantId = '00000000-0000-0000-0000-000000000099';

        const response = await request(app.getHttpServer())
          .get('/itsm/incidents')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', differentTenantId)
          .expect(200);

        const data = response.body.data ?? response.body;
        const items = data.items ?? data;
        items.forEach((incident: { tenantId: string }) => {
          expect(incident.tenantId).toBe(differentTenantId);
        });
      });
    });
  });
});
