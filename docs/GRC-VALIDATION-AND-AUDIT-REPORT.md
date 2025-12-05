# GRC Validation and Audit Report

This document summarizes the validation hardening, Swagger documentation, audit logging, and test coverage implemented during the GRC Backend Hardening & Production Readiness sprint.

## Overview

The NestJS GRC backend has been upgraded from "working CRUD APIs" to "production-ready enterprise APIs" with the following enhancements:

1. Enterprise-grade DTO validation with comprehensive validators
2. OpenAPI 3 / Swagger documentation at `/docs` endpoint
3. Audit logging for all write operations (create/update/delete)
4. Comprehensive test suite with deterministic test factories
5. Full RBAC and multi-tenancy enforcement

## 1. DTO Validation Summary

### Risk DTOs (CreateRiskDto / UpdateRiskDto)

| Field | Type | Validators | Description |
|-------|------|------------|-------------|
| title | string | @IsString, @IsNotEmpty, @MinLength(3), @MaxLength(255) | Risk title (required) |
| description | string | @IsString, @IsOptional, @MaxLength(2000) | Detailed description |
| category | string | @IsString, @IsOptional, @MaxLength(100) | Risk category |
| severity | RiskSeverity | @IsEnum(RiskSeverity), @IsOptional | LOW, MEDIUM, HIGH, CRITICAL |
| likelihood | RiskLikelihood | @IsEnum(RiskLikelihood), @IsOptional | RARE, UNLIKELY, POSSIBLE, LIKELY, ALMOST_CERTAIN |
| status | RiskStatus | @IsEnum(RiskStatus), @IsOptional | IDENTIFIED, ASSESSED, MITIGATED, ACCEPTED, CLOSED |
| owner | string | @IsString, @IsOptional, @MaxLength(255) | Risk owner email |
| impactScore | number | @IsInt, @Min(1), @Max(10), @IsOptional | Impact score (1-10) |
| riskScore | number | @IsInt, @Min(0), @Max(100), @IsOptional | Calculated risk score |
| mitigationPlan | string | @IsString, @IsOptional, @MaxLength(2000) | Mitigation strategy |
| dueDate | Date | @IsDate, @Type(() => Date), @IsOptional | Target completion date |
| tags | string[] | @IsArray, @IsString({ each: true }), @ArrayMaxSize(20), @IsOptional | Classification tags |
| controlIds | string[] | @IsArray, @IsUUID(4, { each: true }), @IsOptional | Associated control UUIDs |
| metadata | Record<string, unknown> | @IsObject, @IsOptional | Additional key-value pairs |

### Policy DTOs (CreatePolicyDto / UpdatePolicyDto)

| Field | Type | Validators | Description |
|-------|------|------------|-------------|
| name | string | @IsString, @IsNotEmpty, @MinLength(3), @MaxLength(255) | Policy name (required) |
| code | string | @IsString, @IsOptional, @Matches(/^[A-Z]{2,5}-[A-Z0-9-]+$/) | Policy code (e.g., POL-SEC-001) |
| version | string | @IsString, @IsOptional, @Matches(/^\d+\.\d+(\.\d+)?$/) | Semantic version |
| status | PolicyStatus | @IsEnum(PolicyStatus), @IsOptional | DRAFT, ACTIVE, UNDER_REVIEW, DEPRECATED, ARCHIVED |
| category | string | @IsString, @IsOptional, @MaxLength(100) | Policy category |
| summary | string | @IsString, @IsOptional, @MaxLength(500) | Brief summary |
| content | string | @IsString, @IsOptional | Full policy content |
| owner | string | @IsString, @IsOptional, @MaxLength(255) | Policy owner email |
| effectiveDate | Date | @IsDate, @Type(() => Date), @IsOptional | When policy becomes effective |
| reviewDate | Date | @IsDate, @Type(() => Date), @Validate(IsAfterEffectiveDate), @IsOptional | Next review date (must be after effectiveDate) |
| tags | string[] | @IsArray, @IsString({ each: true }), @ArrayMaxSize(20), @IsOptional | Classification tags |
| controlIds | string[] | @IsArray, @IsUUID(4, { each: true }), @IsOptional | Associated control UUIDs |
| metadata | Record<string, unknown> | @IsObject, @IsOptional | Additional key-value pairs |

### Requirement DTOs (CreateRequirementDto / UpdateRequirementDto)

| Field | Type | Validators | Description |
|-------|------|------------|-------------|
| framework | ComplianceFramework | @IsEnum(ComplianceFramework), @IsNotEmpty | ISO_27001, SOC2, GDPR, HIPAA, PCI_DSS, NIST_CSF, CUSTOM |
| referenceCode | string | @IsString, @IsNotEmpty, @Matches(/^[A-Za-z0-9.-]+$/) | Framework reference (e.g., A.5.1.1) |
| title | string | @IsString, @IsNotEmpty, @MinLength(3), @MaxLength(255) | Requirement title (required) |
| description | string | @IsString, @IsOptional, @MaxLength(2000) | Detailed description |
| category | string | @IsString, @IsOptional, @MaxLength(100) | Requirement category |
| priority | string | @IsIn(['Critical', 'High', 'Medium', 'Low']), @IsOptional | Priority level |
| status | string | @IsIn(['Not Started', 'In Progress', 'Compliant', 'Partially Compliant', 'Non-Compliant', 'Not Applicable']), @IsOptional | Compliance status |
| owner | string | @IsString, @IsOptional, @MaxLength(255) | Requirement owner email |
| dueDate | Date | @IsDate, @Type(() => Date), @IsOptional | Target compliance date |
| tags | string[] | @IsArray, @IsString({ each: true }), @ArrayMaxSize(20), @IsOptional | Classification tags |
| controlIds | string[] | @IsArray, @IsUUID(4, { each: true }), @IsOptional | Associated control UUIDs |
| metadata | Record<string, unknown> | @IsObject, @IsOptional | Additional key-value pairs |

## 2. Swagger/OpenAPI Documentation

The API documentation is available at `/docs` when the NestJS backend is running.

### Configuration

Swagger is configured in `src/main.ts` with:
- JWT Bearer authentication scheme
- x-tenant-id header for multi-tenancy
- Tags for all GRC endpoints (GRC Risks, GRC Policies, GRC Requirements)
- Persistent authorization for testing

### Documented Endpoints

#### GRC Risks (`/grc/risks`)
- `GET /grc/risks` - List all risks (supports ?status and ?severity filters)
- `POST /grc/risks` - Create a new risk (MANAGER/ADMIN only)
- `GET /grc/risks/statistics` - Get risk statistics (MANAGER/ADMIN only)
- `GET /grc/risks/high-severity` - Get high-severity risks
- `GET /grc/risks/:id` - Get a specific risk
- `GET /grc/risks/:id/controls` - Get a risk with its controls
- `PATCH /grc/risks/:id` - Update a risk (MANAGER/ADMIN only)
- `DELETE /grc/risks/:id` - Soft delete a risk (MANAGER/ADMIN only)

#### GRC Policies (`/grc/policies`)
- `GET /grc/policies` - List all policies (supports ?status and ?category filters)
- `POST /grc/policies` - Create a new policy (MANAGER/ADMIN only)
- `GET /grc/policies/statistics` - Get policy statistics (MANAGER/ADMIN only)
- `GET /grc/policies/active` - Get active policies
- `GET /grc/policies/due-for-review` - Get policies due for review (MANAGER/ADMIN only)
- `GET /grc/policies/:id` - Get a specific policy
- `GET /grc/policies/:id/controls` - Get a policy with its controls
- `PATCH /grc/policies/:id` - Update a policy (MANAGER/ADMIN only)
- `DELETE /grc/policies/:id` - Soft delete a policy (MANAGER/ADMIN only)

#### GRC Requirements (`/grc/requirements`)
- `GET /grc/requirements` - List all requirements (supports ?framework and ?status filters)
- `POST /grc/requirements` - Create a new requirement (MANAGER/ADMIN only)
- `GET /grc/requirements/statistics` - Get requirement statistics (MANAGER/ADMIN only)
- `GET /grc/requirements/frameworks` - Get available frameworks
- `GET /grc/requirements/:id` - Get a specific requirement
- `GET /grc/requirements/:id/controls` - Get a requirement with its controls
- `PATCH /grc/requirements/:id` - Update a requirement (MANAGER/ADMIN only)
- `DELETE /grc/requirements/:id` - Soft delete a requirement (MANAGER/ADMIN only)

## 3. Audit Logging

### Audit Event Schema

All GRC write operations emit domain events that are captured by the AuditService and persisted to the `nest_audit_logs` table.

```typescript
interface AuditLog {
  id: string;           // UUID
  tenantId: string;     // Tenant context
  userId: string;       // Actor who performed the action
  action: string;       // Action type (e.g., RISK_CREATED)
  resource: string;     // Resource type (e.g., grc_risks)
  resourceId: string;   // Entity ID
  statusCode: number;   // HTTP status code (optional)
  metadata: object;     // Additional context (changes, title, etc.)
  ipAddress: string;    // Client IP (optional)
  createdAt: Date;      // Timestamp
}
```

### Audit Actions

| Action | Resource | Trigger |
|--------|----------|---------|
| RISK_CREATED | grc_risks | POST /grc/risks |
| RISK_UPDATED | grc_risks | PATCH /grc/risks/:id |
| RISK_DELETED | grc_risks | DELETE /grc/risks/:id |
| POLICY_CREATED | grc_policies | POST /grc/policies |
| POLICY_UPDATED | grc_policies | PATCH /grc/policies/:id |
| POLICY_DELETED | grc_policies | DELETE /grc/policies/:id |
| REQUIREMENT_CREATED | grc_requirements | POST /grc/requirements |
| REQUIREMENT_UPDATED | grc_requirements | PATCH /grc/requirements/:id |
| REQUIREMENT_DELETED | grc_requirements | DELETE /grc/requirements/:id |

### Example Audit Log Entries

**Risk Created:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenantId": "00000000-0000-0000-0000-000000000001",
  "userId": "00000000-0000-0000-0000-000000000002",
  "action": "RISK_CREATED",
  "resource": "grc_risks",
  "resourceId": "550e8400-e29b-41d4-a716-446655440001",
  "metadata": {
    "title": "Data Breach via Phishing Attack",
    "timestamp": "2025-12-05T05:20:00.000Z"
  },
  "createdAt": "2025-12-05T05:20:00.000Z"
}
```

**Risk Updated:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "tenantId": "00000000-0000-0000-0000-000000000001",
  "userId": "00000000-0000-0000-0000-000000000002",
  "action": "RISK_UPDATED",
  "resource": "grc_risks",
  "resourceId": "550e8400-e29b-41d4-a716-446655440001",
  "metadata": {
    "changes": {
      "severity": "CRITICAL",
      "status": "MITIGATED"
    },
    "timestamp": "2025-12-05T05:25:00.000Z"
  },
  "createdAt": "2025-12-05T05:25:00.000Z"
}
```

**Policy Deleted:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440003",
  "tenantId": "00000000-0000-0000-0000-000000000001",
  "userId": "00000000-0000-0000-0000-000000000002",
  "action": "POLICY_DELETED",
  "resource": "grc_policies",
  "resourceId": "550e8400-e29b-41d4-a716-446655440004",
  "metadata": {
    "name": "Deprecated Security Policy",
    "timestamp": "2025-12-05T05:30:00.000Z"
  },
  "createdAt": "2025-12-05T05:30:00.000Z"
}
```

## 4. Test Coverage Summary

### Test Files

| File | Description | Test Count |
|------|-------------|------------|
| `test/grc.e2e-spec.ts` | GRC CRUD operations | ~30 tests |
| `test/grc-validation.e2e-spec.ts` | Validation and error handling | ~35 tests |
| `test/factories/index.ts` | Test data factories | N/A (utilities) |

### Test Categories

1. **Validation Tests**
   - Required field validation (title, name, framework, referenceCode)
   - Enum validation (severity, likelihood, status, framework)
   - String length validation (MinLength, MaxLength)
   - Numeric range validation (impactScore 1-10, riskScore 0-100)
   - Custom validators (reviewDate > effectiveDate)

2. **CRUD Tests**
   - Create operations with valid data
   - Read operations (list, get by ID, get with relations)
   - Update operations with partial data
   - Soft delete operations
   - Verify deleted items don't appear in lists

3. **Authentication Tests**
   - 401 for missing JWT token
   - 401 for invalid JWT token
   - 400 for missing x-tenant-id header

4. **RBAC Tests**
   - USER role can read but not write
   - MANAGER role can read and write
   - ADMIN role can read and write

5. **Error Response Tests**
   - Consistent error format (statusCode, message, error)
   - 404 for non-existent resources
   - 400 for validation errors

### Test Data Factories

Located in `test/factories/index.ts`:

- `tenantFactory()` - Create test tenant data
- `userFactory()` - Create test user data
- `adminUserFactory()` - Create admin user data
- `managerUserFactory()` - Create manager user data
- `regularUserFactory()` - Create regular user data
- `riskFactory()` - Create test risk data
- `highSeverityRiskFactory()` - Create high-severity risk
- `lowSeverityRiskFactory()` - Create low-severity risk
- `policyFactory()` - Create test policy data
- `activePolicyFactory()` - Create active policy
- `policyDueForReviewFactory()` - Create policy due for review
- `requirementFactory()` - Create test requirement data
- `soc2RequirementFactory()` - Create SOC2 requirement
- `gdprRequirementFactory()` - Create GDPR requirement
- `compliantRequirementFactory()` - Create compliant requirement
- `invalidRiskFactory()` - Create invalid risk for validation testing
- `invalidPolicyFactory()` - Create invalid policy for validation testing
- `invalidRequirementFactory()` - Create invalid requirement for validation testing
- `riskBatchFactory(count)` - Create multiple risks
- `policyBatchFactory(count)` - Create multiple policies
- `requirementBatchFactory(count)` - Create multiple requirements

## 5. How to Run Tests

### Prerequisites

1. PostgreSQL database running with `grc_platform` database
2. Environment variables configured (see `.env.example`)
3. Demo admin user seeded (`npm run seed:grc`)

### Running Tests

```bash
# Navigate to backend-nest directory
cd backend-nest

# Run unit tests
npm test

# Run e2e tests (requires PostgreSQL)
npm run test:e2e

# Run specific test file
npm run test:e2e -- --testPathPattern=grc-validation

# Run smoke tests (quick verification)
npm run smoke:grc
```

### Test Environment Variables

```bash
DEMO_ADMIN_EMAIL=admin@grc-platform.local
DEMO_ADMIN_PASSWORD=TestPassword123!
```

## 6. Files Modified in This Sprint

### DTOs
- `src/grc/dto/create-risk.dto.ts` - Added Swagger decorators and enhanced validators
- `src/grc/dto/update-risk.dto.ts` - Added Swagger decorators and enhanced validators
- `src/grc/dto/create-policy.dto.ts` - Added Swagger decorators, custom date validator
- `src/grc/dto/update-policy.dto.ts` - Added Swagger decorators, custom date validator
- `src/grc/dto/create-requirement.dto.ts` - Added Swagger decorators, priority/status validators
- `src/grc/dto/update-requirement.dto.ts` - Added Swagger decorators, priority/status validators

### Controllers
- `src/grc/controllers/grc-risk.controller.ts` - Added comprehensive Swagger decorators
- `src/grc/controllers/grc-policy.controller.ts` - Added comprehensive Swagger decorators
- `src/grc/controllers/grc-requirement.controller.ts` - Added comprehensive Swagger decorators

### Services
- `src/audit/audit.service.ts` - Added GRC domain event listeners

### Configuration
- `src/main.ts` - Added Swagger/OpenAPI configuration
- `package.json` - Added @nestjs/swagger dependency

### Tests
- `test/factories/index.ts` - New test data factories
- `test/grc-validation.e2e-spec.ts` - New validation tests

### Documentation
- `docs/GRC-VALIDATION-AND-AUDIT-REPORT.md` - This report

## 7. Next Steps

1. **Local Testing** - Run `npm run seed:grc` and `npm run smoke:grc` with PostgreSQL
2. **CI Verification** - Ensure all CI checks pass
3. **Frontend Integration** - Update frontend to use new validation error messages
4. **Audit Dashboard** - Consider adding an audit log viewer in the frontend
5. **Additional Validators** - Add more custom validators as business rules evolve
