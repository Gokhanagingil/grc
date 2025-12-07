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

## GRC Domain - Current State

This section documents the current state of the GRC (Governance, Risk, Compliance) domain for testing purposes.

### GRC Endpoints

The GRC domain exposes the following REST API endpoints:

| Domain | Base Path | Operations |
|--------|-----------|------------|
| Risks | `/grc/risks` | GET (list, by ID, statistics, summary, high-severity, controls), POST, PATCH, DELETE |
| Policies | `/grc/policies` | GET (list, by ID, statistics, summary, active, due-for-review, controls), POST, PATCH, DELETE |
| Requirements | `/grc/requirements` | GET (list, by ID, statistics, summary, frameworks, controls), POST, PATCH, DELETE |

### Guards and Security

All GRC endpoints use the following guards (applied in order):

1. **JwtAuthGuard** - Validates JWT token from Authorization header
2. **TenantGuard** - Validates `x-tenant-id` header and ensures user belongs to tenant
3. **PermissionsGuard** - Checks user has required permissions for the operation

Permission requirements:
- Read operations: `GRC_RISK_READ`, `GRC_POLICY_READ`, `GRC_REQUIREMENT_READ`
- Write operations: `GRC_RISK_WRITE`, `GRC_POLICY_WRITE`, `GRC_REQUIREMENT_WRITE`
- Statistics: `GRC_STATISTICS_READ`

### Soft Delete Strategy

All GRC entities implement soft delete:
- Entities have an `isDeleted` boolean field (default: `false`)
- DELETE endpoints call `softDeleteXxx()` which sets `isDeleted = true`
- All query methods filter by `isDeleted = false` to exclude deleted records
- Deleted records remain in the database for audit purposes

### Entity Structure

All GRC entities extend `BaseEntity` which provides:
- `id` (UUID) - Primary key
- `tenantId` (UUID) - Multi-tenant isolation
- `createdAt` / `updatedAt` - Timestamps
- `createdBy` / `updatedBy` - User audit fields
- `isDeleted` - Soft delete flag

### Current Test Coverage

**Unit Tests:** GRC service unit tests are now available:

| Service | File | Test Count |
|---------|------|------------|
| GrcRiskService | `src/grc/services/grc-risk.service.spec.ts` | 19 tests |
| GrcPolicyService | `src/grc/services/grc-policy.service.spec.ts` | 20 tests |
| GrcRequirementService | `src/grc/services/grc-requirement.service.spec.ts` | 20 tests |

**E2E Tests:** `test/grc.e2e-spec.ts` covers:
- Risk CRUD operations with tenant context
- Policy CRUD operations with tenant context
- Requirement CRUD operations with tenant context
- Soft delete behavior verification
- Authentication requirements (401 without token)
- Tenant header requirements (400 without x-tenant-id)

**Gap:** Tenant isolation e2e tests (cross-tenant access prevention) need to be added.

## GRC Domain Unit Tests

This section documents the unit tests for GRC domain services.

### GrcRiskService Tests

**File:** `src/grc/services/grc-risk.service.spec.ts`

| Category | Test Scenario |
|----------|---------------|
| createRisk | Creates new risk with tenant ID |
| createRisk | Creates history entry when creating a risk |
| updateRisk | Updates an existing risk |
| updateRisk | Returns null when updating non-existent risk |
| updateRisk | Does not update risk from different tenant |
| softDeleteRisk | Soft deletes a risk by setting isDeleted to true |
| softDeleteRisk | Returns false when soft deleting non-existent risk |
| softDeleteRisk | Returns false when soft deleting already deleted risk |
| findOneActiveForTenant | Returns risk when found and not deleted |
| findOneActiveForTenant | Returns null when risk not found |
| findOneActiveForTenant | Returns null when risk is deleted |
| findAllActiveForTenant | Returns all active risks for tenant |
| findAllActiveForTenant | Filters by additional criteria |
| findByStatus | Returns risks filtered by status |
| findBySeverity | Returns risks filtered by severity |
| getStatistics | Returns risk statistics for tenant |
| tenant isolation | Does not return risks from different tenant |
| tenant isolation | Only returns risks belonging to the specified tenant |

### GrcPolicyService Tests

**File:** `src/grc/services/grc-policy.service.spec.ts`

| Category | Test Scenario |
|----------|---------------|
| createPolicy | Creates new policy with tenant ID |
| createPolicy | Creates policy with minimal required fields |
| updatePolicy | Updates an existing policy |
| updatePolicy | Returns null when updating non-existent policy |
| updatePolicy | Does not update policy from different tenant |
| softDeletePolicy | Soft deletes a policy by setting isDeleted to true |
| softDeletePolicy | Returns false when soft deleting non-existent policy |
| softDeletePolicy | Returns false when soft deleting already deleted policy |
| findOneActiveForTenant | Returns policy when found and not deleted |
| findOneActiveForTenant | Returns null when policy not found |
| findOneActiveForTenant | Returns null when policy is deleted |
| findAllActiveForTenant | Returns all active policies for tenant |
| findAllActiveForTenant | Filters by additional criteria |
| findByStatus | Returns policies filtered by status |
| findActivePolicies | Returns only active policies |
| findByCategory | Returns policies filtered by category |
| getStatistics | Returns policy statistics for tenant |
| tenant isolation | Does not return policies from different tenant |
| tenant isolation | Only returns policies belonging to the specified tenant |

### GrcRequirementService Tests

**File:** `src/grc/services/grc-requirement.service.spec.ts`

| Category | Test Scenario |
|----------|---------------|
| createRequirement | Creates new requirement with tenant ID |
| createRequirement | Creates requirement with required fields only |
| updateRequirement | Updates an existing requirement |
| updateRequirement | Returns null when updating non-existent requirement |
| updateRequirement | Does not update requirement from different tenant |
| softDeleteRequirement | Soft deletes a requirement by setting isDeleted to true |
| softDeleteRequirement | Returns false when soft deleting non-existent requirement |
| softDeleteRequirement | Returns false when soft deleting already deleted requirement |
| findOneActiveForTenant | Returns requirement when found and not deleted |
| findOneActiveForTenant | Returns null when requirement not found |
| findOneActiveForTenant | Returns null when requirement is deleted |
| findAllActiveForTenant | Returns all active requirements for tenant |
| findAllActiveForTenant | Filters by additional criteria |
| findByFramework | Returns requirements filtered by framework |
| findByStatus | Returns requirements filtered by status |
| getFrameworks | Returns unique frameworks used by tenant |
| getStatistics | Returns requirement statistics for tenant |
| tenant isolation | Does not return requirements from different tenant |
| tenant isolation | Only returns requirements belonging to the specified tenant |

## GRC Domain E2E Tests

This section documents the end-to-end tests for the GRC domain.

### Test File

**File:** `test/grc.e2e-spec.ts`

### CRUD Operations Tests

The following CRUD operations are tested for each GRC entity (Risk, Policy, Requirement):

| Operation | Test Scenario |
|-----------|---------------|
| GET (list) | Returns list with valid auth and tenant ID |
| GET (list) | Returns 401 without token |
| GET (list) | Returns 400 without x-tenant-id header |
| POST | Creates new entity with valid data |
| POST | Returns 400 without required fields |
| GET (by ID) | Returns specific entity by ID |
| GET (by ID) | Returns 404 for non-existent entity |
| PATCH | Updates existing entity |
| PATCH | Returns 404 for non-existent entity |
| DELETE | Soft deletes entity |
| DELETE | Deleted entity not returned in list |
| DELETE | Returns 404 when trying to get deleted entity |
| GET (statistics) | Returns statistics for tenant |

### Tenant Isolation Tests

The following tests verify that tenant isolation is properly enforced:

| Entity | Test Scenario |
|--------|---------------|
| Risk | Returns 403 when accessing risk with fake tenant ID |
| Risk | Returns 403 when updating risk with fake tenant ID |
| Risk | Returns 403 when deleting risk with fake tenant ID |
| Risk | Returns 403 when listing risks with fake tenant ID |
| Policy | Returns 403 when accessing policy with fake tenant ID |
| Policy | Returns 403 when updating policy with fake tenant ID |
| Requirement | Returns 403 when accessing requirement with fake tenant ID |
| Requirement | Returns 403 when updating requirement with fake tenant ID |

### Invalid Tenant ID Handling Tests

| Test Scenario |
|---------------|
| Returns 400 for invalid UUID format in x-tenant-id |
| Returns 400 when x-tenant-id header is missing |

## Future Improvements

1. **Increase Unit Test Coverage**
   - Add tests for GrcRiskService, GrcPolicyService, GrcRequirementService
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
