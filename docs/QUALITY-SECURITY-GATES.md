# Quality and Security Gates

This document describes the CI/CD quality and security gates implemented in the GRC Platform to ensure audit-grade reliability, security, and deterministic builds.

## Overview

The platform implements multiple layers of automated checks to prevent security vulnerabilities, credential leaks, and common deployment issues. These gates are designed to be non-intrusive while providing high-impact protection.

## Security Gates

### 1. Secret Scanning (TruffleHog)

**Workflow:** `.github/workflows/secret-scanning.yml`

**Risk Level:** P0 (Critical)

**Purpose:** Scans the repository for accidentally committed secrets such as API keys, tokens, and credentials.

**Configuration:**
- Runs on push to `main` and `devin/**` branches
- Runs on pull requests to `main`
- Scheduled daily at 2:00 AM UTC
- Uses `--only-verified` flag to minimize false positives
- Fails build only on verified (active) secrets

**Local Testing:**
```bash
# Install TruffleHog
brew install trufflehog  # macOS
# or
pip install trufflehog

# Run scan
trufflehog filesystem . --only-verified
```

### 2. CodeQL Security Analysis

**Workflow:** `.github/workflows/codeql.yml`

**Risk Level:** P1 (High)

**Purpose:** Static analysis for JavaScript/TypeScript code to detect security vulnerabilities, code quality issues, and potential bugs.

**Configuration:**
- Analyzes `javascript-typescript` language
- Uses `security-extended` and `security-and-quality` query suites
- Runs weekly on Sundays and on every push/PR

### 3. Credential Pattern Check

**Workflow:** `.github/workflows/credential-check.yml`
**Config File:** `.github/credential-patterns.txt`

**Risk Level:** P1 (High)

**Purpose:** Prevents hardcoded credentials from being committed by scanning for known credential patterns.

**Blocked Patterns:**
- `StagingPassword`
- `staging-jwt-secret`
- `@grc-staging`
- `TestPassword123!` (only in non-test source files)

**Adding New Patterns:**
Edit `.github/credential-patterns.txt` and add one pattern per line. Lines starting with `#` are comments.

**Local Testing:**
```bash
# Check for patterns manually
grep -rn "StagingPassword" --exclude-dir=node_modules --exclude-dir=dist .
```

## Migration Safety Gates

### 4. No dist/migrations/index.js Check

**Location:** `.github/workflows/backend-nest-ci.yml` (build job)

**Risk Level:** P1 (High)

**Purpose:** Ensures no `index.js` barrel export exists in the migrations directory, which would cause TypeORM to load it as a migration and fail with duplicate migration errors.

**Why This Matters:**
TypeORM uses glob patterns (`dist/migrations/*.js`) to discover migrations. If an `index.js` exists, it gets loaded as a migration class, causing:
- Duplicate migration errors
- Failed deployments
- Database corruption risk

**Local Testing:**
```bash
cd backend-nest
npm run build
ls dist/migrations/  # Should NOT contain index.js
```

### 5. Migration Validation Script

**Location:** `backend-nest/src/scripts/validate-migrations.ts`

**Risk Level:** P1 (High)

**Purpose:** Validates migration status, checks for pending migrations, and verifies migration file integrity.

**Usage:**
```bash
cd backend-nest

# Human-readable output
npm run validate:migrations

# JSON output for CI
npm run validate:migrations -- --json
```

**Checks Performed:**
- Migrations table exists
- No pending migrations
- Migration files follow naming convention
- No index.ts/index.js in migrations directory

## Playwright E2E Reliability

### 6. Trace-on-Failure Configuration

**Location:** `frontend/playwright.config.ts`, `.github/workflows/e2e-tests.yml`

**Risk Level:** P2 (Medium)

**Purpose:** Captures detailed traces when E2E tests fail to aid in debugging flaky tests.

**Configuration:**
- `trace: 'on-first-retry'` for chromium project
- `trace: 'on'` for staging project
- Screenshots and videos captured on failure
- Traces uploaded as artifacts with 14-day retention

**Viewing Traces:**
1. Download the `playwright-traces-{run_id}` artifact from GitHub Actions
2. Extract the `.zip` file
3. Run `npx playwright show-trace trace.zip`

### 7. System Status Test Stability

**Location:** `frontend/e2e/navigation.spec.ts`

**Risk Level:** P2 (Medium)

**Purpose:** Ensures the Admin System Status page test is deterministic and doesn't suffer from race conditions.

**Best Practices Implemented:**
- Uses `data-testid="system-status-widgets"` for reliable element selection
- Uses `page.waitForURL()` before assertions
- 15000ms timeout for async operations
- No `Promise.all` navigation races

## Log/PII Hygiene

### 8. Log Sanitization Layer

**Location:** `backend-nest/src/common/logger/log-sanitizer.ts`

**Risk Level:** P1 (High)

**Purpose:** Prevents sensitive data from being logged, including PII, tokens, and credentials.

**Sanitized Patterns:**
- Authorization headers (Bearer tokens, Basic auth)
- JWT tokens
- Email addresses (domain preserved for context)
- API keys and secrets
- Password field values

**Usage:**
```typescript
import { sanitizeLogData, sanitizeString, sanitizeHeaders } from '../common/logger';

// Sanitize a string
const safeMessage = sanitizeString(errorMessage);

// Sanitize an object
const safeData = sanitizeLogData(requestBody);

// Sanitize HTTP headers
const safeHeaders = sanitizeHeaders(request.headers);
```

**Integration:**
The `GlobalExceptionFilter` automatically sanitizes error messages and stack traces before logging.

## Risk Priority Matrix

| Gate | Risk Level | Impact | Likelihood | Mitigation |
|------|------------|--------|------------|------------|
| Secret Scanning | P0 | Critical | Medium | Immediate credential rotation |
| CodeQL | P1 | High | Medium | Code review + fix |
| Credential Patterns | P1 | High | Low | Block merge |
| Migration Index Check | P1 | High | Low | Block deployment |
| Log Sanitization | P1 | High | Medium | Automatic masking |
| Playwright Traces | P2 | Medium | Medium | Debug artifacts |
| Test Stability | P2 | Medium | Low | Deterministic tests |

## Troubleshooting

### Secret Scanning False Positives

If TruffleHog reports a false positive:
1. Verify the secret is not actually active
2. Add the pattern to `.trufflehog-ignore` if needed
3. Use inline ignore comments in code

### Credential Pattern Check Failures

If the credential check fails:
1. Review the flagged file and line
2. Remove the hardcoded credential
3. Use environment variables instead
4. If it's a test file, ensure it's in an excluded directory

### Migration Validation Failures

If migration validation fails:
1. Check for `index.ts` in `src/migrations/` - remove it
2. Run `npm run build` and check `dist/migrations/`
3. Ensure all migrations follow the naming convention

## Adding New Gates

When adding new quality gates:
1. Document the risk level (P0/P1/P2)
2. Provide local testing instructions
3. Ensure the gate doesn't block developers with false positives
4. Add to this documentation

## Related Documentation

- [Security and Secrets Guide](./SECURITY-AND-SECRETS-GUIDE.md)
- [Staging Maintenance Runbook](./STAGING-MAINTENANCE-RUNBOOK.md)
- [Testing Strategy Backend](./TESTING-STRATEGY-BACKEND.md)
- [GRC Deployment and Environments](./GRC-DEPLOYMENT-AND-ENVIRONMENTS.md)
