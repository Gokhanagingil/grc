# Scenario Data Pack — Runbook

## Overview

The Scenario Data Pack creates a deterministic, idempotent dataset for validating
Topology Intelligence Phase-2 UX/backend features across CMDB + ITSM flows.

### Scenario Story: "Online Banking Platform — DB Upgrade Incident"

A critical Tier-1 business service ("Online Banking Platform") is backed by a web
application, core API, PostgreSQL database, Redis cache, firewall, app server, and
a backup DB. A planned Normal change (DB version upgrade from PG 15.4 to 15.6) is
executed. Shortly after, a Major Incident is declared — the Core API returns 500
errors because the upgrade dropped materialized views. A Problem is raised, a Known
Error is documented with a workaround, and multiple child incidents are linked.

Some CIs intentionally lack metadata (IP, DNS) and some incidents lack assignees
to exercise confidence degradation and partial-data UI resilience.

## What Gets Seeded

| Layer | Entity | Count | Key Identifiers |
|-------|--------|-------|-----------------|
| 2 | CMDB CIs | 7 | `SCEN-BANKING-*` names, `dddd0200-*` IDs |
| 3 | CI Relationships | 8 | depends_on, runs_on, connects_to |
| 4 | CMDB Service | 1 | `SCEN-Online-Banking-Platform` |
| 4 | Service Offerings | 2 | `SCEN-Retail-*`, `SCEN-Corporate-*` |
| 4 | Service-CI Links | 5 | Service → 5 CIs |
| 5 | Change | 1 | `CHG-SCEN-001` |
| 5 | Risk Assessment | 1 | Score 78, HIGH |
| 6 | Incidents | 3 | `INC-SCEN-001/002/003` |
| 6 | Incident-CI Links | 4 | affected, caused_by |
| 6 | Major Incident | 1 | `MI-SCEN-001` (SEV1) |
| 6 | MI Links | 7 | Incidents, Change, Service, CIs |
| 6 | MI Timeline Updates | 2 | DECLARED → INVESTIGATING |
| 7 | Problem | 1 | `PRB-SCEN-001` (KNOWN_ERROR) |
| 7 | Problem-Incident Links | 3 | PRIMARY_SYMPTOM, RELATED |
| 7 | Problem-Change Link | 1 | INVESTIGATES |
| 7 | Known Error | 1 | PUBLISHED, workaround available |

**Total: ~47 records across 15 entity types**

## Prerequisites

Run these seeds first (in order):

```bash
# 1. Base tenant + admin user
npm run seed:grc:dev

# 2. CMDB CI classes + choices
npm run seed:cmdb:baseline:dev
```

## Invocation

### Local Development

```bash
cd backend-nest

# Run the scenario pack seed
npm run seed:scenario-pack:dev
```

### Staging (via Docker)

```bash
# Build first
docker compose -f docker-compose.staging.yml exec -T backend sh -lc \
  'node dist/scripts/seed-scenario-pack.js'
```

### Idempotency Verification

```bash
# Run twice — second run should show all REUSED, zero CREATED
npm run seed:scenario-pack:dev
npm run seed:scenario-pack:dev
```

## Deterministic IDs

All scenario records use the `dddd` UUID prefix to avoid collision with other seeds:

| Entity | ID | Number |
|--------|----|--------|
| CI: Web App | `dddd0200-0000-0000-0000-000000000001` | — |
| CI: Core API | `dddd0200-0000-0000-0000-000000000002` | — |
| CI: Primary DB | `dddd0200-0000-0000-0000-000000000003` | — |
| CI: Redis Cache | `dddd0200-0000-0000-0000-000000000004` | — |
| CI: Firewall | `dddd0200-0000-0000-0000-000000000005` | — |
| CI: App Server | `dddd0200-0000-0000-0000-000000000006` | — |
| CI: Backup DB | `dddd0200-0000-0000-0000-000000000007` | — |
| Service | `dddd0400-0000-0000-0000-000000000001` | — |
| Offering: Retail | `dddd0400-0000-0000-0000-000000000010` | — |
| Offering: Corporate | `dddd0400-0000-0000-0000-000000000011` | — |
| Change | `dddd0500-0000-0000-0000-000000000001` | CHG-SCEN-001 |
| Risk Assessment | `dddd0500-0000-0000-0000-000000000010` | — |
| Incident 1 | `dddd0600-0000-0000-0000-000000000001` | INC-SCEN-001 |
| Incident 2 | `dddd0600-0000-0000-0000-000000000002` | INC-SCEN-002 |
| Incident 3 | `dddd0600-0000-0000-0000-000000000003` | INC-SCEN-003 |
| Major Incident | `dddd0600-0000-0000-0000-000000000010` | MI-SCEN-001 |
| Problem | `dddd0700-0000-0000-0000-000000000001` | PRB-SCEN-001 |
| Known Error | `dddd0700-0000-0000-0000-000000000010` | — |

## 1-Minute Demo Checklist

1. Run `npm run seed:scenario-pack:dev` — verify output shows CREATED counts
2. Check CI topology:
   ```
   curl -s -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
     http://localhost:3000/grc/cmdb/topology/ci/dddd0200-0000-0000-0000-000000000003?depth=3
   ```
3. Check Major Incident:
   ```
   curl -s -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
     http://localhost:3000/grc/itsm/major-incidents/dddd0600-0000-0000-0000-000000000010
   ```
4. Check Change:
   ```
   curl -s -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
     http://localhost:3000/grc/itsm/changes/dddd0500-0000-0000-0000-000000000001
   ```
5. Re-run seed — verify all REUSED, zero CREATED

## 5-Minute Validation Checklist

1. **Topology Impact**: Open change CHG-SCEN-001 in UI → verify topology impact
   analysis shows 5 affected CIs through dependency chain
2. **MI RCA Hypotheses**: Open MI MI-SCEN-001 → verify 3 RCA hypotheses are
   displayed with confidence scores (0.92, 0.58, 0.35) and degrading factors
3. **Problem RCA Phase-2**: Open PRB-SCEN-001 → verify 5-whys summary,
   contributing factors, root cause category (PROCESS_FAILURE), detection gap,
   monitoring gap
4. **Known Error**: Open KE linked to PRB-SCEN-001 → verify workaround text,
   PUBLISHED state, knowledge candidate flag
5. **Incident Relationships**: Open INC-SCEN-001 → verify linked to MI, Problem,
   and CI (SCEN-BANKING-API, SCEN-BANKING-DB)
6. **Partial Data**: Open INC-SCEN-003 → verify no assignee, P2 priority,
   OPEN status (exercises UI resilience for missing fields)
7. **Service Impact**: Check service SCEN-Online-Banking-Platform → verify
   5 CI links and 2 offerings
8. **Confidence Degradation**: Verify SCEN-BANKING-CACHE has no DNS record and
   SCEN-BANKING-DB-BKP has no IP/DNS — topology analysis should show reduced
   confidence for these nodes

## Cleanup / Rollback

The seed pack does NOT provide automatic cleanup. To remove scenario data:

```sql
-- WARNING: Execute with care. Verify tenant_id filter.
-- Run inside psql connected to the target database.

BEGIN;

DELETE FROM itsm_problem_change WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND problem_id LIKE 'dddd07%';
DELETE FROM itsm_problem_incident WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND problem_id LIKE 'dddd07%';
DELETE FROM itsm_known_errors WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND id LIKE 'dddd07%';
DELETE FROM itsm_problems WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND id LIKE 'dddd07%';
DELETE FROM itsm_major_incident_updates WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND major_incident_id LIKE 'dddd06%';
DELETE FROM itsm_major_incident_links WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND major_incident_id LIKE 'dddd06%';
DELETE FROM itsm_major_incidents WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND id LIKE 'dddd06%';
DELETE FROM itsm_incident_ci WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND incident_id LIKE 'dddd06%';
DELETE FROM itsm_incidents WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND id LIKE 'dddd06%';
DELETE FROM itsm_change_risk_assessment WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND id LIKE 'dddd05%';
DELETE FROM itsm_changes WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND id LIKE 'dddd05%';
DELETE FROM cmdb_service_ci WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND service_id LIKE 'dddd04%';
DELETE FROM cmdb_service_offering WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND id LIKE 'dddd04%';
DELETE FROM cmdb_service WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND id LIKE 'dddd04%';
DELETE FROM cmdb_ci_rel WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND source_ci_id LIKE 'dddd02%';
DELETE FROM cmdb_ci WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND id LIKE 'dddd02%';

COMMIT;
```

## Assumptions & Gaps

- Seed depends on `seed:grc` (tenant) and `seed:cmdb:baseline` (CI classes) being
  run first. If classes are missing, the seed exits with a clear error message.
- The seed uses the demo tenant `00000000-0000-0000-0000-000000000001` and admin
  user `00000000-0000-0000-0000-000000000002`.
- Timestamps are relative to script execution time. Re-running updates timestamps
  on changed records but does not duplicate records.
- The seed does NOT modify existing non-scenario records.
- The MI timeline updates are append-only; re-run skips if enough entries exist.
