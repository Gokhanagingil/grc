# Platform Health Baseline Summary

Captured: 2026-03-02T08:55:00Z
Branch: `main` (commit `7e1a299`)

## CI Health (Dependabot PRs)

| PR | Status | Failing Jobs | Root Cause |
|----|--------|-------------|------------|
| #535 | RED | 3 jobs (REAL_STACK Smoke, Tier-1 Smoke, Scenario Pack) | `npm ci` ERESOLVE - missing `--legacy-peer-deps` |
| #531 | RED | 1 job (Frontend CI / Test) | Jest cannot parse ESM `axios` - missing `transformIgnorePatterns` entry |
| #534 | GREEN/CANCELED | 0 failing | N/A |
| #533 | GREEN/CANCELED | 0 failing | N/A |

## Frontend Test Health

- **Total test suites**: 58
- **Total tests**: 1142
- **Failing suites (with axios bump)**: 4 (`priorityMatrix`, `normalizeRcaDecisionsSummary`, `grcClient`, `ItsmChangeTemplateList`)
- **Failing tests (with axios bump)**: 67
- **Console warnings**: MUI out-of-range select value (cosmetic, non-blocking)

## CI Workflow Consistency

| Workflow | Has `--legacy-peer-deps` (before) | Has `--legacy-peer-deps` (after) |
|----------|-----------------------------------|----------------------------------|
| backend-nest-ci.yml | YES (all jobs) | YES |
| frontend-ci.yml | YES (all jobs) | YES |
| e2e-tests.yml | YES | YES |
| e2e-mock-ui.yml | YES | YES |
| e2e-smoke-real.yml | NO | YES |
| platform-health-smoke.yml | NO | YES |
| platform-health-nightly.yml | NO | YES |
| scenario-pack-smoke.yml | NO | YES |
| db-bootstrap-preflight.yml | NO | YES |
| staging-smoke.yml | YES | YES |
| smoke-staging.yml | YES | YES |
| usability-regression-pack.yml | YES | YES |

## Summary Metrics

| Metric | Before | After (Expected) |
|--------|--------|-------------------|
| Dependabot PRs RED | 2 (#531, #535) | 0 |
| Frontend test suites failing (with axios bump) | 4 | 0 |
| Frontend tests failing (with axios bump) | 67 | 0 |
| CI workflows with inconsistent `--legacy-peer-deps` | 5 | 0 |
| Total frontend tests passing | 1142 | 1142 |
