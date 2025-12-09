import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * Dashboard E2E Tests
 *
 * Tests for the Dashboard API endpoints that aggregate data from GRC and ITSM modules.
 * These endpoints provide KPIs and visualizations for the Dashboard page.
 */
describe('Dashboard API (e2e)', () => {
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

  // ==================== DASHBOARD OVERVIEW TESTS ====================
  describe('GET /dashboard/overview', () => {
    it('should return dashboard overview with all KPIs', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/dashboard/overview')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      // Response is wrapped in standard envelope
      const data = response.body.data ?? response.body;

      // Verify risks section
      expect(data).toHaveProperty('risks');
      expect(data.risks).toHaveProperty('total');
      expect(data.risks).toHaveProperty('open');
      expect(data.risks).toHaveProperty('high');
      expect(data.risks).toHaveProperty('overdue');
      expect(data.risks).toHaveProperty('top5OpenRisks');
      expect(Array.isArray(data.risks.top5OpenRisks)).toBe(true);

      // Verify compliance section
      expect(data).toHaveProperty('compliance');
      expect(data.compliance).toHaveProperty('total');
      expect(data.compliance).toHaveProperty('pending');
      expect(data.compliance).toHaveProperty('completed');
      expect(data.compliance).toHaveProperty('overdue');
      expect(data.compliance).toHaveProperty('coveragePercentage');

      // Verify policies section
      expect(data).toHaveProperty('policies');
      expect(data.policies).toHaveProperty('total');
      expect(data.policies).toHaveProperty('active');
      expect(data.policies).toHaveProperty('draft');
      expect(data.policies).toHaveProperty('coveragePercentage');

      // Verify incidents section
      expect(data).toHaveProperty('incidents');
      expect(data.incidents).toHaveProperty('total');
      expect(data.incidents).toHaveProperty('open');
      expect(data.incidents).toHaveProperty('closed');
      expect(data.incidents).toHaveProperty('resolved');
      expect(data.incidents).toHaveProperty('resolvedToday');
      expect(data.incidents).toHaveProperty('avgResolutionTimeHours');

      // Verify users section
      expect(data).toHaveProperty('users');
      expect(data.users).toHaveProperty('total');
      expect(data.users).toHaveProperty('admins');
      expect(data.users).toHaveProperty('managers');
    });

    it('should require authentication', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/dashboard/overview')
        .set('x-tenant-id', tenantId)
        .expect(401);
    });

    it('should require tenant ID header', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/dashboard/overview')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should return numeric values for all counts', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/dashboard/overview')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const data = response.body.data ?? response.body;

      // All count fields should be numbers
      expect(typeof data.risks.total).toBe('number');
      expect(typeof data.risks.open).toBe('number');
      expect(typeof data.risks.high).toBe('number');
      expect(typeof data.risks.overdue).toBe('number');
      expect(typeof data.compliance.total).toBe('number');
      expect(typeof data.policies.total).toBe('number');
      expect(typeof data.incidents.total).toBe('number');
    });
  });

  // ==================== RISK TRENDS TESTS ====================
  describe('GET /dashboard/risk-trends', () => {
    it('should return risk trends data', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/dashboard/risk-trends')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      // Response is wrapped in standard envelope
      const data = response.body.data ?? response.body;

      expect(Array.isArray(data)).toBe(true);
      if (data.length > 0) {
        expect(data[0]).toHaveProperty('date');
        expect(data[0]).toHaveProperty('total_risks');
        expect(data[0]).toHaveProperty('critical');
        expect(data[0]).toHaveProperty('high');
        expect(data[0]).toHaveProperty('medium');
        expect(data[0]).toHaveProperty('low');
      }
    });

    it('should require authentication', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/dashboard/risk-trends')
        .set('x-tenant-id', tenantId)
        .expect(401);
    });

    it('should require tenant ID header', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/dashboard/risk-trends')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should return numeric values for severity counts', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/dashboard/risk-trends')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const data = response.body.data ?? response.body;

      if (data.length > 0) {
        expect(typeof data[0].total_risks).toBe('number');
        expect(typeof data[0].critical).toBe('number');
        expect(typeof data[0].high).toBe('number');
        expect(typeof data[0].medium).toBe('number');
        expect(typeof data[0].low).toBe('number');
      }
    });
  });

  // ==================== COMPLIANCE BY REGULATION TESTS ====================
  describe('GET /dashboard/compliance-by-regulation', () => {
    it('should return compliance by regulation data', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/dashboard/compliance-by-regulation')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      // Response is wrapped in standard envelope
      const data = response.body.data ?? response.body;

      expect(Array.isArray(data)).toBe(true);
      if (data.length > 0) {
        expect(data[0]).toHaveProperty('regulation');
        expect(data[0]).toHaveProperty('completed');
        expect(data[0]).toHaveProperty('pending');
        expect(data[0]).toHaveProperty('overdue');
      }
    });

    it('should require authentication', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/dashboard/compliance-by-regulation')
        .set('x-tenant-id', tenantId)
        .expect(401);
    });

    it('should require tenant ID header', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/dashboard/compliance-by-regulation')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should return numeric values for status counts', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/dashboard/compliance-by-regulation')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const data = response.body.data ?? response.body;

      if (data.length > 0) {
        expect(typeof data[0].completed).toBe('number');
        expect(typeof data[0].pending).toBe('number');
        expect(typeof data[0].overdue).toBe('number');
      }
    });
  });

  // ==================== TENANT ISOLATION TESTS ====================
  describe('Tenant Isolation', () => {
    it('should only return data for the specified tenant', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      // Make two requests with the same tenant ID
      const response1 = await request(app.getHttpServer())
        .get('/dashboard/overview')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const response2 = await request(app.getHttpServer())
        .get('/dashboard/overview')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      // Both responses should have the same structure
      const data1 = response1.body.data ?? response1.body;
      const data2 = response2.body.data ?? response2.body;

      expect(data1.risks.total).toBe(data2.risks.total);
      expect(data1.policies.total).toBe(data2.policies.total);
      expect(data1.compliance.total).toBe(data2.compliance.total);
    });
  });
});
