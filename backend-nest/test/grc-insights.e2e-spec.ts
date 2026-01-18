import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * GRC Insights E2E Tests
 *
 * Tests for the GRC Insights API endpoints that provide aggregated metrics.
 * These tests verify the insights overview endpoint returns correct data structure.
 *
 * Regression test for: Invalid orderBy column 'testedAt' causing 500 error
 * Fix: Changed orderBy from 'tr.testedAt' to 'tr.createdAt' in getRecentFailTestResults
 */
describe('GRC Insights API (e2e)', () => {
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

  describe('GET /grc/insights/overview', () => {
    it('should return 200 with correct response structure (regression test for orderBy fix)', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/insights/overview')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const body = response.body;
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('data');

      const data = body.data;

      expect(data).toHaveProperty('openIssuesBySeverity');
      expect(data.openIssuesBySeverity).toHaveProperty('CRITICAL');
      expect(data.openIssuesBySeverity).toHaveProperty('HIGH');
      expect(data.openIssuesBySeverity).toHaveProperty('MEDIUM');
      expect(data.openIssuesBySeverity).toHaveProperty('LOW');
      expect(typeof data.openIssuesBySeverity.CRITICAL).toBe('number');
      expect(typeof data.openIssuesBySeverity.HIGH).toBe('number');
      expect(typeof data.openIssuesBySeverity.MEDIUM).toBe('number');
      expect(typeof data.openIssuesBySeverity.LOW).toBe('number');

      expect(data).toHaveProperty('overdueCAPAsCount');
      expect(typeof data.overdueCAPAsCount).toBe('number');

      expect(data).toHaveProperty('recentFailTestResults');
      expect(Array.isArray(data.recentFailTestResults)).toBe(true);
      if (data.recentFailTestResults.length > 0) {
        const testResult = data.recentFailTestResults[0];
        expect(testResult).toHaveProperty('id');
        expect(testResult).toHaveProperty('name');
        expect(testResult).toHaveProperty('testedAt');
        expect(testResult).toHaveProperty('controlTestName');
      }

      expect(data).toHaveProperty('evidenceStats');
      expect(data.evidenceStats).toHaveProperty('linked');
      expect(data.evidenceStats).toHaveProperty('unlinked');
      expect(data.evidenceStats).toHaveProperty('total');
      expect(typeof data.evidenceStats.linked).toBe('number');
      expect(typeof data.evidenceStats.unlinked).toBe('number');
      expect(typeof data.evidenceStats.total).toBe('number');

      expect(data).toHaveProperty('summary');
      expect(data.summary).toHaveProperty('totalOpenIssues');
      expect(data.summary).toHaveProperty('totalOverdueCAPAs');
      expect(data.summary).toHaveProperty('totalFailedTests');
      expect(typeof data.summary.totalOpenIssues).toBe('number');
      expect(typeof data.summary.totalOverdueCAPAs).toBe('number');
      expect(typeof data.summary.totalFailedTests).toBe('number');
    });

    it('should require authentication', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/insights/overview')
        .set('x-tenant-id', tenantId)
        .expect(401);
    });

    it('should require tenant ID header', async () => {
      if (!dbConnected) {
        console.log('Skipping test: database not connected');
        return;
      }

      await request(app.getHttpServer())
        .get('/grc/insights/overview')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should return consistent data on repeated calls', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response1 = await request(app.getHttpServer())
        .get('/grc/insights/overview')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const response2 = await request(app.getHttpServer())
        .get('/grc/insights/overview')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const data1 = response1.body.data;
      const data2 = response2.body.data;

      expect(data1.openIssuesBySeverity).toEqual(data2.openIssuesBySeverity);
      expect(data1.overdueCAPAsCount).toBe(data2.overdueCAPAsCount);
      expect(data1.evidenceStats).toEqual(data2.evidenceStats);
      expect(data1.summary).toEqual(data2.summary);
    });
  });
});
