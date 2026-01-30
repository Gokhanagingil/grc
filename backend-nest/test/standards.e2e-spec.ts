import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * Standards Library E2E Tests
 *
 * Tests the Standards Library endpoints for Audit Phase 2:
 * - GET /grc/standards
 * - POST /grc/standards (admin/manager)
 * - GET /grc/audits/:id/scope
 */
describe('Standards Library (e2e)', () => {
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

  describe('GET /grc/standards', () => {
    it('should return list of standards with valid auth', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/standards')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      // Response should be in LIST-CONTRACT format
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(false);
      expect(response.body.data).toHaveProperty('items');
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });

    it('should return 401 without token', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/standards')
        .set('x-tenant-id', tenantId)
        .expect(401);
    });

    it('should return 400 without x-tenant-id header', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/standards')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe('POST /grc/standards', () => {
    it('should create a standard with admin permissions', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const newStandard = {
        code: 'TEST-STD-001',
        name: 'Test Standard',
        version: '1.0',
        domain: 'security',
        description: 'Test standard for e2e testing',
      };

      const response = await request(app.getHttpServer())
        .post('/grc/standards')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send(newStandard)
        .expect(201);

      // Response should be in standard envelope format
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('code', newStandard.code);
      expect(response.body.data).toHaveProperty('name', newStandard.name);
    });

    it('should return 400 for invalid standard data', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const invalidStandard = {
        // Missing required fields
        name: 'Test Standard',
      };

      await request(app.getHttpServer())
        .post('/grc/standards')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send(invalidStandard)
        .expect(400);
    });
  });

  describe('GET /grc/audits/:id/scope', () => {
    it('should return audit scope with standards and clauses', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      // First, create a test audit
      const auditResponse = await request(app.getHttpServer())
        .post('/grc/audits')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          name: 'Test Audit for Scope',
          description: 'Test audit for scope endpoint',
          auditType: 'internal',
          status: 'planned',
        })
        .expect(201);

      const auditId = auditResponse.body.data?.id || auditResponse.body.id;

      // Get audit scope
      const scopeResponse = await request(app.getHttpServer())
        .get(`/grc/audits/${auditId}/scope`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      // Response should be in standard envelope format
      expect(scopeResponse.body).toHaveProperty('success', true);
      expect(scopeResponse.body).toHaveProperty('data');
    });

    it('should return 404 for non-existent audit', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/audits/00000000-0000-0000-0000-000000000999/scope')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(404);
    });
  });

  describe('GET /grc/standards/:id/with-clauses', () => {
    it('should return 400 for invalid UUID (undefined)', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/standards/undefined/with-clauses')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(400);

      // Response format: {success: false, error: {code, message}}
      expect(response.body).toHaveProperty('success', false);
      const errorMessage =
        response.body.error?.message || response.body.message;
      expect(errorMessage).toContain('Validation failed');
    });

    it('should return 400 for invalid UUID (not-a-uuid)', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/standards/not-a-uuid/with-clauses')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(400);

      // Response format: {success: false, error: {code, message}}
      expect(response.body).toHaveProperty('success', false);
      const errorMessage =
        response.body.error?.message || response.body.message;
      expect(errorMessage).toContain('Validation failed');
    });

    it('should return 404 for valid UUID that does not exist', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/standards/00000000-0000-0000-0000-000000000999/with-clauses')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(404);
    });

    it('should return 200 with clause tree for existing standard', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      // First, get the list of standards to find an existing one
      const listResponse = await request(app.getHttpServer())
        .get('/grc/standards')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const standards = listResponse.body.data || [];

      if (standards.length === 0) {
        console.log('Skipping test: no standards available');
        return;
      }

      const standardId = standards[0].id;

      const response = await request(app.getHttpServer())
        .get(`/grc/standards/${standardId}/with-clauses`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('clauseTree');
      expect(Array.isArray(response.body.data.clauseTree)).toBe(true);
    });
  });

  describe('GET /grc/standards/:id', () => {
    it('should return 400 for invalid UUID', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/standards/invalid-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(400);

      // Response format: {success: false, error: {code, message}}
      expect(response.body).toHaveProperty('success', false);
      const errorMessage =
        response.body.error?.message || response.body.message;
      expect(errorMessage).toContain('Validation failed');
    });

    it('should return 404 for valid UUID that does not exist', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/standards/00000000-0000-0000-0000-000000000999')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(404);
    });
  });
});
