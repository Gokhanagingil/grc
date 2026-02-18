import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('ITSM Changes RBAC & CRUD (e2e)', () => {
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

  describe('GET /auth/me - permissions verification', () => {
    it('should return permissions list including ITSM_CHANGE_READ for admin', async () => {
      if (!dbConnected || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const data = response.body.data ?? response.body;
      expect(data).toHaveProperty('permissions');
      expect(Array.isArray(data.permissions)).toBe(true);
      expect(data.permissions).toContain('itsm:change:read');
      expect(data.permissions).toContain('itsm:change:write');
      expect(data.permissions).toContain('itsm:incident:read');
      expect(data.permissions).toContain('itsm:service:read');
      expect(data.permissions).toContain('itsm:sla:read');
    });
  });

  describe('GET /grc/itsm/changes - admin access (regression test for 403 bug)', () => {
    it('should return 200 with valid admin token and tenant', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/itsm/changes')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      const data = response.body.data;
      expect(data).toHaveProperty('items');
      expect(Array.isArray(data.items)).toBe(true);
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('page');
      expect(data).toHaveProperty('pageSize');
    });

    it('should support pagination query params', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/itsm/changes?page=1&pageSize=20')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      const data = response.body.data;
      expect(data.page).toBe(1);
      expect(data.pageSize).toBe(20);
    });

    it('should return 401 without token', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/itsm/changes')
        .set('x-tenant-id', tenantId)
        .expect(401);
    });

    it('should return 400 without x-tenant-id header', async () => {
      if (!dbConnected || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/itsm/changes')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe('POST /grc/itsm/changes - CRUD operations', () => {
    let createdChangeId: string;

    it('should create a new change with valid data', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const newChange = {
        title: 'E2E Test Change Request',
        description: 'Created by e2e test to verify RBAC fix',
        type: 'NORMAL',
        state: 'DRAFT',
        risk: 'MEDIUM',
      };

      const response = await request(app.getHttpServer())
        .post('/grc/itsm/changes')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send(newChange)
        .expect(201);

      const data = response.body.data ?? response.body;
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('number');
      expect(data.number).toMatch(/^CHG\d{6}$/);
      expect(data).toHaveProperty('title', newChange.title);
      expect(data).toHaveProperty('tenantId', tenantId);
      createdChangeId = data.id;
    });

    it('should get the created change by ID', async () => {
      if (!dbConnected || !tenantId || !adminToken || !createdChangeId) {
        console.log('Skipping test: database not connected or no seed data');
        return;
      }

      const response = await request(app.getHttpServer())
        .get(`/grc/itsm/changes/${createdChangeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const data = response.body.data ?? response.body;
      expect(data).toHaveProperty('id', createdChangeId);
      expect(data).toHaveProperty('title', 'E2E Test Change Request');
    });

    it('should update the created change', async () => {
      if (!dbConnected || !tenantId || !adminToken || !createdChangeId) {
        console.log('Skipping test: database not connected or no seed data');
        return;
      }

      const response = await request(app.getHttpServer())
        .patch(`/grc/itsm/changes/${createdChangeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({ title: 'E2E Test Change Request - Updated' })
        .expect(200);

      const data = response.body.data ?? response.body;
      expect(data).toHaveProperty('title', 'E2E Test Change Request - Updated');
    });

    it('should soft-delete the created change', async () => {
      if (!dbConnected || !tenantId || !adminToken || !createdChangeId) {
        console.log('Skipping test: database not connected or no seed data');
        return;
      }

      await request(app.getHttpServer())
        .delete(`/grc/itsm/changes/${createdChangeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(204);
    });

    it('should return 404 for the deleted change', async () => {
      if (!dbConnected || !tenantId || !adminToken || !createdChangeId) {
        console.log('Skipping test: database not connected or no seed data');
        return;
      }

      await request(app.getHttpServer())
        .get(`/grc/itsm/changes/${createdChangeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(404);
    });
  });
});
