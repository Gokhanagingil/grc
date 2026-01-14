# GRC Golden Flow - Phase 0 Specification

## Document Version
- **Version**: 1.0
- **Date**: 2026-01-08
- **Status**: Draft - Pending Approval

## 1. Executive Summary

The GRC Golden Flow represents the complete lifecycle of compliance control management: from defining Controls, collecting Evidence, executing Tests, recording Results, raising Findings, creating CAPAs (Corrective and Preventive Actions), through to Verification and Closure. This specification defines the enterprise-grade data model, relationships, workflows, and acceptance criteria required for implementation.

## 2. Current State Inventory

### 2.1 Existing Entities (Reusable)

| Entity | Table | Service | Controller | Status |
|--------|-------|---------|------------|--------|
| GrcControl | grc_controls | None | None | Entity only - needs service/controller |
| GrcEvidence | grc_evidence | None | None | Entity only - needs service/controller |
| GrcIssue | grc_issues | None | Partial (clause linking only) | Needs full CRUD service |
| GrcCapa | grc_capas | None | None | Entity only - needs service/controller |
| GrcRisk | grc_risks | GrcRiskService | GrcRiskController | Complete |
| GrcPolicy | grc_policies | GrcPolicyService | GrcPolicyController | Complete |
| GrcRequirement | grc_requirements | GrcRequirementService | GrcRequirementController | Complete |
| GrcAudit | grc_audits | GrcAuditService | GrcAuditController | Complete |
| ProcessControl | grc_process_controls | ProcessControlService | ProcessControlController | Complete (process-based) |
| ControlResult | grc_control_results | ControlResultService | ControlResultController | Complete (process-based) |

### 2.2 Existing Join Tables

| Join Table | Purpose | Status |
|------------|---------|--------|
| grc_risk_controls | Risk <-> Control | Exists |
| grc_policy_controls | Policy <-> Control | Exists |
| grc_requirement_controls | Requirement <-> Control | Exists |
| grc_issue_evidence | Issue <-> Evidence | Exists |
| grc_issue_requirements | Issue <-> Requirement | Exists |
| grc_issue_clauses | Issue <-> StandardClause | Exists |

### 2.3 What's Missing

1. **GrcControlService** - Full CRUD service for GrcControl entity
2. **GrcEvidenceService** - Full CRUD service for GrcEvidence entity
3. **GrcIssueService** - Full CRUD service for GrcIssue (Finding) entity
4. **GrcCapaService** - Full CRUD service for GrcCapa entity
5. **ControlTest Entity** - For scheduling and tracking control tests
6. **ControlEvidence Join Table** - Link Evidence directly to Controls
7. **CAPATask Entity** - Break down CAPA into actionable tasks
8. **Status History Tables** - Track status transitions for audit trail

### 2.4 What Needs Extension

1. **GrcControl** - Add fields for test schedule, last test result summary
2. **GrcCapa** - Add verification workflow fields, task breakdown support
3. **GrcIssue** - Add workflow state machine, closure validation

## 3. Golden Flow Data Model v1

### 3.1 Entity Relationship Diagram (Text)

```
                                    ┌─────────────────┐
                                    │   GrcControl    │
                                    │   (Hub Entity)  │
                                    └────────┬────────┘
                                             │
              ┌──────────────────────────────┼──────────────────────────────┐
              │                              │                              │
              ▼                              ▼                              ▼
    ┌─────────────────┐           ┌─────────────────┐           ┌─────────────────┐
    │  GrcEvidence    │           │  ControlTest    │           │   GrcIssue      │
    │                 │           │                 │           │   (Finding)     │
    └─────────────────┘           └────────┬────────┘           └────────┬────────┘
                                           │                             │
                                           ▼                             ▼
                                  ┌─────────────────┐           ┌─────────────────┐
                                  │  TestResult     │           │    GrcCapa      │
                                  │                 │           │                 │
                                  └─────────────────┘           └────────┬────────┘
                                                                         │
                                                                         ▼
                                                                ┌─────────────────┐
                                                                │   CAPATask      │
                                                                │                 │
                                                                └─────────────────┘
```

### 3.2 Cardinalities

| Relationship | Cardinality | Description |
|--------------|-------------|-------------|
| Control -> Evidence | 1:N | A control can have multiple evidence artifacts |
| Control -> ControlTest | 1:N | A control can have multiple test executions |
| ControlTest -> TestResult | 1:1 | Each test execution has one result |
| Control -> Issue | 1:N | A control can have multiple findings |
| Issue -> CAPA | 1:N | A finding can have multiple CAPAs |
| CAPA -> CAPATask | 1:N | A CAPA can have multiple tasks |
| Risk -> Control | N:N | Many-to-many via grc_risk_controls |
| Policy -> Control | N:N | Many-to-many via grc_policy_controls |
| Requirement -> Control | N:N | Many-to-many via grc_requirement_controls |
| Issue -> Evidence | N:N | Many-to-many via grc_issue_evidence |

## 4. Entity Definitions

### 4.1 GrcControl (Extended)

**Table**: `grc_controls`

**Existing Fields** (no changes):
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | UUID | No | Primary key |
| tenant_id | UUID | No | Multi-tenant isolation |
| name | VARCHAR(255) | No | Control name |
| code | VARCHAR(50) | Yes | Unique control code per tenant |
| description | TEXT | Yes | Detailed description |
| type | ENUM | No | preventive, detective, corrective |
| implementation_type | ENUM | No | manual, automated, it_dependent |
| status | ENUM | No | draft, in_design, implemented, inoperative, retired |
| frequency | ENUM | Yes | continuous, daily, weekly, monthly, quarterly, annual |
| owner_user_id | UUID | Yes | Control owner |
| effective_date | DATE | Yes | When control became effective |
| last_tested_date | DATE | Yes | Last test execution date |
| metadata | JSONB | Yes | Extensible metadata |
| created_at | TIMESTAMP | No | Audit field |
| updated_at | TIMESTAMP | No | Audit field |
| created_by | UUID | Yes | Audit field |
| updated_by | UUID | Yes | Audit field |
| is_deleted | BOOLEAN | No | Soft delete flag |

**New Fields to Add**:
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| test_frequency | ENUM | Yes | How often control should be tested |
| next_test_date | DATE | Yes | Scheduled next test date |
| last_test_result | ENUM | Yes | pass, fail, inconclusive, not_tested |
| evidence_requirements | TEXT | Yes | Description of required evidence |

### 4.2 ControlTest (New Entity)

**Table**: `grc_control_tests`

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| id | UUID | No | uuid_generate_v4() | Primary key |
| tenant_id | UUID | No | - | Multi-tenant isolation |
| control_id | UUID | No | - | FK to grc_controls |
| name | VARCHAR(255) | No | - | Test name/title |
| description | TEXT | Yes | - | Test procedure description |
| test_type | ENUM | No | manual | manual, automated, hybrid |
| status | ENUM | No | planned | planned, in_progress, completed, cancelled |
| scheduled_date | DATE | Yes | - | When test is scheduled |
| started_at | TIMESTAMP | Yes | - | When test execution started |
| completed_at | TIMESTAMP | Yes | - | When test execution completed |
| tester_user_id | UUID | Yes | - | Who performed the test |
| reviewer_user_id | UUID | Yes | - | Who reviewed the test |
| test_procedure | TEXT | Yes | - | Detailed test steps |
| sample_size | INTEGER | Yes | - | Sample size for sampling tests |
| population_size | INTEGER | Yes | - | Total population for sampling |
| metadata | JSONB | Yes | - | Extensible metadata |
| created_at | TIMESTAMP | No | now() | Audit field |
| updated_at | TIMESTAMP | No | now() | Audit field |
| created_by | UUID | Yes | - | Audit field |
| updated_by | UUID | Yes | - | Audit field |
| is_deleted | BOOLEAN | No | false | Soft delete flag |

**Indexes**:
- `IDX_grc_control_tests_tenant_control` (tenant_id, control_id)
- `IDX_grc_control_tests_tenant_status` (tenant_id, status)
- `IDX_grc_control_tests_tenant_scheduled` (tenant_id, scheduled_date)

**Enums**:
```typescript
enum ControlTestType {
  MANUAL = 'manual',
  AUTOMATED = 'automated',
  HYBRID = 'hybrid'
}

enum ControlTestStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}
```

### 4.3 TestResult (New Entity)

**Table**: `grc_test_results`

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| id | UUID | No | uuid_generate_v4() | Primary key |
| tenant_id | UUID | No | - | Multi-tenant isolation |
| control_test_id | UUID | No | - | FK to grc_control_tests (unique) |
| result | ENUM | No | - | pass, fail, inconclusive, not_applicable |
| result_details | TEXT | Yes | - | Detailed findings |
| exceptions_noted | TEXT | Yes | - | Any exceptions found |
| exceptions_count | INTEGER | Yes | 0 | Number of exceptions |
| sample_tested | INTEGER | Yes | - | Actual sample tested |
| sample_passed | INTEGER | Yes | - | Samples that passed |
| effectiveness_rating | ENUM | Yes | - | effective, partially_effective, ineffective |
| recommendations | TEXT | Yes | - | Tester recommendations |
| evidence_ids | UUID[] | Yes | - | Array of linked evidence IDs |
| reviewed_at | TIMESTAMP | Yes | - | When result was reviewed |
| reviewed_by_user_id | UUID | Yes | - | Who reviewed the result |
| metadata | JSONB | Yes | - | Extensible metadata |
| created_at | TIMESTAMP | No | now() | Audit field |
| updated_at | TIMESTAMP | No | now() | Audit field |
| created_by | UUID | Yes | - | Audit field |
| updated_by | UUID | Yes | - | Audit field |
| is_deleted | BOOLEAN | No | false | Soft delete flag |

**Indexes**:
- `IDX_grc_test_results_tenant_control_test` UNIQUE (tenant_id, control_test_id)
- `IDX_grc_test_results_tenant_result` (tenant_id, result)

**Enums**:
```typescript
enum TestResultOutcome {
  PASS = 'pass',
  FAIL = 'fail',
  INCONCLUSIVE = 'inconclusive',
  NOT_APPLICABLE = 'not_applicable'
}

enum EffectivenessRating {
  EFFECTIVE = 'effective',
  PARTIALLY_EFFECTIVE = 'partially_effective',
  INEFFECTIVE = 'ineffective'
}
```

### 4.4 GrcIssue (Finding) - Extended

**Table**: `grc_issues` (existing)

**Existing Fields** (no changes needed):
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | UUID | No | Primary key |
| tenant_id | UUID | No | Multi-tenant isolation |
| title | VARCHAR(255) | No | Finding title |
| description | TEXT | Yes | Detailed description |
| type | ENUM | No | internal_audit, external_audit, incident, self_assessment, other |
| status | ENUM | No | open, in_progress, resolved, closed, rejected |
| severity | ENUM | No | low, medium, high, critical |
| risk_id | UUID | Yes | FK to grc_risks |
| control_id | UUID | Yes | FK to grc_controls |
| audit_id | UUID | Yes | FK to grc_audits |
| raised_by_user_id | UUID | Yes | Who raised the finding |
| owner_user_id | UUID | Yes | Finding owner |
| discovered_date | DATE | Yes | When finding was discovered |
| due_date | DATE | Yes | Remediation due date |
| resolved_date | DATE | Yes | When finding was resolved |
| root_cause | TEXT | Yes | Root cause analysis |
| metadata | JSONB | Yes | Extensible metadata |

**New Fields to Add**:
| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| test_result_id | UUID | Yes | - | FK to grc_test_results (if raised from test) |
| closure_notes | TEXT | Yes | - | Notes when closing the finding |
| closed_by_user_id | UUID | Yes | - | Who closed the finding |
| closed_at | TIMESTAMP | Yes | - | When finding was closed |
| reopened_count | INTEGER | No | 0 | Number of times reopened |
| last_reopened_at | TIMESTAMP | Yes | - | Last reopen timestamp |

### 4.5 GrcCapa (Extended)

**Table**: `grc_capas` (existing)

**Existing Fields** (no changes needed):
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | UUID | No | Primary key |
| tenant_id | UUID | No | Multi-tenant isolation |
| issue_id | UUID | No | FK to grc_issues |
| description | TEXT | No | CAPA description |
| type | ENUM | No | corrective, preventive, both |
| status | ENUM | No | planned, in_progress, implemented, verified, rejected, closed |
| owner_user_id | UUID | Yes | CAPA owner |
| due_date | DATE | Yes | Target completion date |
| completed_date | DATE | Yes | Actual completion date |
| verified_by_user_id | UUID | Yes | Who verified the CAPA |
| verified_at | TIMESTAMP | Yes | Verification timestamp |
| effectiveness | TEXT | Yes | Effectiveness assessment |
| metadata | JSONB | Yes | Extensible metadata |

**New Fields to Add**:
| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| title | VARCHAR(255) | No | - | CAPA title |
| root_cause_analysis | TEXT | Yes | - | Detailed root cause |
| action_plan | TEXT | Yes | - | Detailed action plan |
| implementation_notes | TEXT | Yes | - | Implementation details |
| verification_method | TEXT | Yes | - | How effectiveness will be verified |
| verification_evidence_ids | UUID[] | Yes | - | Evidence supporting verification |
| verification_notes | TEXT | Yes | - | Verification findings |
| closure_notes | TEXT | Yes | - | Notes when closing |
| closed_by_user_id | UUID | Yes | - | Who closed the CAPA |
| closed_at | TIMESTAMP | Yes | - | Closure timestamp |
| priority | ENUM | Yes | medium | low, medium, high, critical |

### 4.6 CAPATask (New Entity)

**Table**: `grc_capa_tasks`

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| id | UUID | No | uuid_generate_v4() | Primary key |
| tenant_id | UUID | No | - | Multi-tenant isolation |
| capa_id | UUID | No | - | FK to grc_capas |
| title | VARCHAR(255) | No | - | Task title |
| description | TEXT | Yes | - | Task description |
| status | ENUM | No | pending | pending, in_progress, completed, cancelled |
| assignee_user_id | UUID | Yes | - | Who is assigned |
| due_date | DATE | Yes | - | Task due date |
| completed_at | TIMESTAMP | Yes | - | When task was completed |
| completed_by_user_id | UUID | Yes | - | Who completed the task |
| sequence_order | INTEGER | No | 0 | Order of execution |
| notes | TEXT | Yes | - | Task notes |
| metadata | JSONB | Yes | - | Extensible metadata |
| created_at | TIMESTAMP | No | now() | Audit field |
| updated_at | TIMESTAMP | No | now() | Audit field |
| created_by | UUID | Yes | - | Audit field |
| updated_by | UUID | Yes | - | Audit field |
| is_deleted | BOOLEAN | No | false | Soft delete flag |

**Indexes**:
- `IDX_grc_capa_tasks_tenant_capa` (tenant_id, capa_id)
- `IDX_grc_capa_tasks_tenant_status` (tenant_id, status)
- `IDX_grc_capa_tasks_tenant_assignee` (tenant_id, assignee_user_id)

**Enums**:
```typescript
enum CAPATaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}
```

### 4.7 ControlEvidence (New Join Table)

**Table**: `grc_control_evidence`

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| id | UUID | No | uuid_generate_v4() | Primary key |
| tenant_id | UUID | No | - | Multi-tenant isolation |
| control_id | UUID | No | - | FK to grc_controls |
| evidence_id | UUID | No | - | FK to grc_evidence |
| evidence_type | ENUM | Yes | - | baseline, test, periodic |
| valid_from | DATE | Yes | - | Evidence validity start |
| valid_until | DATE | Yes | - | Evidence validity end |
| notes | TEXT | Yes | - | Notes about the evidence |
| created_at | TIMESTAMP | No | now() | Audit field |

**Indexes**:
- `IDX_grc_control_evidence_tenant_control_evidence` UNIQUE (tenant_id, control_id, evidence_id)
- `IDX_grc_control_evidence_tenant_control` (tenant_id, control_id)

**Enums**:
```typescript
enum ControlEvidenceType {
  BASELINE = 'baseline',      // Initial evidence when control implemented
  TEST = 'test',              // Evidence from test execution
  PERIODIC = 'periodic'       // Periodic evidence collection
}
```

### 4.8 StatusHistory (New Entity for Audit Trail)

**Table**: `grc_status_history`

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| id | UUID | No | uuid_generate_v4() | Primary key |
| tenant_id | UUID | No | - | Multi-tenant isolation |
| entity_type | VARCHAR(50) | No | - | 'issue', 'capa', 'control_test', etc. |
| entity_id | UUID | No | - | ID of the entity |
| previous_status | VARCHAR(50) | Yes | - | Status before change |
| new_status | VARCHAR(50) | No | - | Status after change |
| changed_by_user_id | UUID | Yes | - | Who made the change |
| change_reason | TEXT | Yes | - | Reason for status change |
| metadata | JSONB | Yes | - | Additional context |
| created_at | TIMESTAMP | No | now() | When change occurred |

**Indexes**:
- `IDX_grc_status_history_tenant_entity` (tenant_id, entity_type, entity_id)
- `IDX_grc_status_history_tenant_created` (tenant_id, created_at)

## 5. Workflow State Machines

### 5.1 Finding (GrcIssue) Status Workflow

```
                    ┌─────────┐
                    │  OPEN   │ <──────────────────────────────┐
                    └────┬────┘                                │
                         │                                     │
                         ▼                                     │
                ┌─────────────────┐                           │
                │  IN_PROGRESS    │                           │
                └────────┬────────┘                           │
                         │                                     │
              ┌──────────┴──────────┐                         │
              ▼                     ▼                         │
      ┌─────────────┐       ┌─────────────┐                   │
      │  RESOLVED   │       │  REJECTED   │                   │
      └──────┬──────┘       └─────────────┘                   │
             │                                                 │
             ▼                                                 │
      ┌─────────────┐                                         │
      │   CLOSED    │ ─────────────────────────────────────────┘
      └─────────────┘        (reopen)
```

**Allowed Transitions**:
| From | To | Conditions |
|------|-----|------------|
| OPEN | IN_PROGRESS | Owner assigned |
| IN_PROGRESS | RESOLVED | At least one CAPA created and implemented |
| IN_PROGRESS | REJECTED | Rejection reason provided |
| RESOLVED | CLOSED | All CAPAs verified |
| CLOSED | OPEN | Reopen reason provided (increments reopened_count) |

### 5.2 CAPA Status Workflow

```
                    ┌──────────┐
                    │ PLANNED  │
                    └────┬─────┘
                         │
                         ▼
                ┌─────────────────┐
                │  IN_PROGRESS    │
                └────────┬────────┘
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
      ┌─────────────────┐   ┌─────────────┐
      │  IMPLEMENTED    │   │  REJECTED   │
      └────────┬────────┘   └─────────────┘
               │
               ▼
      ┌─────────────────┐
      │    VERIFIED     │
      └────────┬────────┘
               │
               ▼
      ┌─────────────────┐
      │     CLOSED      │
      └─────────────────┘
```

**Allowed Transitions**:
| From | To | Conditions |
|------|-----|------------|
| PLANNED | IN_PROGRESS | Owner assigned, action plan defined |
| IN_PROGRESS | IMPLEMENTED | Implementation notes provided |
| IN_PROGRESS | REJECTED | Rejection reason provided |
| IMPLEMENTED | VERIFIED | Verified by different user than owner, verification notes provided |
| VERIFIED | CLOSED | Effectiveness assessment completed |

**Validation Rules**:
1. CAPA cannot move to VERIFIED if verified_by_user_id == owner_user_id
2. CAPA cannot move to CLOSED without verification_notes
3. Finding cannot be CLOSED if any linked CAPA is not CLOSED or REJECTED

## 6. API Contracts

### 6.1 Control Endpoints

```
GET    /api/grc/controls                    # List controls with pagination/filtering
GET    /api/grc/controls/:id                # Get control details
POST   /api/grc/controls                    # Create control
PUT    /api/grc/controls/:id                # Update control
DELETE /api/grc/controls/:id                # Soft delete control

# Relationships
GET    /api/grc/controls/:id/evidence       # List evidence for control
POST   /api/grc/controls/:id/evidence       # Link evidence to control
DELETE /api/grc/controls/:id/evidence/:eid  # Unlink evidence

GET    /api/grc/controls/:id/tests          # List tests for control
POST   /api/grc/controls/:id/tests          # Create test for control

GET    /api/grc/controls/:id/issues         # List findings for control
GET    /api/grc/controls/:id/risks          # List linked risks
GET    /api/grc/controls/:id/requirements   # List linked requirements
```

### 6.2 Evidence Endpoints

```
GET    /api/grc/evidence                    # List evidence with pagination/filtering
GET    /api/grc/evidence/:id                # Get evidence details
POST   /api/grc/evidence                    # Create evidence record
PUT    /api/grc/evidence/:id                # Update evidence
DELETE /api/grc/evidence/:id                # Soft delete evidence
```

### 6.3 Control Test Endpoints

```
GET    /api/grc/control-tests               # List tests with pagination/filtering
GET    /api/grc/control-tests/:id           # Get test details with result
POST   /api/grc/control-tests               # Create test
PUT    /api/grc/control-tests/:id           # Update test
DELETE /api/grc/control-tests/:id           # Soft delete test

POST   /api/grc/control-tests/:id/start     # Start test execution
POST   /api/grc/control-tests/:id/complete  # Complete test with result
POST   /api/grc/control-tests/:id/cancel    # Cancel test
```

### 6.4 Issue (Finding) Endpoints

```
GET    /api/grc/issues                      # List issues with pagination/filtering
GET    /api/grc/issues/:id                  # Get issue details
POST   /api/grc/issues                      # Create issue
PUT    /api/grc/issues/:id                  # Update issue
DELETE /api/grc/issues/:id                  # Soft delete issue

# Workflow
POST   /api/grc/issues/:id/transition       # Transition status
POST   /api/grc/issues/:id/close            # Close issue (validates CAPAs)
POST   /api/grc/issues/:id/reopen           # Reopen closed issue

# Relationships
GET    /api/grc/issues/:id/capas            # List CAPAs for issue
POST   /api/grc/issues/:id/capas            # Create CAPA for issue
GET    /api/grc/issues/:id/evidence         # List evidence for issue
POST   /api/grc/issues/:id/evidence         # Link evidence to issue
GET    /api/grc/issues/:id/history          # Get status history
```

### 6.5 CAPA Endpoints

```
GET    /api/grc/capas                       # List CAPAs with pagination/filtering
GET    /api/grc/capas/:id                   # Get CAPA details
POST   /api/grc/capas                       # Create CAPA
PUT    /api/grc/capas/:id                   # Update CAPA
DELETE /api/grc/capas/:id                   # Soft delete CAPA

# Workflow
POST   /api/grc/capas/:id/transition        # Transition status
POST   /api/grc/capas/:id/implement         # Mark as implemented
POST   /api/grc/capas/:id/verify            # Verify CAPA (different user)
POST   /api/grc/capas/:id/close             # Close CAPA

# Tasks
GET    /api/grc/capas/:id/tasks             # List tasks for CAPA
POST   /api/grc/capas/:id/tasks             # Create task
PUT    /api/grc/capas/:id/tasks/:tid        # Update task
DELETE /api/grc/capas/:id/tasks/:tid        # Delete task

GET    /api/grc/capas/:id/history           # Get status history
```

## 7. Validation Rules

### 7.1 Control Validation
- `name` is required, max 255 characters
- `code` must be unique per tenant (if provided)
- `owner_user_id` must reference valid user in same tenant
- `effective_date` cannot be in the future when status is 'implemented'

### 7.2 Evidence Validation
- `name` is required, max 255 characters
- `location` is required (file path or URL)
- `collected_by_user_id` must reference valid user in same tenant
- `expires_at` must be after `collected_at` (if both provided)

### 7.3 Control Test Validation
- `name` is required, max 255 characters
- `control_id` must reference valid control in same tenant
- `scheduled_date` cannot be in the past when creating
- `tester_user_id` must reference valid user in same tenant
- Cannot complete test without result

### 7.4 Issue (Finding) Validation
- `title` is required, max 255 characters
- `control_id` must reference valid control in same tenant (if provided)
- `due_date` cannot be in the past when creating
- Cannot close if any linked CAPA is not CLOSED or REJECTED
- Reopen requires `change_reason`

### 7.5 CAPA Validation
- `description` is required
- `issue_id` must reference valid issue in same tenant
- `owner_user_id` must reference valid user in same tenant
- Cannot verify if `verified_by_user_id` == `owner_user_id`
- Cannot close without `verification_notes`
- Cannot close without `effectiveness` assessment

### 7.6 CAPA Task Validation
- `title` is required, max 255 characters
- `capa_id` must reference valid CAPA in same tenant
- `assignee_user_id` must reference valid user in same tenant

## 8. RBAC & Tenant Considerations

### 8.1 Permissions Required

| Action | Permission |
|--------|------------|
| View Controls | GRC_CONTROL_READ |
| Create/Edit Controls | GRC_CONTROL_WRITE |
| Delete Controls | GRC_CONTROL_DELETE |
| View Evidence | GRC_EVIDENCE_READ |
| Create/Edit Evidence | GRC_EVIDENCE_WRITE |
| Delete Evidence | GRC_EVIDENCE_DELETE |
| View Tests | GRC_TEST_READ |
| Execute Tests | GRC_TEST_WRITE |
| View Issues | GRC_ISSUE_READ |
| Create/Edit Issues | GRC_ISSUE_WRITE |
| Close Issues | GRC_ISSUE_CLOSE |
| View CAPAs | GRC_CAPA_READ |
| Create/Edit CAPAs | GRC_CAPA_WRITE |
| Verify CAPAs | GRC_CAPA_VERIFY |
| Close CAPAs | GRC_CAPA_CLOSE |

### 8.2 Tenant Isolation

All queries MUST include `tenant_id` filter:
```typescript
// Example service method
async findAll(tenantId: string, filters: FilterDto) {
  return this.repository.find({
    where: {
      tenantId,
      isDeleted: false,
      ...filters
    }
  });
}
```

### 8.3 Audit Trail

All status changes MUST be recorded in `grc_status_history`:
```typescript
async transitionStatus(
  tenantId: string,
  entityType: string,
  entityId: string,
  newStatus: string,
  userId: string,
  reason?: string
) {
  // Record history
  await this.statusHistoryRepo.save({
    tenantId,
    entityType,
    entityId,
    previousStatus: entity.status,
    newStatus,
    changedByUserId: userId,
    changeReason: reason
  });
  
  // Update entity
  entity.status = newStatus;
  await this.repository.save(entity);
}
```

## 9. Seed/Demo Scenario

### 9.1 Demo Data Structure

```
Tenant: Demo Corp (existing demo tenant)

Control: CTL-001 "Access Review Control"
  ├── Evidence: EVD-001 "Q4 Access Review Report"
  ├── Evidence: EVD-002 "Access Review Procedure Document"
  ├── Test: TST-001 "Q4 2025 Access Review Test"
  │   └── Result: PASS (effective)
  ├── Test: TST-002 "Q1 2026 Access Review Test"
  │   └── Result: FAIL (3 exceptions)
  │       └── Issue: ISS-001 "Stale Accounts Found"
  │           ├── CAPA: CAPA-001 "Implement Automated Account Cleanup"
  │           │   ├── Task: "Document cleanup procedure"
  │           │   ├── Task: "Implement automation script"
  │           │   └── Task: "Test and deploy"
  │           └── Evidence: EVD-003 "Exception Details"

Control: CTL-002 "Change Management Control"
  ├── Evidence: EVD-004 "Change Management Policy"
  └── Test: TST-003 "Change Management Audit" (planned)
```

### 9.2 Seed Script Requirements

1. Create 3-5 sample controls with different statuses
2. Create 5-10 evidence records
3. Create 2-3 control tests with results
4. Create 1-2 findings with CAPAs
5. Create CAPA tasks for at least one CAPA
6. Record status history for workflow demonstration

## 10. Test Plan

### 10.1 Unit Tests

| Service | Test Cases |
|---------|------------|
| GrcControlService | CRUD operations, validation, tenant isolation |
| GrcEvidenceService | CRUD operations, validation, tenant isolation |
| ControlTestService | CRUD, workflow transitions, result recording |
| GrcIssueService | CRUD, workflow transitions, closure validation |
| GrcCapaService | CRUD, workflow transitions, verification rules |
| CAPATaskService | CRUD, status updates |

### 10.2 Integration Tests

1. **Golden Flow E2E**: Create control -> Add evidence -> Execute test -> Record fail result -> Create finding -> Create CAPA -> Complete tasks -> Verify CAPA -> Close CAPA -> Close finding
2. **Validation Tests**: Attempt invalid transitions, verify rejection
3. **RBAC Tests**: Verify permission enforcement
4. **Tenant Isolation**: Verify cross-tenant data access is blocked

### 10.3 API Contract Tests

1. Verify all endpoints return correct response format
2. Verify pagination works correctly
3. Verify filtering and sorting
4. Verify error responses follow standard format

## 11. Migration Notes

### 11.1 New Tables to Create

1. `grc_control_tests`
2. `grc_test_results`
3. `grc_capa_tasks`
4. `grc_control_evidence`
5. `grc_status_history`

### 11.2 Existing Tables to Alter

1. `grc_controls` - Add new fields
2. `grc_issues` - Add new fields
3. `grc_capas` - Add new fields

### 11.3 New Enums to Create

1. `control_test_type_enum`
2. `control_test_status_enum`
3. `test_result_outcome_enum`
4. `effectiveness_rating_enum`
5. `capa_task_status_enum`
6. `control_evidence_type_enum`
7. `capa_priority_enum`

## 12. Approval Checklist

Before proceeding to Phase 1 implementation, confirm:

- [ ] Data model is complete and accurate
- [ ] All relationships are correctly defined
- [ ] Workflow state machines are approved
- [ ] API contracts are acceptable
- [ ] Validation rules are complete
- [ ] RBAC permissions are defined
- [ ] Seed scenario is representative
- [ ] Test plan is sufficient

---

**Document Status**: Awaiting approval before Phase 1 implementation begins.
