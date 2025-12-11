# Audit Phase 1 - Standards & Findings Core Design

## Overview

This document describes the model design for enriching the Audit module with standard/requirement-based scope management and finding/CAPA tracking capabilities.

## Current State

### Existing Entities

- **GrcAudit**: Single audit record with basic fields (name, description, type, status, dates, etc.)
- **GrcRequirement**: Compliance requirements with framework, referenceCode, title, status
- **GrcIssue**: Issues/findings with type, severity, status, linked to Risk and Control
- **GrcCapa**: Corrective/Preventive actions linked to Issues
- **GrcEvidence**: Evidence artifacts linked to Issues via GrcIssueEvidence

### Current Relationships

```
GrcAudit (standalone - no requirement/issue links)

GrcRequirement <---> GrcRisk (via GrcRiskRequirement)
GrcRequirement <---> GrcControl (via GrcRequirementControl)

GrcIssue ---> GrcRisk (optional)
GrcIssue ---> GrcControl (optional)
GrcIssue <---> GrcCapa (one-to-many)
GrcIssue <---> GrcEvidence (via GrcIssueEvidence)
```

## Proposed Model

### Entity Relationship Diagram (Textual)

```
                                    +------------------+
                                    |    GrcAudit      |
                                    +------------------+
                                           |
                                           | 1:N
                                           v
                              +------------------------+
                              |  GrcAuditRequirement   |
                              |  (join table)          |
                              +------------------------+
                                           |
                                           | N:1
                                           v
                                    +------------------+
                                    |  GrcRequirement  |
                                    +------------------+
                                           |
                                           | 1:N
                                           v
                              +------------------------+
                              |  GrcIssueRequirement   |
                              |  (join table)          |
                              +------------------------+
                                           |
                                           | N:1
                                           v
                                    +------------------+
                                    |    GrcIssue      |
                                    | (type=audit_     |
                                    |  finding)        |
                                    +------------------+
                                           |
                                           | 1:N
                                           v
                                    +------------------+
                                    |    GrcCapa       |
                                    +------------------+
```

### New Tables

#### 1. grc_audit_requirements (Join Table)

Links audits to requirements, representing the audit scope.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| tenant_id | UUID | NO | Tenant isolation |
| audit_id | UUID | NO | FK to grc_audits |
| requirement_id | UUID | NO | FK to grc_requirements |
| status | VARCHAR(50) | YES | planned, in_scope, sampled, tested, completed |
| notes | TEXT | YES | Optional notes |
| created_at | TIMESTAMP | NO | Creation timestamp |
| updated_at | TIMESTAMP | NO | Last update timestamp |
| created_by | UUID | YES | User who created |
| updated_by | UUID | YES | User who last updated |
| is_deleted | BOOLEAN | NO | Soft delete flag (default: false) |

**Indexes:**
- UNIQUE: (tenant_id, audit_id, requirement_id)
- INDEX: (tenant_id, audit_id)
- INDEX: (tenant_id, requirement_id)

#### 2. grc_issue_requirements (Join Table)

Links issues (findings) to requirements.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| tenant_id | UUID | NO | Tenant isolation |
| issue_id | UUID | NO | FK to grc_issues |
| requirement_id | UUID | NO | FK to grc_requirements |
| notes | TEXT | YES | Optional notes |
| created_at | TIMESTAMP | NO | Creation timestamp |
| updated_at | TIMESTAMP | NO | Last update timestamp |
| created_by | UUID | YES | User who created |
| updated_by | UUID | YES | User who last updated |
| is_deleted | BOOLEAN | NO | Soft delete flag (default: false) |

**Indexes:**
- UNIQUE: (tenant_id, issue_id, requirement_id)
- INDEX: (tenant_id, issue_id)
- INDEX: (tenant_id, requirement_id)

### Modified Tables

#### grc_issues

Add `audit_id` column to link findings directly to audits:

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| audit_id | UUID | YES | FK to grc_audits (for audit findings) |

**Note:** The existing `type` enum already includes `internal_audit` and `external_audit` values which can be used to identify audit findings.

## Backend Changes

### New Entity Files

#### 1. backend-nest/src/grc/entities/grc-audit-requirement.entity.ts

```typescript
@Entity('grc_audit_requirements')
export class GrcAuditRequirement extends MappingEntityBase {
  @Column({ name: 'audit_id', type: 'uuid' })
  auditId: string;

  @ManyToOne(() => GrcAudit)
  @JoinColumn({ name: 'audit_id' })
  audit: GrcAudit;

  @Column({ name: 'requirement_id', type: 'uuid' })
  requirementId: string;

  @ManyToOne(() => GrcRequirement)
  @JoinColumn({ name: 'requirement_id' })
  requirement: GrcRequirement;

  @Column({ type: 'varchar', length: 50, nullable: true })
  status: string | null; // planned, in_scope, sampled, tested, completed

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
```

#### 2. backend-nest/src/grc/entities/grc-issue-requirement.entity.ts

```typescript
@Entity('grc_issue_requirements')
export class GrcIssueRequirement extends MappingEntityBase {
  @Column({ name: 'issue_id', type: 'uuid' })
  issueId: string;

  @ManyToOne(() => GrcIssue)
  @JoinColumn({ name: 'issue_id' })
  issue: GrcIssue;

  @Column({ name: 'requirement_id', type: 'uuid' })
  requirementId: string;

  @ManyToOne(() => GrcRequirement)
  @JoinColumn({ name: 'requirement_id' })
  requirement: GrcRequirement;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
```

### Entity Modifications

#### GrcAudit Entity

Add relation to AuditRequirements:

```typescript
@OneToMany(() => GrcAuditRequirement, (ar) => ar.audit)
auditRequirements: GrcAuditRequirement[];
```

#### GrcRequirement Entity

Add relations:

```typescript
@OneToMany(() => GrcAuditRequirement, (ar) => ar.requirement)
auditRequirements: GrcAuditRequirement[];

@OneToMany(() => GrcIssueRequirement, (ir) => ir.requirement)
issueRequirements: GrcIssueRequirement[];
```

#### GrcIssue Entity

Add audit relation and issue requirements:

```typescript
@Column({ name: 'audit_id', type: 'uuid', nullable: true })
auditId: string | null;

@ManyToOne(() => GrcAudit, { nullable: true })
@JoinColumn({ name: 'audit_id' })
audit: GrcAudit | null;

@OneToMany(() => GrcIssueRequirement, (ir) => ir.issue)
issueRequirements: GrcIssueRequirement[];
```

### Service Methods

#### GrcAuditService (additions)

```typescript
// Get requirements in audit scope
async getAuditRequirements(tenantId: string, auditId: string): Promise<GrcAuditRequirement[]>

// Add requirements to audit scope
async addRequirementsToAudit(tenantId: string, auditId: string, requirementIds: string[]): Promise<GrcAuditRequirement[]>

// Remove requirement from audit scope
async removeRequirementFromAudit(tenantId: string, auditId: string, requirementId: string): Promise<boolean>

// Update audit requirement status
async updateAuditRequirementStatus(tenantId: string, auditId: string, requirementId: string, status: string): Promise<GrcAuditRequirement>

// Get findings for audit
async getAuditFindings(tenantId: string, auditId: string): Promise<GrcIssue[]>

// Create audit finding
async createAuditFinding(tenantId: string, userId: string, auditId: string, data: CreateFindingDto): Promise<GrcIssue>
```

#### GrcRequirementService (additions)

```typescript
// Get findings linked to requirement
async getRequirementFindings(tenantId: string, requirementId: string): Promise<GrcIssue[]>
```

### Controller Endpoints

#### GrcAuditController (additions)

| Method | Path | Description |
|--------|------|-------------|
| GET | /grc/audits/:id/requirements | Get requirements in audit scope |
| POST | /grc/audits/:id/requirements | Add requirements to audit scope |
| DELETE | /grc/audits/:id/requirements/:reqId | Remove requirement from audit scope |
| PATCH | /grc/audits/:id/requirements/:reqId | Update audit requirement status |
| GET | /grc/audits/:id/findings | Get findings for audit |
| POST | /grc/audits/:id/findings | Create audit finding |

#### GrcRequirementController (additions)

| Method | Path | Description |
|--------|------|-------------|
| GET | /grc/requirements/:id/findings | Get findings linked to requirement |

### DTOs

#### AddRequirementsToAuditDto

```typescript
class AddRequirementsToAuditDto {
  @IsArray()
  @IsUUID('4', { each: true })
  requirementIds: string[];
}
```

#### UpdateAuditRequirementDto

```typescript
class UpdateAuditRequirementDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
```

#### CreateAuditFindingDto

```typescript
class CreateAuditFindingDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(IssueSeverity)
  severity: IssueSeverity;

  @IsOptional()
  @IsEnum(IssueStatus)
  status?: IssueStatus;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  requirementIds?: string[];
}
```

## Frontend Changes

### AuditDetail.tsx Tab Structure

Replace current tabs with:

1. **Overview** - Basic audit information (existing form fields)
2. **Scope & Standards** - Requirement management for audit scope
3. **Findings & CAPA** - Audit findings with CAPA tracking

### Scope & Standards Tab

**Components:**
- Framework filter dropdown (ISO27001, SOC2, GDPR, HIPAA, etc.)
- Requirements table with columns:
  - Framework
  - Reference Code
  - Title
  - Status (in audit scope)
  - Findings Count
  - CAPAs Count
- "Add Requirements" button opening modal
- Row click opens requirement detail drawer

**Requirement Detail Drawer:**
- Title, description, category, priority, status
- Linked findings list
- "Add Finding" button

### Findings & CAPA Tab

**Components:**
- Findings table with columns:
  - Title
  - Severity
  - Status
  - Owner
  - Due Date
  - Requirements Count
- "Add Finding" button opening modal
- Row click opens finding detail drawer

**Add Finding Modal:**
- Title, description, severity, status, owner, due date
- Multi-select for requirements (from audit scope)

**Finding Detail Drawer:**
- Finding details
- Linked requirements list
- Linked CAPAs list (read-only for now)

### API Integration

Add to grcClient.ts:

```typescript
// Audit Requirements
GET_AUDIT_REQUIREMENTS: (auditId: string) => `/grc/audits/${auditId}/requirements`,
ADD_AUDIT_REQUIREMENTS: (auditId: string) => `/grc/audits/${auditId}/requirements`,
REMOVE_AUDIT_REQUIREMENT: (auditId: string, reqId: string) => `/grc/audits/${auditId}/requirements/${reqId}`,
UPDATE_AUDIT_REQUIREMENT: (auditId: string, reqId: string) => `/grc/audits/${auditId}/requirements/${reqId}`,

// Audit Findings
GET_AUDIT_FINDINGS: (auditId: string) => `/grc/audits/${auditId}/findings`,
CREATE_AUDIT_FINDING: (auditId: string) => `/grc/audits/${auditId}/findings`,

// Requirement Findings
GET_REQUIREMENT_FINDINGS: (reqId: string) => `/grc/requirements/${reqId}/findings`,
```

## Migration Strategy

### Migration Order

1. Create `grc_audit_requirements` table
2. Create `grc_issue_requirements` table
3. Add `audit_id` column to `grc_issues` table

### Rollback Plan

If issues arise:
1. Drop `audit_id` column from `grc_issues`
2. Drop `grc_issue_requirements` table
3. Drop `grc_audit_requirements` table

## Testing Considerations

- Unit tests for new service methods
- E2E tests for new endpoints
- Verify existing audit CRUD still works
- Verify existing issue CRUD still works
- Test multi-tenant isolation for new tables

## Future Enhancements (Out of Scope)

- Evidence linking to audit requirements
- Audit criteria vs requirements distinction
- Audit report generation with requirement coverage
- Bulk import of requirements to audit scope
