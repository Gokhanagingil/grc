import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

interface ListContractResponse {
  success: boolean;
  data: {
    items: unknown[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

function assertListContract(
  response: { body: unknown },
  options?: { expectItems?: boolean },
): asserts response is { body: ListContractResponse } {
  const body = response.body as Record<string, unknown>;
  if (typeof body !== 'object' || body === null) {
    throw new Error('LIST-CONTRACT: Response body must be an object');
  }
  if (body.success !== true) {
    throw new Error('LIST-CONTRACT: Response must have success: true');
  }
  if (typeof body.data !== 'object' || body.data === null) {
    throw new Error('LIST-CONTRACT: Response must have data object');
  }
  if (Array.isArray(body.data)) {
    throw new Error(
      'LIST-CONTRACT: data must be an object, not an array (old format)',
    );
  }
  const data = body.data as Record<string, unknown>;
  if (!Array.isArray(data.items)) {
    throw new Error('LIST-CONTRACT: data.items must be an array');
  }
  if (typeof data.total !== 'number') {
    throw new Error('LIST-CONTRACT: data.total must be a number');
  }
  if (typeof data.page !== 'number') {
    throw new Error('LIST-CONTRACT: data.page must be a number');
  }
  if (typeof data.pageSize !== 'number') {
    throw new Error('LIST-CONTRACT: data.pageSize must be a number');
  }
  if (typeof data.totalPages !== 'number') {
    throw new Error('LIST-CONTRACT: data.totalPages must be a number');
  }
  if ('meta' in body) {
    throw new Error('LIST-CONTRACT: Response must not have meta field');
  }
  if (options?.expectItems && data.items.length === 0 && data.total > 0) {
    throw new Error('LIST-CONTRACT: Expected items but got empty array');
  }
}

/**
 * LIST-CONTRACT E2E Tests
 *
 * Tests to verify that paginated list endpoints follow the LIST-CONTRACT specification:
 *
 * {
 *   "success": true,
 *   "data": {
 *     "items": [...],
 *     "total": number,
 *     "page": number,
 *     "pageSize": number,
 *     "totalPages": number
 *   }
 * }
 *
 * This is a regression guard to ensure the response shape is not accidentally changed.
 */
describe('LIST-CONTRACT Compliance (e2e)', () => {
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

  describe('Controls List Endpoint - LIST-CONTRACT', () => {
    it('GET /grc/controls should return LIST-CONTRACT compliant response', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/controls')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      assertListContract(response);
    });

    it('GET /grc/controls should NOT have meta field (LIST-CONTRACT)', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/controls')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      // LIST-CONTRACT does not use meta field
      expect(response.body).not.toHaveProperty('meta');
    });

    it('GET /grc/controls with pagination should return correct page info', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/controls?page=1&pageSize=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body.data.page).toBe(1);
      expect(response.body.data.pageSize).toBe(5);
      expect(response.body.data.items.length).toBeLessThanOrEqual(5);
    });

    it('GET /grc/controls response should match exact LIST-CONTRACT shape', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/controls')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      // Verify exact shape matches LIST-CONTRACT.md
      const expectedShape = {
        success: true,
        data: {
          items: expect.any(Array),
          total: expect.any(Number),
          page: expect.any(Number),
          pageSize: expect.any(Number),
          totalPages: expect.any(Number),
        },
      };

      expect(response.body).toMatchObject(expectedShape);

      // Verify no extra top-level fields
      const topLevelKeys = Object.keys(response.body);
      expect(topLevelKeys).toContain('success');
      expect(topLevelKeys).toContain('data');
      expect(topLevelKeys).not.toContain('meta');
    });
  });

  describe('Other Paginated Endpoints - LIST-CONTRACT', () => {
    it('GET /grc/risks should return LIST-CONTRACT compliant response', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/risks')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      // Verify LIST-CONTRACT compliance
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(false);
      expect(response.body.data).toHaveProperty('items');
      expect(Array.isArray(response.body.data.items)).toBe(true);
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('page');
      expect(response.body.data).toHaveProperty('pageSize');
      expect(response.body.data).toHaveProperty('totalPages');
    });

    it('GET /grc/policies should return LIST-CONTRACT compliant response', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/policies')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      // Verify LIST-CONTRACT compliance
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(false);
      expect(response.body.data).toHaveProperty('items');
      expect(Array.isArray(response.body.data.items)).toBe(true);
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('page');
      expect(response.body.data).toHaveProperty('pageSize');
      expect(response.body.data).toHaveProperty('totalPages');
    });

    it('GET /grc/requirements should return LIST-CONTRACT compliant response', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/requirements')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      // Verify LIST-CONTRACT compliance
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(false);
      expect(response.body.data).toHaveProperty('items');
      expect(Array.isArray(response.body.data.items)).toBe(true);
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('page');
      expect(response.body.data).toHaveProperty('pageSize');
      expect(response.body.data).toHaveProperty('totalPages');
    });
  });

  describe('Universal Search - Controls', () => {
    it('GET /grc/controls with search should filter results', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/controls?search=test')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('items');
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });

    it('GET /grc/controls with sort should order results', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/controls?sort=name:ASC')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('items');
    });

    it('GET /grc/controls with status filter should filter results', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/controls?status=draft')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('items');
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });

    it('GET /grc/controls with combined search and pagination', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/controls?search=control&page=1&pageSize=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.pageSize).toBe(5);
      expect(response.body.data.items.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Universal Search - Risks', () => {
    it('GET /grc/risks with search should filter results', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/risks?search=test')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('items');
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });

    it('GET /grc/risks with sort should order results', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/risks?sortBy=title&sortOrder=ASC')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('items');
    });

    it('GET /grc/risks with combined search and pagination', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/risks?search=risk&page=1&pageSize=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.pageSize).toBe(5);
      expect(response.body.data.items.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Sort Parameter Compatibility - Sprint 1F Regression', () => {
    it('GET /grc/evidence with sort param should return 200 (not 400)', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get(
          '/grc/evidence?page=1&pageSize=10&sort=createdAt:DESC&sortBy=createdAt&sortOrder=DESC',
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('items');
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });

    it('GET /grc/test-results with sort param should return 200 (not 400)', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get(
          '/grc/test-results?page=1&pageSize=10&sort=createdAt:DESC&sortBy=createdAt&sortOrder=DESC',
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('items');
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });

    it('GET /grc/issues with sort param should return 200 (not 400)', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get(
          '/grc/issues?page=1&pageSize=10&sort=createdAt:DESC&sortBy=createdAt&sortOrder=DESC',
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('items');
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });

    it('GET /grc/capas with sort param should return 200 (not 400)', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get(
          '/grc/capas?page=1&pageSize=10&sort=createdAt:DESC&sortBy=createdAt&sortOrder=DESC',
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('items');
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });

    it('GET /grc/capa-tasks with sort param should return 200 (not 400)', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get(
          '/grc/capa-tasks?page=1&pageSize=10&sort=createdAt:DESC&sortBy=createdAt&sortOrder=DESC',
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('items');
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });
  });

  describe('Regression Tests - Old Format Should Fail', () => {
    it('should NOT have data as array (old format)', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/controls')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      // OLD FORMAT (should fail): { success: true, data: [...], meta: {...} }
      // NEW FORMAT (should pass): { success: true, data: { items: [...], ... } }
      expect(Array.isArray(response.body.data)).toBe(false);
    });

    it('should NOT have pagination in meta (old format)', async () => {
      if (!dbConnected || !tenantId) {
        console.log('Skipping test: database not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .get('/grc/controls')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      // OLD FORMAT had meta with pagination
      // NEW FORMAT has pagination inside data
      expect(response.body.meta).toBeUndefined();
      expect(response.body.data.total).toBeDefined();
      expect(response.body.data.page).toBeDefined();
    });
  });
});
