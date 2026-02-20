# Audit Standards Data Model - Phase 2

## Overview

This document specifies the database schema and entity definitions for the standards-driven audit system. All entities follow the existing GRC platform conventions including multi-tenancy, soft deletion, and audit logging.

## New Entities

### 1. Standard Entity

The `Standard` entity represents a compliance/regulatory standard as a first-class citizen.

#### Table: `grc_standards`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| tenant_id | UUID | NO | - | Tenant isolation |
| code | VARCHAR(50) | NO | - | Unique code (e.g., 'iso27001', 'cobit') |
| name | VARCHAR(255) | NO | - | Display name (e.g., 'ISO/IEC 27001:2022') |
| short_name | VARCHAR(100) | YES | - | Short name (e.g., 'ISO 27001') |
| version | VARCHAR(50) | NO | - | Version identifier (e.g., '2022', '2019') |
| description | TEXT | YES | - | Standard description |
| publisher | VARCHAR(255) | YES | - | Publishing organization (e.g., 'ISO', 'ISACA') |
| effective_date | DATE | YES | - | When the standard became effective |
| domain | VARCHAR(100) | YES | - | Domain classification (security, privacy, itservice, quality) |
| is_active | BOOLEAN | NO | true | Whether standard is available for selection |
| metadata | JSONB | YES | - | Additional metadata |
| created_at | TIMESTAMP | NO | now() | Creation timestamp |
| updated_at | TIMESTAMP | NO | now() | Last update timestamp |
| created_by | UUID | YES | - | User who created |
| updated_by | UUID | YES | - | User who last updated |
| is_deleted | BOOLEAN | NO | false | Soft delete flag |

**Indexes:**
- `UNIQUE (tenant_id, code, version)` - Unique standard per tenant
- `INDEX (tenant_id, is_active, is_deleted)`
- `INDEX (tenant_id, domain)`

#### TypeORM Entity: `Standard`

```typescript
// DRAFT - NOT USED YET
// File: backend-nest/src/grc/entities/standard.entity.ts

import { Entity, Column, ManyToOne, JoinColumn, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';

export enum StandardDomain {
  SECURITY = 'security',
  PRIVACY = 'privacy',
  IT_SERVICE = 'itservice',
  QUALITY = 'quality',
  GOVERNANCE = 'governance',
  CONTINUITY = 'continuity',
}

@Entity('grc_standards')
@Index(['tenantId', 'code', 'version'], { unique: true })
@Index(['tenantId', 'isActive', 'isDeleted'])
@Index(['tenantId', 'domain'])
export class Standard extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'short_name', type: 'varchar', length: 100, nullable: true })
  shortName: string | null;

  @Column({ type: 'varchar', length: 50 })
  version: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  publisher: string | null;

  @Column({ name: 'effective_date', type: 'date', nullable: true })
  effectiveDate: Date | null;

  @Column({
    type: 'enum',
    enum: StandardDomain,
    nullable: true,
  })
  domain: StandardDomain | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @OneToMany(() => StandardClause, (clause) => clause.standard)
  clauses: StandardClause[];

  @OneToMany(() => AuditScopeStandard, (scope) => scope.standard)
  auditScopes: AuditScopeStandard[];
}
```

---

### 2. StandardClause Entity

The `StandardClause` entity represents a hierarchical clause/control/article within a standard.

#### Table: `grc_standard_clauses`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| tenant_id | UUID | NO | - | Tenant isolation |
| standard_id | UUID | NO | - | FK to grc_standards |
| parent_clause_id | UUID | YES | - | FK to self (for hierarchy) |
| code | VARCHAR(50) | NO | - | Clause code (e.g., 'A.5.1', '4.1') |
| title | VARCHAR(500) | NO | - | Clause title |
| description | TEXT | YES | - | Short description |
| description_long | TEXT | YES | - | Detailed guidance text |
| level | INTEGER | NO | 1 | Hierarchy level (1=domain, 2=clause, 3=sub-clause) |
| sort_order | INTEGER | NO | 0 | Display order within parent |
| path | VARCHAR(500) | YES | - | Materialized path for efficient queries (e.g., '/A/A.5/A.5.1') |
| is_auditable | BOOLEAN | NO | true | Whether clause can be audited |
| metadata | JSONB | YES | - | Additional metadata (tags, references) |
| created_at | TIMESTAMP | NO | now() | Creation timestamp |
| updated_at | TIMESTAMP | NO | now() | Last update timestamp |
| created_by | UUID | YES | - | User who created |
| updated_by | UUID | YES | - | User who last updated |
| is_deleted | BOOLEAN | NO | false | Soft delete flag |

**Indexes:**
- `UNIQUE (tenant_id, standard_id, code)` - Unique clause code per standard
- `INDEX (tenant_id, standard_id, parent_clause_id)`
- `INDEX (tenant_id, standard_id, level)`
- `INDEX (tenant_id, path)` - For hierarchical queries

#### TypeORM Entity: `StandardClause`

```typescript
// DRAFT - NOT USED YET
// File: backend-nest/src/grc/entities/standard-clause.entity.ts

import { Entity, Column, ManyToOne, JoinColumn, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { Standard } from './standard.entity';

export enum ClauseLevel {
  DOMAIN = 1,
  CLAUSE = 2,
  SUB_CLAUSE = 3,
  CONTROL = 4,
}

@Entity('grc_standard_clauses')
@Index(['tenantId', 'standardId', 'code'], { unique: true })
@Index(['tenantId', 'standardId', 'parentClauseId'])
@Index(['tenantId', 'standardId', 'level'])
@Index(['tenantId', 'path'])
export class StandardClause extends BaseEntity {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'standard_id', type: 'uuid' })
  standardId: string;

  @ManyToOne(() => Standard, (standard) => standard.clauses, { nullable: false })
  @JoinColumn({ name: 'standard_id' })
  standard: Standard;

  @Column({ name: 'parent_clause_id', type: 'uuid', nullable: true })
  parentClauseId: string | null;

  @ManyToOne(() => StandardClause, (clause) => clause.children, { nullable: true })
  @JoinColumn({ name: 'parent_clause_id' })
  parentClause: StandardClause | null;

  @OneToMany(() => StandardClause, (clause) => clause.parentClause)
  children: StandardClause[];

  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'description_long', type: 'text', nullable: true })
  descriptionLong: string | null;

  @Column({ type: 'integer', default: 1 })
  level: number;

  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  path: string | null;

  @Column({ name: 'is_auditable', type: 'boolean', default: true })
  isAuditable: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @OneToMany(() => AuditScopeClause, (scope) => scope.clause)
  auditScopes: AuditScopeClause[];

  @OneToMany(() => GrcIssueClause, (ic) => ic.clause)
  issueClauses: GrcIssueClause[];
}
```

---

### 3. AuditScopeStandard Entity

Links an audit to a standard, defining whether the full standard or selected clauses are in scope.

#### Table: `grc_audit_scope_standards`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| tenant_id | UUID | NO | - | Tenant isolation |
| audit_id | UUID | NO | - | FK to grc_audits |
| standard_id | UUID | NO | - | FK to grc_standards |
| scope_type | VARCHAR(20) | NO | 'full' | 'full' or 'partial' |
| is_locked | BOOLEAN | NO | false | Locked when audit starts |
| locked_at | TIMESTAMP | YES | - | When scope was locked |
| locked_by | UUID | YES | - | User who locked |
| notes | TEXT | YES | - | Optional notes |
| created_at | TIMESTAMP | NO | now() | Creation timestamp |
| updated_at | TIMESTAMP | NO | now() | Last update timestamp |
| created_by | UUID | YES | - | User who created |
| updated_by | UUID | YES | - | User who last updated |

**Indexes:**
- `UNIQUE (tenant_id, audit_id, standard_id)` - One standard per audit
- `INDEX (tenant_id, audit_id)`
- `INDEX (tenant_id, standard_id)`

#### TypeORM Entity: `AuditScopeStandard`

```typescript
// DRAFT - NOT USED YET
// File: backend-nest/src/grc/entities/audit-scope-standard.entity.ts

import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { MappingEntityBase } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { GrcAudit } from './grc-audit.entity';
import { Standard } from './standard.entity';

export enum ScopeType {
  FULL = 'full',
  PARTIAL = 'partial',
}

@Entity('grc_audit_scope_standards')
@Index(['tenantId', 'auditId', 'standardId'], { unique: true })
@Index(['tenantId', 'auditId'])
@Index(['tenantId', 'standardId'])
export class AuditScopeStandard extends MappingEntityBase {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'audit_id', type: 'uuid' })
  auditId: string;

  @ManyToOne(() => GrcAudit, { nullable: false })
  @JoinColumn({ name: 'audit_id' })
  audit: GrcAudit;

  @Column({ name: 'standard_id', type: 'uuid' })
  standardId: string;

  @ManyToOne(() => Standard, (standard) => standard.auditScopes, { nullable: false })
  @JoinColumn({ name: 'standard_id' })
  standard: Standard;

  @Column({
    name: 'scope_type',
    type: 'enum',
    enum: ScopeType,
    default: ScopeType.FULL,
  })
  scopeType: ScopeType;

  @Column({ name: 'is_locked', type: 'boolean', default: false })
  isLocked: boolean;

  @Column({ name: 'locked_at', type: 'timestamp', nullable: true })
  lockedAt: Date | null;

  @Column({ name: 'locked_by', type: 'uuid', nullable: true })
  lockedBy: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
```

---

### 4. AuditScopeClause Entity

Links an audit to specific clauses within a standard (used when scope_type is 'partial').

#### Table: `grc_audit_scope_clauses`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| tenant_id | UUID | NO | - | Tenant isolation |
| audit_id | UUID | NO | - | FK to grc_audits |
| clause_id | UUID | NO | - | FK to grc_standard_clauses |
| status | VARCHAR(50) | YES | 'planned' | Testing status |
| notes | TEXT | YES | - | Optional notes |
| tested_at | TIMESTAMP | YES | - | When clause was tested |
| tested_by | UUID | YES | - | User who tested |
| created_at | TIMESTAMP | NO | now() | Creation timestamp |
| updated_at | TIMESTAMP | NO | now() | Last update timestamp |
| created_by | UUID | YES | - | User who created |
| updated_by | UUID | YES | - | User who last updated |

**Status Values:**
- `planned` - Clause is in scope but not yet tested
- `in_progress` - Testing is underway
- `tested` - Testing complete
- `not_applicable` - Clause determined to be N/A
- `deferred` - Testing deferred to future audit

**Indexes:**
- `UNIQUE (tenant_id, audit_id, clause_id)` - One clause per audit
- `INDEX (tenant_id, audit_id)`
- `INDEX (tenant_id, clause_id)`
- `INDEX (tenant_id, audit_id, status)`

#### TypeORM Entity: `AuditScopeClause`

```typescript
// DRAFT - NOT USED YET
// File: backend-nest/src/grc/entities/audit-scope-clause.entity.ts

import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { MappingEntityBase } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { GrcAudit } from './grc-audit.entity';
import { StandardClause } from './standard-clause.entity';

export enum ClauseTestingStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  TESTED = 'tested',
  NOT_APPLICABLE = 'not_applicable',
  DEFERRED = 'deferred',
}

@Entity('grc_audit_scope_clauses')
@Index(['tenantId', 'auditId', 'clauseId'], { unique: true })
@Index(['tenantId', 'auditId'])
@Index(['tenantId', 'clauseId'])
@Index(['tenantId', 'auditId', 'status'])
export class AuditScopeClause extends MappingEntityBase {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'audit_id', type: 'uuid' })
  auditId: string;

  @ManyToOne(() => GrcAudit, { nullable: false })
  @JoinColumn({ name: 'audit_id' })
  audit: GrcAudit;

  @Column({ name: 'clause_id', type: 'uuid' })
  clauseId: string;

  @ManyToOne(() => StandardClause, (clause) => clause.auditScopes, { nullable: false })
  @JoinColumn({ name: 'clause_id' })
  clause: StandardClause;

  @Column({
    type: 'enum',
    enum: ClauseTestingStatus,
    default: ClauseTestingStatus.PLANNED,
    nullable: true,
  })
  status: ClauseTestingStatus | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'tested_at', type: 'timestamp', nullable: true })
  testedAt: Date | null;

  @Column({ name: 'tested_by', type: 'uuid', nullable: true })
  testedBy: string | null;
}
```

---

### 5. GrcIssueClause Entity

Links findings (issues) to standard clauses for traceability.

#### Table: `grc_issue_clauses`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| tenant_id | UUID | NO | - | Tenant isolation |
| issue_id | UUID | NO | - | FK to grc_issues |
| clause_id | UUID | NO | - | FK to grc_standard_clauses |
| notes | TEXT | YES | - | Optional notes |
| created_at | TIMESTAMP | NO | now() | Creation timestamp |
| updated_at | TIMESTAMP | NO | now() | Last update timestamp |
| created_by | UUID | YES | - | User who created |
| updated_by | UUID | YES | - | User who last updated |

**Indexes:**
- `UNIQUE (tenant_id, issue_id, clause_id)` - One link per issue-clause pair
- `INDEX (tenant_id, issue_id)`
- `INDEX (tenant_id, clause_id)`

#### TypeORM Entity: `GrcIssueClause`

```typescript
// DRAFT - NOT USED YET
// File: backend-nest/src/grc/entities/grc-issue-clause.entity.ts

import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { MappingEntityBase } from '../../common/entities';
import { Tenant } from '../../tenants/tenant.entity';
import { GrcIssue } from './grc-issue.entity';
import { StandardClause } from './standard-clause.entity';

@Entity('grc_issue_clauses')
@Index(['tenantId', 'issueId', 'clauseId'], { unique: true })
@Index(['tenantId', 'issueId'])
@Index(['tenantId', 'clauseId'])
export class GrcIssueClause extends MappingEntityBase {
  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'issue_id', type: 'uuid' })
  issueId: string;

  @ManyToOne(() => GrcIssue, { nullable: false })
  @JoinColumn({ name: 'issue_id' })
  issue: GrcIssue;

  @Column({ name: 'clause_id', type: 'uuid' })
  clauseId: string;

  @ManyToOne(() => StandardClause, (clause) => clause.issueClauses, { nullable: false })
  @JoinColumn({ name: 'clause_id' })
  clause: StandardClause;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
```

---

## Entity Modifications (Existing Entities)

### GrcAudit Entity

Add relations to new scope entities:

```typescript
// DRAFT - Additions to existing GrcAudit entity

@OneToMany(() => AuditScopeStandard, (scope) => scope.audit)
scopeStandards: AuditScopeStandard[];

@OneToMany(() => AuditScopeClause, (scope) => scope.audit)
scopeClauses: AuditScopeClause[];
```

### GrcIssue Entity

Add relation to clause linkages:

```typescript
// DRAFT - Additions to existing GrcIssue entity

@OneToMany(() => GrcIssueClause, (ic) => ic.issue)
issueClauses: GrcIssueClause[];
```

---

## Seed Data Structure

### Standards Seed Data

```typescript
// DRAFT - NOT USED YET
// File: backend-nest/src/scripts/seed-standards.ts

const STANDARDS_SEED_DATA = [
  {
    code: 'iso27001',
    name: 'ISO/IEC 27001:2022',
    shortName: 'ISO 27001',
    version: '2022',
    description: 'Information security management systems - Requirements',
    publisher: 'ISO/IEC',
    domain: 'security',
  },
  {
    code: 'iso22301',
    name: 'ISO 22301:2019',
    shortName: 'ISO 22301',
    version: '2019',
    description: 'Business continuity management systems - Requirements',
    publisher: 'ISO',
    domain: 'continuity',
  },
  {
    code: 'iso20000',
    name: 'ISO/IEC 20000-1:2018',
    shortName: 'ISO 20000',
    version: '2018',
    description: 'IT service management system requirements',
    publisher: 'ISO/IEC',
    domain: 'itservice',
  },
  {
    code: 'cobit',
    name: 'COBIT 2019',
    shortName: 'COBIT',
    version: '2019',
    description: 'Governance and management of enterprise IT',
    publisher: 'ISACA',
    domain: 'governance',
  },
  {
    code: 'itil',
    name: 'ITIL 4',
    shortName: 'ITIL',
    version: '4',
    description: 'IT service management best practices',
    publisher: 'Axelos',
    domain: 'itservice',
  },
];
```

### ISO 27001 Clauses Example

```typescript
// DRAFT - Example clause structure for ISO 27001:2022

const ISO27001_CLAUSES = [
  // Annex A - Organizational controls
  {
    code: 'A.5',
    title: 'Organizational controls',
    level: 1,
    children: [
      {
        code: 'A.5.1',
        title: 'Policies for information security',
        level: 2,
        description: 'Information security policy and topic-specific policies shall be defined...',
      },
      {
        code: 'A.5.2',
        title: 'Information security roles and responsibilities',
        level: 2,
        description: 'Information security roles and responsibilities shall be defined and allocated...',
      },
      // ... more clauses
    ],
  },
  // Annex A - People controls
  {
    code: 'A.6',
    title: 'People controls',
    level: 1,
    children: [
      {
        code: 'A.6.1',
        title: 'Screening',
        level: 2,
        description: 'Background verification checks on all candidates...',
      },
      // ... more clauses
    ],
  },
  // ... more domains
];
```

---

## Migration Scripts

### Create Tables Migration

```sql
-- DRAFT - NOT USED YET
-- Migration: Create Phase 2 tables

-- 1. Create grc_standards table
CREATE TABLE grc_standards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    short_name VARCHAR(100),
    version VARCHAR(50) NOT NULL,
    description TEXT,
    publisher VARCHAR(255),
    effective_date DATE,
    domain VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (tenant_id, code, version)
);

CREATE INDEX idx_grc_standards_tenant_active ON grc_standards(tenant_id, is_active, is_deleted);
CREATE INDEX idx_grc_standards_tenant_domain ON grc_standards(tenant_id, domain);

-- 2. Create grc_standard_clauses table
CREATE TABLE grc_standard_clauses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    standard_id UUID NOT NULL REFERENCES grc_standards(id),
    parent_clause_id UUID REFERENCES grc_standard_clauses(id),
    code VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    description_long TEXT,
    level INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    path VARCHAR(500),
    is_auditable BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (tenant_id, standard_id, code)
);

CREATE INDEX idx_grc_standard_clauses_parent ON grc_standard_clauses(tenant_id, standard_id, parent_clause_id);
CREATE INDEX idx_grc_standard_clauses_level ON grc_standard_clauses(tenant_id, standard_id, level);
CREATE INDEX idx_grc_standard_clauses_path ON grc_standard_clauses(tenant_id, path);

-- 3. Create grc_audit_scope_standards table
CREATE TABLE grc_audit_scope_standards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    audit_id UUID NOT NULL REFERENCES grc_audits(id),
    standard_id UUID NOT NULL REFERENCES grc_standards(id),
    scope_type VARCHAR(20) NOT NULL DEFAULT 'full',
    is_locked BOOLEAN NOT NULL DEFAULT false,
    locked_at TIMESTAMP,
    locked_by UUID,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    UNIQUE (tenant_id, audit_id, standard_id)
);

CREATE INDEX idx_grc_audit_scope_standards_audit ON grc_audit_scope_standards(tenant_id, audit_id);
CREATE INDEX idx_grc_audit_scope_standards_standard ON grc_audit_scope_standards(tenant_id, standard_id);

-- 4. Create grc_audit_scope_clauses table
CREATE TABLE grc_audit_scope_clauses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    audit_id UUID NOT NULL REFERENCES grc_audits(id),
    clause_id UUID NOT NULL REFERENCES grc_standard_clauses(id),
    status VARCHAR(50) DEFAULT 'planned',
    notes TEXT,
    tested_at TIMESTAMP,
    tested_by UUID,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    UNIQUE (tenant_id, audit_id, clause_id)
);

CREATE INDEX idx_grc_audit_scope_clauses_audit ON grc_audit_scope_clauses(tenant_id, audit_id);
CREATE INDEX idx_grc_audit_scope_clauses_clause ON grc_audit_scope_clauses(tenant_id, clause_id);
CREATE INDEX idx_grc_audit_scope_clauses_status ON grc_audit_scope_clauses(tenant_id, audit_id, status);

-- 5. Create grc_issue_clauses table
CREATE TABLE grc_issue_clauses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    issue_id UUID NOT NULL REFERENCES grc_issues(id),
    clause_id UUID NOT NULL REFERENCES grc_standard_clauses(id),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    created_by UUID,
    updated_by UUID,
    UNIQUE (tenant_id, issue_id, clause_id)
);

CREATE INDEX idx_grc_issue_clauses_issue ON grc_issue_clauses(tenant_id, issue_id);
CREATE INDEX idx_grc_issue_clauses_clause ON grc_issue_clauses(tenant_id, clause_id);
```

---

## Query Patterns

### Get Clause Hierarchy for Standard

```sql
-- Get all clauses for a standard in hierarchical order
WITH RECURSIVE clause_tree AS (
    SELECT id, code, title, level, parent_clause_id, sort_order, 1 as depth
    FROM grc_standard_clauses
    WHERE tenant_id = :tenantId 
      AND standard_id = :standardId 
      AND parent_clause_id IS NULL
      AND is_deleted = false
    
    UNION ALL
    
    SELECT c.id, c.code, c.title, c.level, c.parent_clause_id, c.sort_order, ct.depth + 1
    FROM grc_standard_clauses c
    JOIN clause_tree ct ON c.parent_clause_id = ct.id
    WHERE c.tenant_id = :tenantId AND c.is_deleted = false
)
SELECT * FROM clause_tree
ORDER BY depth, sort_order;
```

### Get Audit Scope with Clauses

```sql
-- Get all in-scope clauses for an audit
SELECT 
    ass.id as scope_standard_id,
    s.code as standard_code,
    s.name as standard_name,
    ass.scope_type,
    asc.id as scope_clause_id,
    sc.code as clause_code,
    sc.title as clause_title,
    asc.status as clause_status
FROM grc_audit_scope_standards ass
JOIN grc_standards s ON ass.standard_id = s.id
LEFT JOIN grc_audit_scope_clauses asc ON asc.audit_id = ass.audit_id
LEFT JOIN grc_standard_clauses sc ON asc.clause_id = sc.id
WHERE ass.tenant_id = :tenantId 
  AND ass.audit_id = :auditId
ORDER BY s.code, sc.sort_order;
```

### Get Findings by Clause

```sql
-- Get all findings linked to a specific clause across all audits
SELECT 
    i.id as issue_id,
    i.title as issue_title,
    i.severity,
    i.status,
    a.id as audit_id,
    a.name as audit_name,
    a.status as audit_status
FROM grc_issue_clauses ic
JOIN grc_issues i ON ic.issue_id = i.id
LEFT JOIN grc_audits a ON i.audit_id = a.id
WHERE ic.tenant_id = :tenantId 
  AND ic.clause_id = :clauseId
  AND i.is_deleted = false
ORDER BY i.created_at DESC;
```

---

## Validation Rules

### Scope Locking

1. Scope can only be modified when audit status is `planned`
2. When audit status changes to `in_progress`, all scope standards are locked
3. Locked scope cannot be modified unless audit is reverted to `planned`

### Clause Selection

1. When `scope_type` is `full`, all auditable clauses are automatically in scope
2. When `scope_type` is `partial`, only explicitly selected clauses are in scope
3. Child clauses can only be selected if parent clause is selected (optional rule)

### Finding-Clause Linkage

1. A finding can be linked to multiple clauses
2. Clauses must belong to standards that are in scope for the audit
3. Linkage can be modified until finding is closed

---

## Performance Considerations

### Materialized Path

The `path` column in `grc_standard_clauses` enables efficient hierarchical queries:
- Format: `/root/parent/child` (e.g., `/A/A.5/A.5.1`)
- Enables `LIKE '/A/A.5/%'` queries for subtree selection
- Updated automatically when clause hierarchy changes

### Indexing Strategy

- Composite indexes on (tenant_id, foreign_key) for all join tables
- Partial indexes on `is_deleted = false` for frequently queried tables
- GIN index on `metadata` JSONB columns for flexible queries

### Caching Recommendations

- Cache standard and clause hierarchies (rarely change)
- Cache audit scope after locking (immutable)
- Invalidate cache on standard/clause updates
