# E2E Test Modes: MOCK_UI vs REAL_STACK

## Overview

All Playwright E2E tests run in one of two explicit modes, controlled by the `E2E_MODE` environment variable:

| Mode | Purpose | Backend required? | Mocks? |
|------|---------|-------------------|--------|
| **MOCK_UI** | Fast UI regression (routing, rendering, envelope parsing, empty/error states) | No | Yes (`setupMockApi`) |
| **REAL_STACK** | Validate real API contracts, RBAC, migrations, seeds, end-to-end flows | Yes (docker compose or staging) | **No** (hard error if attempted) |

**Default is `REAL_STACK`** so that accidentally omitting the flag never hides real API issues behind mocks.

---

## How It Works

### Environment Variable

```
E2E_MODE=MOCK_UI | REAL_STACK
```

- Set in CI workflow env blocks.
- Set locally before running tests.
- Default: `REAL_STACK` (safe fallback).

### Helper Guards (`frontend/e2e/helpers.ts`)

- `getE2eMode()` — returns the current mode, throws on invalid value.
- `isMockUi()` / `isRealStack()` — boolean helpers.
- `assertE2eMode(expected)` — call at the top of a suite to hard-fail if misconfigured.
- `setupMockApi(page)` — **throws in REAL_STACK mode**. Only works in MOCK_UI.
- `login(page)` — automatically skips mock setup in REAL_STACK mode.

### Test Tagging

Tests are tagged with `@mock` or `@real` in their `test.describe()` title:

```ts
test.describe('My Feature @mock', () => { ... });
test.describe('My Feature @real', () => { ... });
```

Playwright projects use `grep` / `grepInvert` to only run matching tests.

---

## When to Use Which Mode

| Scenario | Mode | Why |
|----------|------|-----|
| PR gate: UI rendering checks | MOCK_UI | Fast, no backend needed |
| PR gate: API contract smoke | REAL_STACK | Validates real 200/201/403 |
| Nightly full sweep | REAL_STACK | Comprehensive API validation |
| Staging smoke | REAL_STACK | Real environment validation |
| Debugging a UI layout bug | MOCK_UI | Quick feedback loop |
| Debugging a 403/401 error | REAL_STACK | Must hit real auth/RBAC |

---

## Running Locally

### MOCK_UI Mode

```bash
cd frontend

# Start frontend dev server
npm start

# In another terminal
E2E_MODE=MOCK_UI npx playwright test --project=mock-ui
```

### REAL_STACK Mode

```bash
# Start the full stack
docker compose -f docker-compose.staging.yml up -d

# Wait for backend health
curl -sf http://localhost:3002/health/live

# Run from repo root (API-level tests)
E2E_MODE=REAL_STACK npx playwright test --project=smoke

# Or run frontend REAL_STACK tests
cd frontend
E2E_MODE=REAL_STACK E2E_BASE_URL=http://localhost:3000 npx playwright test --project=real-stack
```

---

## CI Workflows

| Workflow | Mode | Trigger | Timeout |
|----------|------|---------|---------|
| `e2e-smoke-real.yml` | REAL_STACK | PR to main | ~3 min |
| `e2e-mock-ui.yml` | MOCK_UI | PR to main (frontend changes) | ~5 min |
| `platform-health-smoke.yml` | REAL_STACK | PR to main | ~5 min |
| `platform-health-nightly.yml` | REAL_STACK | Nightly cron (03:00 UTC) | ~20 min |
| `smoke-staging.yml` | REAL_STACK | Manual / post-deploy | ~15 min |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `[mock] ... 127.0.0.1:3000/api/...` in logs | Test running in MOCK_UI mode | If this appears in a REAL_STACK workflow, it's a bug — check `E2E_MODE` env var |
| `setupMockApi() called in REAL_STACK mode` error | Test file calls `setupMockApi` but `E2E_MODE=REAL_STACK` | Either set `E2E_MODE=MOCK_UI` or remove the `setupMockApi` call |
| `E2E_MODE mismatch: expected "REAL_STACK" but got "MOCK_UI"` | Suite has `assertE2eMode('REAL_STACK')` but workflow sets MOCK_UI | Fix the workflow env or move the test to the correct project |
| Platform health tests skipped | `E2E_MODE` not set to `REAL_STACK` | Platform health always requires REAL_STACK — check CI config |
| Tests pass in CI but fail on staging | Mock responses hide real API contract changes | Run REAL_STACK locally with docker compose to reproduce |

---

## Adding New Tests

### For UI-only regression tests (MOCK_UI)

1. Add `@mock` tag to `test.describe()`.
2. Call `setupMockApi(page)` in `beforeEach`.
3. Add mock handlers for any new endpoints in `frontend/e2e/helpers.ts`.

### For API contract tests (REAL_STACK)

1. Add `@real` tag to `test.describe()`.
2. Call `assertE2eMode('REAL_STACK')` at the top of the file.
3. Do NOT call `setupMockApi()` — it will throw.
4. Ensure the test data exists (via seed script or test creates its own).

---

## Seed Strategy

The canonical seed script is `scripts/seed-e2e.sh`. It creates:

- **Tenant**: `00000000-0000-0000-0000-000000000001`
- **Admin user**: `admin@grc-platform.local` / `changeme`
- **GRC baseline**: policies, risks, requirements (core choices)
- **Standards library**: ISO 27001, etc. (if seed scripts exist)

The script is **idempotent** — safe to run multiple times.

CI workflows run migrations and start the backend with `DEMO_ADMIN_EMAIL` / `DEMO_ADMIN_PASSWORD` which auto-seeds the admin user on first boot.
