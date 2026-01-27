import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * Standard Clauses E2E Tests
 *
 * Tests the Standard Clauses endpoints:
 * - GET /grc/clauses (list with pagination)
 * - GET /grc/clauses/:clauseId (single clause)
 */
describe('Standard Clauses (e2e)', () => {
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

  describe('GET /grc/clauses', () => {
    it('should return paginated list of clauses with valid auth', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/clauses?page=1&pageSize=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      // Response should be in standard envelope format with list contract
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('page');
      expect(response.body.data).toHaveProperty('pageSize');
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });

    it('should support search parameter', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/clauses?page=1&pageSize=10&search=test')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('items');
    });

    it('should support standardId filter', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      // First get list of standards to get a valid standardId
      const standardsResponse = await request(app.getHttpServer())
        .get('/grc/standards')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const standards = standardsResponse.body.data ?? standardsResponse.body;
      if (Array.isArray(standards) && standards.length > 0) {
        const standardId = standards[0].id;

        const response = await request(app.getHttpServer())
          .get(`/grc/clauses?page=1&pageSize=10&standardId=${standardId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('items');
      }
    });

    it('should return 401 without token', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/clauses')
        .set('x-tenant-id', tenantId)
        .expect(401);
    });

    it('should return 400 without x-tenant-id header', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/clauses')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe('GET /grc/clauses/:clauseId', () => {
    it('should return a specific clause by ID', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      // First get list of clauses to get a valid clauseId
      const listResponse = await request(app.getHttpServer())
        .get('/grc/clauses?page=1&pageSize=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const items = listResponse.body.data?.items ?? [];
      if (items.length > 0) {
        const clauseId = items[0].id;

        const response = await request(app.getHttpServer())
          .get(`/grc/clauses/${clauseId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('id', clauseId);
      } else {
        console.log('Skipping test: no clauses available');
      }
    });

    it('should return 404 for non-existent clause', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/clauses/00000000-0000-0000-0000-000000000999')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(404);
    });

    it('should return 401 without token', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/clauses/00000000-0000-0000-0000-000000000001')
        .set('x-tenant-id', tenantId)
        .expect(401);
    });
  });
});
