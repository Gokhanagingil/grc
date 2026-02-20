import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * Pagination Contract E2E Tests
 *
 * Verifies that all LIST endpoints respect the canonical pagination contract:
 * - pageSize max = 100 (enforced by PaginationQueryDto @Max(100))
 * - pageSize > 100 returns 400 Bad Request with clear error
 * - pageSize <= 100 returns 200 OK with LIST-CONTRACT envelope
 */
describe('Pagination Contract (e2e)', () => {
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

  describe('CMDB Services — Pagination', () => {
    it('should accept pageSize=100 and return 200', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/cmdb/services')
        .query({ pageSize: 100 })
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const data = response.body.data ?? response.body;
      expect(data).toHaveProperty('items');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('pageSize');
    });

    it('should accept pageSize=50 (default range) and return 200', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/cmdb/services')
        .query({ pageSize: 50 })
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);
    });

    it('should reject pageSize=200 with 400 Bad Request', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/cmdb/services')
        .query({ pageSize: 200 })
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should reject pageSize=0 with 400 Bad Request', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/cmdb/services')
        .query({ pageSize: 0 })
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(400);
    });

    it('should reject negative pageSize with 400 Bad Request', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/cmdb/services')
        .query({ pageSize: -1 })
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(400);
    });
  });

  describe('Calendar Events — Pagination', () => {
    it('should accept pageSize=100 and return 200', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/itsm/calendar/events')
        .query({ pageSize: 100 })
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const data = response.body.data ?? response.body;
      const items = data.items ?? data;
      expect(Array.isArray(items)).toBe(true);
    });

    it('should reject pageSize=200 with 400 Bad Request', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/itsm/calendar/events')
        .query({ pageSize: 200 })
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(400);
    });
  });

  describe('Service Offerings — Pagination', () => {
    it('should accept pageSize=100 and return 200', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/cmdb/service-offerings')
        .query({ pageSize: 100 })
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const data = response.body.data ?? response.body;
      expect(data).toHaveProperty('items');
      expect(data).toHaveProperty('total');
    });

    it('should reject pageSize=200 with 400 Bad Request', async () => {
      if (!dbConnected || !tenantId || !adminToken) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/cmdb/service-offerings')
        .query({ pageSize: 200 })
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(400);
    });
  });
});
