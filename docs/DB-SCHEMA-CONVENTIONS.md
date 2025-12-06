# Database Schema Conventions

This document defines the database schema conventions for the GRC Platform. All entities and database objects must follow these conventions to ensure consistency, maintainability, and compatibility across the system.

## Table Naming Conventions

All table names follow these rules:

1. **snake_case format**: Use lowercase letters with underscores separating words
2. **Plural form**: Table names should be plural (e.g., `grc_risks`, `nest_users`)
3. **Prefix for domain**: GRC domain tables use `grc_` prefix, NestJS-specific tables use `nest_` prefix
4. **History tables**: Append `_history` suffix (e.g., `grc_risks_history`)
5. **Mapping tables**: Use format `{entity1}_{entity2}` (e.g., `grc_risk_controls`)

### Examples

| Entity | Table Name |
|--------|------------|
| Risk | `grc_risks` |
| Policy | `grc_policies` |
| Requirement | `grc_requirements` |
| Control | `grc_controls` |
| User | `nest_users` |
| Tenant | `nest_tenants` |
| Audit Log | `nest_audit_logs` |
| Risk-Control Mapping | `grc_risk_controls` |
| Risk History | `grc_risks_history` |

## Column Naming Conventions

All column names follow these rules:

1. **snake_case format**: Use lowercase letters with underscores separating words
2. **Foreign keys**: End with `_id` suffix (e.g., `tenant_id`, `owner_user_id`)
3. **Timestamps**: End with `_at` suffix (e.g., `created_at`, `updated_at`, `deleted_at`)
4. **Boolean flags**: Use `is_` prefix (e.g., `is_deleted`, `is_active`)
5. **Dates (non-timestamp)**: End with `_date` suffix (e.g., `due_date`, `effective_date`)

### Standard Columns

Every entity should include these standard columns from `BaseEntity`:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key, auto-generated |
| `tenant_id` | UUID | Multi-tenant isolation key |
| `created_at` | TIMESTAMP | Record creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |
| `created_by` | UUID | User who created the record |
| `updated_by` | UUID | User who last updated the record |
| `is_deleted` | BOOLEAN | Soft delete flag (default: false) |

### Foreign Key Naming

Foreign keys should clearly indicate the relationship:

| Relationship | Column Name |
|--------------|-------------|
| Owner (User) | `owner_user_id` |
| Assigned To (User) | `assigned_to_user_id` |
| Approved By (User) | `approved_by_user_id` |
| Parent Risk | `risk_id` |
| Parent Policy | `policy_id` |
| Parent Control | `control_id` |
| Parent Requirement | `requirement_id` |

## Index Naming Conventions

Index names follow this pattern: `idx_{table}_{column(s)}`

### Examples

| Index Type | Name Pattern | Example |
|------------|--------------|---------|
| Single column | `idx_{table}_{column}` | `idx_grc_risks_tenant_id` |
| Composite | `idx_{table}_{col1}_{col2}` | `idx_grc_risks_tenant_id_status` |
| Unique | `uq_{table}_{column(s)}` | `uq_grc_policies_tenant_id_code` |

## Enum Conventions

All enums are defined in TypeScript and mapped to PostgreSQL enum types:

1. **Enum names**: PascalCase (e.g., `RiskSeverity`, `PolicyStatus`)
2. **Enum values**: lowercase snake_case strings (e.g., `'low'`, `'in_progress'`)
3. **Location**: All enums defined in `src/grc/enums/index.ts`

### Standard Enums

| Enum | Values | Usage |
|------|--------|-------|
| `CommonStatus` | draft, active, inactive, archived | Generic lifecycle status |
| `AuditAction` | create, update, delete | Audit log actions |
| `RiskSeverity` | low, medium, high, critical | Risk/Issue severity levels |
| `PolicyStatus` | draft, under_review, approved, active, retired | Policy lifecycle |
| `RequirementType` | regulatory, contractual, internal, industry_standard, best_practice | Requirement classification |
| `RequirementStatus` | not_started, in_progress, implemented, verified, non_compliant | Requirement progress |

## BaseEntity Classes

The platform provides three base entity classes:

### BaseEntity

For all tenant-scoped domain entities (Risk, Policy, Requirement, Control, Issue, CAPA, Evidence):

```typescript
abstract class BaseEntity {
  id: string;           // UUID primary key
  tenantId: string;     // Multi-tenant isolation
  createdAt: Date;      // Creation timestamp
  updatedAt: Date;      // Last update timestamp
  createdBy: string;    // Creator user ID
  updatedBy: string;    // Last updater user ID
  isDeleted: boolean;   // Soft delete flag
}
```

### BaseEntityWithoutTenant

For entities that don't require tenant isolation (e.g., Tenant itself):

```typescript
abstract class BaseEntityWithoutTenant {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  isDeleted: boolean;
}
```

### MappingEntityBase

For many-to-many mapping entities (e.g., RiskControl, PolicyControl):

```typescript
abstract class MappingEntityBase {
  id: string;
  tenantId: string;
  createdAt: Date;
}
```

## Soft Delete Pattern

All entities implement soft delete:

1. Records are never physically deleted from the database
2. The `is_deleted` column is set to `true` when "deleted"
3. All queries must filter by `is_deleted = false` to exclude deleted records
4. History tables preserve the complete audit trail

### Query Pattern

```typescript
// Always filter out deleted records
const activeRisks = await repository.find({
  where: { tenantId, isDeleted: false }
});
```

## Multi-Tenancy Pattern

All tenant-scoped entities include:

1. `tenant_id` column with index
2. Foreign key relationship to `nest_tenants` table
3. All queries must include tenant filter

### Query Pattern

```typescript
// Always include tenant filter
const risks = await repository.find({
  where: { tenantId: currentTenantId, isDeleted: false }
});
```

## History Tables

History tables track all changes to critical entities:

### Structure

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | History record ID |
| `entity_id` | UUID | Original entity ID |
| `tenant_id` | UUID | Tenant ID |
| `action` | ENUM | create, update, delete |
| `before_data` | JSONB | Entity state before change |
| `after_data` | JSONB | Entity state after change |
| `changed_by` | UUID | User who made the change |
| `changed_at` | TIMESTAMP | When the change occurred |

### Entities with History

- `grc_risks` → `grc_risks_history`
- `grc_policies` → `grc_policies_history`
- `grc_requirements` → `grc_requirements_history`
- `nest_users` → `nest_users_history`

## TypeORM Entity Decorators

### Standard Entity Definition

```typescript
@Entity('grc_risks')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'severity'])
export class GrcRisk extends BaseEntity {
  // Entity-specific columns
}
```

### Column Decorators

```typescript
// Foreign key with snake_case name
@Column({ name: 'owner_user_id', type: 'uuid', nullable: true })
ownerUserId: string | null;

// Timestamp with snake_case name
@Column({ name: 'due_date', type: 'date', nullable: true })
dueDate: Date | null;

// Enum column
@Column({
  type: 'enum',
  enum: RiskSeverity,
  default: RiskSeverity.MEDIUM,
})
severity: RiskSeverity;
```

## Migration Guidelines

1. **Never modify existing migrations**: Create new migrations for changes
2. **Use descriptive names**: `1234567890-add-created-by-to-risks.ts`
3. **Include both up and down**: Always implement rollback
4. **Test from empty database**: Migrations must run cleanly from scratch
5. **Document breaking changes**: Note any schema changes that affect API contracts

## PostgreSQL Compatibility

All schema definitions are compatible with PostgreSQL:

1. Use `uuid` type for IDs (with `uuid-ossp` extension)
2. Use `timestamp with time zone` for timestamps
3. Use `jsonb` for JSON columns (not `json`)
4. Use PostgreSQL enum types for enums
5. Use `text` for unlimited strings, `varchar(n)` for limited

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-06 | Initial schema conventions document |
