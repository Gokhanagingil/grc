# GRC Domain Model

This document defines the unified GRC (Governance, Risk, Compliance) domain model for the NestJS backend. This model will serve as the foundation for all GRC functionality in the platform.

## Design Principles

1. **Multi-tenancy First** - All GRC entities include `tenantId` for data isolation
2. **Controls as Central Hub** - Controls bridge Risks, Policies, and Requirements
3. **UUID Primary Keys** - Consistent with NestJS conventions
4. **Non-Destructive** - New `grc_*` tables, no changes to Express tables
5. **Extensible** - JSONB metadata fields for future flexibility

## Entity Relationship Overview

```
                              ┌─────────────────┐
                              │     Tenant      │
                              └────────┬────────┘
                                       │ owns all
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
        ▼                              ▼                              ▼
┌───────────────┐            ┌─────────────────┐            ┌─────────────────┐
│    GrcRisk    │◄──────────►│   GrcControl    │◄──────────►│   GrcPolicy     │
└───────┬───────┘            └────────┬────────┘            └─────────────────┘
        │                             │
        │                             │
        │                    ┌────────┴────────┐
        │                    ▼                 │
        │           ┌─────────────────┐        │
        │           │ GrcRequirement  │◄───────┘
        │           └─────────────────┘
        │
        ▼
┌───────────────┐            ┌─────────────────┐
│   GrcIssue    │───────────►│    GrcCapa      │
└───────┬───────┘            └─────────────────┘
        │
        ▼
┌───────────────┐
│  GrcEvidence  │
└───────────────┘
```

## Enumerations

### Risk Enums

```typescript
enum RiskSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

enum RiskLikelihood {
  RARE = 'rare',
  UNLIKELY = 'unlikely',
  POSSIBLE = 'possible',
  LIKELY = 'likely',
  ALMOST_CERTAIN = 'almost_certain',
}

enum RiskStatus {
  DRAFT = 'draft',
  IDENTIFIED = 'identified',
  ASSESSED = 'assessed',
  MITIGATING = 'mitigating',
  ACCEPTED = 'accepted',
  CLOSED = 'closed',
}
```

### Control Enums

```typescript
enum ControlType {
  PREVENTIVE = 'preventive',
  DETECTIVE = 'detective',
  CORRECTIVE = 'corrective',
}

enum ControlImplementationType {
  MANUAL = 'manual',
  AUTOMATED = 'automated',
  IT_DEPENDENT = 'it_dependent',
}

enum ControlStatus {
  DRAFT = 'draft',
  IN_DESIGN = 'in_design',
  IMPLEMENTED = 'implemented',
  INOPERATIVE = 'inoperative',
  RETIRED = 'retired',
}

enum ControlFrequency {
  CONTINUOUS = 'continuous',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUAL = 'annual',
}
```

### Policy Enums

```typescript
enum PolicyStatus {
  DRAFT = 'draft',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  ACTIVE = 'active',
  RETIRED = 'retired',
}
```

### Issue Enums

```typescript
enum IssueType {
  INTERNAL_AUDIT = 'internal_audit',
  EXTERNAL_AUDIT = 'external_audit',
  INCIDENT = 'incident',
  SELF_ASSESSMENT = 'self_assessment',
  OTHER = 'other',
}

enum IssueStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
  REJECTED = 'rejected',
}

enum IssueSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}
```

### CAPA Enums

```typescript
enum CapaType {
  CORRECTIVE = 'corrective',
  PREVENTIVE = 'preventive',
  BOTH = 'both',
}

enum CapaStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  IMPLEMENTED = 'implemented',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
  CLOSED = 'closed',
}
```

### Evidence Enums

```typescript
enum EvidenceType {
  DOCUMENT = 'document',
  SCREENSHOT = 'screenshot',
  LOG = 'log',
  REPORT = 'report',
  CONFIG_EXPORT = 'config_export',
  OTHER = 'other',
}
```

### Framework Enum (for Compliance Requirements)

```typescript
enum ComplianceFramework {
  ISO27001 = 'iso27001',
  SOC2 = 'soc2',
  GDPR = 'gdpr',
  HIPAA = 'hipaa',
  PCI_DSS = 'pci_dss',
  NIST = 'nist',
  OTHER = 'other',
}
```

## Core Entities

### GrcRisk

**Table:** `grc_risks`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| tenantId | UUID | FK→nest_tenants, NOT NULL, INDEX | Tenant isolation |
| title | VARCHAR(255) | NOT NULL | Risk title |
| description | TEXT | NULL | Detailed description |
| category | VARCHAR(100) | NULL | Risk category (e.g., Operational, Security) |
| severity | ENUM | NOT NULL, DEFAULT 'medium' | Risk severity level |
| likelihood | ENUM | NOT NULL, DEFAULT 'possible' | Probability of occurrence |
| impact | ENUM | NOT NULL, DEFAULT 'medium' | Business impact if realized |
| score | INTEGER | NULL | Calculated risk score (1-100) |
| status | ENUM | NOT NULL, DEFAULT 'draft' | Current risk status |
| ownerUserId | UUID | FK→nest_users, NULL | Risk owner |
| dueDate | DATE | NULL | Mitigation due date |
| mitigationPlan | TEXT | NULL | Mitigation strategy |
| tags | JSONB | NULL | Flexible tagging |
| metadata | JSONB | NULL | Additional metadata |
| createdAt | TIMESTAMP | NOT NULL | Creation timestamp |
| updatedAt | TIMESTAMP | NOT NULL | Last update timestamp |

**Indexes:**
- `(tenantId, status)`
- `(tenantId, severity)`
- `(tenantId, ownerUserId)`

### GrcControl

**Table:** `grc_controls`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| tenantId | UUID | FK→nest_tenants, NOT NULL, INDEX | Tenant isolation |
| name | VARCHAR(255) | NOT NULL | Control name |
| code | VARCHAR(50) | NULL | Control identifier (e.g., CTL-001) |
| description | TEXT | NULL | Control description |
| type | ENUM | NOT NULL, DEFAULT 'preventive' | Control type |
| implementationType | ENUM | NOT NULL, DEFAULT 'manual' | How control is implemented |
| status | ENUM | NOT NULL, DEFAULT 'draft' | Control status |
| frequency | ENUM | NULL | How often control is executed |
| ownerUserId | UUID | FK→nest_users, NULL | Control owner |
| effectiveDate | DATE | NULL | When control became effective |
| lastTestedDate | DATE | NULL | Last testing date |
| metadata | JSONB | NULL | Additional metadata |
| createdAt | TIMESTAMP | NOT NULL | Creation timestamp |
| updatedAt | TIMESTAMP | NOT NULL | Last update timestamp |

**Indexes:**
- `(tenantId, status)`
- `(tenantId, type)`
- `(tenantId, code)` UNIQUE

### GrcPolicy

**Table:** `grc_policies`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| tenantId | UUID | FK→nest_tenants, NOT NULL, INDEX | Tenant isolation |
| name | VARCHAR(255) | NOT NULL | Policy name |
| code | VARCHAR(50) | NULL | Policy identifier (e.g., POL-SEC-001) |
| version | VARCHAR(20) | NOT NULL, DEFAULT '1.0' | Version number |
| status | ENUM | NOT NULL, DEFAULT 'draft' | Policy status |
| category | VARCHAR(100) | NULL | Policy category |
| summary | TEXT | NULL | Executive summary |
| content | TEXT | NULL | Full policy content |
| ownerUserId | UUID | FK→nest_users, NULL | Policy owner |
| effectiveDate | DATE | NULL | When policy becomes effective |
| reviewDate | DATE | NULL | Next review date |
| approvedByUserId | UUID | FK→nest_users, NULL | Approver |
| approvedAt | TIMESTAMP | NULL | Approval timestamp |
| metadata | JSONB | NULL | Additional metadata |
| createdAt | TIMESTAMP | NOT NULL | Creation timestamp |
| updatedAt | TIMESTAMP | NOT NULL | Last update timestamp |

**Indexes:**
- `(tenantId, status)`
- `(tenantId, category)`
- `(tenantId, code)` UNIQUE

### GrcComplianceRequirement

**Table:** `grc_requirements`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| tenantId | UUID | FK→nest_tenants, NOT NULL, INDEX | Tenant isolation |
| framework | ENUM | NOT NULL | Compliance framework |
| referenceCode | VARCHAR(50) | NOT NULL | Framework reference (e.g., A.5.1) |
| title | VARCHAR(255) | NOT NULL | Requirement title |
| description | TEXT | NULL | Detailed description |
| category | VARCHAR(100) | NULL | Requirement category |
| priority | VARCHAR(20) | NULL | Implementation priority |
| status | VARCHAR(50) | NOT NULL, DEFAULT 'not_started' | Compliance status |
| ownerUserId | UUID | FK→nest_users, NULL | Requirement owner |
| dueDate | DATE | NULL | Compliance due date |
| metadata | JSONB | NULL | Additional metadata |
| createdAt | TIMESTAMP | NOT NULL | Creation timestamp |
| updatedAt | TIMESTAMP | NOT NULL | Last update timestamp |

**Indexes:**
- `(tenantId, framework)`
- `(tenantId, status)`
- `(tenantId, framework, referenceCode)` UNIQUE

### GrcIssue

**Table:** `grc_issues`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| tenantId | UUID | FK→nest_tenants, NOT NULL, INDEX | Tenant isolation |
| title | VARCHAR(255) | NOT NULL | Issue title |
| description | TEXT | NULL | Issue description |
| type | ENUM | NOT NULL, DEFAULT 'other' | Issue type |
| status | ENUM | NOT NULL, DEFAULT 'open' | Issue status |
| severity | ENUM | NOT NULL, DEFAULT 'medium' | Issue severity |
| riskId | UUID | FK→grc_risks, NULL | Related risk |
| controlId | UUID | FK→grc_controls, NULL | Related control |
| raisedByUserId | UUID | FK→nest_users, NULL | Who raised the issue |
| ownerUserId | UUID | FK→nest_users, NULL | Issue owner |
| discoveredDate | DATE | NULL | When issue was discovered |
| dueDate | DATE | NULL | Resolution due date |
| resolvedDate | DATE | NULL | When issue was resolved |
| rootCause | TEXT | NULL | Root cause analysis |
| metadata | JSONB | NULL | Additional metadata |
| createdAt | TIMESTAMP | NOT NULL | Creation timestamp |
| updatedAt | TIMESTAMP | NOT NULL | Last update timestamp |

**Indexes:**
- `(tenantId, status)`
- `(tenantId, severity)`
- `(tenantId, riskId)`
- `(tenantId, controlId)`

### GrcCapa

**Table:** `grc_capas`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| tenantId | UUID | FK→nest_tenants, NOT NULL, INDEX | Tenant isolation |
| issueId | UUID | FK→grc_issues, NOT NULL | Parent issue |
| description | TEXT | NOT NULL | CAPA description |
| type | ENUM | NOT NULL, DEFAULT 'corrective' | CAPA type |
| status | ENUM | NOT NULL, DEFAULT 'planned' | CAPA status |
| ownerUserId | UUID | FK→nest_users, NULL | CAPA owner |
| dueDate | DATE | NULL | Target completion date |
| completedDate | DATE | NULL | Actual completion date |
| verifiedByUserId | UUID | FK→nest_users, NULL | Verifier |
| verifiedAt | TIMESTAMP | NULL | Verification timestamp |
| effectiveness | TEXT | NULL | Effectiveness assessment |
| metadata | JSONB | NULL | Additional metadata |
| createdAt | TIMESTAMP | NOT NULL | Creation timestamp |
| updatedAt | TIMESTAMP | NOT NULL | Last update timestamp |

**Indexes:**
- `(tenantId, status)`
- `(tenantId, issueId)`

### GrcEvidence

**Table:** `grc_evidence`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| tenantId | UUID | FK→nest_tenants, NOT NULL, INDEX | Tenant isolation |
| name | VARCHAR(255) | NOT NULL | Evidence name/label |
| description | TEXT | NULL | Evidence description |
| type | ENUM | NOT NULL, DEFAULT 'document' | Evidence type |
| location | VARCHAR(500) | NOT NULL | URL or storage path |
| hash | VARCHAR(64) | NULL | SHA-256 hash for integrity |
| fileSize | INTEGER | NULL | File size in bytes |
| mimeType | VARCHAR(100) | NULL | MIME type |
| collectedAt | DATE | NULL | When evidence was collected |
| collectedByUserId | UUID | FK→nest_users, NULL | Who collected it |
| expiresAt | DATE | NULL | Evidence expiration date |
| metadata | JSONB | NULL | Additional metadata |
| createdAt | TIMESTAMP | NOT NULL | Creation timestamp |
| updatedAt | TIMESTAMP | NOT NULL | Last update timestamp |

**Indexes:**
- `(tenantId, type)`
- `(tenantId, collectedAt)`

## Mapping Entities

### GrcRiskControl

**Table:** `grc_risk_controls`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| tenantId | UUID | FK→nest_tenants, NOT NULL | Tenant isolation |
| riskId | UUID | FK→grc_risks, NOT NULL | Risk reference |
| controlId | UUID | FK→grc_controls, NOT NULL | Control reference |
| relationshipType | VARCHAR(50) | NULL | PRIMARY, SECONDARY, etc. |
| effectiveness | VARCHAR(50) | NULL | How effective is the control |
| notes | TEXT | NULL | Additional notes |
| createdAt | TIMESTAMP | NOT NULL | Creation timestamp |

**Constraints:**
- UNIQUE `(tenantId, riskId, controlId)`

### GrcPolicyControl

**Table:** `grc_policy_controls`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| tenantId | UUID | FK→nest_tenants, NOT NULL | Tenant isolation |
| policyId | UUID | FK→grc_policies, NOT NULL | Policy reference |
| controlId | UUID | FK→grc_controls, NOT NULL | Control reference |
| notes | TEXT | NULL | Additional notes |
| createdAt | TIMESTAMP | NOT NULL | Creation timestamp |

**Constraints:**
- UNIQUE `(tenantId, policyId, controlId)`

### GrcRequirementControl

**Table:** `grc_requirement_controls`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| tenantId | UUID | FK→nest_tenants, NOT NULL | Tenant isolation |
| requirementId | UUID | FK→grc_requirements, NOT NULL | Requirement reference |
| controlId | UUID | FK→grc_controls, NOT NULL | Control reference |
| coverageLevel | VARCHAR(50) | NULL | FULL, PARTIAL, etc. |
| notes | TEXT | NULL | Additional notes |
| createdAt | TIMESTAMP | NOT NULL | Creation timestamp |

**Constraints:**
- UNIQUE `(tenantId, requirementId, controlId)`

### GrcIssueEvidence

**Table:** `grc_issue_evidence`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Primary key |
| tenantId | UUID | FK→nest_tenants, NOT NULL | Tenant isolation |
| issueId | UUID | FK→grc_issues, NOT NULL | Issue reference |
| evidenceId | UUID | FK→grc_evidence, NOT NULL | Evidence reference |
| notes | TEXT | NULL | Additional notes |
| createdAt | TIMESTAMP | NOT NULL | Creation timestamp |

**Constraints:**
- UNIQUE `(tenantId, issueId, evidenceId)`

## Mapping from Express Schema to NestJS GRC Domain

### Correspondence Table

| Express Table | NestJS Entity | Migration Notes |
|---------------|---------------|-----------------|
| `risks` | `GrcRisk` | Map severity/likelihood/impact text to enums; generate UUIDs; assign tenantId |
| `policies` | `GrcPolicy` | Map status text to enum; generate UUIDs; assign tenantId |
| `compliance_requirements` | `GrcComplianceRequirement` | Map regulation to framework enum; generate UUIDs; assign tenantId |
| `audit_logs` | `AuditLog` (existing) | Already separate in NestJS |
| `organizations` | N/A | Not part of GRC domain; keep in Express |
| `risk_assessments` | N/A (future) | Could become GrcRiskAssessment in future sprint |
| N/A | `GrcControl` | NEW - no Express equivalent |
| N/A | `GrcIssue` | NEW - no Express equivalent |
| N/A | `GrcCapa` | NEW - no Express equivalent |
| N/A | `GrcEvidence` | NEW - evidence was just a text field |

### Migration Strategy (Future Sprint)

1. **Phase 1: Parallel Operation**
   - NestJS GRC entities created with `grc_*` tables
   - Express continues using original tables
   - No data migration yet

2. **Phase 2: Data Migration**
   - Create migration scripts to copy Express data to NestJS tables
   - Generate UUIDs for all records
   - Map user IDs (INTEGER → UUID) via email lookup
   - Assign default tenantId to all records
   - Validate data integrity

3. **Phase 3: Cutover**
   - Update frontend to use NestJS GRC endpoints
   - Deprecate Express GRC routes
   - Keep Express tables as read-only backup

## API Endpoints (Read-Only for This Sprint)

### Risks

```
GET /grc/risks                    # List risks for tenant
GET /grc/risks/:id                # Get single risk
```

### Policies

```
GET /grc/policies                 # List policies for tenant
GET /grc/policies/:id             # Get single policy
```

### Requirements

```
GET /grc/requirements             # List requirements for tenant
GET /grc/requirements/:id         # Get single requirement
```

### Controls (Optional)

```
GET /grc/controls                 # List controls for tenant
GET /grc/controls/:id             # Get single control
```

All endpoints require:
- `Authorization: Bearer <token>` header
- `x-tenant-id: <uuid>` header
- User role: MANAGER or ADMIN

## Domain Events

### Events to Emit

```typescript
// When a risk is created
class RiskCreatedEvent {
  riskId: string;
  tenantId: string;
  userId: string;
  title: string;
  severity: RiskSeverity;
  timestamp: Date;
}

// When a policy is created
class PolicyCreatedEvent {
  policyId: string;
  tenantId: string;
  userId: string;
  name: string;
  status: PolicyStatus;
  timestamp: Date;
}

// When an issue is created
class IssueCreatedEvent {
  issueId: string;
  tenantId: string;
  userId: string;
  title: string;
  severity: IssueSeverity;
  timestamp: Date;
}
```

## Implementation Notes

### Multi-Tenancy Enforcement

All GRC services MUST:
1. Extend `MultiTenantServiceBase<T>` or use its methods
2. Never query without `tenantId` filter
3. Validate tenant ownership before creating relationships

### Relationship Validation

When creating mapping records (e.g., RiskControl):
1. Verify both entities belong to the same tenant
2. Verify both entities exist
3. Prevent cross-tenant relationships

### Audit Integration

All GRC operations are automatically logged via:
1. Global `AuditInterceptor` for HTTP requests
2. Domain events for business-level tracking

---

## Implementation Status

### Completed (This Sprint)

**Core Entities Implemented:**
- `GrcRisk` - Risk management with severity, likelihood, impact, status tracking
- `GrcControl` - Control activities with type, implementation type, frequency
- `GrcPolicy` - Policy lifecycle management with versioning and approval workflow
- `GrcRequirement` - Compliance requirements with framework support
- `GrcIssue` - Issue/finding tracking linked to risks and controls
- `GrcCapa` - Corrective and Preventive Actions linked to issues
- `GrcEvidence` - Evidence artifacts with integrity tracking

**Mapping Entities Implemented:**
- `GrcRiskControl` - Many-to-many Risk ↔ Control relationships
- `GrcPolicyControl` - Many-to-many Policy ↔ Control relationships
- `GrcRequirementControl` - Many-to-many Requirement ↔ Control relationships
- `GrcIssueEvidence` - Many-to-many Issue ↔ Evidence relationships

**Services Implemented:**
- `GrcRiskService` - Multi-tenant CRUD with domain events
- `GrcPolicyService` - Multi-tenant CRUD with domain events
- `GrcRequirementService` - Multi-tenant CRUD with domain events

**API Endpoints Implemented (Read-Only):**
- `GET /grc/risks` - List risks with optional status/severity filters
- `GET /grc/risks/:id` - Get single risk
- `GET /grc/risks/:id/controls` - Get risk with associated controls
- `GET /grc/risks/statistics` - Get risk statistics
- `GET /grc/risks/high-severity` - Get high-severity risks
- `GET /grc/policies` - List policies with optional status/category filters
- `GET /grc/policies/:id` - Get single policy
- `GET /grc/policies/:id/controls` - Get policy with associated controls
- `GET /grc/policies/statistics` - Get policy statistics
- `GET /grc/policies/active` - Get active policies
- `GET /grc/policies/due-for-review` - Get policies due for review
- `GET /grc/requirements` - List requirements with optional framework/status filters
- `GET /grc/requirements/:id` - Get single requirement
- `GET /grc/requirements/:id/controls` - Get requirement with associated controls
- `GET /grc/requirements/statistics` - Get requirement statistics
- `GET /grc/requirements/frameworks` - Get unique frameworks

**Domain Events Implemented:**
- `RiskCreatedEvent`, `RiskUpdatedEvent`
- `PolicyCreatedEvent`, `PolicyUpdatedEvent`
- `ControlCreatedEvent`
- `RequirementCreatedEvent`
- `IssueCreatedEvent`, `IssueResolvedEvent`
- `CapaCreatedEvent`
- `EvidenceUploadedEvent`

**Enumerations Implemented:**
- Risk: `RiskSeverity`, `RiskLikelihood`, `RiskStatus`
- Control: `ControlType`, `ControlImplementationType`, `ControlStatus`, `ControlFrequency`
- Policy: `PolicyStatus`
- Issue: `IssueType`, `IssueStatus`, `IssueSeverity`
- CAPA: `CapaType`, `CapaStatus`
- Evidence: `EvidenceType`
- Framework: `ComplianceFramework`
- Mapping: `RelationshipType`, `CoverageLevel`

### Ready for Immediate Feature Development

1. **Risk Listing & Filtering** - Full read-only API available
2. **Policy Listing & Filtering** - Full read-only API available
3. **Requirement Listing & Filtering** - Full read-only API available
4. **Statistics Dashboards** - Statistics endpoints ready for UI integration

### Deferred to Future Sprints

1. **Full CRUD Operations** - Create, Update, Delete endpoints for all entities
2. **Control Management UI** - Control CRUD and mapping management
3. **Issue/CAPA Workflow** - Issue lifecycle and CAPA tracking
4. **Evidence Upload** - File upload and integrity verification
5. **Data Migration** - Express → NestJS data migration scripts
6. **Advanced Reporting** - Cross-entity analytics and compliance reports
7. **Bulk Operations** - Batch import/export functionality

### Files Created

```
backend-nest/src/grc/
├── index.ts                           # Module exports
├── grc.module.ts                      # GRC module definition
├── enums/
│   └── index.ts                       # All GRC enumerations
├── entities/
│   ├── index.ts                       # Entity exports
│   ├── grc-risk.entity.ts             # Risk entity
│   ├── grc-control.entity.ts          # Control entity
│   ├── grc-policy.entity.ts           # Policy entity
│   ├── grc-requirement.entity.ts      # Requirement entity
│   ├── grc-issue.entity.ts            # Issue entity
│   ├── grc-capa.entity.ts             # CAPA entity
│   ├── grc-evidence.entity.ts         # Evidence entity
│   ├── grc-risk-control.entity.ts     # Risk-Control mapping
│   ├── grc-policy-control.entity.ts   # Policy-Control mapping
│   ├── grc-requirement-control.entity.ts  # Requirement-Control mapping
│   └── grc-issue-evidence.entity.ts   # Issue-Evidence mapping
├── services/
│   ├── index.ts                       # Service exports
│   ├── grc-risk.service.ts            # Risk service
│   ├── grc-policy.service.ts          # Policy service
│   └── grc-requirement.service.ts     # Requirement service
├── controllers/
│   ├── index.ts                       # Controller exports
│   ├── grc-risk.controller.ts         # Risk API endpoints
│   ├── grc-policy.controller.ts       # Policy API endpoints
│   └── grc-requirement.controller.ts  # Requirement API endpoints
└── events/
    ├── index.ts                       # Event exports
    └── grc-domain-events.ts           # Domain event definitions

docs/
├── GRC-DOMAIN-MODEL.md                # This document
└── GRC-DOMAIN-CURRENT-SNAPSHOT.md     # Current schema inventory
```

### Verification

- TypeScript build: PASSED
- ESLint (GRC module): PASSED (0 errors)
- Unit tests: PASSED
- Express backend tests: PASSED (31 tests)
- No breaking changes to existing Express or NestJS functionality
