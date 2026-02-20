# Sprint 5 - Process Controls & Compliance Design Document

## Overview

Sprint 5 introduces a **Process Controls & Compliance** layer on top of the existing GRC modules. This enables organizations to:

- Define business processes and their control points
- Record control execution results (manual or automated)
- Automatically create process violations for non-compliant results
- Calculate compliance scores per process based on recent control results
- Link violations to existing GrcRisk records

## Data Model

### Entity Relationship Diagram

```
Process (1) ----< (N) ProcessControl (1) ----< (N) ControlResult
    |                      |                           |
    |                      |                           |
    |                      v                           v
    |              GrcRisk (M:N)              ProcessViolation (1:1)
    |                                                  |
    +--------------------------------------------------+
                           |
                           v
                       GrcRisk (optional link)
```

### 1. Process Entity

Represents a business or IT process.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| tenantId | UUID | FK to Tenant (multi-tenant isolation) |
| name | string(255) | Process name (unique per tenant) |
| code | string(50) | Short code (e.g., "CHG-MGMT") |
| description | text | Optional description |
| ownerUserId | UUID | FK to User (optional) |
| category | string(100) | Category (e.g., "ITSM", "Security", "Finance") |
| isActive | boolean | Default true |
| createdAt | timestamp | Auto-generated |
| updatedAt | timestamp | Auto-generated |
| createdBy | UUID | User who created |
| updatedBy | UUID | User who last updated |
| isDeleted | boolean | Soft delete flag |

**Relations:**
- One Process has many ProcessControls

### 2. ProcessControl Entity

A control point attached to a Process.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| tenantId | UUID | FK to Tenant |
| processId | UUID | FK to Process |
| name | string(255) | Control name |
| description | text | Optional description |
| isAutomated | boolean | Whether control is automated |
| method | enum | SCRIPT, SAMPLING, INTERVIEW, WALKTHROUGH, OBSERVATION |
| frequency | enum | DAILY, WEEKLY, MONTHLY, QUARTERLY, ANNUALLY, EVENT_DRIVEN |
| expectedResultType | enum | BOOLEAN, NUMERIC, QUALITATIVE |
| parameters | jsonb | Optional metadata for automation |
| isActive | boolean | Default true |
| createdAt | timestamp | Auto-generated |
| updatedAt | timestamp | Auto-generated |
| createdBy | UUID | User who created |
| updatedBy | UUID | User who last updated |
| isDeleted | boolean | Soft delete flag |

**Relations:**
- Many ProcessControls belong to one Process
- One ProcessControl has many ControlResults
- Many-to-Many with GrcRisk via ProcessControlRisk mapping table

### 3. ControlResult Entity

Each time a control is executed, we record a ControlResult.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| tenantId | UUID | FK to Tenant |
| controlId | UUID | FK to ProcessControl |
| executionDate | timestamp | When the control was executed |
| executorUserId | UUID | FK to User (null for automated) |
| source | enum | MANUAL, SCHEDULED_JOB, INTEGRATION |
| resultValueBoolean | boolean | Result for BOOLEAN type |
| resultValueNumber | number | Result for NUMERIC type |
| resultValueText | string | Result for QUALITATIVE type |
| isCompliant | boolean | Required - whether result is compliant |
| evidenceReference | string | Link or file ID for evidence |
| createdAt | timestamp | Auto-generated |
| updatedAt | timestamp | Auto-generated |

**Relations:**
- Many ControlResults belong to one ProcessControl
- One ControlResult can have one ProcessViolation (if non-compliant)

### 4. ProcessViolation Entity

Represents a violation created when a control result is non-compliant.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| tenantId | UUID | FK to Tenant |
| controlId | UUID | FK to ProcessControl |
| controlResultId | UUID | FK to ControlResult |
| createdAt | timestamp | Auto-generated |
| severity | enum | LOW, MEDIUM, HIGH, CRITICAL |
| status | enum | OPEN, IN_PROGRESS, RESOLVED |
| title | string(255) | Violation title |
| description | text | Optional description |
| linkedRiskId | UUID | FK to GrcRisk (optional) |
| ownerUserId | UUID | FK to User (optional) |
| dueDate | date | Optional due date |
| resolutionNotes | text | Notes on resolution |
| updatedAt | timestamp | Auto-generated |

**Relations:**
- One ProcessViolation belongs to one ProcessControl and one ControlResult
- One ProcessViolation may be linked to one GrcRisk

### 5. ProcessControlRisk Entity (Mapping Table)

Links ProcessControls to GrcRisks (many-to-many).

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| tenantId | UUID | FK to Tenant |
| controlId | UUID | FK to ProcessControl |
| riskId | UUID | FK to GrcRisk |
| createdAt | timestamp | Auto-generated |

## Enums

### ProcessControlMethod
```typescript
enum ProcessControlMethod {
  SCRIPT = 'script',
  SAMPLING = 'sampling',
  INTERVIEW = 'interview',
  WALKTHROUGH = 'walkthrough',
  OBSERVATION = 'observation',
}
```

### ProcessControlFrequency
```typescript
enum ProcessControlFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUALLY = 'annually',
  EVENT_DRIVEN = 'event_driven',
}
```

### ControlResultType
```typescript
enum ControlResultType {
  BOOLEAN = 'boolean',
  NUMERIC = 'numeric',
  QUALITATIVE = 'qualitative',
}
```

### ControlResultSource
```typescript
enum ControlResultSource {
  MANUAL = 'manual',
  SCHEDULED_JOB = 'scheduled_job',
  INTEGRATION = 'integration',
}
```

### ViolationSeverity
```typescript
enum ViolationSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}
```

### ViolationStatus
```typescript
enum ViolationStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
}
```

## API Endpoints

### Process Endpoints (`/grc/processes`)

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | /grc/processes | List processes with pagination/filters | GRC_PROCESS_READ |
| GET | /grc/processes/:id | Get process details | GRC_PROCESS_READ |
| POST | /grc/processes | Create process | GRC_PROCESS_WRITE |
| PATCH | /grc/processes/:id | Update process | GRC_PROCESS_WRITE |
| DELETE | /grc/processes/:id | Soft delete process | GRC_PROCESS_WRITE |
| GET | /grc/processes/:id/compliance-score | Get compliance score | GRC_PROCESS_READ |
| GET | /grc/processes/compliance-overview | Get all processes with scores | GRC_STATISTICS_READ |

### ProcessControl Endpoints (`/grc/process-controls`)

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | /grc/process-controls | List controls with filters | GRC_PROCESS_READ |
| GET | /grc/process-controls/:id | Get control details | GRC_PROCESS_READ |
| POST | /grc/process-controls | Create control | GRC_PROCESS_WRITE |
| PATCH | /grc/process-controls/:id | Update control | GRC_PROCESS_WRITE |
| DELETE | /grc/process-controls/:id | Soft delete control | GRC_PROCESS_WRITE |
| PUT | /grc/process-controls/:id/risks | Link/unlink risks | GRC_PROCESS_WRITE |
| GET | /grc/process-controls/:id/risks | Get linked risks | GRC_PROCESS_READ |

### ControlResult Endpoints (`/grc/control-results`)

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | /grc/control-results | List results with filters | GRC_PROCESS_READ |
| GET | /grc/control-results/:id | Get result details | GRC_PROCESS_READ |
| POST | /grc/control-results | Create manual result | GRC_PROCESS_WRITE |

### ProcessViolation Endpoints (`/grc/process-violations`)

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | /grc/process-violations | List violations with filters | GRC_PROCESS_READ |
| GET | /grc/process-violations/:id | Get violation details | GRC_PROCESS_READ |
| PATCH | /grc/process-violations/:id | Update violation | GRC_PROCESS_WRITE |
| PATCH | /grc/process-violations/:id/link-risk | Link to GrcRisk | GRC_PROCESS_WRITE |
| PATCH | /grc/process-violations/:id/unlink-risk | Unlink from GrcRisk | GRC_PROCESS_WRITE |

## Business Rules

### 1. Automatic Violation Creation

When a ControlResult is created with `isCompliant = false`:
1. Automatically create a ProcessViolation
2. Link it to the ControlResult and ProcessControl
3. Set default severity to MEDIUM (can be enhanced later)
4. Set status to OPEN
5. Generate title from control name and execution date

### 2. Duplicate Violation Prevention

- Only one ProcessViolation per non-compliant ControlResult
- Check for existing violation before creating

### 3. Compliance Score Calculation

```
complianceScore = numberOfCompliantResults / totalResults
```

- Computed for a given time window (default: last 30 days)
- Returns value between 0 and 1 (or percentage 0-100)
- Calculated per process based on all its controls' results

### 4. Multi-Tenant Isolation

- All queries filtered by tenantId
- Same patterns as existing GRC modules

## Permission Model

### New Permissions

```typescript
// Process permissions
GRC_PROCESS_READ = 'grc:process:read',
GRC_PROCESS_WRITE = 'grc:process:write',
```

### Role Mapping

| Role | Permissions |
|------|-------------|
| ADMIN | GRC_PROCESS_READ, GRC_PROCESS_WRITE |
| MANAGER | GRC_PROCESS_READ, GRC_PROCESS_WRITE |
| USER | GRC_PROCESS_READ |

## Example Flows

### Happy Path: Compliant Control Result

1. User creates a Process "Change Management" (CHG-MGMT)
2. User adds ProcessControl "Change Approval Check" (BOOLEAN type, WEEKLY frequency)
3. User records ControlResult with `isCompliant = true`
4. No violation created
5. Compliance score for process = 100%

### Non-Compliant Control Result

1. User records ControlResult with `isCompliant = false`
2. System automatically creates ProcessViolation:
   - Title: "Violation: Change Approval Check - 2025-01-15"
   - Severity: MEDIUM
   - Status: OPEN
3. User can update violation status, assign owner, set due date
4. User can link violation to existing GrcRisk
5. Compliance score for process decreases

### Compliance Score Query

1. Request: GET /grc/processes/123/compliance-score?from=2025-01-01&to=2025-01-31
2. System queries all ControlResults for process 123 in date range
3. Calculates: compliant / total
4. Returns: `{ processId: "123", complianceScore: 0.85, compliantCount: 17, totalCount: 20 }`

## Frontend Pages

### 1. Process List Page (`/processes`)

- Table with columns: Name, Code, Category, Owner, Compliance Score, Status
- Filters: Category, Active status
- Actions: Create, Edit, View details

### 2. Process Detail Page (`/processes/:id`)

- Basic info section (name, code, description, category, owner)
- Controls tab: List of ProcessControls with add/edit capability
- Compliance score display with trend chart

### 3. Control Results Recording

- Form to select ProcessControl
- Input for result value based on expectedResultType
- isCompliant checkbox
- Evidence reference field

### 4. Violations List Page (`/violations`)

- Table with columns: Process, Control, Severity, Status, Linked Risk, Created, Owner
- Filters: Status, Severity, Process, Control
- Actions: View details, Update status

### 5. Violation Detail Page (`/violations/:id`)

- Status management (OPEN -> IN_PROGRESS -> RESOLVED)
- Owner assignment
- Due date setting
- Resolution notes
- Link/unlink GrcRisk

## Testing Strategy

### Unit Tests

- ProcessService: CRUD operations, soft delete
- ProcessControlService: CRUD, risk linking
- ControlResultService: Create with auto-violation
- ProcessViolationService: CRUD, risk linking
- ProcessComplianceService: Score calculation

### E2E Tests

1. Create process and controls
2. Record compliant result - verify no violation
3. Record non-compliant result - verify violation created
4. Fetch compliance score - verify calculation
5. Update violation status
6. Link violation to risk

### Smoke Test

Extend existing smoke-grc.ts:
1. Create process
2. Create control
3. Record compliant result
4. Record non-compliant result
5. Verify violation exists
6. Fetch compliance score
