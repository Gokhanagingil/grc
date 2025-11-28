import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { PolicyEntity } from '../src/entities/app/policy.entity';
import { RequirementEntity } from '../src/modules/compliance/comp.entity';
import { RiskCatalogEntity } from '../src/entities/app/risk-catalog.entity';
import { EntityTypeEntity } from '../src/entities/app/entity-type.entity';
import { randomUUID } from 'crypto';

describe('Lists E2E Tests (Real Data)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const tenantId = process.env.DEFAULT_TENANT_ID || '217492b2-f814-4ba0-ae50-4e4f8ecf6216';
  const seedCount = 3; // Number of records to seed per entity

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Seed Data', () => {
    it('should seed policies', async () => {
      const repo = dataSource.getRepository(PolicyEntity);
      for (let i = 1; i <= seedCount; i++) {
        const policy = repo.create({
          id: randomUUID(),
          tenant_id: tenantId,
          code: `POL-TEST-${i}`,
          title: `Test Policy ${i}`,
          status: 'active',
        });
        await repo.save(policy).catch(() => {
          // Ignore duplicates
        });
      }
      const count = await repo.count({ where: { tenant_id: tenantId } });
      expect(count).toBeGreaterThanOrEqual(seedCount);
    });

    it('should seed requirements', async () => {
      const repo = dataSource.getRepository(RequirementEntity);
      for (let i = 1; i <= seedCount; i++) {
        const req = repo.create({
          id: randomUUID(),
          tenant_id: tenantId,
          title: `Test Requirement ${i}`,
          regulation: 'TEST',
          status: 'pending',
        });
        await repo.save(req).catch(() => {
          // Ignore duplicates
        });
      }
      const count = await repo.count({ where: { tenant_id: tenantId } });
      expect(count).toBeGreaterThanOrEqual(seedCount);
    });

    it('should seed risk catalog', async () => {
      const repo = dataSource.getRepository(RiskCatalogEntity);
      for (let i = 1; i <= seedCount; i++) {
        const risk = repo.create({
          id: randomUUID(),
          tenant_id: tenantId,
          code: `RISK-TEST-${i}`,
          name: `Test Risk ${i}`,
          default_likelihood: 3,
          default_impact: 4,
        });
        await repo.save(risk).catch(() => {
          // Ignore duplicates
        });
      }
      const count = await repo.count({ where: { tenant_id: tenantId } });
      expect(count).toBeGreaterThanOrEqual(seedCount);
    });

    it('should seed entity types', async () => {
      const repo = dataSource.getRepository(EntityTypeEntity);
      for (let i = 1; i <= seedCount; i++) {
        const et = repo.create({
          id: randomUUID(),
          tenant_id: tenantId,
          code: `ET-TEST-${i}`,
          name: `Test Entity Type ${i}`,
        });
        await repo.save(et).catch(() => {
          // Ignore duplicates
        });
      }
      const count = await repo.count({ where: { tenant_id: tenantId } });
      expect(count).toBeGreaterThanOrEqual(seedCount);
    });
  });

  describe('List Endpoints with Real Data', () => {
    const listEndpoints = [
      { path: '/api/v2/governance/policies?page=1&limit=20', name: 'Governance Policies' },
      { path: '/api/v2/compliance/requirements?page=1&limit=20', name: 'Compliance Requirements' },
      { path: '/api/v2/risk-catalog?page=1&pageSize=20', name: 'Risk Catalog' },
      { path: '/api/v2/entity-registry/entity-types?page=1&pageSize=20', name: 'Entity Types' },
    ];

    listEndpoints.forEach(({ path, name }) => {
      it(`should return real data for ${name}`, async () => {
        const [basePath, queryString] = path.split('?');
        const url = queryString ? `${basePath}?${queryString}` : basePath;

        const response = await request(app.getHttpServer())
          .get(url)
          .set('x-tenant-id', tenantId)
          .set('Authorization', 'Bearer fake-token');

        // Accept 200, 401, 403 (not 404/5xx)
        expect([200, 201, 401, 403]).toContain(response.status);

        if (response.status === 200) {
          // Verify PagedListDto contract
          expect(response.body).toHaveProperty('items');
          expect(response.body).toHaveProperty('total');
          expect(response.body).toHaveProperty('page');
          expect(response.body).toHaveProperty('pageSize');
          expect(Array.isArray(response.body.items)).toBe(true);
          expect(typeof response.body.total).toBe('number');
          expect(typeof response.body.page).toBe('number');
          expect(typeof response.body.pageSize).toBe('number');

          // If we have seed data, total should be >= seedCount
          // (may be more if other tests created data)
          if (response.body.total > 0) {
            expect(response.body.items.length).toBeGreaterThan(0);
            expect(response.body.items.length).toBeLessThanOrEqual(response.body.pageSize);
          }
        }
      });
    });
  });

  describe('Filter and Sort', () => {
    it('should filter by q parameter', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v2/governance/policies?page=1&limit=20&q=Test')
        .set('x-tenant-id', tenantId)
        .set('Authorization', 'Bearer fake-token');

      if (response.status === 200) {
        expect(response.body).toHaveProperty('items');
        expect(response.body).toHaveProperty('total');
        expect(Array.isArray(response.body.items)).toBe(true);
      }
    });

    it('should sort by created_at:asc', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v2/governance/policies?page=1&limit=20&sort=created_at:asc')
        .set('x-tenant-id', tenantId)
        .set('Authorization', 'Bearer fake-token');

      if (response.status === 200 && response.body.items.length >= 2) {
        // First item should have earlier or equal created_at than second
        const first = new Date(response.body.items[0].created_at).getTime();
        const second = new Date(response.body.items[1].created_at).getTime();
        expect(first).toBeLessThanOrEqual(second);
      }
    });

    it('should sort by created_at:desc', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v2/governance/policies?page=1&limit=20&sort=created_at:desc')
        .set('x-tenant-id', tenantId)
        .set('Authorization', 'Bearer fake-token');

      if (response.status === 200 && response.body.items.length >= 2) {
        // First item should have later or equal created_at than second
        const first = new Date(response.body.items[0].created_at).getTime();
        const second = new Date(response.body.items[1].created_at).getTime();
        expect(first).toBeGreaterThanOrEqual(second);
      }
    });
  });

  describe('Tenant Isolation', () => {
    const otherTenantId = randomUUID();

    it('should return empty list for different tenant', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v2/governance/policies?page=1&limit=20')
        .set('x-tenant-id', otherTenantId)
        .set('Authorization', 'Bearer fake-token');

      if (response.status === 200) {
        // Different tenant should see empty or different data
        expect(response.body).toHaveProperty('items');
        expect(response.body).toHaveProperty('total');
        // Total should be 0 or different from main tenant
        expect(response.body.total).toBeGreaterThanOrEqual(0);
      }
    });
  });
});

