# Hardening Backlog

**Purpose:** Prioritized list of platform hardening tasks to improve reliability, security, operability, and maintainability.

**Ranking:** Items ranked by Impact/Effort ratio. Impact: Critical (5) → Low (1). Effort: Small (1) → Large (5).

---

## High Priority (Impact 4-5, Effort 1-3)

### 1. TypeORM Migration Verification Enhancement
**Impact:** 5 (Critical) | **Effort:** 2 (Medium) | **Priority:** P0

**Description:**
Replace heuristic `isDistEnvironment()` detection with explicit environment variable. Add migration verification to health checks and deployment scripts.

**Tasks:**
- Add `TYPEORM_ENV` environment variable (explicit `dist|src`)
- Update `data-source.ts` to use explicit env var
- Add migration status to `/health/db` endpoint
- Add migration verification step to `deploy-staging.sh`
- Create migration smoke test script

**Acceptance:**
- `migration:show` always produces output
- Health check includes migration status
- Deployment fails if migration verification fails

**Files:**
- `backend-nest/src/data-source.ts`
- `backend-nest/src/health/health.service.ts`
- `scripts/deploy-staging.sh`
- `backend-nest/src/scripts/validate-migrations.ts` (new)

---

### 2. CI/CD Pipeline Implementation
**Impact:** 5 (Critical) | **Effort:** 3 (Medium) | **Priority:** P0

**Description:**
Create GitHub Actions workflows for PR validation and staging deployment.

**Tasks:**
- Create `.github/workflows/pr-validation.yml` (lint, test, build)
- Create `.github/workflows/staging-deploy.yml` (on merge to main)
- Add quality gates (coverage threshold, lint errors block merge)
- Integrate with existing deployment scripts

**Acceptance:**
- PR workflow runs on every PR
- Staging deployment workflow runs on merge to main
- Quality gates enforced

**Files:**
- `.github/workflows/pr-validation.yml` (new)
- `.github/workflows/staging-deploy.yml` (new)
- `.github/workflows/quality-gates.yml` (new)

---

### 3. TypeORM Synchronize Flag Protection
**Impact:** 5 (Critical) | **Effort:** 1 (Small) | **Priority:** P0

**Description:**
Add validation to prevent `synchronize: true` in production environments.

**Tasks:**
- Add config validation that fails if `synchronize: true` and `NODE_ENV=production`
- Update `docker-compose.staging.yml` to explicitly set `DB_SYNC=false`
- Add startup check with clear error message

**Acceptance:**
- Application fails to start if synchronize enabled in production
- Staging docker-compose explicitly sets `DB_SYNC=false`
- Error message is clear and actionable

**Files:**
- `backend-nest/src/app.module.ts`
- `backend-nest/src/config/validation.ts`
- `docker-compose.staging.yml`

---

### 4. Admin System Menu Discovery Fix
**Impact:** 4 (High) | **Effort:** 1 (Small) | **Priority:** P1

**Description:**
Make `/admin/system` discoverable in left navigation menu for admin users.

**Tasks:**
- Add `/admin/system` to `Layout.tsx` menu items explicitly
- Ensure admin menu items visible regardless of module state
- Verify menu item has correct icon and label

**Acceptance:**
- `/admin/system` appears in left menu for admin users
- Menu item visible even if module not enabled
- Direct URL access still works

**Files:**
- `frontend/src/components/Layout.tsx`

---

### 5. Frontend/Backend Route Discovery
**Impact:** 4 (High) | **Effort:** 3 (Medium) | **Priority:** P1

**Description:**
Create backend route discovery endpoint and frontend dynamic menu builder.

**Tasks:**
- Create `/api/v2/routes` endpoint that returns available routes
- Frontend queries route registry on startup
- Build dynamic menu from route registry
- Add route contract validation in CI/CD

**Acceptance:**
- Backend exposes route registry endpoint
- Frontend menu dynamically built from route registry
- CI/CD fails if route contract mismatch

**Files:**
- `backend-nest/src/platform/controllers/routes.controller.ts` (new)
- `frontend/src/services/routeDiscovery.ts` (new)
- `frontend/src/components/Layout.tsx`
- `.github/workflows/route-contract-check.yml` (new)

---

## Medium Priority (Impact 3-4, Effort 2-4)

### 6. Tenant Isolation Verification
**Impact:** 4 (High) | **Effort:** 3 (Medium) | **Priority:** P2

**Description:**
Add automated tenant isolation tests and verification scripts.

**Tasks:**
- Create `test/tenant-isolation.e2e-spec.ts`
- Create `scripts/verify-tenant-isolation.ts`
- Add tenant context logging to all queries
- Document tenant isolation guarantees

**Acceptance:**
- E2E tests verify tenant A cannot access tenant B data
- Tenant boundary verification script passes
- Tenant context logged in all queries

**Files:**
- `backend-nest/test/tenant-isolation.e2e-spec.ts` (new)
- `backend-nest/src/scripts/verify-tenant-isolation.ts` (new)
- `backend-nest/src/common/multi-tenant-service.base.ts` (verify)

---

### 7. Deployment Determinism Enhancement
**Impact:** 4 (High) | **Effort:** 3 (Medium) | **Priority:** P2

**Description:**
Enhance deployment script with rollback capability and verification checklist.

**Tasks:**
- Add rollback capability to `deploy-staging.sh`
- Create `scripts/rollback-staging.sh`
- Add deployment verification checklist automation
- Document rollback procedure

**Acceptance:**
- Deployment script supports rollback
- Rollback procedure documented
- Smoke tests run after deployment

**Files:**
- `scripts/deploy-staging.sh` (enhance)
- `scripts/rollback-staging.sh` (new)
- `docs/STAGING_DEPLOYMENT_RUNBOOK.md` (update)

---

### 8. Health Check Coverage Enhancement
**Impact:** 3 (Medium) | **Effort:** 2 (Medium) | **Priority:** P2

**Description:**
Enhance health checks to include migration status and external service checks.

**Tasks:**
- Enhance `/health/ready` to include migration status
- Add health checks for external services (if configured)
- Add health check aggregation endpoint
- Document health check contract

**Acceptance:**
- `/health/ready` includes migration status
- Health checks cover all critical dependencies
- Health check contract documented

**Files:**
- `backend-nest/src/health/health.service.ts`
- `backend-nest/src/health/health.controller.ts`

---

### 9. Environment Variable Validation Enhancement
**Impact:** 3 (Medium) | **Effort:** 2 (Medium) | **Priority:** P2

**Description:**
Add staging-specific validation and secret strength validation.

**Tasks:**
- Add staging environment validation
- Add secret strength validation (JWT_SECRET min length)
- Add validation for required staging variables
- Enhance `validate-env.ts` script

**Acceptance:**
- Staging deployment fails if required env vars missing
- JWT_SECRET validation enforces minimum length
- Validation errors are clear and actionable

**Files:**
- `backend-nest/src/config/validation.ts`
- `backend-nest/src/scripts/validate-env.ts` (enhance)

---

### 10. Test Coverage Enhancement
**Impact:** 3 (Medium) | **Effort:** 4 (Large) | **Priority:** P2

**Description:**
Add test coverage reporting to CI/CD and improve coverage for critical paths.

**Tasks:**
- Add test coverage reporting to CI/CD
- Identify critical paths with low coverage
- Add tests for error scenarios
- Document test coverage targets

**Acceptance:**
- Test coverage report generated in CI/CD
- Critical paths have >80% coverage
- Error scenarios covered in E2E tests

**Files:**
- `.github/workflows/pr-validation.yml` (add coverage)
- `backend-nest/jest.config.js` (verify coverage config)

---

### 11. Error Response Format Standardization
**Impact:** 3 (Medium) | **Effort:** 2 (Medium) | **Priority:** P3

**Description:**
Ensure all NestJS endpoints return consistent response format.

**Tasks:**
- Verify all endpoints use `ResponseTransformInterceptor`
- Add response format validation in tests
- Document standard response format
- Plan Express backend deprecation

**Acceptance:**
- All NestJS endpoints return consistent format
- Response format documented
- Test coverage for response format

**Files:**
- `backend-nest/src/common/interceptors/response-transform.interceptor.ts` (verify)
- `docs/API-RESPONSE-STANDARDS.md` (update)

---

### 12. Security Headers Enhancement
**Impact:** 3 (Medium) | **Effort:** 2 (Medium) | **Priority:** P3

**Description:**
Review and enhance security headers (CSP, HSTS, etc.).

**Tasks:**
- Review security headers middleware
- Add CSP, HSTS, X-Frame-Options headers
- Tighten CORS configuration for production
- Add security headers validation in tests

**Acceptance:**
- Security headers include CSP, HSTS, etc.
- CORS configuration restrictive in production
- Security headers validated in tests

**Files:**
- `backend-nest/src/common/middleware/security-headers.middleware.ts`
- `backend-nest/test/security-headers.e2e-spec.ts` (new)

---

## Low Priority (Impact 1-2, Effort 1-3)

### 13. Logging and Observability Enhancement
**Impact:** 2 (Low) | **Effort:** 2 (Medium) | **Priority:** P4

**Description:**
Ensure all services use structured logging and correlation IDs propagate.

**Tasks:**
- Verify all services use `StructuredLoggerService`
- Add correlation ID to database query logs
- Document logging standards

**Acceptance:**
- All services use structured logging
- Correlation IDs appear in all logs
- Logging standards documented

**Files:**
- `backend-nest/src/common/logger/structured-logger.service.ts` (verify)
- `docs/OBSERVABILITY-AND-HEALTHCHECKS.md` (update)

---

### 14. Database Connection Pool Configuration
**Impact:** 2 (Low) | **Effort:** 1 (Small) | **Priority:** P4

**Description:**
Configure TypeORM connection pool settings explicitly and add metrics.

**Tasks:**
- Configure TypeORM connection pool settings explicitly
- Add connection pool metrics to `/metrics` endpoint
- Document connection pool configuration

**Acceptance:**
- Connection pool settings configured explicitly
- Connection pool metrics available
- Connection pool configuration documented

**Files:**
- `backend-nest/src/app.module.ts` (TypeORM config)
- `backend-nest/src/metrics/metrics.service.ts` (add pool metrics)

---

### 15. Frontend Build Determinism
**Impact:** 2 (Low) | **Effort:** 2 (Medium) | **Priority:** P4

**Description:**
Add build hash to frontend build and build verification step.

**Tasks:**
- Add build hash to frontend build
- Add build verification step
- Document build process

**Acceptance:**
- Frontend build includes hash
- Build verification step passes
- Build process documented

**Files:**
- `frontend/package.json` (build scripts)
- `.github/workflows/pr-validation.yml` (add build verification)

---

## Backlog Summary

**Total Items:** 15

**By Priority:**
- P0 (Critical): 3 items
- P1 (High): 2 items
- P2 (Medium): 5 items
- P3 (Medium-Low): 2 items
- P4 (Low): 3 items

**By Impact:**
- Critical (5): 3 items
- High (4): 3 items
- Medium (3): 6 items
- Low (2): 3 items

**By Effort:**
- Small (1): 2 items
- Medium (2-3): 10 items
- Large (4-5): 3 items

---

## Recommended Sprint Planning

**Sprint 1 (Week 1):**
- Item 1: TypeORM Migration Verification Enhancement
- Item 3: TypeORM Synchronize Flag Protection
- Item 4: Admin System Menu Discovery Fix

**Sprint 2 (Week 2):**
- Item 2: CI/CD Pipeline Implementation
- Item 5: Frontend/Backend Route Discovery (partial)

**Sprint 3 (Week 3):**
- Item 5: Frontend/Backend Route Discovery (complete)
- Item 6: Tenant Isolation Verification
- Item 8: Health Check Coverage Enhancement

**Sprint 4 (Week 4):**
- Item 7: Deployment Determinism Enhancement
- Item 9: Environment Variable Validation Enhancement
- Item 11: Error Response Format Standardization

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-27

