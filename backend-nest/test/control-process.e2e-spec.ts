import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Control-Process Link Operations (e2e)', () => {
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

  describe('GET /grc/processes', () => {
    it('should return list of processes with valid auth', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/processes')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return 401 without token', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/processes')
        .set('x-tenant-id', tenantId)
        .expect(401);
    });

    it('should return 400 without x-tenant-id header', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/processes')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe('GET /grc/controls with filters', () => {
    it('should return controls list with valid auth', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/controls')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should filter controls by processId', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const processesResponse = await request(app.getHttpServer())
        .get('/grc/processes')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);

      const processes = processesResponse.body.data ?? [];
      if (processes.length === 0) {
        console.log('Skipping test: no processes available');
        return;
      }

      const processId = processes[0].id;
      const response = await request(app.getHttpServer())
        .get(`/grc/controls?processId=${processId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should filter controls by unlinked=true', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/controls?unlinked=true')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('Control-Process Link/Unlink Operations', () => {
    let testControlId: string;
    let testProcessId: string;

    beforeAll(async () => {
      if (!dbConnected || !tenantId) return;

      const controlsResponse = await request(app.getHttpServer())
        .get('/grc/controls')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);

      const controls = controlsResponse.body.data ?? [];
      if (controls.length > 0) {
        testControlId = controls[0].id;
      }

      const processesResponse = await request(app.getHttpServer())
        .get('/grc/processes')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);

      const processes = processesResponse.body.data ?? [];
      if (processes.length > 0) {
        testProcessId = processes[0].id;
      }
    });

    it('should link a control to a process', async () => {
      if (!dbConnected || !tenantId || !testControlId || !testProcessId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      const response = await request(app.getHttpServer())
        .post(`/grc/controls/${testControlId}/processes/${testProcessId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect((res) => {
          expect([200, 201, 409]).toContain(res.status);
        });

      if (response.status === 201 || response.status === 200) {
        expect(response.body).toHaveProperty('success', true);
      }
    });

    it('should return 409 when linking duplicate control-process', async () => {
      if (!dbConnected || !tenantId || !testControlId || !testProcessId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      await request(app.getHttpServer())
        .post(`/grc/controls/${testControlId}/processes/${testProcessId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);

      await request(app.getHttpServer())
        .post(`/grc/controls/${testControlId}/processes/${testProcessId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(409);
    });

    it('should unlink a control from a process', async () => {
      if (!dbConnected || !tenantId || !testControlId || !testProcessId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      await request(app.getHttpServer())
        .post(`/grc/controls/${testControlId}/processes/${testProcessId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);

      await request(app.getHttpServer())
        .delete(`/grc/controls/${testControlId}/processes/${testProcessId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(204);
    });

    it('should return 404 when unlinking non-existent link', async () => {
      if (!dbConnected || !tenantId || !testControlId || !testProcessId) {
        console.log('Skipping test: prerequisites not met');
        return;
      }

      await request(app.getHttpServer())
        .delete(`/grc/controls/${testControlId}/processes/${testProcessId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);

      await request(app.getHttpServer())
        .delete(`/grc/controls/${testControlId}/processes/${testProcessId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(404);
    });
  });

  describe('GET /grc/coverage', () => {
    it('should return coverage summary with valid auth', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/coverage')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('requirementCoverage');
      expect(response.body.data).toHaveProperty('processCoverage');
      expect(response.body.data).toHaveProperty('unlinkedControlsCount');
    });

    it('should return requirement coverage details', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/coverage/requirements')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('covered');
      expect(response.body.data).toHaveProperty('coveragePercent');
    });

    it('should return process coverage details', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/coverage/processes')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('covered');
      expect(response.body.data).toHaveProperty('coveragePercent');
    });

    it('should return 401 without token', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/coverage')
        .set('x-tenant-id', tenantId)
        .expect(401);
    });
  });

  describe('Tenant Isolation for Control-Process Links', () => {
    const fakeTenantId = '00000000-0000-0000-0000-000000000099';

    it('should not allow linking controls from different tenant', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const controlsResponse = await request(app.getHttpServer())
        .get('/grc/controls')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);

      const controls = controlsResponse.body.data ?? [];
      if (controls.length === 0) {
        console.log('Skipping test: no controls available');
        return;
      }

      const processesResponse = await request(app.getHttpServer())
        .get('/grc/processes')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);

      const processes = processesResponse.body.data ?? [];
      if (processes.length === 0) {
        console.log('Skipping test: no processes available');
        return;
      }

      await request(app.getHttpServer())
        .post(`/grc/controls/${controls[0].id}/processes/${processes[0].id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', fakeTenantId)
        .expect(403);
    });

    it('should not allow accessing coverage from different tenant', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/coverage')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', fakeTenantId)
        .expect(403);
    });
  });
});
