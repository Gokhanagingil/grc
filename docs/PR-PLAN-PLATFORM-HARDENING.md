# PR Plan: Platform Hardening (Week 1)

**Goal:** Implement critical platform hardening fixes in 2-4 PRs this week.

**Scope:** Focus on reliability, security, operability, maintainability. No feature work.

---

## PR 1: TypeORM Migration & Synchronize Protection

**Branch:** `hardening/typeorm-migration-protection`  
**Priority:** P0 (Critical)  
**Estimated Effort:** 2-3 hours

### Scope

1. **TypeORM Migration Verification Enhancement**
   - Replace heuristic `isDistEnvironment()` with explicit `TYPEORM_ENV` variable
   - Add migration status to `/health/db` endpoint
   - Add migration verification step to deployment script

2. **TypeORM Synchronize Flag Protection**
   - Add validation to prevent `synchronize: true` in production
   - Update staging docker-compose to explicitly set `DB_SYNC=false`
   - Add startup check with clear error message

### Files to Touch

**Backend:**
- `backend-nest/src/data-source.ts` - Replace heuristic with explicit env var
- `backend-nest/src/health/health.service.ts` - Add migration status check
- `backend-nest/src/app.module.ts` - Add synchronize validation
- `backend-nest/src/config/validation.ts` - Add synchronize validation rule
- `backend-nest/src/scripts/validate-migrations.ts` - New migration verification script

**Infrastructure:**
- `docker-compose.staging.yml` - Explicitly set `DB_SYNC=false`
- `scripts/deploy-staging.sh` - Add migration verification step
- `backend-nest/Dockerfile` - Add `TYPEORM_ENV` env var (optional)

**Documentation:**
- `docs/STAGING_DEPLOYMENT_RUNBOOK.md` - Update migration verification steps

### Commit Message Template

```
feat(platform): enhance TypeORM migration verification and protect synchronize flag

- Replace heuristic isDistEnvironment() with explicit TYPEORM_ENV env var
- Add migration status to /health/db endpoint
- Add migration verification step to deployment script
- Prevent synchronize:true in production with validation
- Update staging docker-compose to explicitly set DB_SYNC=false

Fixes: TypeORM migration verification failures in staging
Risk: Low (additive changes, backward compatible)
```

### Acceptance Tests

1. **Migration Verification:**
   ```bash
   # In staging container
   npx typeorm migration:show -d dist/data-source.js
   # Should always produce output (even if empty)
   ```

2. **Health Check:**
   ```bash
   curl http://localhost:3002/health/db
   # Should include migration status in response
   ```

3. **Synchronize Protection:**
   ```bash
   # Set DB_SYNC=true and NODE_ENV=production
   # Application should fail to start with clear error message
   ```

4. **Deployment Script:**
   ```bash
   ./scripts/deploy-staging.sh
   # Should verify migration status before proceeding
   ```

---

## PR 2: Admin System Menu Discovery & CI/CD Foundation

**Branch:** `hardening/admin-menu-ci-foundation`  
**Priority:** P0 (Critical) + P1 (High)  
**Estimated Effort:** 4-5 hours

### Scope

1. **Admin System Menu Discovery Fix**
   - Add `/admin/system` to `Layout.tsx` menu items explicitly
   - Ensure admin menu items visible regardless of module state

2. **CI/CD Pipeline Foundation**
   - Create `.github/workflows/pr-validation.yml`
   - Add quality gates (lint, test, build)
   - Integrate with existing scripts

### Files to Touch

**Frontend:**
- `frontend/src/components/Layout.tsx` - Add `/admin/system` menu item

**CI/CD:**
- `.github/workflows/pr-validation.yml` - New PR validation workflow
- `.github/workflows/quality-gates.yml` - New quality gates workflow (optional, can be in PR 1)

**Documentation:**
- `docs/QUALITY-GATE-CHECKLIST.md` - Reference CI/CD workflows

### Commit Message Template

```
feat(platform): fix admin system menu discovery and add CI/CD foundation

- Add /admin/system to Layout.tsx menu items explicitly
- Ensure admin menu items visible regardless of module state
- Create GitHub Actions workflow for PR validation (lint, test, build)
- Add quality gates to prevent merge on failures

Fixes: /admin/system not discoverable in left menu
Risk: Low (additive changes, CI/CD is new infrastructure)
```

### Acceptance Tests

1. **Menu Discovery:**
   - Login as admin user
   - Verify `/admin/system` appears in left navigation menu
   - Click menu item, verify it navigates to `/admin/system`
   - Verify direct URL access still works

2. **CI/CD:**
   - Create test PR with lint error
   - Verify CI/CD fails and blocks merge
   - Fix lint error, verify CI/CD passes

---

## PR 3: Health Check Enhancement & Environment Validation

**Branch:** `hardening/health-env-validation`  
**Priority:** P2 (Medium)  
**Estimated Effort:** 3-4 hours

### Scope

1. **Health Check Coverage Enhancement**
   - Enhance `/health/ready` to include migration status
   - Add health check aggregation endpoint (optional)

2. **Environment Variable Validation Enhancement**
   - Add staging-specific validation
   - Add secret strength validation (JWT_SECRET min length)
   - Enhance `validate-env.ts` script

### Files to Touch

**Backend:**
- `backend-nest/src/health/health.service.ts` - Add migration status to ready check
- `backend-nest/src/health/health.controller.ts` - Update ready endpoint
- `backend-nest/src/config/validation.ts` - Add staging validation and secret strength
- `backend-nest/src/scripts/validate-env.ts` - Enhance validation script

**Infrastructure:**
- `scripts/deploy-staging.sh` - Add environment validation step

**Documentation:**
- `docs/ENV-CONFIG-AND-VALIDATION.md` - Update validation rules

### Commit Message Template

```
feat(platform): enhance health checks and environment validation

- Add migration status to /health/ready endpoint
- Add staging-specific environment validation
- Add secret strength validation (JWT_SECRET min length)
- Enhance validate-env.ts script with staging checks

Improves: Deployment reliability and configuration validation
Risk: Low (additive changes, backward compatible)
```

### Acceptance Tests

1. **Health Check:**
   ```bash
   curl http://localhost:3002/health/ready
   # Should include migration status in checks
   ```

2. **Environment Validation:**
   ```bash
   # Set JWT_SECRET to short value (<32 chars)
   npm run validate:env
   # Should fail with clear error message
   ```

---

## PR 4: Deployment Determinism & Rollback (Optional)

**Branch:** `hardening/deployment-rollback`  
**Priority:** P2 (Medium)  
**Estimated Effort:** 4-5 hours

### Scope

1. **Deployment Determinism Enhancement**
   - Add rollback capability to `deploy-staging.sh`
   - Create `scripts/rollback-staging.sh`
   - Add deployment verification checklist automation

### Files to Touch

**Infrastructure:**
- `scripts/deploy-staging.sh` - Add rollback capability
- `scripts/rollback-staging.sh` - New rollback script

**Documentation:**
- `docs/STAGING_DEPLOYMENT_RUNBOOK.md` - Update with rollback procedure

### Commit Message Template

```
feat(platform): add deployment rollback capability

- Add rollback capability to deploy-staging.sh
- Create rollback-staging.sh script
- Add deployment verification checklist automation
- Document rollback procedure

Improves: Deployment reliability and recovery
Risk: Low (new script, doesn't change existing deployment)
```

### Acceptance Tests

1. **Rollback:**
   ```bash
   # Deploy to staging
   ./scripts/deploy-staging.sh
   
   # Rollback to previous version
   ./scripts/rollback-staging.sh
   
   # Verify staging is back to previous state
   ```

---

## PR Execution Order

**Recommended Order:**
1. **PR 1** (TypeORM Migration & Synchronize Protection) - **MUST DO**
2. **PR 2** (Admin Menu & CI/CD Foundation) - **MUST DO**
3. **PR 3** (Health Check & Environment Validation) - **SHOULD DO**
4. **PR 4** (Deployment Rollback) - **NICE TO HAVE** (can defer to next week)

**Rationale:**
- PR 1 addresses known symptoms (migration verification, synchronize risk)
- PR 2 fixes user-facing issue (admin menu) and adds CI/CD foundation
- PR 3 improves deployment reliability (can be done in parallel with PR 2)
- PR 4 is nice-to-have but not critical for this week

---

## PR Review Checklist

For each PR, reviewers should verify:

- [ ] **Scope:** Only platform-level changes, no feature work
- [ ] **Tests:** Acceptance tests pass
- [ ] **Documentation:** Relevant docs updated
- [ ] **Backward Compatibility:** Changes are additive or clearly documented
- [ ] **Security:** No security regressions
- [ ] **Multi-Tenancy:** Tenant isolation maintained
- [ ] **Deployment:** Staging deployment works with changes

---

## Risk Assessment

**PR 1 Risk:** Low
- Additive changes (new env var, new health check field)
- Backward compatible (heuristic still works if env var not set)
- Synchronize protection is fail-safe (fails on unsafe config)

**PR 2 Risk:** Low
- Menu change is additive (new menu item)
- CI/CD is new infrastructure (doesn't affect existing code)
- Can be disabled if issues arise

**PR 3 Risk:** Low
- Health check enhancement is additive
- Environment validation is fail-safe (fails on invalid config)
- Backward compatible

**PR 4 Risk:** Low
- New script, doesn't change existing deployment
- Rollback is opt-in (doesn't affect normal deployment)

---

## Success Criteria

**Week 1 Goals:**
- ✅ TypeORM migration verification reliable
- ✅ Synchronize flag protected in production
- ✅ Admin system menu discoverable
- ✅ CI/CD foundation in place
- ✅ Health checks include migration status
- ✅ Environment validation enhanced

**Metrics:**
- Deployment success rate: >95%
- Migration verification success rate: 100%
- CI/CD pass rate: >90% on first submission

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-27

