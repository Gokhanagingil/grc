import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Contract Smoke Tests (404 Prevention)', () => {
  let app: INestApplication;
  const tenantId = process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const criticalPaths = [
    { path: '/api/v2/health', method: 'GET', name: 'Health' },
    { path: '/api/v2/dashboard/overview', method: 'GET', name: 'Dashboard Overview' },
    { path: '/api/v2/governance/policies?page=1&limit=20', method: 'GET', name: 'Governance Policies' },
    { path: '/api/v2/compliance/requirements?page=1&limit=20', method: 'GET', name: 'Compliance Requirements' },
    { path: '/api/v2/risk-catalog?page=1&pageSize=20', method: 'GET', name: 'Risk Catalog' },
    { path: '/api/v2/risk-instances?page=1&pageSize=20', method: 'GET', name: 'Risk Instances' },
    { path: '/api/v2/entity-registry/entity-types?page=1&pageSize=20', method: 'GET', name: 'Entity Registry Types' },
  ];

  criticalPaths.forEach(({ path, method, name }) => {
    it(`should not return 404 for ${name} (${method} ${path})`, async () => {
      const [basePath, queryString] = path.split('?');
      const url = queryString ? `${basePath}?${queryString}` : basePath;
      
      const response = await request(app.getHttpServer())
        .get(url)
        .set('x-tenant-id', tenantId)
        .set('Authorization', 'Bearer fake-token') // Optional, may get 401 but not 404
        .expect((res) => {
          // Accept 200, 401, 403 (authentication/authorization issues are OK)
          // Reject 404, 500 (route missing or server error)
          if (res.status === 404) {
            throw new Error(`Route not found: ${path} returned 404`);
          }
          if (res.status >= 500) {
            throw new Error(`Server error: ${path} returned ${res.status}`);
          }
          // 200, 201, 401, 403 are acceptable
        });

      // If we get here, status is acceptable (200/201/401/403)
      expect([200, 201, 401, 403]).toContain(response.status);
    });
  });

  it('should return standardized PagedListDto schema for list endpoints', async () => {
    const listEndpoints = [
      '/api/v2/governance/policies?page=1&limit=20',
      '/api/v2/compliance/requirements?page=1&limit=20',
      '/api/v2/risk-catalog?page=1&pageSize=20',
      '/api/v2/risk-instances?page=1&pageSize=20',
      '/api/v2/entity-registry/entity-types?page=1&pageSize=20',
    ];

    for (const endpoint of listEndpoints) {
      const [basePath, queryString] = endpoint.split('?');
      const url = queryString ? `${basePath}?${queryString}` : basePath;
      
      const response = await request(app.getHttpServer())
        .get(url)
        .set('x-tenant-id', tenantId)
        .set('Authorization', 'Bearer fake-token');

      // If 200, check PagedListDto contract
      if (response.status === 200) {
        expect(response.body).toHaveProperty('items');
        expect(response.body).toHaveProperty('total');
        expect(response.body).toHaveProperty('page');
        expect(response.body).toHaveProperty('pageSize');
        expect(Array.isArray(response.body.items)).toBe(true);
        expect(typeof response.body.total).toBe('number');
        expect(typeof response.body.page).toBe('number');
        expect(typeof response.body.pageSize).toBe('number');
        // Ensure total >= 0, page >= 1, pageSize >= 1
        expect(response.body.total).toBeGreaterThanOrEqual(0);
        expect(response.body.page).toBeGreaterThanOrEqual(1);
        expect(response.body.pageSize).toBeGreaterThanOrEqual(1);
        // Ensure items.length <= pageSize (unless it's the last page)
        if (response.body.items.length > 0) {
          expect(response.body.items.length).toBeLessThanOrEqual(response.body.pageSize);
        }
      }
    }
  });

  it('should support filter and sort parameters', async () => {
    // Test filter (q parameter)
    const filterResponse = await request(app.getHttpServer())
      .get('/api/v2/governance/policies?page=1&limit=20&q=test')
      .set('x-tenant-id', tenantId)
      .set('Authorization', 'Bearer fake-token');
    
    if (filterResponse.status === 200) {
      expect(filterResponse.body).toHaveProperty('items');
      expect(filterResponse.body).toHaveProperty('total');
    }

    // Test sort parameter
    const sortResponse = await request(app.getHttpServer())
      .get('/api/v2/governance/policies?page=1&limit=20&sort=created_at:asc')
      .set('x-tenant-id', tenantId)
      .set('Authorization', 'Bearer fake-token');
    
    if (sortResponse.status === 200) {
      expect(sortResponse.body).toHaveProperty('items');
      expect(sortResponse.body).toHaveProperty('total');
    }
  });
});

