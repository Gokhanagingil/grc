# Testing Guide

This document describes the testing strategy for the GRC Platform backend, including how to run tests locally and the CI/CD workflow configuration.

## Test Types

### Unit Tests

Unit tests validate individual components in isolation using Jest mocks.

```bash
# Run all unit tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- --testPathPatterns="service-name"
```

### E2E Tests

End-to-end tests validate the full API stack with a real PostgreSQL database.

#### Prerequisites

1. PostgreSQL running on localhost:5432
2. Test database `grc_platform_test` created
3. Environment variables set (see below)

#### Running E2E Tests Locally

```bash
# 1. Set environment variables
export DB_HOST=localhost
export DB_PORT=5432
export DB_USER=postgres
export DB_PASSWORD=postgres
export DB_NAME=grc_platform_test
export DEMO_ADMIN_EMAIL=admin@grc-platform.local
export DEMO_ADMIN_PASSWORD=TestPassword123!
export JWT_SECRET=test-jwt-secret-for-e2e-testing-purposes

# 2. Bootstrap the test database (reset + migrate + seed)
npm run db:test:bootstrap

# 3. Run all E2E tests
npm run test:e2e

# 4. Run specific test suite
npm run test:e2e -- --testPathPatterns="settings"

# 5. Run smoke tests only (fast, stable subset)
npm run test:e2e -- --testPathPatterns="app.e2e-spec|settings.e2e-spec|tenants.e2e-spec"
```

## Two-Tier E2E Strategy

The GRC Platform uses a two-tier E2E testing strategy in CI:

### Tier 1: Smoke Tests (Required)

**Workflow:** `.github/workflows/e2e-smoke.yml`

Smoke tests are a small, stable subset of E2E tests that must pass before any PR can be merged. They validate critical functionality:

- Health endpoints (live/ready)
- Authentication (login)
- Tenant context
- Settings with proper headers
- Basic GRC operations

**Characteristics:**
- Fast execution (< 5 minutes)
- Highly stable (no flaky tests)
- Required for PR merge
- Runs on every push and PR

### Tier 2: Full E2E Suite (Non-blocking)

**Workflow:** `.github/workflows/backend-nest-ci.yml` (e2e-tests job)

The full E2E test suite runs all 340+ tests but is non-blocking for PRs. This prevents flaky tests from blocking development while still providing comprehensive coverage.

**Characteristics:**
- Comprehensive coverage (all test files)
- Runs on every push but failures are allowed
- Runs nightly at 2 AM UTC on schedule
- Results should be monitored for regressions

## Test Files

| File | Description | Tier |
|------|-------------|------|
| `app.e2e-spec.ts` | Basic app health | Smoke |
| `settings.e2e-spec.ts` | Settings API | Smoke |
| `tenants.e2e-spec.ts` | Tenant management | Smoke |
| `grc.e2e-spec.ts` | GRC CRUD operations | Full |
| `platform.e2e-spec.ts` | Platform features | Full |
| `security-access-control.e2e-spec.ts` | Multi-tenancy | Full |
| `list-contract.e2e-spec.ts` | LIST-CONTRACT pagination | Full |
| `audit.e2e-spec.ts` | Audit functionality | Full |
| `closure-loop.e2e-spec.ts` | Golden Flow lifecycle | Full |
| ... | Other test files | Full |

## Log Levels

E2E tests use reduced logging to minimize noise. The `LOG_LEVEL` environment variable controls verbosity:

- `error` - Only errors (default for tests)
- `warn` - Errors and warnings
- `info` - Errors, warnings, and info
- `debug` - All except verbose
- `verbose` - All logs

To see more detailed logs during debugging:

```bash
LOG_LEVEL=debug npm run test:e2e -- --testPathPatterns="your-test"
```

## Database Bootstrap

The `db:test:bootstrap` script performs a 7-step process:

1. Drop and recreate the `public` schema
2. Run all migrations
3. Validate schema contract
4. Seed demo tenant
5. Seed demo admin user
6. Verify minimum data exists
7. Close database connection

This ensures a clean, deterministic database state for each test run.

## Troubleshooting

### Tests fail with "duplicate key" errors

The test database may have stale data. Reset it:

```bash
npm run db:test:bootstrap
```

### Tests fail with "x-tenant-id header is required"

Ensure your test includes the tenant ID header:

```typescript
await request(app.getHttpServer())
  .get('/grc/endpoint')
  .set('Authorization', `Bearer ${authToken}`)
  .set('x-tenant-id', tenantId)
  .expect(200);
```

### Tests fail with 400 "Query parameter 'key' is required"

For `/settings/effective`, always include the `key` parameter:

```typescript
await request(app.getHttpServer())
  .get('/settings/effective?key=maxLoginAttempts')
  .set('Authorization', `Bearer ${authToken}`)
  .expect(200);
```

### Tests timeout

Increase the Jest timeout in your test file:

```typescript
jest.setTimeout(60000); // 60 seconds
```

Or run with extended timeout:

```bash
npm run test:e2e -- --testTimeout=60000
```

## CI Workflow Summary

| Workflow | Purpose | Required | Schedule |
|----------|---------|----------|----------|
| `e2e-smoke.yml` | Smoke tests | Yes | Every push/PR |
| `backend-nest-ci.yml` | Full CI (lint, build, unit, e2e, docker) | Partial | Every push/PR + Nightly |

The `e2e-tests` job in `backend-nest-ci.yml` has `continue-on-error: true`, meaning it runs but doesn't block PR merges. Monitor nightly runs for regressions.
