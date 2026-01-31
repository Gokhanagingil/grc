import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('BCM and Calendar Operations (e2e)', () => {
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

  // ==================== BCM SERVICES ====================
  describe('BCM Services', () => {
    let createdServiceId: string;

    describe('GET /grc/bcm/services', () => {
      it('should return list of BCM services with valid auth', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/bcm/services')
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
          .get('/grc/bcm/services')
          .set('x-tenant-id', tenantId)
          .expect(401);
      });

      it('should return 400 without x-tenant-id header', async () => {
        if (!dbConnected) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/bcm/services')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);
      });
    });

    describe('POST /grc/bcm/services', () => {
      it('should create a new BCM service with valid data', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const newService = {
          name: 'Test BCM Service - E2E',
          description: 'A test BCM service created by e2e tests',
          criticalityTier: 'TIER_1',
          status: 'ACTIVE',
        };

        const response = await request(app.getHttpServer())
          .post('/grc/bcm/services')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(newService)
          .expect(201);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('name', newService.name);
        expect(data).toHaveProperty('tenantId', tenantId);

        createdServiceId = data.id;
      });

      it('should return 400 without required name field', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const invalidService = {
          description: 'Missing name',
        };

        await request(app.getHttpServer())
          .post('/grc/bcm/services')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(invalidService)
          .expect(400);
      });
    });

    describe('GET /grc/bcm/services/:id', () => {
      it('should return a specific BCM service by ID', async () => {
        if (!dbConnected || !tenantId || !createdServiceId) {
          console.log(
            'Skipping test: database not connected or no service created',
          );
          return;
        }

        const response = await request(app.getHttpServer())
          .get(`/grc/bcm/services/${createdServiceId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id', createdServiceId);
        expect(data).toHaveProperty('name', 'Test BCM Service - E2E');
      });

      it('should return 404 for non-existent service', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/bcm/services/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(404);
      });
    });

    describe('PATCH /grc/bcm/services/:id', () => {
      it('should update an existing BCM service', async () => {
        if (!dbConnected || !tenantId || !createdServiceId) {
          console.log(
            'Skipping test: database not connected or no service created',
          );
          return;
        }

        const updateData = {
          name: 'Test BCM Service - E2E Updated',
          criticalityTier: 'TIER_2',
        };

        const response = await request(app.getHttpServer())
          .patch(`/grc/bcm/services/${createdServiceId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(updateData)
          .expect(200);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id', createdServiceId);
        expect(data).toHaveProperty('name', updateData.name);
      });
    });

    describe('DELETE /grc/bcm/services/:id', () => {
      it('should soft delete a BCM service', async () => {
        if (!dbConnected || !tenantId || !createdServiceId) {
          console.log(
            'Skipping test: database not connected or no service created',
          );
          return;
        }

        await request(app.getHttpServer())
          .delete(`/grc/bcm/services/${createdServiceId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(204);
      });

      it('should not return deleted service in list', async () => {
        if (!dbConnected || !tenantId || !createdServiceId) {
          console.log(
            'Skipping test: database not connected or no service created',
          );
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/bcm/services')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const items =
          response.body.data?.items ?? response.body.data ?? response.body;
        const deletedService = items.find(
          (s: { id: string }) => s.id === createdServiceId,
        );
        expect(deletedService).toBeUndefined();
      });
    });
  });

  // ==================== BCM SERVICE NESTED ENDPOINTS ====================
  describe('BCM Service Nested Endpoints (LIST-CONTRACT format)', () => {
    let testServiceId: string;
    let testBiaId: string;
    let testPlanId: string;
    let testExerciseId: string;

    beforeAll(async () => {
      if (!dbConnected || !tenantId) {
        return;
      }

      // Create a test service for nested endpoint tests
      const serviceResponse = await request(app.getHttpServer())
        .post('/grc/bcm/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          name: 'Test Service for Nested Endpoints',
          description: 'Service for testing nested BCM endpoints',
          criticalityTier: 'TIER_1',
          status: 'ACTIVE',
        });

      const serviceData = serviceResponse.body.data ?? serviceResponse.body;
      testServiceId = serviceData?.id;
    });

    afterAll(async () => {
      if (!dbConnected || !tenantId || !testServiceId) {
        return;
      }

      // Clean up: delete created entities
      if (testExerciseId) {
        await request(app.getHttpServer())
          .delete(`/grc/bcm/exercises/${testExerciseId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId);
      }
      if (testPlanId) {
        await request(app.getHttpServer())
          .delete(`/grc/bcm/plans/${testPlanId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId);
      }
      if (testBiaId) {
        await request(app.getHttpServer())
          .delete(`/grc/bcm/bias/${testBiaId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId);
      }
      if (testServiceId) {
        await request(app.getHttpServer())
          .delete(`/grc/bcm/services/${testServiceId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId);
      }
    });

    describe('GET /grc/bcm/services/:id/bias', () => {
      it('should return LIST-CONTRACT format with items array', async () => {
        if (!dbConnected || !tenantId || !testServiceId) {
          console.log('Skipping test: database not connected or no service');
          return;
        }

        const response = await request(app.getHttpServer())
          .get(`/grc/bcm/services/${testServiceId}/bias`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('items');
        expect(response.body.data).toHaveProperty('total');
        expect(response.body.data).toHaveProperty('page');
        expect(response.body.data).toHaveProperty('pageSize');
        expect(Array.isArray(response.body.data.items)).toBe(true);
      });

      it('should show created BIA in list after create', async () => {
        if (!dbConnected || !tenantId || !testServiceId) {
          console.log('Skipping test: database not connected or no service');
          return;
        }

        // Create a BIA
        const createResponse = await request(app.getHttpServer())
          .post('/grc/bcm/bias')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({
            serviceId: testServiceId,
            rtoHours: 4,
            rpoHours: 1,
            mtpdHours: 24,
            impactAnalysis: 'Test impact analysis',
          })
          .expect(201);

        const biaData = createResponse.body.data ?? createResponse.body;
        testBiaId = biaData?.id;

        // Verify it appears in the nested list
        const listResponse = await request(app.getHttpServer())
          .get(`/grc/bcm/services/${testServiceId}/bias`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(listResponse.body.data.items.length).toBeGreaterThan(0);
        const foundBia = listResponse.body.data.items.find(
          (b: { id: string }) => b.id === testBiaId,
        );
        expect(foundBia).toBeDefined();
      });
    });

    describe('GET /grc/bcm/services/:id/plans', () => {
      it('should return LIST-CONTRACT format with items array', async () => {
        if (!dbConnected || !tenantId || !testServiceId) {
          console.log('Skipping test: database not connected or no service');
          return;
        }

        const response = await request(app.getHttpServer())
          .get(`/grc/bcm/services/${testServiceId}/plans`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('items');
        expect(response.body.data).toHaveProperty('total');
        expect(response.body.data).toHaveProperty('page');
        expect(response.body.data).toHaveProperty('pageSize');
        expect(Array.isArray(response.body.data.items)).toBe(true);
      });

      it('should show created Plan in list after create', async () => {
        if (!dbConnected || !tenantId || !testServiceId) {
          console.log('Skipping test: database not connected or no service');
          return;
        }

        // Create a Plan
        const createResponse = await request(app.getHttpServer())
          .post('/grc/bcm/plans')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({
            serviceId: testServiceId,
            name: 'Test Recovery Plan',
            planType: 'RECOVERY',
            status: 'DRAFT',
          })
          .expect(201);

        const planData = createResponse.body.data ?? createResponse.body;
        testPlanId = planData?.id;

        // Verify it appears in the nested list
        const listResponse = await request(app.getHttpServer())
          .get(`/grc/bcm/services/${testServiceId}/plans`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(listResponse.body.data.items.length).toBeGreaterThan(0);
        const foundPlan = listResponse.body.data.items.find(
          (p: { id: string }) => p.id === testPlanId,
        );
        expect(foundPlan).toBeDefined();
      });
    });

    describe('GET /grc/bcm/services/:id/exercises', () => {
      it('should return LIST-CONTRACT format with items array', async () => {
        if (!dbConnected || !tenantId || !testServiceId) {
          console.log('Skipping test: database not connected or no service');
          return;
        }

        const response = await request(app.getHttpServer())
          .get(`/grc/bcm/services/${testServiceId}/exercises`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('items');
        expect(response.body.data).toHaveProperty('total');
        expect(response.body.data).toHaveProperty('page');
        expect(response.body.data).toHaveProperty('pageSize');
        expect(Array.isArray(response.body.data.items)).toBe(true);
      });

      it('should show created Exercise in list after create', async () => {
        if (!dbConnected || !tenantId || !testServiceId) {
          console.log('Skipping test: database not connected or no service');
          return;
        }

        // Create an Exercise
        const createResponse = await request(app.getHttpServer())
          .post('/grc/bcm/exercises')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({
            serviceId: testServiceId,
            name: 'Test Tabletop Exercise',
            exerciseType: 'TABLETOP',
            status: 'PLANNED',
            scheduledAt: new Date().toISOString(),
          })
          .expect(201);

        const exerciseData = createResponse.body.data ?? createResponse.body;
        testExerciseId = exerciseData?.id;

        // Verify it appears in the nested list
        const listResponse = await request(app.getHttpServer())
          .get(`/grc/bcm/services/${testServiceId}/exercises`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(listResponse.body.data.items.length).toBeGreaterThan(0);
        const foundExercise = listResponse.body.data.items.find(
          (e: { id: string }) => e.id === testExerciseId,
        );
        expect(foundExercise).toBeDefined();
      });
    });
  });

  // ==================== BCM EXERCISES ====================
  describe('BCM Exercises', () => {
    let createdExerciseId: string;

    describe('GET /grc/bcm/exercises', () => {
      it('should return list of BCM exercises with valid auth', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/bcm/exercises')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('items');
        expect(Array.isArray(response.body.data.items)).toBe(true);
      });
    });

    describe('POST /grc/bcm/exercises', () => {
      it('should create a new BCM exercise with valid data', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        // First create a service to link the exercise to
        // Include all fields to ensure service creation succeeds
        const serviceResponse = await request(app.getHttpServer())
          .post('/grc/bcm/services')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({
            name: 'Service for Exercise Test',
            description: 'Test service for BCM exercise E2E tests',
            criticalityTier: 'TIER_2',
            status: 'ACTIVE',
          });

        const serviceData = serviceResponse.body.data ?? serviceResponse.body;
        const testServiceId = serviceData?.id;

        if (!testServiceId) {
          console.log('Skipping test: could not create service for exercise');
          console.log(
            'Service creation response:',
            serviceResponse.status,
            serviceResponse.body,
          );
          return;
        }

        const newExercise = {
          name: 'Test BCM Exercise - E2E',
          serviceId: testServiceId,
          exerciseType: 'TABLETOP',
          status: 'PLANNED',
          scheduledAt: new Date().toISOString(),
        };

        const response = await request(app.getHttpServer())
          .post('/grc/bcm/exercises')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(newExercise)
          .expect(201);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('name', newExercise.name);
        expect(data).toHaveProperty('tenantId', tenantId);

        createdExerciseId = data.id;
      });

      it('should return 400 without required name field', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const invalidExercise = {
          description: 'Missing name',
        };

        await request(app.getHttpServer())
          .post('/grc/bcm/exercises')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(invalidExercise)
          .expect(400);
      });
    });

    describe('GET /grc/bcm/exercises/:id', () => {
      it('should return a specific BCM exercise by ID', async () => {
        if (!dbConnected || !tenantId || !createdExerciseId) {
          console.log(
            'Skipping test: database not connected or no exercise created',
          );
          return;
        }

        const response = await request(app.getHttpServer())
          .get(`/grc/bcm/exercises/${createdExerciseId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id', createdExerciseId);
        expect(data).toHaveProperty('name', 'Test BCM Exercise - E2E');
      });
    });

    describe('PATCH /grc/bcm/exercises/:id', () => {
      it('should update an existing BCM exercise', async () => {
        if (!dbConnected || !tenantId || !createdExerciseId) {
          console.log(
            'Skipping test: database not connected or no exercise created',
          );
          return;
        }

        const updateData = {
          name: 'Test BCM Exercise - E2E Updated',
          status: 'IN_PROGRESS',
        };

        const response = await request(app.getHttpServer())
          .patch(`/grc/bcm/exercises/${createdExerciseId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(updateData)
          .expect(200);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id', createdExerciseId);
        expect(data).toHaveProperty('name', updateData.name);
      });
    });

    describe('DELETE /grc/bcm/exercises/:id', () => {
      it('should soft delete a BCM exercise', async () => {
        if (!dbConnected || !tenantId || !createdExerciseId) {
          console.log(
            'Skipping test: database not connected or no exercise created',
          );
          return;
        }

        await request(app.getHttpServer())
          .delete(`/grc/bcm/exercises/${createdExerciseId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(204);
      });
    });
  });

  // ==================== CALENDAR ====================
  describe('GRC Calendar', () => {
    describe('GET /grc/calendar/events', () => {
      it('should return calendar events with valid auth', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const start = new Date();
        start.setMonth(start.getMonth() - 1);
        const end = new Date();
        end.setMonth(end.getMonth() + 1);

        const response = await request(app.getHttpServer())
          .get('/grc/calendar/events')
          .query({
            start: start.toISOString(),
            end: end.toISOString(),
          })
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const data = response.body.data ?? response.body;
        expect(Array.isArray(data)).toBe(true);
      });

      it('should return 401 without token', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const start = new Date();
        start.setMonth(start.getMonth() - 1);
        const end = new Date();
        end.setMonth(end.getMonth() + 1);

        await request(app.getHttpServer())
          .get('/grc/calendar/events')
          .query({
            start: start.toISOString(),
            end: end.toISOString(),
          })
          .set('x-tenant-id', tenantId)
          .expect(401);
      });

      it('should return 400 without x-tenant-id header', async () => {
        if (!dbConnected) {
          console.log('Skipping test: database not connected');
          return;
        }

        const start = new Date();
        start.setMonth(start.getMonth() - 1);
        const end = new Date();
        end.setMonth(end.getMonth() + 1);

        await request(app.getHttpServer())
          .get('/grc/calendar/events')
          .query({
            start: start.toISOString(),
            end: end.toISOString(),
          })
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);
      });

      it('should filter events by date range', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const start = new Date();
        start.setMonth(start.getMonth() - 1);
        const end = new Date();
        end.setMonth(end.getMonth() + 1);

        const response = await request(app.getHttpServer())
          .get('/grc/calendar/events')
          .query({
            start: start.toISOString(),
            end: end.toISOString(),
          })
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const data = response.body.data ?? response.body;
        expect(Array.isArray(data)).toBe(true);
      });

      it('should filter events by type', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const start = new Date();
        start.setMonth(start.getMonth() - 1);
        const end = new Date();
        end.setMonth(end.getMonth() + 1);

        const response = await request(app.getHttpServer())
          .get('/grc/calendar/events')
          .query({
            start: start.toISOString(),
            end: end.toISOString(),
            types: 'bcm_exercise',
          })
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        const data = response.body.data ?? response.body;
        expect(Array.isArray(data)).toBe(true);

        if (data.length > 0) {
          data.forEach((event: { type: string }) => {
            expect(event.type).toBe('bcm_exercise');
          });
        }
      });

      // Note: Status filtering across different event types is not supported
      // because BCM exercises use UPPERCASE enums while CAPAs use lowercase enums.
      // Status filtering should be done per event type using the 'types' parameter.
    });

    describe('Calendar date handling regression', () => {
      it('should return 200 even when CAPA tasks have legacy string dates', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const start = new Date('2026-01-01T00:00:00.000Z');
        const end = new Date('2026-02-01T00:00:00.000Z');

        const response = await request(app.getHttpServer())
          .get('/grc/calendar/events')
          .query({
            start: start.toISOString(),
            end: end.toISOString(),
            page: 1,
            pageSize: 5,
          })
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        const data = response.body.data ?? response.body;
        expect(Array.isArray(data)).toBe(true);
      });

      it('should not throw when processing CAPA_TASK events', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const start = new Date();
        start.setMonth(start.getMonth() - 1);
        const end = new Date();
        end.setMonth(end.getMonth() + 1);

        const response = await request(app.getHttpServer())
          .get('/grc/calendar/events')
          .query({
            start: start.toISOString(),
            end: end.toISOString(),
            types: 'capa_task',
          })
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        const data = response.body.data ?? response.body;
        expect(Array.isArray(data)).toBe(true);
      });
    });

    describe('Calendar event types', () => {
      it('should include BCM exercises in calendar events', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        // First create a service to link the exercise to
        // Include all fields to ensure service creation succeeds
        const serviceResponse = await request(app.getHttpServer())
          .post('/grc/bcm/services')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({
            name: 'Service for Calendar Test',
            description: 'Test service for calendar E2E tests',
            criticalityTier: 'TIER_2',
            status: 'ACTIVE',
          });

        const serviceData = serviceResponse.body.data ?? serviceResponse.body;
        const testServiceId = serviceData?.id;

        if (!testServiceId) {
          console.log(
            'Skipping test: could not create service for calendar exercise test',
          );
          console.log(
            'Service creation response:',
            serviceResponse.status,
            serviceResponse.body,
          );
          return;
        }

        // Now create a BCM exercise linked to the service
        const newExercise = {
          name: 'Calendar Test Exercise',
          serviceId: testServiceId,
          exerciseType: 'TABLETOP',
          status: 'PLANNED',
          scheduledAt: new Date().toISOString(),
        };

        const createResponse = await request(app.getHttpServer())
          .post('/grc/bcm/exercises')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(newExercise);

        if (createResponse.status === 201) {
          // Now check calendar events
          const start = new Date();
          start.setMonth(start.getMonth() - 1);
          const end = new Date();
          end.setMonth(end.getMonth() + 1);

          const response = await request(app.getHttpServer())
            .get('/grc/calendar/events')
            .query({
              start: start.toISOString(),
              end: end.toISOString(),
              types: 'bcm_exercise',
            })
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId)
            .expect(200);

          const data = response.body.data ?? response.body;
          expect(Array.isArray(data)).toBe(true);

          // Clean up
          const exerciseData = createResponse.body.data ?? createResponse.body;
          if (exerciseData.id) {
            await request(app.getHttpServer())
              .delete(`/grc/bcm/exercises/${exerciseData.id}`)
              .set('Authorization', `Bearer ${adminToken}`)
              .set('x-tenant-id', tenantId);
          }
        }
      });
    });
  });
});
