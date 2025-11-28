# DB IMPACT MAP – GRC Platform

**Analysis Date:** 2025-01-28  
**Purpose:** Map domains ↔ tables ↔ code to understand change sensitivity and dependencies before schema modifications.

---

## 1. Risk Domain

### 1.1 Tables

- `risk_catalog` - Risk definitions/catalog entries
- `risk_instances` - Actual risk occurrences for entities
- `risk_category` - Risk categories
- `risk_to_control` - Junction: risks ↔ controls
- `risk_to_policy` - Junction: risks ↔ policies
- `risk_to_requirement` - Junction: risks ↔ requirements
- `risk_catalog_attachments` - Attachments for risk catalog
- `risk_instance_attachments` - Attachments for risk instances

### 1.2 Related Modules / Code

**Entities:**
- `RiskCatalogEntity` - `src/entities/app/risk-catalog.entity.ts`
- `RiskInstanceEntity` - `src/entities/app/risk-instance.entity.ts`
- `RiskCategoryEntity` - `src/entities/app/risk-category.entity.ts`
- `RiskToControlEntity` - `src/entities/app/risk-to-control.entity.ts`
- `RiskToPolicyEntity` - `src/entities/app/risk-to-policy.entity.ts`
- `RiskToRequirementEntity` - `src/entities/app/risk-to-requirement.entity.ts`
- `RiskCatalogAttachmentEntity` - `src/entities/app/risk-catalog-attachment.entity.ts`
- `RiskInstanceAttachmentEntity` - `src/entities/app/risk-instance-attachment.entity.ts`

**Repositories / Services:**
- `DataFoundationService` - `src/modules/data-foundation/data-foundation.service.ts`
  - `findRiskCatalog()` - Lists risk catalog with KQL search
- `RiskInstanceService` - `src/modules/risk-instance/risk-instance.service.ts`
  - `list()` - Lists risk instances with filters
  - `getOne()` - Gets single risk instance
  - `create()`, `update()`, `delete()` - CRUD operations
  - `linkControl()`, `unlinkControl()` - Control relationships
- `RiskService` - `src/modules/risk/risk.service.ts`
  - `list()` - Lists risks (legacy entity)
  - `get()` - Gets single risk
- `AutoGenerationService` - `src/modules/risk-instance/auto-generation.service.ts`
  - Auto-generates risk instances from catalog

**Controllers / Routes:**
- `RiskCatalogController` - `src/modules/risk/risk-catalog.controller.ts`
  - `GET /api/v2/risk-catalog` - List risk catalog
  - `GET /api/v2/risk-catalog/:id` - Get risk catalog entry
- `RiskInstanceController` - `src/modules/risk-instance/risk-instance.controller.ts`
  - `GET /api/v2/risk-instances` - List risk instances
  - `GET /api/v2/risk-instances/:id` - Get risk instance
  - `POST /api/v2/risk-instances` - Create risk instance
  - `PATCH /api/v2/risk-instances/:id` - Update risk instance
  - `DELETE /api/v2/risk-instances/:id` - Delete risk instance
- `DataFoundationController` - `src/modules/data-foundation/data-foundation.controller.ts`
  - `GET /api/v2/risk-catalog` - List risk catalog (alternative endpoint)

**DTOs:**
- `QueryRiskCatalogDto` - `src/modules/data-foundation/dto/query-risk-catalog.dto.ts`
- `CreateRiskCatalogDto` - `src/modules/data-foundation/dto/create-risk-catalog.dto.ts`
- `QueryRiskInstanceDto` - `src/modules/risk-instance/risk-instance.service.ts`
- `CreateRiskInstanceDto` - `src/modules/risk-instance/dto/create-risk-instance.dto.ts`

### 1.3 Cross-Domain Links

**Links TO:**
- `audit_findings.risk_instance_id` → `risk_instances.id`
- `risk_instances.catalog_id` → `risk_catalog.id`
- `risk_instances.entity_id` → `entities.id`
- `risk_catalog.category_id` → `risk_category.id`
- `risk_to_control.control_id` → `control_library.id`
- `risk_to_policy.policy_id` → `policies.id`

**Links FROM:**
- `risk_instances` referenced by audit findings
- `risk_catalog` referenced by risk instances
- Junction tables link to controls, policies, requirements

### 1.4 Change Sensitivity

**High impact if:**
- Unique constraint changes on `risk_catalog.code` (affects duplicate detection)
- `risk_instances` unique constraint `(catalog_id, entity_id, tenant_id)` changes (affects duplicate prevention)
- `tenant_id` column removed or made nullable (breaks multi-tenancy)
- Foreign key constraints change (affects referential integrity)
- Score calculation fields change (`inherent_score`, `residual_score` formulas)

**Medium impact if:**
- New columns added to `risk_catalog` or `risk_instances` (may require DTO updates)
- Enum values change (RiskStatus, EntityType, ImpactArea) - may break existing data
- Index changes (affects query performance)

**Low impact if:**
- New optional columns added
- Attachment tables modified (isolated functionality)
- Junction tables modified (isolated relationships)

---

## 2. Policy Domain

### 2.1 Tables

- `policies` - Policy documents
- `policy_standards` - Junction: policies ↔ standards
- `control_to_policy` - Junction: controls ↔ policies (via Control domain)
- `risk_to_policy` - Junction: risks ↔ policies (via Risk domain)

### 2.2 Related Modules / Code

**Entities:**
- `PolicyEntity` - `src/entities/app/policy.entity.ts`
- `PolicyStandardEntity` - `src/entities/app/policy-standard.entity.ts`
- `Policy` (legacy) - `src/modules/policy/policy.entity.ts`

**Repositories / Services:**
- `GovernanceService` - `src/modules/governance/governance.service.ts`
  - `list()` - Lists policies with tenant filtering ✅
  - `get()` - Gets single policy
  - `create()`, `update()`, `delete()` - CRUD operations
- `PolicyService` - `src/modules/policy/policy.service.ts` ⚠️ **LEGACY (HARDENED)**
  - `findAll()` - Lists policies **WITH tenant filtering** ✅ (hardened 2025-01-28)
  - `findOne()` - Gets single policy **WITH tenant filtering** ✅ (hardened 2025-01-28)
  - `create()`, `update()`, `remove()` - CRUD operations (all tenant-safe)
  - **Status:** Hardened but deprecated - use GovernanceService for new code

**Controllers / Routes:**
- `GovernanceController` - `src/modules/governance/governance.controller.ts` ✅
  - `GET /api/v2/governance/policies` - List policies (tenant-safe)
  - `GET /api/v2/governance/policies/:id` - Get policy (tenant-safe)
  - `POST /api/v2/governance/policies` - Create policy
  - `PATCH /api/v2/governance/policies/:id` - Update policy
  - `DELETE /api/v2/governance/policies/:id` - Delete policy
- `PolicyController` - `src/modules/policy/policy.controller.ts` ⚠️ **LEGACY (HARDENED)**
  - `GET /api/v2/policies` - List policies (tenant-safe with TenantGuard) ✅ (hardened 2025-01-28)
  - `GET /api/v2/policies/:id` - Get policy (tenant-safe with TenantGuard) ✅ (hardened 2025-01-28)
  - **Status:** Hardened but deprecated - use GovernanceController for new code

**DTOs:**
- `QueryPolicyDto` - `src/modules/governance/dto/query-policy.dto.ts`
- `CreatePolicyDto` - `src/modules/governance/dto/create-policy.dto.ts`

### 2.3 Cross-Domain Links

**Links TO:**
- `audit_findings.policy_id` → `policies.id`
- `control_to_policy.policy_id` → `policies.id`
- `risk_to_policy.policy_id` → `policies.id`
- `policy_standards.policy_id` → `policies.id`
- `policy_standards.standard_id` → `standard.id`

**Links FROM:**
- Policies referenced by audit findings, controls, risks, standards

### 2.4 Change Sensitivity

**High impact if:**
- **Missing unique constraint on `policies.code`** ⚠️ **CRITICAL GAP**
  - Should be `UNIQUE(code, tenant_id)` but currently missing
  - Affects data integrity and duplicate prevention
- `tenant_id` column removed or made nullable (breaks multi-tenancy)
- Foreign key constraints change

**Medium impact if:**
- New required columns added (breaks existing create operations)
- `status` enum values change (may break existing data)
- `title` vs `name` field changes (recently standardized)

**Low impact if:**
- New optional columns added
- Junction tables modified

**⚠️ Security Status (Updated 2025-01-28):**
- `PolicyService` (legacy) **NOW HAS tenant filtering** ✅ (hardened)
- `PolicyController` (legacy) **NOW HAS `@UseGuards(TenantGuard)`** ✅ (hardened)
- **Status:** Legacy code has been hardened for security, but is still deprecated
- **Recommendation:** Use GovernanceService/Controller for new code. Legacy endpoints maintained for backward compatibility only.

---

## 3. Audit Domain

### 3.1 Tables

- `audit_plans` - Audit planning periods
- `audit_engagements` - Individual audit engagements
- `audit_tests` - Audit test procedures
- `audit_evidences` - Evidence collected for tests
- `audit_findings` - Audit findings/discrepancies
- `corrective_actions` - Corrective action plans (CAPs)
- `audit_logs` - System audit trail (separate schema)

### 3.2 Related Modules / Code

**Entities:**
- `AuditPlanEntity` - `src/entities/app/audit-plan.entity.ts`
- `AuditEngagementEntity` - `src/entities/app/audit-engagement.entity.ts`
- `AuditTestEntity` - `src/entities/app/audit-test.entity.ts`
- `AuditEvidenceEntity` - `src/entities/app/audit-evidence.entity.ts`
- `AuditFindingEntity` - `src/entities/app/audit-finding.entity.ts`
- `CorrectiveActionEntity` - `src/entities/app/corrective-action.entity.ts`
- `AuditLogEntity` - `src/entities/audit/audit-log.entity.ts`

**Repositories / Services:**
- `AuditLifecycleService` - `src/modules/audit/audit-lifecycle.service.ts`
  - `listPlans()` - Lists audit plans ✅
  - `getPlan()`, `createPlan()`, `updatePlan()`, `archivePlan()` - Plan CRUD
  - `listEngagements()` - Lists audit engagements ✅
  - `getEngagement()`, `createEngagement()`, `updateEngagement()` - Engagement CRUD
  - `listTests()` - Lists audit tests ✅
  - `getTest()`, `createTest()`, `updateTest()` - Test CRUD
  - `listFindings()` - Lists audit findings ✅
  - `getFinding()`, `createFinding()`, `updateFinding()` - Finding CRUD
  - `listCorrectiveActions()` - Lists CAPs ✅
  - `createCorrectiveAction()`, `updateCorrectiveAction()` - CAP CRUD

**Controllers / Routes:**
- `AuditLifecycleController` - `src/modules/audit/audit-lifecycle.controller.ts`
  - `GET /api/v2/audit/plans` - List audit plans
  - `GET /api/v2/audit/plans/:id` - Get audit plan
  - `POST /api/v2/audit/plans` - Create audit plan
  - `PATCH /api/v2/audit/plans/:id` - Update audit plan
  - `POST /api/v2/audit/plans/:id/archive` - Archive audit plan
  - `GET /api/v2/audit/engagements` - List engagements
  - `GET /api/v2/audit/engagements/:id` - Get engagement
  - `POST /api/v2/audit/engagements` - Create engagement
  - `PATCH /api/v2/audit/engagements/:id` - Update engagement
  - `GET /api/v2/audit/tests` - List tests
  - `GET /api/v2/audit/tests/:id` - Get test
  - `POST /api/v2/audit/tests` - Create test
  - `GET /api/v2/audit/findings` - List findings
  - `GET /api/v2/audit/findings/:id` - Get finding
  - `POST /api/v2/audit/findings` - Create finding
  - `GET /api/v2/audit/corrective-actions` - List CAPs
  - `POST /api/v2/audit/corrective-actions` - Create CAP

**DTOs:**
- `QueryAuditPlanDto`, `CreateAuditPlanDto` - `src/modules/audit/dto/query-audit.dto.ts`
- `QueryAuditEngagementDto`, `CreateAuditEngagementDto`
- `QueryAuditTestDto`, `CreateAuditTestDto`
- `QueryAuditFindingDto`, `CreateAuditFindingDto`
- `QueryCorrectiveActionDto`, `CreateCorrectiveActionDto`

### 3.3 Cross-Domain Links

**Links TO:**
- `audit_engagements.plan_id` → `audit_plans.id`
- `audit_tests.engagement_id` → `audit_engagements.id`
- `audit_evidences.test_id` → `audit_tests.id`
- `audit_findings.engagement_id` → `audit_engagements.id`
- `audit_findings.test_id` → `audit_tests.id`
- `audit_findings.policy_id` → `policies.id`
- `audit_findings.clause_id` → `standard_clause.id`
- `audit_findings.control_id` → `process_controls.id`
- `audit_findings.risk_instance_id` → `risk_instances.id`
- `audit_findings.bia_process_id` → `bia_processes.id`
- `corrective_actions.finding_id` → `audit_findings.id`
- `audit_tests.clause_id` → `standard_clause.id`
- `audit_tests.control_id` → `process_controls.id`

**Links FROM:**
- Audit findings link to policies, controls, risks, BIA processes
- Calendar events created for audit engagements

### 3.4 Change Sensitivity

**High impact if:**
- Unique constraint changes on `audit_plans.code`, `audit_engagements.code`, `audit_tests.code`
- `tenant_id` column removed or made nullable
- Foreign key constraints change (many cross-domain links)
- Status enum values change (AuditPlanStatus, AuditEngagementStatus, AuditTestStatus, AuditFindingStatus)

**Medium impact if:**
- New required columns added
- Date range fields change (`period_start`, `period_end`)
- Severity enum values change (AuditFindingSeverity)

**Low impact if:**
- New optional columns added
- Evidence table modified (isolated functionality)

---

## 4. Control & Compliance Domain

### 4.1 Tables

- `control_library` - Control definitions
- `process_controls` - Process-specific controls
- `processes` - Business processes
- `control_to_policy` - Junction: controls ↔ policies
- `control_to_clause` - Junction: controls ↔ standard clauses
- `control_to_cap` - Junction: controls ↔ corrective actions
- `regulations` - Regulatory requirements
- `standard` - Compliance standards
- `standard_clause` - Standard clauses/sections
- `standard_mappings` - Standard mappings

### 4.2 Related Modules / Code

**Entities:**
- `ControlLibraryEntity` - `src/entities/app/control-library.entity.ts`
- `ProcessControlEntity` - `src/entities/app/process-control.entity.ts`
- `ProcessEntity` - `src/entities/app/process.entity.ts`
- `RegulationEntity` - `src/entities/app/regulation.entity.ts`
- `StandardEntity` - `src/entities/app/standard.entity.ts`
- `StandardClauseEntity` - `src/entities/app/standard-clause.entity.ts`
- `StandardMappingEntity` - `src/entities/app/standard-mapping.entity.ts`

**Repositories / Services:**
- `DataFoundationService` - `src/modules/data-foundation/data-foundation.service.ts`
  - `findControls()` - Lists controls with tenant filtering ✅
  - `getOneControl()` - Gets control with relationships ✅
  - `findStandards()` - Lists standards ✅
  - `getStandard()` - Gets standard with clauses ✅

**Controllers / Routes:**
- `DataFoundationController` - `src/modules/data-foundation/data-foundation.controller.ts`
  - `GET /api/v2/controls` - List controls
  - `GET /api/v2/controls/:id` - Get control details
  - `GET /api/v2/standards` - List standards
  - `GET /api/v2/standards/:code` - Get standard

**DTOs:**
- `QueryControlDto` - `src/modules/data-foundation/dto/query-control.dto.ts`
- `QueryStandardDto` - `src/modules/data-foundation/dto/query-standard.dto.ts`

### 4.3 Cross-Domain Links

**Links TO:**
- `control_to_policy.policy_id` → `policies.id`
- `control_to_clause.clause_id` → `standard_clause.id`
- `control_to_cap.cap_id` → `corrective_actions.id`
- `risk_to_control.control_id` → `control_library.id`
- `audit_tests.control_id` → `process_controls.id`
- `audit_findings.control_id` → `process_controls.id`
- `process_controls.process_id` → `processes.id`
- `control_library.clause_id` → `standard_clause.id`
- `standard_clause.standard_id` → `standard.id`

**Links FROM:**
- Controls linked to policies, clauses, risks, audit tests, audit findings, CAPs

### 4.4 Change Sensitivity

**High impact if:**
- Unique constraint changes on `control_library.code`, `processes.code`, `standard.code`
- `tenant_id` column removed or made nullable
- `effectiveness` field type/range changes (decimal 0-1)
- Foreign key constraints change (many cross-domain links)

**Medium impact if:**
- New required columns added
- Control family/type fields change

**Low impact if:**
- New optional columns added
- Junction tables modified

---

## 5. BCM Domain

### 5.1 Tables

- `bcp_plans` - Business continuity plans
- `bcp_exercises` - BCP exercises/tests
- `bia_processes` - Business impact analysis processes
- `bia_process_dependencies` - BIA process dependencies

### 5.2 Related Modules / Code

**Entities:**
- `BCPPlanEntity` - `src/entities/app/bcp-plan.entity.ts`
- `BCPExerciseEntity` - `src/entities/app/bcp-exercise.entity.ts`
- `BIAProcessEntity` - `src/entities/app/bia-process.entity.ts`
- `BIAProcessDependencyEntity` - `src/entities/app/bia-process-dependency.entity.ts`

**Repositories / Services:**
- `BCMService` - `src/modules/bcm/bcm.service.ts`
  - `listBCPPlans()` - Lists BCP plans ✅
  - `getBCPPlan()`, `createBCPPlan()`, `updateBCPPlan()`, `deleteBCPPlan()` - BCP CRUD
  - `listBIAProcesses()` - Lists BIA processes ✅
  - `getBIAProcess()`, `createBIAProcess()`, `updateBIAProcess()`, `deleteBIAProcess()` - BIA CRUD
  - `listBCPExercises()` - Lists BCP exercises ✅
  - `createBCPExercise()`, `updateBCPExercise()` - Exercise CRUD

**Controllers / Routes:**
- `BCMController` - `src/modules/bcm/bcm.controller.ts`
  - `GET /api/v2/bcm/plans` - List BCP plans
  - `GET /api/v2/bcm/plans/:id` - Get BCP plan
  - `POST /api/v2/bcm/plans` - Create BCP plan
  - `PATCH /api/v2/bcm/plans/:id` - Update BCP plan
  - `DELETE /api/v2/bcm/plans/:id` - Delete BCP plan
  - `GET /api/v2/bcm/bia-processes` - List BIA processes
  - `GET /api/v2/bcm/bia-processes/:id` - Get BIA process
  - `POST /api/v2/bcm/bia-processes` - Create BIA process
  - `GET /api/v2/bcm/exercises` - List BCP exercises
  - `POST /api/v2/bcm/exercises` - Create BCP exercise

**DTOs:**
- `QueryBCPPlanDto`, `CreateBCPPlanDto` - `src/modules/bcm/dto/query-bcm.dto.ts`
- `QueryBIAProcessDto`, `CreateBIAProcessDto`
- `QueryBCPExerciseDto`, `CreateBCPExerciseDto`

### 5.3 Cross-Domain Links

**Links TO:**
- `bcp_plans.process_id` → `bia_processes.id`
- `bcp_plans.scope_entity_id` → `entities.id`
- `bcp_exercises.plan_id` → `bcp_plans.id`
- `bia_process_dependencies.bia_process_id` → `bia_processes.id`
- `audit_findings.bia_process_id` → `bia_processes.id`

**Links FROM:**
- BCP plans link to BIA processes and entities
- Audit findings can reference BIA processes

### 5.4 Change Sensitivity

**High impact if:**
- Unique constraint changes on `bcp_plans.code`, `bia_processes.code`
- `tenant_id` column removed or made nullable
- Foreign key constraints change
- Status enum values change (BCPPlanStatus)

**Medium impact if:**
- New required columns added
- `steps` JSON structure changes (affects frontend)

**Low impact if:**
- New optional columns added
- Exercise table modified (isolated functionality)

---

## 6. Entity Registry Domain

### 6.1 Tables

- `entity_types` - Entity type definitions (Application, Database, Service, etc.)
- `entities` - Business entities (applications, databases, services, etc.)

### 6.2 Related Modules / Code

**Entities:**
- `EntityTypeEntity` - `src/entities/app/entity-type.entity.ts`
- `EntityEntity` - `src/entities/app/entity.entity.ts`

**Repositories / Services:**
- `EntityService` - `src/modules/entity-registry/entity.service.ts`
  - `list()` - Lists entities with KQL search ✅
  - `get()` - Gets single entity ✅
  - `create()`, `update()`, `delete()` - CRUD operations
- `EntityTypeService` - `src/modules/entity-registry/entity-type.service.ts`
  - `list()` - Lists entity types ✅
  - `get()` - Gets single entity type ✅

**Controllers / Routes:**
- `EntityRegistryController` - `src/modules/entity-registry/entity-registry.controller.ts`
  - `GET /api/v2/entities` - List entities
  - `GET /api/v2/entities/:id` - Get entity
  - `POST /api/v2/entities` - Create entity
  - `PATCH /api/v2/entities/:id` - Update entity
  - `DELETE /api/v2/entities/:id` - Delete entity
  - `GET /api/v2/entity-types` - List entity types
  - `GET /api/v2/entity-types/:id` - Get entity type

**DTOs:**
- `QueryEntityDto`, `CreateEntityDto` - `src/modules/entity-registry/dto/`

### 6.3 Cross-Domain Links

**Links TO:**
- `entities.entity_type_id` → `entity_types.id`
- `risk_instances.entity_id` → `entities.id`
- `bcp_plans.scope_entity_id` → `entities.id`

**Links FROM:**
- Entities referenced by risk instances and BCP plans

### 6.4 Change Sensitivity

**High impact if:**
- Unique constraint changes on `entities.code`, `entity_types.code`
- `tenant_id` column removed or made nullable
- `criticality` field type/range changes (integer 1-5)
- Foreign key constraints change

**Medium impact if:**
- New required columns added
- `attributes` JSON structure changes (affects frontend)

**Low impact if:**
- New optional columns added

---

## 7. Dictionary & Metadata Domain

### 7.1 Tables

- `dictionaries` - Key-value pairs for dropdowns, status values, categories

### 7.2 Related Modules / Code

**Entities:**
- `DictionaryEntity` - `src/entities/app/dictionary.entity.ts`

**Repositories / Services:**
- `AdminService` - `src/modules/admin/admin.service.ts`
  - Dictionary CRUD operations (admin-only)

**Controllers / Routes:**
- `AdminController` - `src/modules/admin/admin.controller.ts`
  - Dictionary management endpoints (admin-only)

**DTOs:**
- `AdminDictionaryDto` - `src/modules/admin/dto/admin-dictionary.dto.ts`

### 7.3 Cross-Domain Links

**Links TO:**
- Used by all domains for dropdown values, status options, categories

**Links FROM:**
- Referenced by frontend for form dropdowns

### 7.4 Change Sensitivity

**High impact if:**
- Unique constraint changes on `(code, domain, tenant_id)`
- `tenant_id` column removed or made nullable
- `domain` or `code` field types change

**Medium impact if:**
- `is_active` field behavior changes (affects filtering)
- `order` field behavior changes (affects sorting)

**Low impact if:**
- New optional columns added
- `meta` JSON structure changes

---

## 8. Calendar Domain

### 8.1 Tables

- `calendar_events` - Calendar events for audits, exercises, etc.

### 8.2 Related Modules / Code

**Entities:**
- `CalendarEventEntity` - `src/entities/app/calendar-event.entity.ts`

**Repositories / Services:**
- `CalendarService` - `src/modules/calendar/calendar.service.ts`
  - `list()` - Lists calendar events ✅
  - `create()`, `update()`, `delete()` - CRUD operations

**Controllers / Routes:**
- `CalendarController` - `src/modules/calendar/calendar.controller.ts`
  - `GET /api/v2/calendar/events` - List calendar events
  - `POST /api/v2/calendar/events` - Create calendar event
  - `PATCH /api/v2/calendar/events/:id` - Update calendar event
  - `DELETE /api/v2/calendar/events/:id` - Delete calendar event

**DTOs:**
- `QueryCalendarEventDto`, `CreateCalendarEventDto` - `src/modules/calendar/dto/`

### 8.3 Cross-Domain Links

**Links TO:**
- `calendar_events.related_entity_type`, `calendar_events.related_entity_id` - Polymorphic links
- Created automatically by AuditLifecycleService for audit engagements

**Links FROM:**
- Calendar events created by audit module

### 8.4 Change Sensitivity

**High impact if:**
- `tenant_id` column removed or made nullable
- Date/time fields change (`start_at`, `end_at`)

**Medium impact if:**
- `event_type` enum values change
- Polymorphic link structure changes

**Low impact if:**
- New optional columns added

---

## 9. Queue/Event Domain

### 9.1 Tables

- `queue.events_raw` - Raw event ingestion
- `event_normalized` - Normalized events

### 9.2 Related Modules / Code

**Entities:**
- `EventRawEntity` - `src/entities/queue/event-raw.entity.ts`
- `EventNormalizedEntity` - `src/entities/queue/event-normalized.entity.ts`

**Repositories / Services:**
- `QueueService` - `src/modules/queue/queue.service.ts`
  - Event ingestion and processing
- `EventRawProcessor`, `EventNormalizeProcessor`, `EventIncidentProcessor` - Workers

**Controllers / Routes:**
- `QueueController` - `src/modules/queue/queue.controller.ts`
  - Event ingestion endpoints

### 9.3 Cross-Domain Links

**Links TO:**
- `event_normalized.raw_id` → `events_raw.id`
- Events may reference entities from other domains

**Links FROM:**
- Events ingested from external systems

### 9.4 Change Sensitivity

**High impact if:**
- `tenant_id` column removed (nullable is acceptable for raw events)
- Event schema changes (affects processing pipeline)

**Medium impact if:**
- Severity enum values change
- Category field changes

**Low impact if:**
- New optional columns added
- Metadata fields modified

---

## 10. Summary of Critical Gaps

### 10.1 Missing Unique Constraints

- ⚠️ **`policies.code`** - Missing `UNIQUE(code, tenant_id)` constraint
  - **Impact:** Allows duplicate policy codes per tenant
  - **Risk:** Data integrity issues, potential conflicts
  - **Fix:** See `scripts/check-policies-duplicates.sql` for preflight check
  - **Preflight Script:** Run `check-policies-duplicates.sql` before adding constraint to identify existing duplicates

### 10.2 Legacy Code Without Tenant Filtering

- ✅ **`PolicyService.findAll()`** - NOW HAS tenant filtering (hardened 2025-01-28)
- ✅ **`PolicyService.findOne()`** - NOW HAS tenant filtering (hardened 2025-01-28)
- ✅ **`PolicyController`** - NOW HAS `@UseGuards(TenantGuard)` (hardened 2025-01-28)
  - **Status:** Legacy code is now tenant-safe but still deprecated. Use GovernanceService/Controller for new code.
  - **Risk:** Data leakage, unauthorized access
  - **Fix:** Use `GovernanceService` and `GovernanceController` instead

### 10.3 Tenant Query Safety

- See `DB-TENANT-QUERIES-CHECK.md` for detailed analysis
- Most services properly filter by tenant ✅
- Legacy PolicyService **NOW HAS tenant filtering** ✅ (hardened 2025-01-28)
- **Status:** All services are now tenant-safe. Legacy PolicyService/Controller are deprecated but hardened.

---

**End of DB Impact Map Documentation**

