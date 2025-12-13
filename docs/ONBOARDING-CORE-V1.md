# Onboarding Core v1

This document describes the Suite-first Platform Onboarding Core v1 implementation for the GRC platform.

## Overview

The Onboarding Core module provides platform-standard onboarding functionality that determines which suites, modules, and frameworks are available to each tenant. It implements a policy engine that evaluates the tenant's configuration and produces warnings and feature flags that control UI behavior.

## Database Schema

### Tables

All tables follow the standard multi-tenant pattern with `tenantId` and soft deletion via `isDeleted`.

#### tenant_initialization_profile

Stores the initialization state for each tenant.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| tenant_id | uuid | Foreign key to tenant |
| schema_version | int | Schema version (default: 1) |
| policy_set_version | varchar(50) | Policy set version (nullable) |
| initialized_at | timestamp | When tenant was initialized |
| metadata | jsonb | Additional metadata |
| created_at | timestamp | Record creation time |
| updated_at | timestamp | Record update time |
| is_deleted | boolean | Soft delete flag |

#### tenant_active_suite

Tracks which suites are active for each tenant.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| tenant_id | uuid | Foreign key to tenant |
| suite_type | enum | GRC_SUITE or ITSM_SUITE |
| is_active | boolean | Whether suite is active |
| activated_at | timestamp | When suite was activated |
| created_at | timestamp | Record creation time |
| updated_at | timestamp | Record update time |
| is_deleted | boolean | Soft delete flag |

#### tenant_enabled_module

Tracks which modules are enabled for each tenant within each suite.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| tenant_id | uuid | Foreign key to tenant |
| suite_type | enum | GRC_SUITE or ITSM_SUITE |
| module_type | enum | risk, policy, control, audit, incident, request, change, problem, cmdb |
| is_enabled | boolean | Whether module is enabled |
| enabled_at | timestamp | When module was enabled |
| created_at | timestamp | Record creation time |
| updated_at | timestamp | Record update time |
| is_deleted | boolean | Soft delete flag |

#### tenant_active_framework

Tracks which compliance frameworks are active for each tenant.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| tenant_id | uuid | Foreign key to tenant |
| framework_type | enum | ISO27001, SOC2, GDPR, HIPAA, NIST, PCI_DSS |
| is_active | boolean | Whether framework is active |
| activated_at | timestamp | When framework was activated |
| created_at | timestamp | Record creation time |
| updated_at | timestamp | Record update time |
| is_deleted | boolean | Soft delete flag |

#### tenant_maturity_profile

Stores the maturity level for each tenant.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| tenant_id | uuid | Foreign key to tenant |
| maturity_level | enum | foundational, intermediate, advanced |
| assessed_at | timestamp | When maturity was assessed |
| assessed_by | uuid | User who assessed maturity |
| notes | text | Assessment notes |
| created_at | timestamp | Record creation time |
| updated_at | timestamp | Record update time |
| is_deleted | boolean | Soft delete flag |

#### onboarding_decision

Audit trail for onboarding decisions.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| tenant_id | uuid | Foreign key to tenant |
| decision_type | enum | suite_activation, module_enable, module_disable, framework_activation, framework_deactivation, maturity_change, policy_override |
| decision_key | varchar(100) | Key identifying what was changed |
| decision_value | jsonb | New value |
| previous_value | jsonb | Previous value |
| reason | text | Reason for decision |
| decided_by | uuid | User who made decision |
| decided_at | timestamp | When decision was made |
| created_at | timestamp | Record creation time |
| updated_at | timestamp | Record update time |
| is_deleted | boolean | Soft delete flag |

## Suite Manifest

The suite manifest defines the default modules for each suite:

```typescript
GRC_SUITE: [risk, policy, control, audit]
ITSM_SUITE: [incident, request, change, problem, cmdb]
```

When a suite is activated, all its default modules are enabled unless explicitly overridden in `tenant_enabled_module`.

## Context Contract

### GET /onboarding/context

Returns the onboarding context for the current tenant.

#### Request

Headers:
- `Authorization: Bearer <token>` (required)
- `x-tenant-id: <tenant-id>` (required)

#### Response

```json
{
  "success": true,
  "data": {
    "context": {
      "status": "active",
      "schemaVersion": 1,
      "policySetVersion": "v1.0",
      "activeSuites": ["GRC_SUITE"],
      "enabledModules": {
        "GRC_SUITE": ["risk", "policy", "control", "audit"],
        "ITSM_SUITE": []
      },
      "activeFrameworks": ["ISO27001", "SOC2"],
      "maturity": "foundational",
      "metadata": {
        "initializedAt": "2024-01-15T10:00:00Z",
        "lastUpdatedAt": "2024-01-20T14:30:00Z"
      }
    },
    "policy": {
      "disabledFeatures": ["advanced_risk_scoring", "major_incident_automation"],
      "warnings": [
        {
          "code": "ISO27001_EVIDENCE_RECOMMENDED",
          "severity": "info",
          "message": "ISO 27001 framework is active. Evidence collection is recommended for compliance.",
          "targets": ["audit", "control"]
        }
      ],
      "metadata": {
        "audit_scope_standards": ["ISO 27001:2022", "SOC 2 Type I", "SOC 2 Type II"],
        "audit_scope_filtered_by_frameworks": true
      }
    }
  }
}
```

### Default Context (Fallback)

If no onboarding records exist for a tenant, the following conservative defaults are returned:

```json
{
  "status": "active",
  "schemaVersion": 1,
  "policySetVersion": null,
  "activeSuites": [],
  "enabledModules": {
    "GRC_SUITE": [],
    "ITSM_SUITE": []
  },
  "activeFrameworks": [],
  "maturity": "foundational",
  "metadata": {
    "initializedAt": null,
    "lastUpdatedAt": null
  }
}
```

## Policy Set v1

The policy engine evaluates 7 policies:

### P1: Framework Required Warning

**Condition**: GRC_SUITE enabled AND activeFrameworks is empty

**Result**: Warning `FRAMEWORK_REQUIRED` with targets `[grc, audit]`

**Message**: "No compliance frameworks are configured. Please activate at least one framework for full GRC functionality."

### P2: Advanced Risk Scoring Disabled

**Condition**: maturity is `foundational`

**Result**: Disable feature `advanced_risk_scoring`

**Reason**: Advanced risk scoring requires intermediate or advanced maturity level.

### P3: ISO 27001 Evidence Recommended

**Condition**: ISO27001 framework is active

**Result**: Warning `ISO27001_EVIDENCE_RECOMMENDED` with severity `info`

**Message**: "ISO 27001 framework is active. Evidence collection is recommended for compliance."

### P4: Audit Scope Standards Filtered

**Condition**: Always evaluated

**Result**: Metadata `audit_scope_standards` filtered by active frameworks

**Standards Mapping**:
- ISO27001: "ISO 27001:2022"
- SOC2: "SOC 2 Type I", "SOC 2 Type II"
- GDPR: "GDPR"
- HIPAA: "HIPAA"
- NIST: "NIST CSF", "NIST 800-53"
- PCI_DSS: "PCI DSS v4.0"

### P5: Clause Level Assessment Warning

**Condition**: maturity is `foundational`

**Result**: Warning `CLAUSE_LEVEL_ASSESSMENT_WARNING` with targets `[audit]`

**Message**: "Clause-level assessment is available but may be complex for foundational maturity. Consider domain-level assessment first."

### P6: ITSM Related Risk Disabled

**Condition**: GRC_SUITE is NOT enabled

**Result**: Disable feature `itsm_related_risk`

**Reason**: Related Risk feature requires GRC Suite to be enabled.

### P7: Major Incident Automation Disabled

**Condition**: maturity is `foundational`

**Result**: Disable feature `major_incident_automation`

**Reason**: Major incident automation requires intermediate or advanced maturity level.

## Frontend Integration

### OnboardingProvider

The `OnboardingProvider` context wraps the application and fetches the onboarding context after login. It provides:

- `context`: The current onboarding context
- `policy`: The current policy result
- `isFeatureDisabled(feature)`: Check if a feature is disabled
- `hasWarning(code)`: Check if a warning exists
- `getWarningsForTarget(target)`: Get warnings for a specific target
- `isSuiteEnabled(suite)`: Check if a suite is enabled
- `isFrameworkActive(framework)`: Check if a framework is active
- `getAuditScopeStandards()`: Get the filtered audit scope standards

### UI Gating Components

#### FeatureGate

Conditionally renders children based on feature availability:

```tsx
<FeatureGate feature="advanced_risk_scoring" hideWhenDisabled>
  <AdvancedRiskScoringPanel />
</FeatureGate>
```

#### SuiteGate

Conditionally renders children based on suite availability:

```tsx
<SuiteGate suite="GRC_SUITE" hideWhenDisabled>
  <RelatedRiskSection />
</SuiteGate>
```

#### GrcFrameworkWarningBanner

Displays a warning banner when no frameworks are configured:

```tsx
<GrcFrameworkWarningBanner />
```

### Fail-Open Behavior

If the onboarding context fetch fails, the UI continues to function with default values. No screens should break due to onboarding context unavailability.

## Smoke Test Checklist

### Backend

1. Start the backend server: `cd backend-nest && npm run start:dev`
2. Authenticate and get a JWT token
3. Call `GET /onboarding/context` with valid tenant ID header
4. Verify response contains `context` and `policy` objects
5. Verify default context is returned for tenant with no onboarding records

### Frontend

1. Start the frontend: `cd frontend && npm start`
2. Login with valid credentials
3. Verify no console errors related to onboarding context
4. Navigate to GRC pages and verify warning banner appears if no frameworks configured
5. Verify disabled features are properly hidden/disabled in UI

### Policy Evaluation

1. Create a tenant with GRC_SUITE enabled but no frameworks
2. Verify `FRAMEWORK_REQUIRED` warning is returned
3. Create a tenant with foundational maturity
4. Verify `advanced_risk_scoring` and `major_incident_automation` are disabled
5. Create a tenant with ITSM_SUITE only (no GRC_SUITE)
6. Verify `itsm_related_risk` is disabled

## Staging Verification

### Running Migrations

1. Ensure the database connection is configured in `.env`:
   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_USERNAME=postgres
   DB_PASSWORD=your_password
   DB_DATABASE=grc_platform
   ```

2. Available migration commands:
   ```bash
   cd backend-nest
   
   # Generate a new migration from entity changes
   npm run migration:generate src/migrations/MigrationName
   
   # Run pending migrations
   npm run migration:run
   
   # Revert the last migration
   npm run migration:revert
   
   # Show migration status
   npm run migration:show
   ```

4. Verify the tables were created:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name LIKE 'tenant_%' OR table_name = 'onboarding_decision';
   ```

### Verifying /onboarding/context Endpoint

1. Start the backend server:
   ```bash
   cd backend-nest && npm run start:dev
   ```

2. Authenticate and obtain a JWT token

3. Call the endpoint with a valid tenant ID:
   ```bash
   curl -X GET http://localhost:3002/onboarding/context \
     -H "Authorization: Bearer <token>" \
     -H "x-tenant-id: <tenant-id>"
   ```

4. Expected response for empty tables (default fallback):
   ```json
   {
     "success": true,
     "data": {
       "context": {
         "status": "active",
         "schemaVersion": 1,
         "policySetVersion": null,
         "activeSuites": [],
         "enabledModules": { "GRC_SUITE": [], "ITSM_SUITE": [] },
         "activeFrameworks": [],
         "maturity": "foundational"
       },
       "policy": {
         "disabledFeatures": ["advanced_risk_scoring", "major_incident_automation"],
         "warnings": []
       }
     }
   }
   ```

### UI Verification Checks

After deploying to staging, verify the following 3 UI behaviors:

1. **GRC Warning Banner** (Risk Management page)
   - Navigate to `/risks`
   - If no frameworks are configured, a warning banner should appear at the top of the page
   - The banner displays: "No compliance frameworks are configured..."

2. **Hidden Advanced Risk Scoring** (Risk Management page)
   - Navigate to `/risks`
   - For tenants with `foundational` maturity level, the Score column in the risk table should be hidden
   - For tenants with `intermediate` or `advanced` maturity, the Score column should be visible

3. **Hidden Related Risk Field** (ITSM Incident Details)
   - Navigate to `/incidents` and view an incident's details
   - If GRC_SUITE is NOT enabled for the tenant, the "Related Risk" field should be hidden
   - If GRC_SUITE IS enabled, the "Related Risk" field should be visible

### Troubleshooting

If the `/onboarding/context` endpoint returns an error:
- Check the backend logs for warnings about query failures
- The service is designed to return a fallback context and never throw runtime errors
- Verify the database connection is working

If UI components are not gating correctly:
- Check browser console for errors related to OnboardingContext
- Verify the OnboardingProvider is wrapping the application
- Check that the tenant has the expected onboarding configuration

## Exit Validation

Before merging, verify:

- [ ] All TypeORM entities are created and properly configured
- [ ] OnboardingContextService returns correct fallback defaults
- [ ] PolicyEvaluator implements all 7 policies correctly
- [ ] Unit tests pass for OnboardingContextService and PolicyEvaluator
- [ ] Frontend OnboardingProvider fetches context after login
- [ ] UI gating components work correctly
- [ ] No breaking changes to existing endpoints
- [ ] Lint checks pass
- [ ] Build succeeds
