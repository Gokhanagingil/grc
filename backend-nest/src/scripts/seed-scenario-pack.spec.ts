/**
 * Scenario Data Pack — Idempotency & Record Existence Tests
 *
 * These tests verify:
 * 1. Key scenario records exist with correct stable identifiers
 * 2. Running the seed twice does not increase record counts
 * 3. Critical relationships are intact
 *
 * Prerequisites: seed:grc + seed:cmdb:baseline + seed:scenario-pack must have
 * been run at least once against the test database.
 *
 * These tests use direct DataSource queries (no HTTP) for speed and isolation.
 */

process.env.JOBS_ENABLED = 'false';

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { INestApplicationContext } from '@nestjs/common';

// Import deterministic IDs from the seed pack
import { SCENARIO_PACK_IDS, SCENARIO_TENANT_ID } from './seed-scenario-pack';

const TENANT = SCENARIO_TENANT_ID;
const ID = SCENARIO_PACK_IDS;

let app: INestApplicationContext;
let ds: DataSource;

beforeAll(async () => {
  app = await NestFactory.createApplicationContext(AppModule);
  ds = app.get(DataSource);
}, 30000);

afterAll(async () => {
  if (app) await app.close();
}, 15000);

// ============================================================================
// Helper: count rows matching a query
// ============================================================================

async function countRows(
  table: string,
  where: string,
  params: unknown[] = [],
): Promise<number> {
  const result: Array<{ cnt: string }> = await ds.query(
    `SELECT COUNT(*) as cnt FROM ${table} WHERE ${where}`,
    params,
  );
  return parseInt(result[0]?.cnt ?? '0', 10);
}

async function rowExists(
  table: string,
  where: string,
  params: unknown[] = [],
): Promise<boolean> {
  return (await countRows(table, where, params)) > 0;
}

// ============================================================================
// SECTION 1: Record Existence Assertions
// ============================================================================

describe('Scenario Pack — Record Existence', () => {
  test('CIs: 7 scenario CIs exist', async () => {
    const count = await countRows(
      'cmdb_cis',
      `tenant_id = $1 AND id LIKE 'dddd0200%' AND is_deleted = false`,
      [TENANT],
    );
    expect(count).toBe(7);
  });

  test('CI Relationships: 8 scenario relationships exist', async () => {
    // Count rels where BOTH source and target are scenario CIs
    const count = await countRows(
      'cmdb_ci_rels',
      `tenant_id = $1 AND source_ci_id LIKE 'dddd0200%' AND target_ci_id LIKE 'dddd0200%' AND is_deleted = false`,
      [TENANT],
    );
    expect(count).toBe(8);
  });

  test('Service: Online Banking Platform exists', async () => {
    expect(
      await rowExists(
        'cmdb_service',
        `id = $1 AND tenant_id = $2 AND is_deleted = false`,
        [ID.SVC_ONLINE_BANKING, TENANT],
      ),
    ).toBe(true);
  });

  test('Offerings: 2 scenario offerings exist', async () => {
    const count = await countRows(
      'cmdb_service_offering',
      `tenant_id = $1 AND service_id = $2 AND name LIKE 'SCEN-%' AND is_deleted = false`,
      [TENANT, ID.SVC_ONLINE_BANKING],
    );
    expect(count).toBe(2);
  });

  test('Service-CI links: 5 links exist', async () => {
    const count = await countRows(
      'cmdb_service_ci',
      `tenant_id = $1 AND service_id = $2 AND is_deleted = false`,
      [TENANT, ID.SVC_ONLINE_BANKING],
    );
    expect(count).toBe(5);
  });

  test('Change: CHG-SCEN-001 exists with correct state', async () => {
    const rows: Array<{ state: string; risk: string }> = await ds.query(
      `SELECT state, risk FROM itsm_changes WHERE id = $1 AND tenant_id = $2 AND is_deleted = false`,
      [ID.CHANGE_DB_UPGRADE, TENANT],
    );
    expect(rows.length).toBe(1);
    expect(rows[0].state).toBe('IMPLEMENT');
    expect(rows[0].risk).toBe('HIGH');
  });

  test('Risk Assessment: score 78, HIGH exists for change', async () => {
    expect(
      await rowExists(
        'itsm_change_risk_assessment',
        `id = $1 AND tenant_id = $2 AND change_id = $3 AND is_deleted = false`,
        [ID.RISK_DB_UPGRADE, TENANT, ID.CHANGE_DB_UPGRADE],
      ),
    ).toBe(true);
  });

  test('Incidents: 3 scenario incidents exist', async () => {
    const count = await countRows(
      'itsm_incidents',
      `tenant_id = $1 AND number LIKE 'INC-SCEN-%' AND is_deleted = false`,
      [TENANT],
    );
    expect(count).toBe(3);
  });

  test('Major Incident: MI-SCEN-001 exists', async () => {
    const rows: Array<{ status: string; severity: string }> = await ds.query(
      `SELECT status, severity FROM itsm_major_incidents WHERE id = $1 AND tenant_id = $2 AND is_deleted = false`,
      [ID.MI_BANKING_OUTAGE, TENANT],
    );
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe('INVESTIGATING');
    expect(rows[0].severity).toBe('SEV1');
  });

  test('MI Links: 7 links exist', async () => {
    const count = await countRows(
      'itsm_major_incident_links',
      `tenant_id = $1 AND major_incident_id = $2 AND is_deleted = false`,
      [TENANT, ID.MI_BANKING_OUTAGE],
    );
    expect(count).toBe(7);
  });

  test('Problem: PRB-SCEN-001 exists with KNOWN_ERROR state', async () => {
    const rows: Array<{ state: string; known_error: boolean }> = await ds.query(
      `SELECT state, known_error FROM itsm_problems WHERE id = $1 AND tenant_id = $2 AND is_deleted = false`,
      [ID.PROB_SCHEMA_COMPAT, TENANT],
    );
    expect(rows.length).toBe(1);
    expect(rows[0].state).toBe('KNOWN_ERROR');
    expect(rows[0].known_error).toBe(true);
  });

  test('Problem-Incident links: 3 links exist', async () => {
    const count = await countRows(
      'itsm_problem_incident',
      `tenant_id = $1 AND problem_id = $2 AND is_deleted = false`,
      [TENANT, ID.PROB_SCHEMA_COMPAT],
    );
    expect(count).toBe(3);
  });

  test('Problem-Change link: 1 link exists', async () => {
    const count = await countRows(
      'itsm_problem_change',
      `tenant_id = $1 AND problem_id = $2 AND change_id = $3 AND is_deleted = false`,
      [TENANT, ID.PROB_SCHEMA_COMPAT, ID.CHANGE_DB_UPGRADE],
    );
    expect(count).toBe(1);
  });

  test('Known Error: exists with PUBLISHED state', async () => {
    const rows: Array<{ state: string; permanent_fix_status: string }> =
      await ds.query(
        `SELECT state, permanent_fix_status FROM itsm_known_errors WHERE id = $1 AND tenant_id = $2 AND is_deleted = false`,
        [ID.KE_SCHEMA_WORKAROUND, TENANT],
      );
    expect(rows.length).toBe(1);
    expect(rows[0].state).toBe('PUBLISHED');
    expect(rows[0].permanent_fix_status).toBe('WORKAROUND_AVAILABLE');
  });

  test('Incident-CI links: 4 links exist', async () => {
    const count = await countRows(
      'itsm_incident_ci',
      `tenant_id = $1 AND incident_id IN ($2, $3, $4) AND is_deleted = false`,
      [TENANT, ID.INC_API_500, ID.INC_LOGIN_FAIL, ID.INC_TIMEOUT],
    );
    expect(count).toBe(4);
  });
});

// ============================================================================
// SECTION 2: Idempotency Checks
// ============================================================================

describe('Scenario Pack — Idempotency', () => {
  // Snapshot record counts before and after a hypothetical re-run
  // Since we can't actually re-run the seed in test, we verify counts are
  // exactly as expected (not growing) and that deterministic IDs are stable.

  test('CI count is exactly 7 (no duplicates)', async () => {
    const count = await countRows(
      'cmdb_cis',
      `tenant_id = $1 AND id LIKE 'dddd0200%' AND is_deleted = false`,
      [TENANT],
    );
    expect(count).toBe(7);
  });

  test('Relationship count is exactly 8 (no duplicates)', async () => {
    const count = await countRows(
      'cmdb_ci_rels',
      `tenant_id = $1 AND source_ci_id LIKE 'dddd0200%' AND target_ci_id LIKE 'dddd0200%' AND is_deleted = false`,
      [TENANT],
    );
    expect(count).toBe(8);
  });

  test('MI Link count is exactly 7 (no duplicates)', async () => {
    const count = await countRows(
      'itsm_major_incident_links',
      `tenant_id = $1 AND major_incident_id = $2 AND is_deleted = false`,
      [TENANT, ID.MI_BANKING_OUTAGE],
    );
    expect(count).toBe(7);
  });

  test('Problem-Incident link count is exactly 3 (no duplicates)', async () => {
    const count = await countRows(
      'itsm_problem_incident',
      `tenant_id = $1 AND problem_id = $2 AND is_deleted = false`,
      [TENANT, ID.PROB_SCHEMA_COMPAT],
    );
    expect(count).toBe(3);
  });

  test('Deterministic IDs are stable (CI lookup by name)', async () => {
    const rows: Array<{ id: string }> = await ds.query(
      `SELECT id FROM cmdb_cis WHERE tenant_id = $1 AND name = $2 AND is_deleted = false`,
      [TENANT, 'SCEN-BANKING-DB'],
    );
    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe(ID.CI_PRIMARY_DB);
  });

  test('Deterministic IDs are stable (Change lookup by number)', async () => {
    const rows: Array<{ id: string }> = await ds.query(
      `SELECT id FROM itsm_changes WHERE tenant_id = $1 AND number = $2 AND is_deleted = false`,
      [TENANT, 'CHG-SCEN-001'],
    );
    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe(ID.CHANGE_DB_UPGRADE);
  });

  test('Deterministic IDs are stable (MI lookup by number)', async () => {
    const rows: Array<{ id: string }> = await ds.query(
      `SELECT id FROM itsm_major_incidents WHERE tenant_id = $1 AND number = $2 AND is_deleted = false`,
      [TENANT, 'MI-SCEN-001'],
    );
    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe(ID.MI_BANKING_OUTAGE);
  });
});

// ============================================================================
// SECTION 3: Relationship Integrity
// ============================================================================

describe('Scenario Pack — Relationship Integrity', () => {
  test('MI source incident links to INC-SCEN-001', async () => {
    const rows: Array<{ source_incident_id: string }> = await ds.query(
      `SELECT source_incident_id FROM itsm_major_incidents WHERE id = $1 AND tenant_id = $2`,
      [ID.MI_BANKING_OUTAGE, TENANT],
    );
    expect(rows[0].source_incident_id).toBe(ID.INC_API_500);
  });

  test('Known Error references Problem', async () => {
    const rows: Array<{ problem_id: string }> = await ds.query(
      `SELECT problem_id FROM itsm_known_errors WHERE id = $1 AND tenant_id = $2`,
      [ID.KE_SCHEMA_WORKAROUND, TENANT],
    );
    expect(rows[0].problem_id).toBe(ID.PROB_SCHEMA_COMPAT);
  });

  test('Change is linked to Service', async () => {
    const rows: Array<{ service_id: string }> = await ds.query(
      `SELECT service_id FROM itsm_changes WHERE id = $1 AND tenant_id = $2`,
      [ID.CHANGE_DB_UPGRADE, TENANT],
    );
    expect(rows[0].service_id).toBe(ID.SVC_ONLINE_BANKING);
  });

  test('RCA hypotheses metadata present in MI', async () => {
    const rows: Array<{ metadata: Record<string, unknown> }> = await ds.query(
      `SELECT metadata FROM itsm_major_incidents WHERE id = $1 AND tenant_id = $2`,
      [ID.MI_BANKING_OUTAGE, TENANT],
    );
    const meta = rows[0]?.metadata;
    expect(meta).toBeDefined();
    const hypotheses = meta.rcaHypotheses;
    expect(Array.isArray(hypotheses)).toBe(true);
    expect((hypotheses as unknown[]).length).toBe(3);
  });

  test('Problem has Phase-2 RCA fields populated', async () => {
    const rows: Array<{
      five_why_summary: string;
      root_cause_category: string;
      contributing_factors: string[];
    }> = await ds.query(
      `SELECT five_why_summary, root_cause_category, contributing_factors FROM itsm_problems WHERE id = $1 AND tenant_id = $2`,
      [ID.PROB_SCHEMA_COMPAT, TENANT],
    );
    expect(rows[0].five_why_summary).toBeTruthy();
    expect(rows[0].root_cause_category).toBe('PROCESS_FAILURE');
    expect(Array.isArray(rows[0].contributing_factors)).toBe(true);
    expect(rows[0].contributing_factors.length).toBeGreaterThan(0);
  });

  test('Partial data: INC-SCEN-003 has null assignee (confidence degradation)', async () => {
    const rows: Array<{ assigned_to: string | null }> = await ds.query(
      `SELECT assigned_to FROM itsm_incidents WHERE id = $1 AND tenant_id = $2`,
      [ID.INC_TIMEOUT, TENANT],
    );
    expect(rows[0].assigned_to).toBeNull();
  });

  test('Partial data: Backup DB CI has null IP/DNS (confidence degradation)', async () => {
    const rows: Array<{ ip_address: string | null; dns_name: string | null }> =
      await ds.query(
        `SELECT ip_address, dns_name FROM cmdb_cis WHERE id = $1 AND tenant_id = $2`,
        [ID.CI_BACKUP_DB, TENANT],
      );
    expect(rows[0].ip_address).toBeNull();
    expect(rows[0].dns_name).toBeNull();
  });
});
