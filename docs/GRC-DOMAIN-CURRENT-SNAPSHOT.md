# GRC Domain Current Snapshot

This document provides an inventory of the current database schemas in both the Express backend and NestJS backend, serving as a baseline for the unified GRC domain model design.

## Express Backend Schema (backend/)

The Express backend uses SQLite (with PostgreSQL compatibility layer) and defines the following tables in `backend/database/connection.js`:

### Core GRC Tables

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `users` | id (INTEGER PK), username, email, password, role, first_name, last_name, department, is_active, created_at, updated_at | User accounts with role-based access |
| `policies` | id (INTEGER PK), title, description, category, version, status, owner_id (FK→users), effective_date, review_date, content, created_at, updated_at | Governance policies with lifecycle management |
| `risks` | id (INTEGER PK), title, description, category, severity, likelihood, impact, risk_score, status, owner_id (FK→users), assigned_to (FK→users), mitigation_plan, due_date, created_at, updated_at | Risk register with calculated scores |
| `compliance_requirements` | id (INTEGER PK), title, description, regulation, category, status, due_date, owner_id (FK→users), assigned_to (FK→users), evidence, created_at, updated_at | Regulatory compliance tracking |
| `audit_logs` | id (INTEGER PK), user_id (FK→users), action, entity_type, entity_id, old_values, new_values, ip_address, user_agent, created_at | Activity audit trail |
| `organizations` | id (INTEGER PK), name, description, type, parent_id (FK→self), created_at, updated_at | Organizational hierarchy |
| `risk_assessments` | id (INTEGER PK), risk_id (FK→risks), assessor_id (FK→users), assessment_date, likelihood_score, impact_score, overall_score, notes, created_at | Point-in-time risk evaluations |

### Express Schema Characteristics

- **Primary Keys:** INTEGER with AUTOINCREMENT
- **Foreign Keys:** Simple integer references to users table
- **Timestamps:** DATETIME with DEFAULT CURRENT_TIMESTAMP
- **Status Fields:** TEXT with string values (e.g., 'draft', 'open', 'pending')
- **Multi-tenancy:** NOT IMPLEMENTED - single-tenant design
- **Risk Scoring:** Calculated as severity × likelihood × impact (1-64 range)

### Missing GRC Concepts in Express

The current Express schema lacks several enterprise GRC concepts:

1. **Controls** - No dedicated table for control activities
2. **Control Mappings** - No risk-to-control or policy-to-control relationships
3. **Issues/Findings** - No formal issue tracking beyond audit logs
4. **CAPA** - No corrective/preventive action tracking
5. **Evidence Management** - Only a text field in compliance_requirements
6. **Multi-tenancy** - No tenant isolation

## NestJS Backend Schema (backend-nest/)

The NestJS backend uses TypeORM with PostgreSQL and defines entities with UUID primary keys and multi-tenancy support.

### Existing NestJS Entities

| Entity | Table Name | Key Columns | Purpose |
|--------|------------|-------------|---------|
| `User` | `nest_users` | id (UUID), email, passwordHash, role (enum), firstName, lastName, isActive, tenantId (FK), createdAt, updatedAt | Multi-tenant user accounts |
| `Tenant` | `nest_tenants` | id (UUID), name, description, isActive, createdAt, updatedAt | Tenant/organization isolation |
| `AuditLog` | `nest_audit_logs` | id (UUID), tenantId, userId, action, resource, resourceId, statusCode, metadata (JSONB), ipAddress, createdAt | Request-level audit logging |
| `SystemSetting` | `nest_system_settings` | id (UUID), key (unique), value, description, category, createdAt, updatedAt | Global system configuration |
| `TenantSetting` | `nest_tenant_settings` | id (UUID), tenantId (FK), key, value, description, createdAt, updatedAt | Tenant-specific settings |

### NestJS Schema Characteristics

- **Primary Keys:** UUID (v4)
- **Foreign Keys:** UUID references with proper TypeORM relations
- **Timestamps:** TypeORM @CreateDateColumn/@UpdateDateColumn
- **Enums:** TypeScript enums stored as PostgreSQL enum types
- **Multi-tenancy:** IMPLEMENTED via tenantId on all tenant-scoped entities
- **JSONB:** Used for flexible metadata storage

### NestJS Infrastructure Already Available

1. **MultiTenantServiceBase<T>** - Base service class for tenant-aware CRUD
2. **TenantGuard** - Request guard enforcing x-tenant-id header
3. **RolesGuard** - RBAC enforcement via @Roles() decorator
4. **AuditInterceptor** - Global request/response audit logging
5. **EventEmitter** - Domain event bus for decoupled communication
6. **SettingsService** - System/tenant settings with fallback pattern

## Schema Comparison Summary

| Aspect | Express | NestJS |
|--------|---------|--------|
| Database | SQLite/PostgreSQL | PostgreSQL |
| Primary Keys | INTEGER | UUID |
| Multi-tenancy | No | Yes (tenantId) |
| User Roles | TEXT field | TypeScript enum |
| Audit Logging | Basic table | Event-driven with JSONB |
| Settings | None | System + Tenant levels |
| ORM | Raw SQL | TypeORM |

## Implications for GRC Domain Model

### Non-Destructive Approach

The new GRC domain model in NestJS will:

1. **Use new table names** with `grc_` prefix to avoid conflicts
2. **Use UUID primary keys** consistent with NestJS conventions
3. **Include tenantId** on all GRC entities for multi-tenancy
4. **Not modify** existing Express tables (risks, policies, compliance_requirements)
5. **Enable future migration** from Express tables to NestJS tables

### Data Migration Path (Future Sprint)

When ready to migrate data from Express to NestJS:

1. Create migration scripts to copy data from Express tables to NestJS tables
2. Generate UUIDs for migrated records
3. Map integer user IDs to UUID user IDs
4. Assign tenantId to all migrated records
5. Validate data integrity post-migration
6. Update frontend to use NestJS endpoints

This migration is OUT OF SCOPE for the current sprint, which focuses on establishing the domain model foundation.
