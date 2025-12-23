# FAZ 3 CI Fix Report

## Summary

PR #106 (FAZ 3: Identity, Security & Admin Core Implementation) CI checks are now GREEN after fixing three issues.

## Root Causes

### 1. Unit Tests Failure: Missing MfaService Mock

**Error:**
```
Nest can't resolve dependencies of the AuthService (..., MfaService). Please make sure that the argument MfaService at index [6] is available in the RootTestModule context.
```

**Root Cause:** FAZ 3 added `MfaService` as a dependency to `AuthService` for MFA challenge during login. The existing `auth.service.spec.ts` test file did not have a mock provider for `MfaService`.

**Fix:** Added `MfaService` mock to `auth.service.spec.ts` with the methods used by `AuthService`:
- `isMfaEnabled(userId)` - returns `false` by default (no MFA challenge in existing tests)
- `verifyMfaCode(userId, code, tenantId)` - returns `true` by default

### 2. E2E Tests Failure: pg_isready Health Check Using Wrong User

**Error (in Postgres container logs):**
```
FATAL: role "root" does not exist
```

**Root Cause:** The `pg_isready` health check in the GitHub Actions workflow did not specify a user, so it defaulted to the OS user (`root` on the runner). This caused noisy errors in the Postgres logs.

**Fix:** Updated the health check command in `.github/workflows/backend-nest-ci.yml` to explicitly use the postgres user:
```yaml
--health-cmd "pg_isready -U postgres -d grc_platform_test"
```

### 3. E2E Tests Failure: AdminModule Missing TenantsModule Import

**Error:**
```
Nest can't resolve dependencies of the TenantGuard (?, EventEmitter). Please make sure that the argument TenantsService at index [0] is available in the AdminModule context.
```

**Root Cause:** FAZ 3 created `AdminModule` with `AdminSystemController` that uses `@UseGuards(JwtAuthGuard, TenantGuard)`. The `TenantGuard` depends on `TenantsService`, but `AdminModule` did not import `TenantsModule` which exports `TenantsService`.

**Fix:** Added `TenantsModule` to `AdminModule`'s imports array.

## Files Changed

1. `backend-nest/src/auth/auth.service.spec.ts` - Added MfaService mock
2. `.github/workflows/backend-nest-ci.yml` - Fixed pg_isready health check
3. `backend-nest/src/admin/admin.module.ts` - Added TenantsModule import

## Verification

**Local Verification:**
- `npm run lint` - PASS
- `npm run build` - PASS
- `npm run test` - 204 tests PASS

**CI Verification (commit 387bbbd):**
- Lint: PASS
- Security Audit: PASS
- Build: PASS
- API Contract Check: PASS
- Unit Tests: PASS
- E2E Tests: PASS
- Docker Build: PASS
- Acceptance Tests: SKIPPED (disabled by default)

## What Was NOT Changed

- No runtime behavior changes
- No new dependencies added
- No test logic modified (only mock providers added)
- No security gates weakened
- Acceptance Tests remain disabled (as designed)
