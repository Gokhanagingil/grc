# DB BASELINE – GRC Platform (Backend Nest)

**Analysis Date:** 2025-01-28  
**Purpose:** Document current database schema, entities, and multi-tenant model before introducing Contract Management and licensing features.

---

## 1. Global DB / TypeORM Setup

### 1.1 Database Configuration

**Location:** `src/config/database.config.ts`

- **Database Type:** Supports both PostgreSQL (primary) and SQLite (fallback/dev)
- **Selection:** Controlled by `DB_ENGINE` env var (`postgres` or `sqlite`, default: `sqlite`)
- **PostgreSQL Config:**
  - Connection: `DATABASE_URL` or individual vars (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`)
  - Schema: `DB_SCHEMA` (default: `public`)
  - SSL: `DB_SSL=true` (optional)
- **SQLite Config:**
  - File: `SQLITE_FILE` (default: `./data/grc.sqlite`)
  - Used when `SAFE_MODE=true` or `DB_ENGINE=sqlite`

### 1.2 Migration Strategy

- **Synchronize:** `false` (always) - migrations are mandatory
- **Migrations Run:** `true` (auto-run on startup)
- **Migration Path:** `src/migrations/*.ts` (dev) or `dist/migrations/*.js` (prod)
- **Entity Discovery:** `autoLoadEntities: true` (automatic via `@Entity()` decorator)

### 1.3 Global Options

- **Naming Strategy:** Default TypeORM (snake_case for columns)
- **Logging:** Controlled by `DB_LOGGING=true` env var
- **Schema Support:** PostgreSQL uses multiple schemas (`tenant`, `auth`, `app`, `audit`, `queue`); SQLite uses flat table names

### 1.4 PostgreSQL Extensions

From bootstrap migration:
- `pgcrypto` (UUID generation)
- `uuid-ossp` (UUID functions)
- `citext` (case-insensitive text for emails)

---

## 2. Tenant & Core Model

### 2.1 Tenant Entity

**Table:** `tenant.tenants` (PostgreSQL) / `tenants` (SQLite)  
**Entity:** `TenantEntity`

- **PK:** `id` (UUID)
- **Unique:** `name`, `slug`
- **Fields:**
  - `name` (text, unique)
  - `slug` (text, unique)
  - `is_active` (boolean, default: true)
- **Timestamps:** `created_at`, `updated_at`
- **Tenant ID:** N/A (root entity)

### 2.2 User Entity

**Table:** `auth.users` (PostgreSQL) / `users` (SQLite)  
**Entity:** `UserEntity`

- **PK:** `id` (UUID)
- **Tenant ID:** `tenant_id` (UUID, FK to `tenant.tenants`)
- **Unique:** `(tenant_id, email)` - tenant-aware email uniqueness
- **Indexes:** `idx_users_tenant_entity`, `idx_users_locked_until`
- **Fields:**
  - `email` (citext/text, unique per tenant)
  - `password_hash` (text)
  - `display_name` (text, nullable)
  - `is_email_verified` (boolean)
  - `is_active` (boolean)
  - `mfa_enabled`, `mfa_secret` (MFA support)
  - `failed_attempts`, `locked_until` (account lockout)
  - `roles` (JSON array, legacy - consider migrating to `user_roles` junction)
- **Timestamps:** `created_at`, `updated_at`

### 2.3 Role Entity

**Table:** `auth.roles` (PostgreSQL) / `roles` (SQLite)  
**Entity:** `RoleEntity`

- **PK:** `id` (UUID)
- **Tenant ID:** `tenant_id` (UUID, FK to `tenant.tenants`)
- **Unique:** `(tenant_id, name)` - tenant-aware role names
- **Index:** `idx_roles_tenant_entity`
- **Fields:**
  - `name` (text)
  - `description` (text, nullable)
  - `is_system` (boolean, default: false)
- **Timestamps:** `created_at`, `updated_at`

### 2.4 Permission Entity

**Table:** `auth.permissions` (PostgreSQL) / `permissions` (SQLite)  
**Entity:** `PermissionEntity`

- **PK:** `id` (UUID)
- **Tenant ID:** ❌ **NO tenant_id** - global permissions (shared across all tenants)
- **Unique:** `code` (global uniqueness)
- **Fields:**
  - `code` (text, unique globally)
  - `description` (text, nullable)
- **Timestamps:** `created_at`, `updated_at`

**Note:** Permissions are global, but roles are tenant-scoped. This allows sharing permission definitions while keeping role assignments tenant-specific.

### 2.5 Role-Permission Junction

**Table:** `auth.role_permissions`  
**Entity:** `RolePermissionEntity`

- **PK:** Composite (`role_id`, `permission_id`)
- **Tenant ID:** Inherited via `role_id` → `roles.tenant_id`
- **Unique:** `(role_id, permission_id)`
- **FKs:** `role_id` → `roles.id`, `permission_id` → `permissions.id`
- **Timestamps:** `created_at`, `updated_at`

### 2.6 User-Role Junction

**Table:** `auth.user_roles`  
**Entity:** `UserRoleEntity`

- **PK:** Composite (`user_id`, `role_id`)
- **Tenant ID:** Inherited via `user_id` → `users.tenant_id` or `role_id` → `roles.tenant_id`
- **Unique:** `(user_id, role_id)`
- **FKs:** `user_id` → `users.id`, `role_id` → `roles.id`
- **Timestamps:** `created_at`, `updated_at`

### 2.7 Refresh Token Entity

**Table:** `auth.refresh_tokens`  
**Entity:** `RefreshTokenEntity`

- **PK:** `id` (UUID, auto-generated)
- **Tenant ID:** ❌ **NO tenant_id** - inherited via `user_id` → `users.tenant_id`
- **Unique:** `jti` (JWT ID)
- **Indexes:** `idx_refresh_tokens_user_id`, `idx_refresh_tokens_expires_at`, `idx_refresh_tokens_jti`
- **Fields:**
  - `user_id` (UUID, FK to `users.id`)
  - `jti` (UUID, unique)
  - `expires_at` (timestamp)
  - `revoked` (boolean)
  - `revoked_at` (timestamp, nullable)
- **Timestamps:** `created_at`, `updated_at`

---

## 3. Risk Domain

### 3.1 Risk Catalog Entity

**Table:** `risk_catalog`  
**Entity:** `RiskCatalogEntity`

- **PK:** `id` (UUID)
- **Tenant ID:** `tenant_id` (UUID)
- **Unique:** `(code, tenant_id)` - tenant-aware codes
- **Indexes:** `idx_risk_catalog_tenant`, `idx_risk_catalog_category`, `idx_risk_catalog_code_tenant`
- **FKs:**
  - `category_id` → `risk_category.id`
- **Fields:**
  - `code` (varchar(100))
  - `title` (text, renamed from `name`)
  - `name` (text, nullable, legacy)
  - `risk_statement`, `root_cause`, `description` (text, nullable)
  - `impact_areas` (JSON array: ImpactArea enum)
  - `default_inherent_likelihood`, `default_inherent_impact`, `default_inherent_score` (int, 1-5)
  - `default_likelihood`, `default_impact` (int, legacy)
  - `control_refs` (JSON array, legacy - use `risk_to_control` junction)
  - `tags` (JSON array)
  - `owner_role` (text, nullable)
  - `schema_version` (int, default: 1)
  - `entity_type`, `entity_filter` (varchar/text, nullable, for auto-generation)
- **Relations:**
  - `OneToMany` → `RiskToControlEntity`, `RiskToPolicyEntity`, `RiskToRequirementEntity`
  - `OneToMany` → `RiskInstanceEntity`, `RiskCatalogAttachmentEntity`
- **Timestamps:** `created_at`, `updated_at`

### 3.2 Risk Instance Entity

**Table:** `risk_instances`  
**Entity:** `RiskInstanceEntity`

- **PK:** `id` (UUID)
- **Tenant ID:** `tenant_id` (UUID)
- **Unique:** `(catalog_id, entity_id, tenant_id)` - one risk instance per catalog+entity per tenant
- **Indexes:** `idx_risk_instances_tenant`, `idx_risk_instances_catalog`, `idx_risk_instances_entity`, `idx_risk_instances_status`, `idx_risk_instances_unique`
- **FKs:**
  - `catalog_id` → `risk_catalog.id` (CASCADE delete)
  - `entity_id` → `entities.id`
- **Fields:**
  - `entity_type` (enum: EntityType - Application, Database, Process, etc., nullable, legacy)
  - `description` (text, nullable)
  - **Inherent Risk:** `inherent_likelihood`, `inherent_impact`, `inherent_score` (int, 1-5)
  - **Residual Risk:** `residual_likelihood`, `residual_impact`, `residual_score` (int, nullable, 1-5)
  - **Legacy:** `likelihood`, `impact`, `residual_risk` (deprecated)
  - **Treatment:** `treatment_action`, `treatment_owner_id`, `treatment_due_date`, `expected_reduction`
  - `status` (enum: RiskStatus - draft, open, in_progress, mitigated, accepted, transferred, closed)
  - `owner_id`, `assigned_to` (UUID, nullable, user references)
  - `controls_linked` (simple-array, legacy - use `risk_to_control` junction)
  - `notes`, `last_assessed_at`
- **Relations:**
  - `OneToMany` → `RiskInstanceAttachmentEntity`
- **Timestamps:** `created_at`, `updated_at`
- **Audit:** `created_by`, `updated_by` (UUID, nullable)

### 3.3 Risk Category Entity

**Table:** `risk_category`  
**Entity:** `RiskCategoryEntity`

- **PK:** `id` (UUID)
- **Tenant ID:** `tenant_id` (UUID)
- **Unique:** `(code, tenant_id)`
- **Indexes:** `idx_risk_category_tenant`, `idx_risk_category_code_tenant`
- **Fields:**
  - `code` (varchar(50))
  - `name` (text)
  - `description` (text, nullable)
- **Timestamps:** `created_at`, `updated_at`

### 3.4 Risk Junction Tables

**Risk-to-Control:** `risk_to_control`  
- **PK:** Composite (`risk_id`, `control_id`)
- **Tenant ID:** Inherited via `risk_id` → `risk_catalog.tenant_id`
- **FKs:** `risk_id` → `risk_catalog.id`, `control_id` → `control_library.id`

**Risk-to-Policy:** `risk_to_policy`  
- **PK:** Composite (`risk_id`, `policy_id`)
- **Tenant ID:** Inherited via `risk_id` → `risk_catalog.tenant_id`
- **FKs:** `risk_id` → `risk_catalog.id`, `policy_id` → `policies.id`

**Risk-to-Requirement:** `risk_to_requirement`  
- **PK:** Composite (`risk_id`, `requirement_id`)
- **Tenant ID:** Inherited via `risk_id` → `risk_catalog.tenant_id`
- **FKs:** `risk_id` → `risk_catalog.id`, `requirement_id` → (TBD - requirements table)

### 3.5 Risk Attachments

**Risk Catalog Attachment:** `risk_catalog_attachments`  
- **PK:** `id` (UUID)
- **Tenant ID:** Inherited via `risk_catalog_id` → `risk_catalog.tenant_id`
- **FK:** `risk_catalog_id` → `risk_catalog.id`

**Risk Instance Attachment:** `risk_instance_attachments`  
- **PK:** `id` (UUID)
- **Tenant ID:** Inherited via `risk_instance_id` → `risk_instances.tenant_id`
- **FK:** `risk_instance_id` → `risk_instances.id`

---

## 4. Policy Domain

### 4.1 Policy Entity

**Table:** `policies`  
**Entity:** `PolicyEntity`

- **PK:** `id` (UUID)
- **Tenant ID:** `tenant_id` (UUID)
- **Unique:** ❌ **NO unique constraint on code** - potential issue
- **Index:** `idx_policies_tenant`
- **Fields:**
  - `code` (text) - **Not unique per tenant** ⚠️
  - `title` (text, standardized from `name`)
  - `status` (text)
  - `owner_first_name`, `owner_last_name` (text, nullable)
  - `effective_date`, `review_date` (date, nullable)
  - `content` (text, nullable)
- **Timestamps:** `created_at`, `updated_at`
- **Audit:** `created_by`, `updated_by` (UUID, nullable)

**Observation:** Policy `code` should have unique constraint `(code, tenant_id)` for data integrity.

### 4.2 Policy-Standard Junction

**Table:** `policy_standards`  
**Entity:** `PolicyStandardEntity`

- **PK:** Composite (`policy_id`, `standard_id`)
- **Tenant ID:** Inherited via `policy_id` → `policies.tenant_id`
- **FKs:** `policy_id` → `policies.id`, `standard_id` → `standard.id`

---

## 5. Audit Domain

### 5.1 Audit Plan Entity

**Table:** `audit_plans`  
**Entity:** `AuditPlanEntity`

- **PK:** `id` (UUID)
- **Tenant ID:** `tenant_id` (UUID)
- **Unique:** `(code, tenant_id)`
- **Indexes:** `idx_audit_plans_tenant`, `idx_audit_plans_code_tenant`
- **Fields:**
  - `code` (varchar(100))
  - `name` (text)
  - `period_start`, `period_end` (date)
  - `scope` (text, nullable)
  - `status` (enum: AuditPlanStatus - planned, in_progress, completed, archived)
- **Relations:**
  - `OneToMany` → `AuditEngagementEntity`
- **Timestamps:** `created_at`, `updated_at`, `archived_at` (nullable)
- **Audit:** `created_by`, `updated_by` (UUID, nullable)

### 5.2 Audit Engagement Entity

**Table:** `audit_engagements`  
**Entity:** `AuditEngagementEntity`

- **PK:** `id` (UUID)
- **Tenant ID:** `tenant_id` (UUID)
- **Unique:** `(code, tenant_id)`
- **Indexes:** `idx_audit_engagements_tenant`, `idx_audit_engagements_code_tenant`, `idx_audit_engagements_plan`
- **FKs:**
  - `plan_id` → `audit_plans.id`
- **Fields:**
  - `code` (varchar(100))
  - `name` (text)
  - `auditee` (text, nullable - can be entity reference later)
  - `lead_auditor_id` (UUID, nullable)
  - `status` (enum: AuditEngagementStatus - planned, in_progress, completed, cancelled)
- **Relations:**
  - `OneToMany` → `AuditTestEntity`, `AuditFindingEntity`
- **Timestamps:** `created_at`, `updated_at`
- **Audit:** `created_by`, `updated_by` (UUID, nullable)

### 5.3 Audit Test Entity

**Table:** `audit_tests`  
**Entity:** `AuditTestEntity`

- **PK:** `id` (UUID)
- **Tenant ID:** `tenant_id` (UUID)
- **Unique:** `(code, tenant_id)`
- **Indexes:** `idx_audit_tests_tenant`, `idx_audit_tests_code_tenant`, `idx_audit_tests_engagement`
- **FKs:**
  - `engagement_id` → `audit_engagements.id`
  - `clause_id` → `standard_clause.id` (nullable)
  - `control_id` → `process_controls.id` (nullable)
- **Fields:**
  - `code` (varchar(100))
  - `name` (text)
  - `objective`, `population_ref` (text, nullable)
  - `status` (enum: AuditTestStatus - planned, in_progress, passed, failed, skipped)
- **Relations:**
  - `OneToMany` → `AuditEvidenceEntity`
- **Timestamps:** `created_at`, `updated_at`
- **Audit:** `created_by`, `updated_by` (UUID, nullable)

### 5.4 Audit Finding Entity

**Table:** `audit_findings`  
**Entity:** `AuditFindingEntity`

- **PK:** `id` (UUID)
- **Tenant ID:** `tenant_id` (UUID)
- **Indexes:** `idx_audit_findings_tenant`, `idx_audit_findings_engagement`, `idx_audit_findings_test`, `idx_audit_findings_status`
- **FKs:**
  - `engagement_id` → `audit_engagements.id`
  - `test_id` → `audit_tests.id` (nullable)
- **Fields:**
  - `severity` (enum: AuditFindingSeverity - low, medium, high, critical)
  - `title` (text)
  - `description`, `details` (text, nullable - `details` is alias for `description`)
  - `root_cause` (text, nullable)
  - `status` (enum: AuditFindingStatus - open, in_progress, closed)
  - `due_date` (date, nullable)
  - **GRC Links:** `policy_id`, `clause_id`, `control_id`, `risk_instance_id`, `bia_process_id` (UUID, nullable)
- **Relations:**
  - `OneToMany` → `CorrectiveActionEntity`
- **Timestamps:** `created_at`, `updated_at`
- **Audit:** `created_by`, `updated_by` (UUID, nullable)

### 5.5 Audit Evidence Entity

**Table:** `audit_evidences`  
**Entity:** `AuditEvidenceEntity`

- **PK:** `id` (UUID)
- **Tenant ID:** Inherited via `test_id` → `audit_tests.tenant_id`
- **FK:** `test_id` → `audit_tests.id`

### 5.6 Corrective Action Entity

**Table:** `corrective_actions`  
**Entity:** `CorrectiveActionEntity`

- **PK:** `id` (UUID)
- **Tenant ID:** Inherited via `finding_id` → `audit_findings.tenant_id`
- **FK:** `finding_id` → `audit_findings.id`

### 5.7 Audit Log Entity

**Table:** `audit.audit_logs` (PostgreSQL) / `audit_logs` (SQLite)  
**Entity:** `AuditLogEntity`

- **PK:** `id` (UUID)
- **Tenant ID:** `tenant_id` (UUID, **nullable** - optional for system-level logs)
- **Fields:**
  - `user_id` (UUID, nullable)
  - `entity_schema`, `entity_table` (text)
  - `entity_id` (UUID, nullable)
  - `action` (text - CREATE, UPDATE, DELETE, etc.)
  - `diff` (JSON, nullable - before/after changes)
- **Timestamps:** `created_at` (only)

**Note:** Audit logs are system-wide and may not always have a tenant context (e.g., tenant creation events).

---

## 6. Control & Compliance Domain

### 6.1 Control Library Entity

**Table:** `control_library`  
**Entity:** `ControlLibraryEntity`

- **PK:** `id` (UUID)
- **Tenant ID:** `tenant_id` (UUID)
- **Unique:** `(code, tenant_id)`
- **Indexes:** `idx_control_library_tenant`, `idx_control_library_code_tenant`, `idx_control_library_family`, `idx_control_library_clause`
- **FKs:**
  - `clause_id` → `standard_clause.id` (nullable, SET NULL on delete)
- **Fields:**
  - `code` (varchar(100))
  - `name` (text)
  - `description` (text, nullable)
  - `family` (varchar(100), nullable)
  - `effectiveness` (decimal(3,2), default: 0.3, range: 0-1)
  - `references` (JSON array)
- **Timestamps:** `created_at`, `updated_at`

### 6.2 Control Junction Tables

**Control-to-Policy:** `control_to_policy`  
- **PK:** Composite (`control_id`, `policy_id`)
- **Tenant ID:** Inherited via `control_id` → `control_library.tenant_id`
- **FKs:** `control_id` → `control_library.id`, `policy_id` → `policies.id`

**Control-to-Clause:** `control_to_clause`  
- **PK:** Composite (`control_id`, `clause_id`)
- **Tenant ID:** Inherited via `control_id` → `control_library.tenant_id`
- **FKs:** `control_id` → `control_library.id`, `clause_id` → `standard_clause.id`

**Control-to-CAP:** `control_to_cap`  
- **PK:** Composite (`control_id`, `cap_id`)
- **Tenant ID:** Inherited via `control_id` → `control_library.tenant_id`
- **FKs:** `control_id` → `control_library.id`, `cap_id` → `corrective_actions.id`

### 6.3 Process Entity

**Table:** `processes`  
**Entity:** `ProcessEntity`

- **PK:** `id` (UUID)
- **Tenant ID:** `tenant_id` (UUID)
- **Unique:** `(code, tenant_id)`
- **Indexes:** `idx_processes_tenant`, `idx_processes_code_tenant`
- **Fields:**
  - `code` (varchar(100))
  - `name` (text)
  - `description` (text, nullable)
  - `owner_user_id` (UUID, nullable)
  - `is_active` (boolean, default: true)
- **Relations:**
  - `OneToMany` → `ProcessControlEntity`
- **Timestamps:** `created_at`, `updated_at`
- **Audit:** `created_by`, `updated_by` (UUID, nullable)

### 6.4 Process Control Entity

**Table:** `process_controls`  
**Entity:** `ProcessControlEntity`

- **PK:** `id` (UUID)
- **Tenant ID:** Inherited via `process_id` → `processes.tenant_id`
- **FK:** `process_id` → `processes.id`

### 6.5 Regulation Entity

**Table:** `regulations`  
**Entity:** `RegulationEntity`

- **PK:** `id` (UUID, auto-generated)
- **Tenant ID:** `tenant_id` (UUID)
- **Unique:** `(code, tenant_id)`
- **Indexes:** `idx_regulations_tenant`, `idx_regulations_code_tenant`
- **Fields:**
  - `code` (varchar(50))
  - `title` (text)
  - `description` (text, nullable)
  - `publisher` (varchar(100), nullable)
  - `version` (varchar(20), nullable)
- **Timestamps:** `created_at`, `updated_at`

---

## 7. Standards & Compliance Domain

### 7.1 Standard Entity

**Table:** `standard`  
**Entity:** `StandardEntity`

- **PK:** `id` (UUID)
- **Tenant ID:** `tenant_id` (UUID)
- **Unique:** `(code, tenant_id)`
- **Indexes:** `idx_standard_tenant`, `idx_standard_code_tenant`
- **Fields:**
  - `code` (varchar(50))
  - `name` (text)
  - `version` (varchar(20), nullable)
  - `publisher` (varchar(100), nullable)
- **Timestamps:** `created_at`, `updated_at`

### 7.2 Standard Clause Entity

**Table:** `standard_clause`  
**Entity:** `StandardClauseEntity`

- **PK:** `id` (UUID)
- **Tenant ID:** Inherited via `standard_id` → `standard.tenant_id`
- **FK:** `standard_id` → `standard.id`

### 7.3 Standard Mapping Entity

**Table:** `standard_mappings`  
**Entity:** `StandardMappingEntity`

- **PK:** `id` (UUID)
- **Tenant ID:** Inherited via parent entities
- **Purpose:** Maps standards to other entities (e.g., clauses to controls)

---

## 8. BCM (Business Continuity Management) Domain

### 8.1 BCP Plan Entity

**Table:** `bcp_plans`  
**Entity:** `BCPPlanEntity`

- **PK:** `id` (UUID)
- **Tenant ID:** `tenant_id` (UUID)
- **Unique:** `(code, tenant_id)`
- **Indexes:** `idx_bcp_plans_tenant`, `idx_bcp_plans_code_tenant`
- **Fields:**
  - `code` (varchar(100))
  - `name` (text)
  - `process_id` (UUID, nullable, FK to `bia_processes.id`)
  - `scope_entity_id` (UUID, nullable, FK to `entities.id`)
  - `version` (varchar(20), default: '1.0')
  - `status` (enum: BCPPlanStatus - draft, approved, retired)
  - `steps` (JSON array: `{step, title, description, owner?}`)
  - `last_tested_at` (timestamp, nullable)
- **Relations:**
  - `OneToMany` → `BCPExerciseEntity`
- **Timestamps:** `created_at`, `updated_at`
- **Audit:** `created_by`, `updated_by` (UUID, nullable)

### 8.2 BCP Exercise Entity

**Table:** `bcp_exercises`  
**Entity:** `BCPExerciseEntity`

- **PK:** `id` (UUID)
- **Tenant ID:** Inherited via `plan_id` → `bcp_plans.tenant_id`
- **FK:** `plan_id` → `bcp_plans.id`

### 8.3 BIA Process Entity

**Table:** `bia_processes`  
**Entity:** `BIAProcessEntity`

- **PK:** `id` (UUID)
- **Tenant ID:** `tenant_id` (UUID)
- **FK:** `process_id` → `processes.id`

### 8.4 BIA Process Dependency Entity

**Table:** `bia_process_dependencies`  
**Entity:** `BIAProcessDependencyEntity`

- **PK:** `id` (UUID)
- **Tenant ID:** Inherited via `bia_process_id` → `bia_processes.tenant_id`
- **FK:** `bia_process_id` → `bia_processes.id`

---

## 9. Entity Registry Domain

### 9.1 Entity Type Entity

**Table:** `entity_types`  
**Entity:** `EntityTypeEntity`

- **PK:** `id` (UUID)
- **Tenant ID:** `tenant_id` (UUID)
- **Unique:** `(code, tenant_id)`
- **Indexes:** `idx_entity_types_tenant`, `idx_entity_types_code_tenant`
- **Fields:**
  - `code` (varchar(100)) - Application, Database, Service, etc.
  - `name` (text)
  - `description` (text, nullable)
- **Timestamps:** `created_at`, `updated_at`

### 9.2 Entity Entity

**Table:** `entities`  
**Entity:** `EntityEntity`

- **PK:** `id` (UUID)
- **Tenant ID:** `tenant_id` (UUID)
- **Unique:** `(code, tenant_id)`
- **Indexes:** `idx_entities_tenant`, `idx_entities_type`, `idx_entities_code_tenant`, `idx_entities_owner`
- **FKs:**
  - `entity_type_id` → `entity_types.id`
- **Fields:**
  - `code` (varchar(100))
  - `name` (text)
  - `criticality` (integer, default: 3, range: 1-5)
  - `owner_user_id` (UUID, nullable)
  - `attributes` (JSON object - flexible attributes like tier, repo, etc.)
- **Timestamps:** `created_at`, `updated_at`
- **Audit:** `created_by`, `updated_by` (UUID, nullable)

**Purpose:** Central registry for all business entities (applications, databases, services, etc.) that can be linked to risks, controls, audits, etc.

---

## 10. Dictionary & Metadata Domain

### 10.1 Dictionary Entity

**Table:** `dictionaries`  
**Entity:** `DictionaryEntity`

- **PK:** `id` (UUID)
- **Tenant ID:** `tenant_id` (UUID)
- **Unique:** `(code, domain, tenant_id)` - tenant-aware dictionary entries
- **Indexes:** `idx_dictionaries_tenant`, `idx_dictionaries_domain`, `idx_dictionaries_code_domain_tenant`, `idx_dictionaries_active`
- **Fields:**
  - `domain` (varchar(100)) - e.g., 'POLICY_STATUS', 'REQUIREMENT_CATEGORY', 'RISK_TYPE'
  - `code` (varchar(100)) - e.g., 'draft', 'approved', 'legal'
  - `label` (text) - human-readable display text
  - `description` (text, nullable)
  - `order` (integer, default: 0) - display order
  - `is_active` (boolean, default: true)
  - `meta` (JSON object - flexible attributes like color, icon, etc.)
- **Timestamps:** `created_at`, `updated_at`
- **Audit:** `created_by`, `updated_by` (UUID, nullable)

**Purpose:** Tenant-aware key-value pairs for dropdowns, status values, categories, etc.

---

## 11. Calendar Domain

### 11.1 Calendar Event Entity

**Table:** `calendar_events`  
**Entity:** `CalendarEventEntity`

- **PK:** `id` (UUID)
- **Tenant ID:** `tenant_id` (UUID)
- **Fields:**
  - `title` (text)
  - `description` (text, nullable)
  - `start_date`, `end_date` (timestamp)
  - `event_type` (text, nullable)
  - `related_entity_type`, `related_entity_id` (text/UUID, nullable - polymorphic link)
- **Timestamps:** `created_at`, `updated_at`

---

## 12. Queue & Event Domain

### 12.1 Event Raw Entity

**Table:** `queue.events_raw` (PostgreSQL) / `events_raw` (SQLite)  
**Entity:** `EventRawEntity`

- **PK:** `id` (UUID, auto-generated)
- **Tenant ID:** `tenant_id` (UUID, **nullable** - may be unknown at ingestion)
- **Fields:**
  - `source` (text)
  - `event_type` (text)
  - `fingerprint` (text, nullable)
  - `received_at` (timestamp)
  - `idempotency_key` (text, nullable)
  - `payload` (JSON)
  - `ingest_meta` (JSON, nullable)
- **Timestamps:** `created_at` (only)

### 12.2 Event Normalized Entity

**Table:** `event_normalized`  
**Entity:** `EventNormalizedEntity`

- **PK:** `id` (UUID, auto-generated)
- **Tenant ID:** `tenant_id` (UUID, **required** - normalized events must have tenant)
- **Indexes:** `idx_event_normalized_tenant_time`, `idx_event_normalized_severity`, `idx_event_normalized_category`
- **Fields:**
  - `event_time` (timestamp)
  - `severity` (enum: EventSeverity - info, warning, minor, major, critical)
  - `category` (varchar(100))
  - `resource` (varchar(255))
  - `message` (text)
  - `labels` (JSON, nullable)
  - `raw_id` (UUID, FK to `events_raw.id`)
- **Timestamps:** `created_at` (only)

---

## 13. Observations / Open Questions

### 13.1 Tenant ID Coverage

**Entities WITHOUT tenant_id (by design):**
- ✅ `permissions` - global permissions (shared across tenants)
- ✅ `role_permissions` - inherits tenant via `role_id`
- ✅ `user_roles` - inherits tenant via `user_id` or `role_id`
- ✅ `refresh_tokens` - inherits tenant via `user_id`

**Entities WITH optional/nullable tenant_id:**
- ⚠️ `audit_logs` - `tenant_id` is nullable (system-level logs may not have tenant)
- ⚠️ `events_raw` - `tenant_id` is nullable (may be unknown at ingestion)

**Entities that SHOULD have tenant_id but need verification:**
- All business entities appear to have `tenant_id` ✅

### 13.2 Unique Constraints

**Missing tenant-aware unique constraints:**
- ⚠️ `policies.code` - **NO unique constraint** (should be `(code, tenant_id)`)
- ✅ Most other entities have `(code, tenant_id)` unique constraints

### 13.3 Schema Organization

**PostgreSQL Schemas:**
- `tenant` - tenant root table
- `auth` - users, roles, permissions, refresh tokens
- `app` - all business entities (default schema, no explicit schema in entity decorators)
- `audit` - audit logs
- `queue` - event queue tables

**SQLite:**
- Flat table names (no schema support)
- All tables in single database file

### 13.4 Foreign Key Patterns

- Most FKs use `ON DELETE CASCADE` for parent-child relationships
- Some use `ON DELETE SET NULL` (e.g., `control_library.clause_id`)
- Junction tables typically cascade on both sides

### 13.5 Timestamp Patterns

- Most entities have `created_at` and `updated_at` (via `@CreateDateColumn` and `@UpdateDateColumn`)
- Some have `archived_at` (e.g., `audit_plans`)
- Audit logs only have `created_at` (immutable)
- Queue entities only have `created_at` (immutable events)

### 13.6 Audit Trail Fields

Many entities have:
- `created_by` (UUID, nullable)
- `updated_by` (UUID, nullable)

These are separate from the `audit_logs` table which tracks all changes via interceptor.

### 13.7 Soft Delete

- ❌ **No soft delete pattern** - entities use hard deletes
- Consider adding `deleted_at` timestamp for audit/BCM/risk entities if needed

### 13.8 JSON Fields

Common JSON fields:
- `roles` (users) - legacy, should migrate to `user_roles` junction
- `control_refs` (risk_catalog) - legacy, use `risk_to_control` junction
- `impact_areas` (risk_catalog) - enum array
- `tags` (risk_catalog) - string array
- `steps` (bcp_plans) - structured array
- `attributes` (entities) - flexible key-value
- `meta` (dictionaries) - flexible key-value
- `payload`, `ingest_meta` (events_raw) - event data
- `labels` (event_normalized) - event metadata
- `diff` (audit_logs) - change tracking

---

## 14. Migration History

Key migrations (from `src/migrations/`):
- `1700000000000_bootstrap_db.ts` - Initial schema, extensions, core tables
- `1730000005000_DataFoundations_Squashed.ts` - Data foundation tables
- `1730000005100_AddSyntheticFlags.ts` - Synthetic flags
- `1730000005200_MoveTablesToPublic.ts` - Schema organization
- `1730000005300_AddPolicyContent.ts` - Policy content field
- `1731000000000_AddRiskInstanceAndCatalogFields.ts` - Risk enhancements
- `1731000000100_AddControlEffectiveness.ts` - Control effectiveness
- `1731000000200_AddPolicyComplianceRelations.ts` - Policy compliance links
- `1732000000000_CreateEntityRegistry.ts` - Entity registry
- `1733000000000_CreateAuditLifecycle.ts` - Audit lifecycle
- `1734000000000_CreateBCMAndAuditRefinements.ts` - BCM and audit refinements
- `1735000000000_FixAuditLogsSchema.ts` - Audit logs schema fixes
- `1735000000000_AddAuditFindingDescription.ts` - Audit finding description
- `1736000000000_RemovePolicyNameColumn.ts` - Policy schema cleanup
- `1737000000000_AddMissingTablesAndColumns.ts` - Missing tables/columns
- `1738000000000_FixDictionariesRequirementsAndRolePermissions.ts` - Dictionary and RBAC fixes
- `1739000000000_CreateCalendarEventsTable.ts` - Calendar events
- `1740000000000_AddControlRelationships.ts` - Control relationships
- `1741000000000_RiskModuleFullRewrite.ts` - Risk module rewrite

---

**End of DB Baseline Documentation**

