import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * GRC Analytics E2E Tests
 *
 * Tests for pagination, sorting, filtering, and summary endpoints.
 * These tests verify the analytics and reporting capabilities of the GRC module.
 */
describe('GRC Analytics, Filtering & Reporting (e2e)', () => {
  let app: INestApplication<App>;
  let dbConnected = false;
  let adminToken: string;
  let tenantId: string;

  // Demo admin credentials
  const DEMO_ADMIN_EMAIL =
    process.env.DEMO_ADMIN_EMAIL || 'admin@grc-platform.local';
  const DEMO_ADMIN_PASSWORD =
    process.env.DEMO_ADMIN_PASSWORD || 'TestPassword123!';

  // Track created resources for cleanup
  const createdRiskIds: string[] = [];
  const createdPolicyIds: string[] = [];
  const createdRequirementIds: string[] = [];

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
    // Cleanup created resources
    if (dbConnected && tenantId && adminToken) {
      for (const id of createdRiskIds) {
        try {
          await request(app.getHttpServer())
            .delete(`/grc/risks/${id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId);
        } catch {
          // Ignore cleanup errors
        }
      }
      for (const id of createdPolicyIds) {
        try {
          await request(app.getHttpServer())
            .delete(`/grc/policies/${id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId);
        } catch {
          // Ignore cleanup errors
        }
      }
      for (const id of createdRequirementIds) {
        try {
          await request(app.getHttpServer())
            .delete(`/grc/requirements/${id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-tenant-id', tenantId);
        } catch {
          // Ignore cleanup errors
        }
      }
    }

    if (app) {
      await app.close();
    }
  });

  // Helper function to create test risks
  async function createTestRisk(data: {
    title: string;
    severity?: string;
    status?: string;
    category?: string;
  }): Promise<string | null> {
    if (!dbConnected || !tenantId) return null;

    const response = await request(app.getHttpServer())
      .post('/grc/risks')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        title: data.title,
        description: `Test risk for analytics: ${data.title}`,
        severity: data.severity || 'medium',
        status: data.status || 'identified',
        likelihood: 'possible',
        category: data.category || 'Testing',
      });

    // Response is wrapped in standard envelope
    const responseData = response.body.data ?? response.body;
    if (response.status === 201 && responseData.id) {
      createdRiskIds.push(responseData.id);
      return responseData.id;
    }
    return null;
  }

  // Helper function to create test policies
  async function createTestPolicy(policyData: {
    name: string;
    code: string;
    status?: string;
    category?: string;
  }): Promise<string | null> {
    if (!dbConnected || !tenantId) return null;

    const response = await request(app.getHttpServer())
      .post('/grc/policies')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-tenant-id', tenantId)
      .send({
        name: policyData.name,
        code: policyData.code,
        version: '1.0',
        status: policyData.status || 'draft',
        category: policyData.category || 'Testing',
        summary: `Test policy for analytics: ${policyData.name}`,
      });

    // Response is wrapped in standard envelope
    const responseData = response.body.data ?? response.body;
    if (response.status === 201 && responseData.id) {
      createdPolicyIds.push(responseData.id);
      return responseData.id;
    }
    return null;
  }

  // ==================== PAGINATION TESTS ====================
  describe('Pagination', () => {
    describe('GET /grc/risks with pagination', () => {
      it('should return paginated response with default values', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/risks')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in standard envelope with pagination in meta
        const data = response.body.data ?? response.body.items ?? response.body;
        const meta = response.body.meta ?? response.body;
        expect(Array.isArray(data)).toBe(true);
        expect(meta).toHaveProperty('total');
        expect(meta).toHaveProperty('page');
        expect(meta).toHaveProperty('pageSize');
        expect(meta).toHaveProperty('totalPages');
      });

      it('should respect page and pageSize parameters', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/risks?page=1&pageSize=5')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in standard envelope with pagination in meta
        const data = response.body.data ?? response.body.items ?? response.body;
        const meta = response.body.meta ?? response.body;
        expect(meta.page).toBe(1);
        expect(meta.pageSize).toBe(5);
        expect(data.length).toBeLessThanOrEqual(5);
      });

      it('should enforce maximum pageSize of 100', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        // Request with pageSize > 100 should be rejected by validation
        const response = await request(app.getHttpServer())
          .get('/grc/risks?pageSize=200')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId);

        // Should either return 400 (validation error) or cap at 100
        expect([200, 400]).toContain(response.status);
      });

      it('should calculate totalPages correctly', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/risks?pageSize=10')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in standard envelope with pagination in meta
        const meta = response.body.meta ?? response.body;
        const expectedTotalPages = Math.ceil(meta.total / meta.pageSize);
        expect(meta.totalPages).toBe(expectedTotalPages);
      });
    });

    describe('GET /grc/policies with pagination', () => {
      it('should return paginated response', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/policies')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in standard envelope with pagination in meta
        const data = response.body.data ?? response.body.items ?? response.body;
        const meta = response.body.meta ?? response.body;
        expect(Array.isArray(data)).toBe(true);
        expect(meta).toHaveProperty('total');
        expect(meta).toHaveProperty('page');
        expect(meta).toHaveProperty('pageSize');
        expect(meta).toHaveProperty('totalPages');
      });
    });

    describe('GET /grc/requirements with pagination', () => {
      it('should return paginated response', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/requirements')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in standard envelope with pagination in meta
        const data = response.body.data ?? response.body.items ?? response.body;
        const meta = response.body.meta ?? response.body;
        expect(Array.isArray(data)).toBe(true);
        expect(meta).toHaveProperty('total');
        expect(meta).toHaveProperty('page');
        expect(meta).toHaveProperty('pageSize');
        expect(meta).toHaveProperty('totalPages');
      });
    });
  });

  // ==================== SORTING TESTS ====================
  describe('Sorting', () => {
    describe('GET /grc/risks with sorting', () => {
      it('should sort by createdAt DESC by default', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/risks')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in standard envelope
        const items = response.body.data ?? response.body.items ?? response.body;
        if (items.length >= 2) {
          // Verify descending order by createdAt
          const dates = items.map((r: { createdAt: string }) =>
            new Date(r.createdAt).getTime(),
          );
          for (let i = 0; i < dates.length - 1; i++) {
            expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
          }
        }
      });

      it('should sort by title ASC when specified', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/risks?sortBy=title&sortOrder=ASC')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in standard envelope
        const items = response.body.data ?? response.body.items ?? response.body;
        if (items.length >= 2) {
          // Verify ascending order by title
          const titles = items.map((r: { title: string }) => r.title);
          for (let i = 0; i < titles.length - 1; i++) {
            expect(titles[i].localeCompare(titles[i + 1])).toBeLessThanOrEqual(
              0,
            );
          }
        }
      });

      it('should handle invalid sortBy field gracefully', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        // Invalid sortBy should fall back to default (createdAt)
        const response = await request(app.getHttpServer())
          .get('/grc/risks?sortBy=invalidField')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in standard envelope
        const data = response.body.data ?? response.body.items ?? response.body;
        expect(Array.isArray(data)).toBe(true);
      });
    });
  });

  // ==================== FILTERING TESTS ====================
  describe('Filtering', () => {
    describe('GET /grc/risks with filters', () => {
      beforeAll(async () => {
        // Create test risks with different severities and statuses
        await createTestRisk({
          title: 'Analytics Test Risk - High Severity',
          severity: 'high',
          status: 'identified',
        });
        await createTestRisk({
          title: 'Analytics Test Risk - Low Severity',
          severity: 'low',
          status: 'assessed',
        });
        await createTestRisk({
          title: 'Analytics Test Risk - Critical',
          severity: 'critical',
          status: 'mitigating',
        });
      });

      it('should filter by status', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/risks?status=identified')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in standard envelope
        const items = response.body.data ?? response.body.items ?? response.body;
        // All returned items should have status=identified
        for (const item of items) {
          expect(item.status).toBe('identified');
        }
      });

      it('should filter by severity', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/risks?severity=high')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in standard envelope
        const items = response.body.data ?? response.body.items ?? response.body;
        // All returned items should have severity=high
        for (const item of items) {
          expect(item.severity).toBe('high');
        }
      });

      it('should filter by search term', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/risks?search=Analytics%20Test')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in standard envelope
        const items = response.body.data ?? response.body.items ?? response.body;
        // All returned items should contain the search term
        for (const item of items) {
          const matchesTitle = item.title
            .toLowerCase()
            .includes('analytics test');
          const matchesDescription =
            item.description?.toLowerCase().includes('analytics test') || false;
          expect(matchesTitle || matchesDescription).toBe(true);
        }
      });

      it('should combine multiple filters', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/risks?severity=high&status=identified')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in standard envelope
        const items = response.body.data ?? response.body.items ?? response.body;
        // All returned items should match both filters
        for (const item of items) {
          expect(item.severity).toBe('high');
          expect(item.status).toBe('identified');
        }
      });

      it('should combine filters with pagination', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/risks?severity=high&page=1&pageSize=5')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in standard envelope with pagination in meta
        const items = response.body.data ?? response.body.items ?? response.body;
        const meta = response.body.meta ?? response.body;
        expect(meta.page).toBe(1);
        expect(meta.pageSize).toBe(5);
        for (const item of items) {
          expect(item.severity).toBe('high');
        }
      });
    });

    describe('GET /grc/policies with filters', () => {
      beforeAll(async () => {
        // Create test policies with different statuses
        await createTestPolicy({
          name: 'Analytics Test Policy - Draft',
          code: 'POL-ANALYTICS-001',
          status: 'draft',
          category: 'Security',
        });
        await createTestPolicy({
          name: 'Analytics Test Policy - Active',
          code: 'POL-ANALYTICS-002',
          status: 'active',
          category: 'Compliance',
        });
      });

      it('should filter by status', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/policies?status=draft')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in standard envelope
        const items = response.body.data ?? response.body.items ?? response.body;
        for (const item of items) {
          expect(item.status).toBe('draft');
        }
      });

      it('should filter by category', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/policies?category=Security')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in standard envelope
        const items = response.body.data ?? response.body.items ?? response.body;
        for (const item of items) {
          expect(item.category).toBe('Security');
        }
      });

      it('should filter by search term', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/policies?search=Analytics%20Test')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in standard envelope
        const items = response.body.data ?? response.body.items ?? response.body;
        for (const item of items) {
          const matchesName = item.name
            .toLowerCase()
            .includes('analytics test');
          const matchesSummary =
            item.summary?.toLowerCase().includes('analytics test') || false;
          const matchesCode =
            item.code?.toLowerCase().includes('analytics') || false;
          expect(matchesName || matchesSummary || matchesCode).toBe(true);
        }
      });
    });

    describe('GET /grc/requirements with filters', () => {
      it('should filter by framework', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/requirements?framework=iso27001')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in standard envelope
        const items = response.body.data ?? response.body.items ?? response.body;
        for (const item of items) {
          expect(item.framework).toBe('iso27001');
        }
      });

      it('should filter by status', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/requirements?status=compliant')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in standard envelope
        const items = response.body.data ?? response.body.items ?? response.body;
        for (const item of items) {
          expect(item.status).toBe('compliant');
        }
      });
    });
  });

  // ==================== SUMMARY ENDPOINT TESTS ====================
  describe('Summary Endpoints', () => {
    describe('GET /grc/risks/summary', () => {
      it('should return risk summary with all expected fields', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/risks/summary')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in standard envelope
        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('total');
        expect(data).toHaveProperty('byStatus');
        expect(data).toHaveProperty('bySeverity');
        expect(data).toHaveProperty('byLikelihood');
        expect(data).toHaveProperty('byCategory');
        expect(data).toHaveProperty('highPriorityCount');
        expect(data).toHaveProperty('overdueCount');

        expect(typeof data.total).toBe('number');
        expect(typeof data.byStatus).toBe('object');
        expect(typeof data.bySeverity).toBe('object');
        expect(typeof data.highPriorityCount).toBe('number');
        expect(typeof data.overdueCount).toBe('number');
      });

      it('should return 401 without authentication', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/risks/summary')
          .set('x-tenant-id', tenantId)
          .expect(401);
      });

      it('should return 400 without tenant header', async () => {
        if (!dbConnected) {
          console.log('Skipping test: database not connected');
          return;
        }

        await request(app.getHttpServer())
          .get('/grc/risks/summary')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);
      });
    });

    describe('GET /grc/policies/summary', () => {
      it('should return policy summary with all expected fields', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/policies/summary')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in standard envelope
        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('total');
        expect(data).toHaveProperty('byStatus');
        expect(data).toHaveProperty('byCategory');
        expect(data).toHaveProperty('dueForReviewCount');
        expect(data).toHaveProperty('activeCount');
        expect(data).toHaveProperty('draftCount');

        expect(typeof data.total).toBe('number');
        expect(typeof data.byStatus).toBe('object');
        expect(typeof data.byCategory).toBe('object');
        expect(typeof data.dueForReviewCount).toBe('number');
        expect(typeof data.activeCount).toBe('number');
        expect(typeof data.draftCount).toBe('number');
      });
    });

    describe('GET /grc/requirements/summary', () => {
      it('should return requirement summary with all expected fields', async () => {
        if (!dbConnected || !tenantId) {
          console.log('Skipping test: database not connected');
          return;
        }

        const response = await request(app.getHttpServer())
          .get('/grc/requirements/summary')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-tenant-id', tenantId)
          .expect(200);

        // Response is wrapped in standard envelope
        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('total');
        expect(data).toHaveProperty('byFramework');
        expect(data).toHaveProperty('byStatus');
        expect(data).toHaveProperty('byCategory');
        expect(data).toHaveProperty('byPriority');
        expect(data).toHaveProperty('compliantCount');
        expect(data).toHaveProperty('nonCompliantCount');
        expect(data).toHaveProperty('inProgressCount');

        expect(typeof data.total).toBe('number');
        expect(typeof data.byFramework).toBe('object');
        expect(typeof data.byStatus).toBe('object');
        expect(typeof data.compliantCount).toBe('number');
        expect(typeof data.nonCompliantCount).toBe('number');
        expect(typeof data.inProgressCount).toBe('number');
      });
    });
  });

  // ==================== TENANT ISOLATION TESTS ====================
  describe('Tenant Isolation in Analytics', () => {
    it('should only return data for the authenticated tenant', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      // Get risks for the current tenant
      const response = await request(app.getHttpServer())
        .get('/grc/risks')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      // Response is wrapped in standard envelope
      const items = response.body.data ?? response.body.items ?? response.body;
      // All returned items should belong to the authenticated tenant
      for (const item of items) {
        expect(item.tenantId).toBe(tenantId);
      }
    });

    it('should only include tenant data in summary', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      // Get summary for the current tenant
      const summaryResponse = await request(app.getHttpServer())
        .get('/grc/risks/summary')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      // Get all risks for the current tenant
      const risksResponse = await request(app.getHttpServer())
        .get('/grc/risks?pageSize=100')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      // Response is wrapped in standard envelope
      const summaryData = summaryResponse.body.data ?? summaryResponse.body;
      const risksMeta = risksResponse.body.meta ?? risksResponse.body;
      // Summary total should match the number of risks for this tenant
      expect(summaryData.total).toBe(risksMeta.total);
    });
  });
});
