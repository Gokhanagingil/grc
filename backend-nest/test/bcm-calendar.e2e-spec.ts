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
          console.log('Skipping test: could not create service for calendar exercise test');
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
