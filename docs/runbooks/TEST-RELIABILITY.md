# Test Reliability Runbook

## Overview

This runbook covers how to run, debug, and maintain the test reliability infrastructure for the GRC+ITSM platform. It covers the deterministic scenario pack, smoke tests, API contract checks, and CI integration.

## Quick Start

### 1. Seed Scenario Pack (Deterministic Data)

The scenario pack from PR #462 creates 48 records across 15 entities with deterministic UUIDs. This data is the foundation for all reliability tests.

```bash
# From the backend-nest directory
cd backend-nest

# Ensure database is running and migrated
npm run migration:run

# Seed the scenario pack (idempotent — safe to re-run)
npm run seed:scenario-pack
```

**Expected output:** Summary showing 48 records created across CIs, relationships, services, changes, incidents, major incidents, problems, and known errors.

### 2. Run Scenario Pack Smoke Tests

```bash
# From the repo root — requires backend running on localhost:3002

# Start backend first
cd backend-nest && npm run start:dev &

# Wait for backend to be ready
curl -sf http://localhost:3002/health/live

# Run scenario pack smoke suite
E2E_MODE=REAL_STACK npx playwright test --project=scenario-pack

# Run topology smoke suite
E2E_MODE=REAL_STACK npx playwright test --project=topology

# Run all smoke suites
E2E_MODE=REAL_STACK npx playwright test --project=scenario-pack --project=topology
```

### 3. Run API Contract Checks (Backend Jest)

```bash
cd backend-nest

# Run scenario pack contract tests only
npx jest --config test/jest-e2e.json --testPathPattern scenario-pack-contracts

# Run all e2e tests
npm run test:e2e
```

## Test Suites Reference

| Suite | Project | Tags | Runtime | What It Tests |
|-------|---------|------|---------|---------------|
| scenario-pack-smoke | `scenario-pack` | @smoke @real @scenario-pack | ~1 min | Change/MI/Problem/KE/CMDB API flows using seeded data |
| topology-smoke | `topology` | @real @topology | ~2 min | CMDB topology API contracts (CI + Service graphs) |
| analytics-smoke | `analytics` | @real @analytics | ~1 min | Analytics/insights API contracts |
| platform-health | `smoke` | @smoke | ~2 min | Core platform health checks |
| contract-checks | Jest e2e | @contract @real | ~1 min | Backend API shape/type invariants |

## Deterministic Scenario IDs

All scenario pack tests use these deterministic UUIDs (from `seed-scenario-pack.ts`):

| Entity | ID | Name |
|--------|----|------|
| CI: Web App | `dddd0200-...-000000000001` | SCEN-BANKING-WEB-APP |
| CI: Core API | `dddd0200-...-000000000002` | SCEN-BANKING-CORE-API |
| CI: Primary DB | `dddd0200-...-000000000003` | SCEN-BANKING-DB |
| Service | `dddd0400-...-000000000001` | SCEN-Online-Banking-Platform |
| Change | `dddd0500-...-000000000001` | CHG-SCEN-001 (DB Upgrade) |
| Major Incident | `dddd0600-...-000000000010` | MI-SCEN-001 (Banking Outage) |
| Problem | `dddd0700-...-000000000001` | PRB-SCEN-001 (Schema Compat) |
| Known Error | `dddd0700-...-000000000010` | KE-SCEN-001 (Schema Workaround) |

## Common Failure Patterns

### 1. "Scenario pack not seeded"

**Symptom:** Tests skip with "Scenario pack not seeded — CHG-SCEN-001 not found"

**Fix:**
```bash
cd backend-nest && npm run seed:scenario-pack
```

### 2. Authentication failure (401/403)

**Symptom:** `Auth failed: POST /auth/login returned 401`

**Fix:** Check credentials match what's configured:
- **Local:** `admin@grc-platform.local` / `TestPassword123!`
- **CI:** `admin@grc-platform.local` / `changeme`

Set via environment variables:
```bash
export SMOKE_TEST_EMAIL=admin@grc-platform.local
export SMOKE_TEST_PASSWORD=TestPassword123!
```

### 3. Missing x-tenant-id header

**Symptom:** `403 Forbidden` on all endpoints

**Fix:** Ensure `x-tenant-id: 00000000-0000-0000-0000-000000000001` is set. The test helpers do this automatically via `authHeaders()`.

### 4. Topology returns empty graph

**Symptom:** `nodes=[]` or `edges=[]` in topology response

**Possible causes:**
- Scenario pack relationships not seeded (re-run seed)
- CI/Service entity exists but has no relationships
- Depth parameter too low (try `?depth=3`)

### 5. Jest open-handle warnings

**Symptom:** "Jest did not exit one second after the test run has completed"

**Fix:** Use the teardown helpers:
```typescript
import { gracefulShutdown } from './helpers';

afterAll(async () => {
  await gracefulShutdown(app, dataSource);
});
```

**Known residuals:** Some NestJS async logger transports may still produce warnings even with proper teardown. This is a known NestJS issue. The `LOG_LEVEL=error` setting in test setup reduces the frequency.

### 6. API envelope mismatch

**Symptom:** Test expects `data.items` but gets raw array

**Fix:** Use the `unwrap()` / `unwrapEnvelope()` helpers which handle both envelope-wrapped (`{ success: true, data: {...} }`) and raw response formats.

### 7. Runtime crash on page load (Playwright UI tests)

**Symptom:** Console errors during page navigation

**Debug:**
```bash
# Run with trace enabled
E2E_MODE=REAL_STACK npx playwright test --project=scenario-pack --trace on

# View the trace
npx playwright show-trace test-results/.../trace.zip
```

## CI Workflow Reference

### `scenario-pack-smoke.yml`

**Trigger:** PR to main, or manual dispatch

**Jobs:**
1. Start PostgreSQL service
2. Install dependencies
3. Build backend
4. Run migrations
5. Start backend
6. Seed scenario pack
7. Run scenario-pack smoke tests
8. Run topology smoke tests (optional)
9. Upload artifacts

**Artifacts:** `scenario-pack-smoke-report` (JSON report + trace files)

**Expected duration:** ~5-8 minutes

### Tagging Strategy

| Tag | Meaning | When to Run |
|-----|---------|-------------|
| `@smoke` | Fast, high-signal checks | Every PR |
| `@real` | Hits real stack / seeded data | Every PR (or manual) |
| `@topology` | CMDB topology-specific | Every PR |
| `@contract` | API shape/type checks | Every PR |
| `@scenario-pack` | Uses deterministic scenario data | Every PR |
| `@nightly` | Broader/slower checks | Nightly schedule |

## Collecting Artifacts for Debugging

### Playwright Traces
```bash
# Run with traces
E2E_MODE=REAL_STACK npx playwright test --project=scenario-pack --trace on

# Artifacts saved to test-results/
```

### Platform Health Report
```bash
# After running smoke tests, check:
cat test-results/platform-health-report.json | python3 -m json.tool
```

### Backend Logs
```bash
# Run with verbose logging
LOG_LEVEL=debug npm run start:dev
```

## Adding New Smoke Tests

1. Create test in `tests/platform-health/` following the existing pattern
2. Use `SCENARIO_IDS` from the scenario pack for deterministic entity references
3. Use `authenticate()` and `authHeaders()` from `./helpers`
4. Use `addTableResult()` to contribute to the health report
5. Add a new project in `playwright.config.ts` if needed
6. Add the project to the CI workflow if it should run on every PR

## Known Residuals / Not Yet Covered

- **UI-level Playwright tests:** Current smoke tests are API-level only. UI smoke tests for Change detail / MI detail pages are planned for a future PR.
- **Full Jest flake elimination:** Some async logger warnings may persist. The containment in this PR reduces frequency but does not eliminate all cases.
- **Nightly job:** The `@nightly` tag is defined but no scheduled workflow exists yet. Plan to add in a future PR.
- **Performance benchmarks:** No response time assertions yet. Consider adding P95 latency checks in a future reliability iteration.
