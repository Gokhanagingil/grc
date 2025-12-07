# Backend Testing Strategy

This document describes the testing strategy for the GRC Platform backend (`backend-nest`).

## Overview

The backend uses a multi-layered testing approach to ensure code quality and reliability:

1. **Unit Tests** - Test individual services and functions in isolation
2. **E2E Tests** - Test complete API flows with real HTTP requests
3. **Smoke Tests** - Quick health checks for deployment verification

## Test Types

### Unit Tests

Unit tests are located alongside the source files with the `.spec.ts` extension.

**Location:** `backend-nest/src/**/*.spec.ts`

**Current Coverage:**

| Service | File | Scenarios |
|---------|------|-----------|
| AuthService | `src/auth/auth.service.spec.ts` | Login with valid/invalid credentials, user validation, account deactivation |
| TenantsService | `src/tenants/tenants.service.spec.ts` | getOrCreateDemoTenant idempotent behavior, findById, userBelongsToTenant |
| AppController | `src/app.controller.spec.ts` | Basic controller instantiation |

**Key Test Scenarios:**

1. **AuthService**
   - `validateUser` returns user when email and password are correct
   - `validateUser` returns null when email is not found
   - `validateUser` returns null when password is incorrect
   - `login` returns accessToken and user on successful login
   - `login` throws UnauthorizedException on invalid credentials
   - `login` throws UnauthorizedException when user account is deactivated

2. **TenantsService**
   - `getOrCreateDemoTenant` returns existing demo tenant if it exists (idempotent)
   - `getOrCreateDemoTenant` creates demo tenant if it does not exist
   - `getOrCreateDemoTenant` is idempotent - multiple calls return same tenant
   - `findById` returns tenant when found
   - `findById` returns null when tenant not found
   - `userBelongsToTenant` returns true/false based on tenant membership

### E2E Tests

E2E tests are located in the `test/` directory with the `.e2e-spec.ts` extension.

**Location:** `backend-nest/test/*.e2e-spec.ts`

**Current Coverage:**

| Test Suite | File | Scenarios |
|------------|------|-----------|
| Multi-tenancy | `test/tenants.e2e-spec.ts` | Tenant isolation, cross-tenant access prevention |
| GRC CRUD | `test/grc.e2e-spec.ts` | Risk, Policy, Requirement CRUD operations |

**Key Test Scenarios:**

1. **Multi-tenancy (tenants.e2e-spec.ts)**
   - Login with demo admin credentials
   - Verify tenant context is set correctly
   - Test tenant isolation for data access

2. **GRC CRUD (grc.e2e-spec.ts)**
   - Create/Read/Update/Delete risks with tenant context
   - Create/Read/Update/Delete policies with tenant context
   - Create/Read/Update/Delete compliance requirements with tenant context
   - Verify soft delete behavior
   - Test authentication requirements

### Smoke Tests

Smoke tests are quick health checks run via npm scripts.

**Scripts:**
- `npm run test:login` - Tests login endpoint with demo credentials
- `npm run smoke:server` - Tests server health endpoint

## Running Tests

### Unit Tests

```bash
# Run all unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov
```

### E2E Tests

```bash
# Run all e2e tests (requires database connection)
npm run test:e2e
```

**Prerequisites:**
- PostgreSQL database running
- Environment variables configured (see `.env.example`)
- Demo tenant and admin user seeded (`npm run seed:grc`)

### Smoke Tests

```bash
# Test login endpoint
npm run test:login

# Test server health
npm run smoke:server
```

## CI Integration

Tests are integrated into the CI pipeline via GitHub Actions:

**Workflow:** `.github/workflows/backend-nest-ci.yml`

**Test Jobs:**
1. `lint` - ESLint checks
2. `build` - TypeScript compilation
3. `test` - Unit tests (`npm run test`)
4. `docker` - Docker image build

**Note:** E2E tests require a database connection and are not currently run in CI. They should be run locally before creating PRs.

## Critical Risks Covered

The test suite specifically addresses these critical risks:

### 1. Authentication Security
- Password validation with bcrypt
- JWT token generation and validation
- Brute force protection (via BruteForceService)
- Account deactivation enforcement

### 2. Tenant Isolation
- Data is scoped to tenant context
- Cross-tenant access is prevented
- Demo tenant creation is idempotent

### 3. GRC Data Integrity
- CRUD operations work correctly
- Soft delete preserves data
- Required fields are validated

## Test Configuration

### Jest Configuration

**File:** `backend-nest/jest.config.js`

```javascript
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};
```

### Test Setup

**File:** `backend-nest/test/setup.ts`

Sets environment variables for tests:
- `NODE_ENV=test`
- `JWT_SECRET` for token signing
- `DEMO_ADMIN_EMAIL` and `DEMO_ADMIN_PASSWORD` for e2e tests
- Database connection settings

### ESLint Configuration

**File:** `backend-nest/eslint.config.mjs`

Relaxed rules for test files:
- `@typescript-eslint/no-unsafe-*` rules disabled (supertest returns `any`)
- `@typescript-eslint/unbound-method` disabled (Jest mock methods)
- `@typescript-eslint/no-unused-vars` set to warn only

## Future Improvements

1. **Increase Unit Test Coverage**
   - Add tests for GrcService (risks, policies, requirements)
   - Add tests for UsersService
   - Add tests for guards and decorators

2. **Add Integration Tests**
   - Test database transactions
   - Test cascading deletes
   - Test concurrent operations

3. **Add E2E Tests to CI**
   - Set up test database in CI
   - Run e2e tests as part of PR checks

4. **Add Performance Tests**
   - Load testing for API endpoints
   - Database query performance benchmarks

5. **Add Security Tests**
   - SQL injection prevention
   - XSS prevention
   - CSRF protection
