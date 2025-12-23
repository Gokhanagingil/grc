# FAZ 4 Exit Report: Operability, Self-Control, CI Hygiene

## Scope

FAZ 4 establishes the operational foundation for the GRC Platform by implementing self-validation mechanisms, standardizing deployment procedures, and strengthening CI/CD hygiene. The goal is to make the platform operationally reliable, verifiable, and auditable before moving to GRC/ITSM modules.

**Core Principle**: "Evidence-based assurance, not memory-based" (Hatırlamaya değil, kanıta dayalı güvence)

## Changes Summary

### A) Self-Control Kit

#### A1: Platform Validation Command
- **Added**: `npm run platform:validate` - Single command to validate entire platform
- **Features**:
  - Environment variable validation
  - Database connectivity test
  - Migration status check
  - Auth & onboarding smoke tests
  - JSON output option for CI (`--json`)
  - Skip smoke option (`--skip-smoke`)

#### A2: Validation Scripts
Created in `backend-nest/src/scripts/`:

| Script | Purpose | Exit Codes |
|--------|---------|------------|
| `validate-env.ts` | Validates required/optional env vars | 0=pass, 1=fail |
| `validate-db.ts` | Tests database connectivity | 0=pass, 1=fail |
| `validate-migrations.ts` | Checks migration status | 0=pass, 1=fail |
| `smoke-auth-onboarding.ts` | Auth & onboarding smoke tests | 0=pass, 1=fail |
| `platform-validate.ts` | Orchestrates all validations | 0=pass, 1=fail |

**npm Scripts Added**:
```json
"validate:env": "ts-node -r tsconfig-paths/register src/scripts/validate-env.ts",
"validate:db": "ts-node -r tsconfig-paths/register src/scripts/validate-db.ts",
"validate:migrations": "ts-node -r tsconfig-paths/register src/scripts/validate-migrations.ts",
"smoke:auth-onboarding": "ts-node -r tsconfig-paths/register src/scripts/smoke-auth-onboarding.ts",
"platform:validate": "ts-node -r tsconfig-paths/register src/scripts/platform-validate.ts"
```

#### A3: Documentation
- **Created**: `docs/OPERABILITY_SELF_CONTROL.md`
  - Daily control checklist
  - Post-staging deploy control procedures
  - Incident response procedures
  - Validation commands reference
  - Troubleshooting guide
  - CI integration examples

### B) Deploy & Restart Standardization

#### B1: Staging Operations Runbook
- **Created**: `docs/STAGING_OPERATIONS_RUNBOOK.md`
  - Single source of truth for staging operations
  - Standard deployment procedure
  - Quick restart procedure
  - Database backup/restore procedures
  - Rollback procedures
  - Container management
  - Environment variables reference
  - Troubleshooting guide

#### B2: Restart Script
- **Created**: `scripts/restart-staging.sh`
  - Restarts backend/frontend containers
  - Waits for health checks
  - Runs smoke validation
  - Supports `--skip-validation` flag
  - Color-coded output
  - Proper exit codes

### C) CI/Security Hygiene

#### C1: Dependabot
- **Created**: `.github/dependabot.yml`
  - Weekly updates (Mondays, 09:00 Istanbul time)
  - Covers: root, backend-nest, frontend, backend (legacy)
  - GitHub Actions updates
  - Grouped updates (NestJS, TypeORM, React, MUI, testing)
  - Conservative major version handling

#### C2: CodeQL + Security Hygiene
- **Created**: `.github/workflows/codeql.yml`
  - JavaScript/TypeScript analysis
  - Runs on push, PR, and weekly schedule
  - Security-extended queries
- **Created**: `docs/SECURITY_DEV_HYGIENE.md`
  - Secrets management guidelines
  - Code security best practices
  - Dependency security procedures
  - CI/CD security guidelines
  - Development practices checklist

#### C3: Monorepo Strategy
- **Created**: `docs/MONOREPO_STRATEGY.md`
  - Current state analysis
  - Options comparison (npm workspaces, pnpm, Nx, Turborepo)
  - Recommendation: npm workspaces in FAZ 6
  - Migration roadmap

#### C4: Dependency Analysis
- **Created**: `docs/DEPENDENCY_ANALYSIS.md`
  - bcrypt vs bcryptjs analysis
  - Evidence-based usage mapping
  - Risk assessment: LOW
  - Recommendation: Keep both for now, standardize in FAZ 5-6

## Files Changed/Created

### New Files (14)
```
backend-nest/src/scripts/validate-env.ts
backend-nest/src/scripts/validate-db.ts
backend-nest/src/scripts/validate-migrations.ts
backend-nest/src/scripts/smoke-auth-onboarding.ts
backend-nest/src/scripts/platform-validate.ts
docs/OPERABILITY_SELF_CONTROL.md
docs/STAGING_OPERATIONS_RUNBOOK.md
docs/SECURITY_DEV_HYGIENE.md
docs/MONOREPO_STRATEGY.md
docs/DEPENDENCY_ANALYSIS.md
scripts/restart-staging.sh
.github/dependabot.yml
.github/workflows/codeql.yml
FAZ4_EXIT_REPORT.md
```

### Modified Files (1)
```
backend-nest/package.json (added npm scripts)
```

## Risks & Consciously Deferred Items

### Deferred to FAZ 5-6

| Item | Reason | Target Phase |
|------|--------|--------------|
| bcrypt/bcryptjs standardization | Low risk, working system | FAZ 5-6 |
| npm workspaces migration | Breaking change risk | FAZ 6 |
| Nx/Turborepo evaluation | Not needed yet | FAZ 8+ |
| Remote CI caching | Requires infrastructure | FAZ 7+ |
| Gitleaks integration | Optional, docs sufficient | FAZ 5 |

### Known Limitations

1. **Smoke tests require running server**: The `smoke:auth-onboarding` script needs the backend to be running
2. **Platform validation timeout**: Scripts have 60-second timeout per check
3. **No Windows restart script**: `restart-staging.ps1` not created (Linux-only staging)

## Validation Results

### Local Validation Commands

```bash
# Environment validation (no DB required)
cd backend-nest && npm run validate:env
# Expected: Shows required/optional env vars status

# Database validation (requires DB)
cd backend-nest && npm run validate:db
# Expected: Connection test, query test, table count

# Migration validation (requires DB)
cd backend-nest && npm run validate:migrations
# Expected: Migration status, pending count

# Full platform validation (requires running server)
cd backend-nest && npm run platform:validate
# Expected: All checks pass
```

### CI Validation

- All existing CI checks should pass
- New CodeQL workflow will run on push
- Dependabot will create PRs starting next Monday

## Breaking Changes

**None**. All changes are additive:
- New scripts don't affect existing functionality
- New npm scripts don't conflict with existing ones
- Documentation is purely additive
- CI workflows are new additions

## Recommendations for Next Phase

1. **FAZ 5**: Standardize on bcryptjs across all services
2. **FAZ 5**: Add Gitleaks pre-commit hook
3. **FAZ 6**: Migrate to npm workspaces
4. **FAZ 6**: Implement shared ESLint/Prettier config
5. **FAZ 7**: Evaluate remote CI caching needs

## Conclusion

FAZ 4 successfully establishes the operational foundation for the GRC Platform. The self-control kit provides evidence-based validation, the staging runbook standardizes operations, and CI hygiene improvements strengthen the development workflow. The platform is now ready for GRC/ITSM module development with confidence in its operational reliability.
