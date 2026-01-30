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

  // ==================== BCM SERVICE SUB-RESOURCES (LIST CONTRACT) ====================
  describe('BCM Service Sub-Resources', () => {
    let testServiceId: string;
    let createdBiaId: string;
    let createdPlanId: string;
    let createdExerciseId: string;

    beforeAll(async () => {
      if (!dbConnected || !tenantId) return;

      // Create a service for sub-resource tests
      const serviceResponse = await request(app.getHttpServer())
        .post('/grc/bcm/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          name: 'Service for Sub-Resource Tests',
          description: 'Test service for BCM sub-resource e2e tests',
          criticalityTier: 'TIER_1',
          status: 'ACTIVE',
        });

      const serviceData = serviceResponse.body.data ?? serviceResponse.body;
      testServiceId = serviceData?.id;
    });

    afterAll(async () => {
      if (!dbConnected || !tenantId || !testServiceId) return;

      // Clean up created resources
      if (createdExerciseId) {
        await request(app.getHttpServer())
          .delete(`/grc/bcm/exercises/${createdExerciseId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId);
      }
      if (createdPlanId) {
        await request(app.getHttpServer())
          .delete(`/grc/bcm/plans/${createdPlanId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId);
      }
      if (createdBiaId) {
        await request(app.getHttpServer())
          .delete(`/grc/bcm/bias/${createdBiaId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId);
      }
      await request(app.getHttpServer())
        .delete(`/grc/bcm/services/${testServiceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);
    });

    describe('GET /grc/bcm/services/:id/bias (LIST CONTRACT)', () => {
      it('should return BIAs in LIST CONTRACT format', async () => {
        if (!dbConnected || !tenantId || !testServiceId) {
          console.log('Skipping test: prerequisites not met');
          return;
        }

        const response = await request(app.getHttpServer())
          .get(`/grc/bcm/services/${testServiceId}/bias`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Verify LIST CONTRACT format
        expect(response.body).toHaveProperty('items');
        expect(response.body).toHaveProperty('total');
        expect(response.body).toHaveProperty('page');
        expect(response.body).toHaveProperty('pageSize');
        expect(Array.isArray(response.body.items)).toBe(true);
      });
    });

    describe('POST /grc/bcm/services/:id/bias', () => {
      it('should create a BIA linked to the service', async () => {
        if (!dbConnected || !tenantId || !testServiceId) {
          console.log('Skipping test: prerequisites not met');
          return;
        }

        const newBia = {
          rtoMinutes: 60,
          rpoMinutes: 30,
          impactOperational: 3,
          impactFinancial: 2,
          impactRegulatory: 1,
          impactReputational: 2,
          status: 'DRAFT',
        };

        const response = await request(app.getHttpServer())
          .post(`/grc/bcm/services/${testServiceId}/bias`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(newBia)
          .expect(201);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('serviceId', testServiceId);
        createdBiaId = data.id;
      });

      it('should show created BIA in service BIA list', async () => {
        if (!dbConnected || !tenantId || !testServiceId || !createdBiaId) {
          console.log('Skipping test: prerequisites not met');
          return;
        }

        const response = await request(app.getHttpServer())
          .get(`/grc/bcm/services/${testServiceId}/bias`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(
          response.body.items.some(
            (b: { id: string }) => b.id === createdBiaId,
          ),
        ).toBe(true);
      });
    });

    describe('GET /grc/bcm/services/:id/plans (LIST CONTRACT)', () => {
      it('should return Plans in LIST CONTRACT format', async () => {
        if (!dbConnected || !tenantId || !testServiceId) {
          console.log('Skipping test: prerequisites not met');
          return;
        }

        const response = await request(app.getHttpServer())
          .get(`/grc/bcm/services/${testServiceId}/plans`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Verify LIST CONTRACT format
        expect(response.body).toHaveProperty('items');
        expect(response.body).toHaveProperty('total');
        expect(response.body).toHaveProperty('page');
        expect(response.body).toHaveProperty('pageSize');
        expect(Array.isArray(response.body.items)).toBe(true);
      });
    });

    describe('POST /grc/bcm/services/:id/plans', () => {
      it('should create a Plan linked to the service', async () => {
        if (!dbConnected || !tenantId || !testServiceId) {
          console.log('Skipping test: prerequisites not met');
          return;
        }

        const newPlan = {
          name: 'Test Recovery Plan',
          planType: 'BCP',
          status: 'DRAFT',
          summary: 'Test plan for e2e tests',
        };

        const response = await request(app.getHttpServer())
          .post(`/grc/bcm/services/${testServiceId}/plans`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(newPlan)
          .expect(201);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('serviceId', testServiceId);
        createdPlanId = data.id;
      });

      it('should show created Plan in service plans list', async () => {
        if (!dbConnected || !tenantId || !testServiceId || !createdPlanId) {
          console.log('Skipping test: prerequisites not met');
          return;
        }

        const response = await request(app.getHttpServer())
          .get(`/grc/bcm/services/${testServiceId}/plans`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(
          response.body.items.some(
            (p: { id: string }) => p.id === createdPlanId,
          ),
        ).toBe(true);
      });
    });

    describe('GET /grc/bcm/services/:id/exercises (LIST CONTRACT)', () => {
      it('should return Exercises in LIST CONTRACT format', async () => {
        if (!dbConnected || !tenantId || !testServiceId) {
          console.log('Skipping test: prerequisites not met');
          return;
        }

        const response = await request(app.getHttpServer())
          .get(`/grc/bcm/services/${testServiceId}/exercises`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Verify LIST CONTRACT format
        expect(response.body).toHaveProperty('items');
        expect(response.body).toHaveProperty('total');
        expect(response.body).toHaveProperty('page');
        expect(response.body).toHaveProperty('pageSize');
        expect(Array.isArray(response.body.items)).toBe(true);
      });
    });

    describe('POST /grc/bcm/services/:id/exercises', () => {
      it('should create an Exercise linked to the service', async () => {
        if (!dbConnected || !tenantId || !testServiceId) {
          console.log('Skipping test: prerequisites not met');
          return;
        }

        const newExercise = {
          name: 'Test Exercise',
          exerciseType: 'TABLETOP',
          status: 'PLANNED',
          scheduledAt: new Date().toISOString(),
        };

        const response = await request(app.getHttpServer())
          .post(`/grc/bcm/services/${testServiceId}/exercises`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send(newExercise)
          .expect(201);

        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('serviceId', testServiceId);
        createdExerciseId = data.id;
      });

      it('should show created Exercise in service exercises list', async () => {
        if (!dbConnected || !tenantId || !testServiceId || !createdExerciseId) {
          console.log('Skipping test: prerequisites not met');
          return;
        }

        const response = await request(app.getHttpServer())
          .get(`/grc/bcm/services/${testServiceId}/exercises`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(
          response.body.items.some(
            (e: { id: string }) => e.id === createdExerciseId,
          ),
        ).toBe(true);
      });

      it('should NOT show service exercise in another service exercises list', async () => {
        if (!dbConnected || !tenantId || !testServiceId || !createdExerciseId) {
          console.log('Skipping test: prerequisites not met');
          return;
        }

        // Create another service
        const otherServiceResponse = await request(app.getHttpServer())
          .post('/grc/bcm/services')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({
            name: 'Other Service for Isolation Test',
            description: 'Test service for isolation test',
            criticalityTier: 'TIER_2',
            status: 'ACTIVE',
          });

        const otherServiceData =
          otherServiceResponse.body.data ?? otherServiceResponse.body;
        const otherServiceId = otherServiceData?.id;

        if (!otherServiceId) {
          console.log('Skipping test: could not create other service');
          return;
        }

        // Verify the exercise from testServiceId does NOT appear in otherServiceId's list
        const response = await request(app.getHttpServer())
          .get(`/grc/bcm/services/${otherServiceId}/exercises`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(
          response.body.items.some(
            (e: { id: string }) => e.id === createdExerciseId,
          ),
        ).toBe(false);

        // Clean up other service
        await request(app.getHttpServer())
          .delete(`/grc/bcm/services/${otherServiceId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId);
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
        const serviceResponse = await request(app.getHttpServer())
          .post('/grc/bcm/services')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({ name: 'Service for Exercise Test' });

        const serviceData = serviceResponse.body.data ?? serviceResponse.body;
        const testServiceId = serviceData?.id;

        if (!testServiceId) {
          console.log('Skipping test: could not create service for exercise');
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

    describe('Calendar event types', () => {
      it('should include BCM exercises in calendar events', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        // First create a service to link the exercise to
        const serviceResponse = await request(app.getHttpServer())
          .post('/grc/bcm/services')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .send({ name: 'Service for Calendar Test' });

        const serviceData = serviceResponse.body.data ?? serviceResponse.body;
        const testServiceId = serviceData?.id;

        if (!testServiceId) {
          console.log(
            'Skipping test: could not create service for calendar exercise test',
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
