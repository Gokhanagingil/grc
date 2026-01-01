# Quality Gate Checklist

**Purpose:** Define mandatory checks that must pass before any PR merge or release deployment.

**Scope:** All PRs and releases must satisfy these quality gates.

---

## Pre-Merge Quality Gates (PR)

### 1. Code Quality

- [ ] **Linting:** All code passes ESLint/Prettier checks
  - Backend: `npm run nest:lint` passes
  - Frontend: `npm run frontend:lint` passes
  - No auto-fixable linting errors

- [ ] **Type Safety:** TypeScript compilation succeeds
  - Backend: `npm run build` succeeds (no TypeScript errors)
  - Frontend: `npm run build` succeeds (no TypeScript errors)
  - No `any` types introduced (unless explicitly justified)

- [ ] **Formatting:** Code formatted with Prettier
  - All files formatted consistently
  - No formatting-only changes in PR

### 2. Testing

- [ ] **Unit Tests:** All unit tests pass
  - Backend: `npm run nest:test` passes
  - Frontend: `npm run test` passes (if applicable)
  - No skipped or disabled tests

- [ ] **E2E Tests:** Critical E2E tests pass
  - Frontend: `npm run test:e2e` passes (at least smoke tests)
  - Critical user flows covered (login, navigation, CRUD operations)

- [ ] **Test Coverage:** Coverage thresholds met
  - Backend: Critical paths (auth, tenant, migrations) >80% coverage
  - Frontend: Critical components >70% coverage
  - Coverage report generated and reviewed

### 3. Build Verification

- [ ] **Backend Build:** NestJS build succeeds
  - `npm run nest:build` completes without errors
  - `dist/` directory contains expected artifacts
  - No missing dependencies

- [ ] **Frontend Build:** React build succeeds
  - `npm run frontend:build` completes without errors
  - `build/` directory contains expected artifacts
  - No missing dependencies or build warnings

- [ ] **Docker Build:** Docker images build successfully
  - `docker compose -f docker-compose.nest.yml build` succeeds
  - `docker compose -f docker-compose.staging.yml build` succeeds
  - No build errors or warnings

### 4. Security

- [ ] **Dependency Audit:** No critical security vulnerabilities
  - `npm audit` shows no critical or high vulnerabilities
  - Known vulnerabilities documented and justified if present

- [ ] **Secret Management:** No secrets in code
  - No hardcoded passwords, API keys, or tokens
  - Environment variables used for all secrets
  - `.env.example` updated if new variables added

- [ ] **Security Headers:** Security headers configured
  - Security headers middleware active
  - CORS configuration appropriate for environment

### 5. Database

- [ ] **Migrations:** Migrations are valid and reversible
  - Migration files follow naming convention
  - `migration:generate` produces expected output
  - Migration rollback tested (if applicable)

- [ ] **Schema Changes:** Schema changes documented
  - Entity changes documented
  - Migration files include comments explaining changes
  - Breaking changes documented

- [ ] **Migration Mode Configuration:** Migration mode is explicit
  - `TYPEORM_MIGRATIONS_MODE` env var set correctly ("dist" for staging/prod, "src" for dev)
  - Migration mode logged on startup (check application logs)
  - No ambiguous mode detection in production environments

- [ ] **DB_SYNC Kill Switch:** DB_SYNC is disabled in production/staging
  - `DB_SYNC` env var is NOT set to "true" in production/staging
  - Application fails to start if `DB_SYNC=true` in production/staging (kill switch active)
  - `synchronize` is always `false` in configuration (never inferred)

### 6. Documentation

- [ ] **Code Documentation:** Code is documented
  - Public APIs have JSDoc/TSDoc comments
  - Complex logic has inline comments
  - README updated if needed

- [ ] **API Documentation:** API changes documented
  - New endpoints documented
  - Breaking API changes documented
  - API response format follows standards

### 7. Configuration

- [ ] **Environment Variables:** New env vars documented
  - `.env.example` updated
  - `docs/ENV-CONFIG-AND-VALIDATION.md` updated
  - Validation rules added if needed

---

## Pre-Deployment Quality Gates (Release)

### 1. Deployment Readiness

- [ ] **Migration Status:** All migrations applied
  - `npm run migration:status:prod` (or `npm run migration:status` in dev) shows "0 pending migrations"
  - Migration status command never silent (always prints count)
  - Migration status verified in staging container
  - Migration rollback tested
  - **Validation in staging container:**
    ```bash
    # Inside backend container
    npm run migration:status:prod
    # Expected output: "✓ Migration Status: 0 pending migrations"
    # Exit code must be 0 (non-zero if pending migrations exist)
    
    # Run migrations if needed (idempotent)
    npm run migration:run:prod
    # Expected output: "✓ No pending migrations" or list of executed migrations
    ```

- [ ] **Health Checks:** Health endpoints respond
  - `/health/live` returns 200
  - `/health/ready` returns 200
  - `/health/db` indicates database connected
  - Migration status included in health check

- [ ] **Environment Validation:** Environment variables validated
  - `validate:env` script passes
  - Required variables present
  - Secret strength validated (JWT_SECRET length, etc.)

### 2. Smoke Tests

- [ ] **Backend Smoke Tests:** Backend endpoints respond
  - Auth endpoint responds (401/400 expected without credentials)
  - Health endpoints respond
  - GRC endpoints respond (401 expected without auth)
  - Admin endpoints respond (401 expected without auth)

- [ ] **Frontend Smoke Tests:** Frontend loads correctly
  - Frontend serves static assets
  - Frontend health endpoint responds
  - No console errors in browser

- [ ] **Integration Smoke Tests:** Critical flows work
  - Login flow works
  - Navigation works
  - CRUD operations work (at least one entity type)

### 3. Performance

- [ ] **Startup Time:** Application starts within SLA
  - Backend starts within 30 seconds
  - Frontend serves within 5 seconds
  - Database connection established within 10 seconds

- [ ] **Response Times:** Critical endpoints respond within SLA
  - Health endpoints <100ms
  - Auth endpoints <500ms
  - CRUD endpoints <1s (for typical operations)

### 4. Observability

- [ ] **Logging:** Logging works correctly
  - Structured logs produced
  - Correlation IDs present in logs
  - Error logs include stack traces

- [ ] **Metrics:** Metrics endpoint works
  - `/metrics` endpoint responds
  - Metrics include request counts, error rates
  - Metrics format is parseable

### 5. Security

- [ ] **Security Headers:** Security headers present
  - CSP header configured
  - HSTS header configured (if HTTPS)
  - X-Frame-Options header present
  - X-Content-Type-Options header present

- [ ] **CORS:** CORS configuration appropriate
  - Production CORS origins restricted
  - Staging CORS origins appropriate
  - No wildcard origins in production

- [ ] **Authentication:** Authentication works
  - JWT tokens issued correctly
  - Token expiration enforced
  - Refresh tokens work
  - Unauthorized requests rejected

### 6. Multi-Tenancy

- [ ] **Tenant Isolation:** Tenant isolation verified
  - Tenant A cannot access Tenant B data
  - Tenant context propagated correctly
  - Tenant guard enforces isolation

### 7. Rollback Plan

- [ ] **Rollback Procedure:** Rollback procedure documented
  - Rollback steps documented
  - Rollback script tested
  - Data backup procedure documented

---

## Automated Quality Gates (CI/CD)

### PR Validation Workflow

The following checks should run automatically on every PR:

1. **Lint Check**
   ```bash
   npm run nest:lint
   npm run frontend:lint
   ```

2. **Type Check**
   ```bash
   npm run nest:build
   npm run frontend:build
   ```

3. **Unit Tests**
   ```bash
   npm run nest:test
   npm run frontend:test
   ```

4. **E2E Tests (Smoke)**
   ```bash
   npm run test:e2e -- --project=chromium
   ```

5. **Docker Build**
   ```bash
   docker compose -f docker-compose.nest.yml build
   ```

6. **Security Audit**
   ```bash
   npm audit --audit-level=high
   ```

### Staging Deployment Workflow

The following checks should run automatically on merge to main:

1. **All PR Validation Checks** (re-run)

2. **Deployment Script**
   ```bash
   ./scripts/deploy-staging.sh
   ```

3. **Smoke Tests**
   ```bash
   npm run smoke:grc
   ```

4. **Health Check Verification**
   ```bash
   curl -f http://staging-url/health/ready
   ```

---

## Quality Gate Enforcement

### PR Level

- **Blocking:** Lint errors, type errors, test failures, security vulnerabilities
- **Warning:** Coverage below threshold, documentation gaps
- **Manual Review:** Breaking changes, schema changes, security-sensitive changes

### Release Level

- **Blocking:** All PR gates + deployment failures, health check failures, smoke test failures
- **Warning:** Performance degradation, observability gaps
- **Manual Approval:** Production deployments, breaking changes

---

## Quality Gate Metrics

Track the following metrics to improve quality gates:

- **PR Quality Score:** % of PRs that pass all gates on first submission
- **Deployment Success Rate:** % of deployments that succeed without rollback
- **Test Coverage Trend:** Track coverage over time
- **Security Vulnerability Count:** Track vulnerabilities over time

---

## Exceptions

Quality gates may be bypassed in exceptional circumstances:

1. **Hotfixes:** Critical production issues may bypass some gates with approval
2. **Experimental Features:** Features behind feature flags may have relaxed gates
3. **Documentation Only:** Documentation-only PRs may skip some gates

**Process:**
- Exception must be documented in PR description
- Exception must be approved by tech lead
- Exception must be tracked and reviewed post-merge

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-27

