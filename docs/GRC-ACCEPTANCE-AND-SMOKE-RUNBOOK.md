# GRC Platform Acceptance and Smoke Test Runbook

This document provides guidance on running smoke tests and acceptance tests for the GRC + ITSM platform, including when to use each type of test and how to interpret results.

## Overview

The GRC Platform has two levels of automated validation:

1. **Smoke Tests** (`npm run smoke:grc`) - Quick health checks for deployment verification
2. **Acceptance Tests** (`npm run acceptance:full`) - Comprehensive end-to-end scenario validation

## Test Types Comparison

| Aspect | Smoke Tests | Acceptance Tests |
|--------|-------------|------------------|
| **Purpose** | Quick deployment verification | Full user flow validation |
| **Duration** | ~5-10 seconds | ~15-30 seconds |
| **Coverage** | API endpoint availability | Complete user scenarios |
| **When to Run** | After deployment, CI pipeline | Pre-release, staging validation |
| **Data Created** | Minimal (links existing data) | Creates test entities (cleaned up) |
| **Exit Code** | 0 = pass, 1 = fail | 0 = pass, 1 = fail |

## Prerequisites

Before running any tests, ensure:

1. **Backend is running**: The NestJS backend must be accessible at the configured URL
2. **Database is seeded**: Run `npm run seed:grc` to create demo data
3. **Demo admin exists**: The demo admin user must be seeded with correct credentials

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:3002` | Backend API base URL |
| `NEST_API_URL` | `http://localhost:3002` | Alternative for smoke tests |
| `DEMO_ADMIN_EMAIL` | `admin@grc-platform.local` | Demo admin email |
| `DEMO_ADMIN_PASSWORD` | `TestPassword123!` | Demo admin password |

## Running Smoke Tests

Smoke tests verify that all API endpoints are accessible and responding correctly.

### Local Development

```bash
cd backend-nest

# Ensure backend is running
npm run start:dev

# In another terminal, run smoke tests
npm run smoke:grc
```

### Against Staging

```bash
cd backend-nest
NEST_API_URL=https://staging.example.com npm run smoke:grc
```

### What Smoke Tests Check

1. **Health endpoint** - `/health/live` returns 200
2. **Authentication** - Login with demo credentials works
3. **GRC Risks** - List and statistics endpoints respond
4. **GRC Policies** - List and statistics endpoints respond
5. **GRC Requirements** - List, statistics, and frameworks endpoints respond
6. **ITSM Incidents** - List and statistics endpoints respond
7. **Summary endpoints** - KPI data endpoints respond
8. **Relationship endpoints** - Risk-policy and risk-requirement links work
9. **User profile** - `/users/me` returns current user

### Sample Smoke Test Output

```
========================================
GRC Module Smoke Test
========================================
Base URL: http://localhost:3002
Tenant ID: 00000000-0000-0000-0000-000000000001
Demo User: admin@grc-platform.local

==================================================
1. Health Check
==================================================
[OK] GET /health/live - Status: 200

==================================================
2. Authentication
==================================================
[OK] POST /auth/login - Got JWT token

... (more sections)

==================================================
Summary
==================================================
Passed: 20/20 (100%)
Failed: 0/20

[SUCCESS] All smoke tests passed!
```

## Running Acceptance Tests

Acceptance tests validate complete user scenarios from start to finish.

### Local Development

```bash
cd backend-nest

# Ensure backend is running
npm run start:dev

# In another terminal, run acceptance tests
npm run acceptance:full
```

### Against Staging

```bash
cd backend-nest
BASE_URL=https://staging.example.com \
DEMO_ADMIN_EMAIL=admin@grc-platform.local \
DEMO_ADMIN_PASSWORD=YourStagingPassword \
npm run acceptance:full
```

### What Acceptance Tests Check

**Scenario 1: Login + Dashboard**
- Health check
- Login with demo admin
- User profile verification (role = admin)
- Dashboard summary endpoints (risks, policies, requirements, incidents)

**Scenario 2: Risk Lifecycle**
- Create a new risk
- Fetch risk details
- Link existing policy to risk
- Link existing requirement to risk
- Verify relations

**Scenario 3: Incident Lifecycle**
- Create a new incident
- Update status to in_progress
- Resolve incident
- Close incident
- Verify in statistics

**Scenario 4: Governance & Compliance**
- Create a new policy
- Create a new requirement
- Create a risk for linking
- Link policy and requirement to risk
- Verify reverse associations (policy->risks, requirement->risks)

**Scenario 5: Basic Users Check**
- List users
- Verify demo admin user exists with admin role
- Get user statistics
- Verify user count

### Sample Acceptance Test Output

```
========================================
GRC Platform Acceptance Test Runner
========================================
Base URL: http://localhost:3002
Demo User: admin@grc-platform.local
Tenant ID: 00000000-0000-0000-0000-000000000001

--------------------------------------------------
Scenario: 1. Login + Dashboard
--------------------------------------------------
  [PASS] Health check
  [PASS] Login
  [PASS] User profile verification
  [PASS] Risk summary
  [PASS] Policy summary
  [PASS] Requirement summary
  [PASS] Incident summary

--------------------------------------------------
Scenario: 2. Risk Lifecycle
--------------------------------------------------
  [PASS] Create risk
  [PASS] Fetch risk details
  [PASS] Link policy to risk
  [PASS] Link requirement to risk
  [PASS] Verify policy relations
  [PASS] Verify requirement relations

... (more scenarios)

--------------------------------------------------
Cleanup
--------------------------------------------------
  Cleaned up 4/4 test entities

==================================================
SUMMARY
==================================================
Scenarios: 5 passed, 0 failed
Total checks: 25 passed, 0 failed
Duration: 3.2s

[SUCCESS] All acceptance scenarios passed!
```

## Recommended Test Order

For comprehensive validation, run tests in this order:

### 1. After Deployment (Quick Validation)

```bash
npm run smoke:grc
```

This quickly verifies all endpoints are accessible.

### 2. Pre-Release (Full Validation)

```bash
# First, run smoke tests
npm run smoke:grc

# If smoke tests pass, run acceptance tests
npm run acceptance:full
```

### 3. CI Pipeline Integration

```yaml
# Example GitHub Actions workflow
jobs:
  test:
    steps:
      - name: Run smoke tests
        run: npm run smoke:grc
      
      - name: Run acceptance tests
        run: npm run acceptance:full
```

## Interpreting Failures

### Smoke Test Failures

| Failure | Likely Cause | Resolution |
|---------|--------------|------------|
| Health check fails | Backend not running | Start backend: `npm run start:dev` |
| Login fails | Demo user not seeded | Run: `npm run seed:grc` |
| 401 errors | Invalid credentials | Check `DEMO_ADMIN_PASSWORD` env var |
| 400 errors | Missing tenant header | Check tenant ID configuration |
| Connection refused | Wrong port/URL | Verify `BASE_URL` or `NEST_API_URL` |

### Acceptance Test Failures

| Failure | Likely Cause | Resolution |
|---------|--------------|------------|
| Scenario 1 fails | Backend/auth issues | Fix smoke test issues first |
| Create operations fail | Missing permissions | Verify demo admin has admin role |
| Link operations fail | No seed data | Run: `npm run seed:grc` |
| Verify relations fail | Relationship engine issue | Check GRC relationship endpoints |
| Cleanup fails | Entities already deleted | Non-critical, can ignore |

## Troubleshooting

### Backend Not Running

```bash
# Check if backend is running
curl http://localhost:3002/health/live

# Start backend if needed
cd backend-nest && npm run start:dev
```

### Database Not Seeded

```bash
# Seed demo data
cd backend-nest && npm run seed:grc
```

### Wrong Credentials

```bash
# Verify credentials in .env.development
cat backend-nest/.env.development | grep DEMO_ADMIN
```

### Connection Issues

```bash
# Test connectivity
curl -v http://localhost:3002/health/live

# Check for port conflicts
lsof -i :3002
```

## CI Integration

### GitHub Actions Example

Create `.github/workflows/acceptance-tests.yml`:

```yaml
name: Acceptance Tests

on:
  workflow_dispatch:  # Manual trigger
  # Uncomment to run on push:
  # push:
  #   branches: [main]

jobs:
  acceptance:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: grc_platform
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: backend-nest/package-lock.json
      
      - name: Install dependencies
        working-directory: backend-nest
        run: npm ci
      
      - name: Build
        working-directory: backend-nest
        run: npm run build
      
      - name: Start backend
        working-directory: backend-nest
        run: |
          npm run start:prod &
          sleep 10  # Wait for server to start
        env:
          NODE_ENV: test
          DB_HOST: localhost
          DB_PORT: 5432
          DB_USER: postgres
          DB_PASSWORD: postgres
          DB_NAME: grc_platform
          JWT_SECRET: test-jwt-secret-for-ci
          DEMO_ADMIN_PASSWORD: TestPassword123!
      
      - name: Seed database
        working-directory: backend-nest
        run: npm run seed:grc
        env:
          DB_HOST: localhost
          DB_PORT: 5432
          DB_USER: postgres
          DB_PASSWORD: postgres
          DB_NAME: grc_platform
      
      - name: Run smoke tests
        working-directory: backend-nest
        run: npm run smoke:grc
      
      - name: Run acceptance tests
        working-directory: backend-nest
        run: npm run acceptance:full
```

### Notes on CI Integration

1. **Database Required**: Acceptance tests require a real database connection
2. **Seed Data**: Always run `npm run seed:grc` before tests
3. **Server Startup**: Allow time for the server to start before running tests
4. **Environment Variables**: Ensure all required env vars are set
5. **Manual Trigger**: Consider using `workflow_dispatch` for manual triggering initially

## Related Documentation

- [ACCEPTANCE-SCENARIOS.md](./ACCEPTANCE-SCENARIOS.md) - Detailed scenario definitions
- [TESTING-STRATEGY-BACKEND.md](./TESTING-STRATEGY-BACKEND.md) - Overall testing strategy
- [DEMO-ADMIN-USER.md](./DEMO-ADMIN-USER.md) - Demo admin user setup
- [GRC-OBSERVABILITY-AND-TELEMETRY.md](./GRC-OBSERVABILITY-AND-TELEMETRY.md) - Health endpoints

## Maintenance

### Adding New Scenarios

1. Define the scenario in `docs/ACCEPTANCE-SCENARIOS.md`
2. Implement the scenario function in `src/scripts/acceptance-runner.ts`
3. Add the scenario to the `runAcceptanceTests()` function
4. Update this runbook with the new scenario

### Updating Existing Scenarios

1. Update the scenario definition in `docs/ACCEPTANCE-SCENARIOS.md`
2. Update the implementation in `src/scripts/acceptance-runner.ts`
3. Run tests locally to verify changes
4. Update this runbook if behavior changes
