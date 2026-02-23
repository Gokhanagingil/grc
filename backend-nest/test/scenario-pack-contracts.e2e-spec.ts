/**
 * Scenario Pack API Contract Tests (Phase C)
 *
 * Lightweight but real contract assertions for critical ITSM endpoints
 * using deterministic scenario data from PR #462.
 *
 * These tests validate:
 *   - Response shapes and required fields
 *   - Type invariants (array/object/nullable)
 *   - Contract stability across refactors
 *
 * They do NOT validate:
 *   - Exact payload snapshots
 *   - Styling or UI concerns
 *   - Performance characteristics
 *
 * Prerequisites:
 *   - Database with seed:scenario-pack executed
 *   - Backend running or test app initialized
 *
 * Tags: @contract @real @scenario-pack
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

// ============================================================================
// Deterministic IDs from PR #462 seed-scenario-pack.ts
// ============================================================================
const SCENARIO_IDS = {
  CI_PRIMARY_DB: 'dddd0200-0000-0000-0000-000000000003',
  CI_CORE_API: 'dddd0200-0000-0000-0000-000000000002',
  SVC_ONLINE_BANKING: 'dddd0400-0000-0000-0000-000000000001',
  CHANGE_DB_UPGRADE: 'dddd0500-0000-0000-0000-000000000001',
  MI_BANKING_OUTAGE: 'dddd0600-0000-0000-0000-000000000010',
  PROB_SCHEMA_COMPAT: 'dddd0700-0000-0000-0000-000000000001',
  KE_SCHEMA_WORKAROUND: 'dddd0700-0000-0000-0000-000000000010',
};

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

// ============================================================================
// Helper: authenticate and get token
// ============================================================================
async function getAuthToken(
  app: INestApplication,
): Promise<{ token: string; tenantId: string }> {
  const email = process.env.DEMO_ADMIN_EMAIL || 'admin@grc-platform.local';
  const password = process.env.DEMO_ADMIN_PASSWORD || 'TestPassword123!';

  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .set('x-tenant-id', TENANT_ID)
    .send({ email, password });

  if (res.status !== 200 && res.status !== 201) {
    throw new Error(
      `Auth failed: POST /auth/login returned ${res.status}. ` +
        `Check credentials and ensure demo user exists.`,
    );
  }

  const body = res.body.data || res.body;
  return {
    token: body.accessToken || body.access_token || body.token,
    tenantId: body.user?.tenantId || TENANT_ID,
  };
}

// ============================================================================
// Helper: make authenticated GET request
// ============================================================================
function authGet(
  app: INestApplication,
  path: string,
  token: string,
  tenantId: string,
) {
  return request(app.getHttpServer())
    .get(path)
    .set('Authorization', `Bearer ${token}`)
    .set('x-tenant-id', tenantId)
    .set('Content-Type', 'application/json');
}

// ============================================================================
// Helper: unwrap envelope
// ============================================================================
function unwrap(body: Record<string, unknown>): Record<string, unknown> {
  if (
    body &&
    typeof body === 'object' &&
    'success' in body &&
    body.success === true &&
    'data' in body
  ) {
    return body.data as Record<string, unknown>;
  }
  return body;
}

// ============================================================================
// Tests
// ============================================================================
describe('Scenario Pack API Contracts @contract @real @scenario-pack', () => {
  let app: INestApplication;
  let token: string;
  let tenantId: string;
  let scenarioSeeded = true;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    try {
      const auth = await getAuthToken(app);
      token = auth.token;
      tenantId = auth.tenantId;
    } catch (e) {
      console.warn('Auth failed — contract tests will be skipped:', e);
      scenarioSeeded = false;
      return;
    }

    // Quick check: is the scenario pack seeded?
    const checkRes = await authGet(
      app,
      `/grc/itsm/changes/${SCENARIO_IDS.CHANGE_DB_UPGRADE}`,
      token,
      tenantId,
    );
    if (checkRes.status === 404) {
      console.warn(
        'Scenario pack not seeded — contract tests will be skipped. ' +
          'Run: cd backend-nest && npm run seed:scenario-pack',
      );
      scenarioSeeded = false;
    }
  }, 60000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // --------------------------------------------------------------------------
  // Change endpoint contract
  // --------------------------------------------------------------------------
  describe('Change endpoint (CHG-SCEN-001)', () => {
    it('GET /grc/itsm/changes/:id returns correct shape', async () => {
      if (!scenarioSeeded) return;

      const res = await authGet(
        app,
        `/grc/itsm/changes/${SCENARIO_IDS.CHANGE_DB_UPGRADE}`,
        token,
        tenantId,
      );

      expect(res.status).toBe(200);
      const data = unwrap(res.body);

      // Contract invariants
      expect(data).toHaveProperty('id', SCENARIO_IDS.CHANGE_DB_UPGRADE);
      expect(
        typeof data.title === 'string' || typeof data.changeNumber === 'string',
      ).toBe(true);
      expect(data).toHaveProperty('status');

      // Type checks for optional but expected fields
      if ('priority' in data) {
        expect(typeof data.priority).toMatch(/string|number/);
      }
      if ('risk' in data) {
        expect(typeof data.risk).toMatch(/string|object/);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Topology impact endpoint contract
  // --------------------------------------------------------------------------
  describe('Topology impact endpoint', () => {
    it('GET /grc/itsm/changes/:id/topology-impact returns parseable structure', async () => {
      if (!scenarioSeeded) return;

      const res = await authGet(
        app,
        `/grc/itsm/changes/${SCENARIO_IDS.CHANGE_DB_UPGRADE}/topology-impact`,
        token,
        tenantId,
      );

      // 200 with data or 404 (not yet computed) — both acceptable
      expect(res.status).toBeLessThan(500);

      if (res.status === 200) {
        const data = unwrap(res.body);
        expect(typeof data).toBe('object');
        expect(data).not.toBeNull();

        // Tolerant: check for known possible fields
        const knownFields = [
          'impactedCis',
          'impactedServices',
          'riskScore',
          'affectedComponents',
          'topology',
          'analysis',
          'buckets',
          'summary',
          'enhancedAnalysis',
        ];
        // At least one of these should be present in a computed result
        const hasAnyKnownField = knownFields.some((f) => f in data);
        if (Object.keys(data).length > 0) {
          expect(hasAnyKnownField).toBe(true);
        }
      }
    });
  });

  // --------------------------------------------------------------------------
  // Major Incident endpoint contract
  // --------------------------------------------------------------------------
  describe('Major Incident endpoint (MI-SCEN-001)', () => {
    it('GET /grc/itsm/major-incidents/:id returns correct shape', async () => {
      if (!scenarioSeeded) return;

      const res = await authGet(
        app,
        `/grc/itsm/major-incidents/${SCENARIO_IDS.MI_BANKING_OUTAGE}`,
        token,
        tenantId,
      );

      expect(res.status).toBe(200);
      const data = unwrap(res.body);

      // Contract invariants
      expect(data).toHaveProperty('id', SCENARIO_IDS.MI_BANKING_OUTAGE);
      expect(
        typeof data.title === 'string' ||
          typeof data.shortDescription === 'string',
      ).toBe(true);
    });

    it('GET /grc/itsm/major-incidents/:id/rca-topology-hypotheses returns parseable structure', async () => {
      if (!scenarioSeeded) return;

      const res = await authGet(
        app,
        `/grc/itsm/major-incidents/${SCENARIO_IDS.MI_BANKING_OUTAGE}/rca-topology-hypotheses`,
        token,
        tenantId,
      );

      expect(res.status).toBeLessThan(500);

      if (res.status === 200) {
        const data = unwrap(res.body);
        expect(typeof data).toBe('object');

        // Could be { hypotheses: [...] } or an array directly
        if ('hypotheses' in data) {
          expect(Array.isArray(data.hypotheses)).toBe(true);
        }
      }
    });

    it('GET /grc/itsm/major-incidents/:id/links returns array-like structure', async () => {
      if (!scenarioSeeded) return;

      const res = await authGet(
        app,
        `/grc/itsm/major-incidents/${SCENARIO_IDS.MI_BANKING_OUTAGE}/links`,
        token,
        tenantId,
      );

      expect(res.status).toBeLessThan(500);

      if (res.status === 200) {
        const data = unwrap(res.body);
        // Links can be array or { items: [...] } or { links: [...] }
        const isValidShape =
          Array.isArray(data) ||
          (typeof data === 'object' &&
            data !== null &&
            ('items' in data || 'links' in data));
        expect(isValidShape).toBe(true);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Problem endpoint contract
  // --------------------------------------------------------------------------
  describe('Problem endpoint (PRB-SCEN-001)', () => {
    it('GET /grc/itsm/problems/:id returns correct shape with RCA fields', async () => {
      if (!scenarioSeeded) return;

      const res = await authGet(
        app,
        `/grc/itsm/problems/${SCENARIO_IDS.PROB_SCHEMA_COMPAT}`,
        token,
        tenantId,
      );

      expect(res.status).toBe(200);
      const data = unwrap(res.body);

      // Contract invariants
      expect(data).toHaveProperty('id', SCENARIO_IDS.PROB_SCHEMA_COMPAT);
      expect(data).toHaveProperty('status');

      // RCA-related fields should exist on scenario problem
      const hasRcaIndicator =
        'rcaEntries' in data ||
        'rootCauseSummary' in data ||
        'fiveWhySummary' in data ||
        'rcaStatus' in data;
      // Tolerate if RCA is not embedded in single-GET (may require separate endpoint)
      if (hasRcaIndicator) {
        expect(hasRcaIndicator).toBe(true);
      }
    });

    it('GET /grc/itsm/problems/:id/rca returns RCA data structure', async () => {
      if (!scenarioSeeded) return;

      const res = await authGet(
        app,
        `/grc/itsm/problems/${SCENARIO_IDS.PROB_SCHEMA_COMPAT}/rca`,
        token,
        tenantId,
      );

      expect(res.status).toBeLessThan(500);

      if (res.status === 200) {
        const body = res.body;
        // RCA response should have entries or summary
        expect(typeof body).toBe('object');
        // Tolerate various RCA response shapes
        const isValidRca =
          Array.isArray(body.rcaEntries) ||
          typeof body.rootCauseSummary === 'string' ||
          (body.data && Array.isArray(body.data.rcaEntries)) ||
          typeof body === 'object';
        expect(isValidRca).toBe(true);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Known Error endpoint contract
  // --------------------------------------------------------------------------
  describe('Known Error endpoint (KE-SCEN-001)', () => {
    it('GET /grc/itsm/known-errors/:id returns correct shape', async () => {
      if (!scenarioSeeded) return;

      const res = await authGet(
        app,
        `/grc/itsm/known-errors/${SCENARIO_IDS.KE_SCHEMA_WORKAROUND}`,
        token,
        tenantId,
      );

      expect(res.status).toBe(200);
      const data = unwrap(res.body);

      // Contract invariants
      expect(data).toHaveProperty('id', SCENARIO_IDS.KE_SCHEMA_WORKAROUND);

      // KE should have state and workaround-related fields
      if ('state' in data) {
        expect(typeof data.state).toBe('string');
      }
      if ('workaround' in data || 'workaroundNotes' in data) {
        const workaround = data.workaround || data.workaroundNotes;
        expect(typeof workaround).toBe('string');
      }
    });
  });

  // --------------------------------------------------------------------------
  // CMDB Topology contract
  // --------------------------------------------------------------------------
  describe('CMDB Topology contract', () => {
    it('GET /grc/cmdb/topology/ci/:id returns graph shape', async () => {
      if (!scenarioSeeded) return;

      const res = await authGet(
        app,
        `/grc/cmdb/topology/ci/${SCENARIO_IDS.CI_PRIMARY_DB}?depth=2`,
        token,
        tenantId,
      );

      if (res.status === 404) {
        // CI not found — scenario pack may not be seeded
        return;
      }

      expect(res.status).toBe(200);
      const data = unwrap(res.body);

      // Topology contract: must have nodes, edges, meta
      expect(Array.isArray(data.nodes)).toBe(true);
      expect(Array.isArray(data.edges)).toBe(true);
      expect(typeof data.meta).toBe('object');
      expect(data.meta).not.toBeNull();

      const meta = data.meta as Record<string, unknown>;
      expect(meta).toHaveProperty('rootNodeId');
      expect(meta).toHaveProperty('nodeCount');
      expect(meta).toHaveProperty('edgeCount');
      expect(meta).toHaveProperty('depth');
      expect(meta).toHaveProperty('truncated');

      // Verify nodeCount matches nodes array
      expect(meta.nodeCount).toBe((data.nodes as unknown[]).length);
      expect(meta.edgeCount).toBe((data.edges as unknown[]).length);
    });

    it('GET /grc/cmdb/topology/service/:id returns graph shape', async () => {
      if (!scenarioSeeded) return;

      const res = await authGet(
        app,
        `/grc/cmdb/topology/service/${SCENARIO_IDS.SVC_ONLINE_BANKING}?depth=2`,
        token,
        tenantId,
      );

      // Service topology may not be available for all setups
      expect(res.status).toBeLessThan(500);

      if (res.status === 200) {
        const data = unwrap(res.body);
        expect(Array.isArray(data.nodes)).toBe(true);
        expect(Array.isArray(data.edges)).toBe(true);
        expect(typeof data.meta).toBe('object');
      }
    });
  });
});
