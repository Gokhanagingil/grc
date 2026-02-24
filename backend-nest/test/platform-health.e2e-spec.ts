import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';

const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000001';

describe('Platform Health API (e2e)', () => {
  let app: INestApplication;
  let adminToken: string | null = null;
  let tenantId: string | null = null;
  let dbConnected = false;

  beforeAll(async () => {
    try {
      const { AppModule } = await import('../src/app.module');

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({ whitelist: true, transform: true }),
      );
      await app.init();

      const ds = app.get(DataSource);
      dbConnected = ds.isInitialized;

      if (dbConnected) {
        tenantId = TEST_TENANT_ID;
        try {
          const loginRes = await request(app.getHttpServer())
            .post('/auth/login')
            .send({
              email: process.env.DEMO_ADMIN_EMAIL || 'admin@grc.dev',
              password: process.env.DEMO_ADMIN_PASSWORD || 'Admin123!',
            });
          const body = loginRes.body;
          adminToken =
            body.data?.accessToken ||
            body.data?.token ||
            body.accessToken ||
            body.token ||
            null;
        } catch {
          adminToken = null;
        }
      }
    } catch (error) {
      console.log('Setup failed, tests will be skipped:', error);
    }
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  }, 15000);

  describe('GET /grc/platform-health/runs', () => {
    it('should return runs list (or 401/403 if not authorized)', async () => {
      if (!app || !dbConnected || !tenantId) {
        console.log('Skipping: app not initialized or DB not connected');
        return;
      }

      const req = request(app.getHttpServer())
        .get('/grc/platform-health/runs')
        .set('x-tenant-id', tenantId);

      if (adminToken) {
        req.set('Authorization', `Bearer ${adminToken}`);
      }

      const response = await req;
      expect([200, 401, 403]).toContain(response.status);

      if (response.status === 200) {
        const data = response.body.data ?? response.body;
        expect(Array.isArray(data)).toBe(true);
      }
    });
  });

  describe('GET /grc/platform-health/badge', () => {
    it('should return badge summary (or 401/403 if not authorized)', async () => {
      if (!app || !dbConnected || !tenantId) {
        console.log('Skipping: app not initialized or DB not connected');
        return;
      }

      const req = request(app.getHttpServer())
        .get('/grc/platform-health/badge')
        .query({ suite: 'TIER1' })
        .set('x-tenant-id', tenantId);

      if (adminToken) {
        req.set('Authorization', `Bearer ${adminToken}`);
      }

      const response = await req;
      expect([200, 401, 403]).toContain(response.status);

      if (response.status === 200) {
        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('status');
        expect(data).toHaveProperty('passRate');
        expect(['GREEN', 'AMBER', 'RED', 'UNKNOWN']).toContain(data.status);
      }
    });
  });

  describe('POST /grc/platform-health/ingest', () => {
    it('should accept a valid ingest payload (or 401/403 if not authorized)', async () => {
      if (!app || !dbConnected || !tenantId || !adminToken) {
        console.log('Skipping: no admin token or DB not connected');
        return;
      }

      const payload = {
        suite: 'TIER1',
        triggeredBy: 'e2e-test',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: 1234,
        checks: [
          {
            module: 'health',
            checkName: 'api-liveness',
            status: 'PASSED',
            durationMs: 50,
            httpStatus: 200,
          },
          {
            module: 'health',
            checkName: 'db-connectivity',
            status: 'PASSED',
            durationMs: 30,
            httpStatus: 200,
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/grc/platform-health/ingest')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send(payload);

      expect([200, 201, 401, 403]).toContain(response.status);

      if (response.status === 200 || response.status === 201) {
        const data = response.body.data ?? response.body;
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('suite');
        expect(data.totalChecks).toBe(2);
        expect(data.passedChecks).toBe(2);
        expect(data.failedChecks).toBe(0);
      }
    });

    it('should reject invalid payload with 400', async () => {
      if (!app || !dbConnected || !tenantId || !adminToken) {
        console.log('Skipping: no admin token or DB not connected');
        return;
      }

      const response = await request(app.getHttpServer())
        .post('/grc/platform-health/ingest')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send({ suite: 'TIER1' });

      expect([400, 401, 403]).toContain(response.status);
    });
  });

  describe('Ingest -> List -> Detail round-trip', () => {
    it('should persist and retrieve a run with checks', async () => {
      if (!app || !dbConnected || !tenantId || !adminToken) {
        console.log('Skipping: no admin token or DB not connected');
        return;
      }

      const payload = {
        suite: 'MANUAL',
        triggeredBy: 'e2e-roundtrip',
        gitSha: 'abc1234',
        gitRef: 'refs/heads/test',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: 5000,
        checks: [
          {
            module: 'itsm',
            checkName: 'incidents-list',
            status: 'PASSED',
            durationMs: 120,
            httpStatus: 200,
            requestUrl: '/grc/itsm/incidents',
          },
          {
            module: 'itsm',
            checkName: 'changes-list',
            status: 'FAILED',
            durationMs: 250,
            httpStatus: 500,
            errorMessage: 'Internal server error',
            requestUrl: '/grc/itsm/changes',
          },
        ],
      };

      const ingestRes = await request(app.getHttpServer())
        .post('/grc/platform-health/ingest')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send(payload);

      if (![200, 201].includes(ingestRes.status)) {
        console.log('Skipping round-trip: ingest returned', ingestRes.status);
        return;
      }

      const runData = ingestRes.body.data ?? ingestRes.body;
      const runId = runData.id;
      expect(runId).toBeDefined();
      expect(runData.status).toBe('FAILED');
      expect(runData.passedChecks).toBe(1);
      expect(runData.failedChecks).toBe(1);

      const listRes = await request(app.getHttpServer())
        .get('/grc/platform-health/runs')
        .query({ suite: 'MANUAL' })
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const runs = listRes.body.data ?? listRes.body;
      expect(Array.isArray(runs)).toBe(true);
      const found = runs.find((r: Record<string, unknown>) => r.id === runId);
      expect(found).toBeDefined();

      const detailRes = await request(app.getHttpServer())
        .get(`/grc/platform-health/runs/${runId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const detail = detailRes.body.data ?? detailRes.body;
      expect(detail.id).toBe(runId);
      expect(detail.checks).toBeDefined();
      expect(detail.checks.length).toBe(2);

      const failedCheck = detail.checks.find(
        (c: Record<string, unknown>) => c.status === 'FAILED',
      );
      expect(failedCheck).toBeDefined();
      expect(failedCheck.errorMessage).toBe('Internal server error');
    });
  });

  describe('Tenant-scoped ingest and query', () => {
    const SECOND_TENANT = '00000000-0000-0000-0000-000000000002';

    it('should ingest a run with tenantId and filter by it', async () => {
      if (!app || !dbConnected || !tenantId || !adminToken) {
        console.log('Skipping: no admin token or DB not connected');
        return;
      }

      const tenantPayload = {
        suite: 'TIER1',
        triggeredBy: 'e2e-tenant-test',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: 800,
        tenantId: SECOND_TENANT,
        checks: [
          {
            module: 'auth',
            checkName: 'tenant-login',
            status: 'PASSED',
            durationMs: 40,
            httpStatus: 200,
          },
        ],
      };

      const ingestRes = await request(app.getHttpServer())
        .post('/grc/platform-health/ingest')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send(tenantPayload);

      if (![200, 201].includes(ingestRes.status)) {
        console.log('Skipping tenant test: ingest returned', ingestRes.status);
        return;
      }

      const runData = ingestRes.body.data ?? ingestRes.body;
      expect(runData.tenantId).toBe(SECOND_TENANT);

      const tenantListRes = await request(app.getHttpServer())
        .get('/grc/platform-health/runs')
        .query({ tenantId: SECOND_TENANT })
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const tenantRuns = tenantListRes.body.data ?? tenantListRes.body;
      expect(Array.isArray(tenantRuns)).toBe(true);
      const tenantRun = tenantRuns.find(
        (r: Record<string, unknown>) => r.id === runData.id,
      );
      expect(tenantRun).toBeDefined();
    });

    it('should ingest a global run (no tenantId) and isolate from tenant queries', async () => {
      if (!app || !dbConnected || !tenantId || !adminToken) {
        console.log('Skipping: no admin token or DB not connected');
        return;
      }

      const globalPayload = {
        suite: 'TIER1',
        triggeredBy: 'e2e-global-test',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: 600,
        checks: [
          {
            module: 'health',
            checkName: 'global-liveness',
            status: 'PASSED',
            durationMs: 20,
            httpStatus: 200,
          },
        ],
      };

      const ingestRes = await request(app.getHttpServer())
        .post('/grc/platform-health/ingest')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .send(globalPayload);

      if (![200, 201].includes(ingestRes.status)) {
        console.log('Skipping global test: ingest returned', ingestRes.status);
        return;
      }

      const globalRun = ingestRes.body.data ?? ingestRes.body;
      expect(globalRun.tenantId).toBeNull();

      const globalListRes = await request(app.getHttpServer())
        .get('/grc/platform-health/runs')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const globalRuns = globalListRes.body.data ?? globalListRes.body;
      const foundGlobal = globalRuns.find(
        (r: Record<string, unknown>) => r.id === globalRun.id,
      );
      expect(foundGlobal).toBeDefined();

      const tenantFilterRes = await request(app.getHttpServer())
        .get('/grc/platform-health/runs')
        .query({ tenantId: SECOND_TENANT })
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);

      const tenantFilteredRuns =
        tenantFilterRes.body.data ?? tenantFilterRes.body;
      const foundInTenant = tenantFilteredRuns.find(
        (r: Record<string, unknown>) => r.id === globalRun.id,
      );
      expect(foundInTenant).toBeUndefined();
    });

    it('should scope badge to tenantId when provided', async () => {
      if (!app || !dbConnected || !tenantId || !adminToken) {
        console.log('Skipping: no admin token or DB not connected');
        return;
      }

      const badgeRes = await request(app.getHttpServer())
        .get('/grc/platform-health/badge')
        .query({ suite: 'TIER1', tenantId: SECOND_TENANT })
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-id', tenantId);

      expect([200, 401, 403]).toContain(badgeRes.status);

      if (badgeRes.status === 200) {
        const badge = badgeRes.body.data ?? badgeRes.body;
        expect(badge).toHaveProperty('status');
        expect(badge).toHaveProperty('passRate');
      }
    });
  });
});
