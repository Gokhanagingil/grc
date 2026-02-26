# Documentation Discovery Pack v1

> **Purpose:** Evidence-first inventory of the GRC Platform repository, providing the foundation for six enterprise-grade documentation sets.
>
> **Generated:** 2026-02-26 | **Repo:** `Gokhanagingil/grc` | **Branch:** `main`

---

## Table of Contents

1. [Repo Map](#1-repo-map)
2. [Source of Truth — Key Files](#2-source-of-truth--key-files)
3. [Module Inventory](#3-module-inventory)
4. [Endpoint Inventory](#4-endpoint-inventory)
5. [UI Route Inventory](#5-ui-route-inventory)
6. [Data Model Inventory](#6-data-model-inventory)
7. [CI/CD Inventory](#7-cicd-inventory)
8. [Planned vs Implemented Matrix](#8-planned-vs-implemented-matrix)
9. [Known Gaps & Risks](#9-known-gaps--risks)
10. [Documentation Readiness Summary](#10-documentation-readiness-summary)

---

## 1. Repo Map

```
grc/
├── backend-nest/          # Canonical NestJS backend (primary, actively developed)
│   ├── src/
│   │   ├── admin/         # Admin system visibility
│   │   ├── ai-admin/      # AI Control Center (provider config, feature policy)
│   │   ├── api-catalog/   # API Catalog v1 (published APIs, API keys, public gateway)
│   │   ├── audit/         # Audit logging module
│   │   ├── auth/          # Authentication (JWT, MFA, LDAP, RBAC, guards)
│   │   ├── common/        # Shared: guards, interceptors, filters, middleware, DTOs
│   │   ├── config/        # Configuration validation (fail-fast)
│   │   ├── copilot/       # Incident Copilot (AI suggest/apply/learn/indexing)
│   │   ├── dashboard/     # Dashboard aggregation (GRC + ITSM KPIs)
│   │   ├── event-bus/     # Durable event bus (sys_event persistence)
│   │   ├── events/        # In-process event emitter module
│   │   ├── grc/           # GRC domain (Risk, Control, Policy, Audit, Evidence, ...)
│   │   ├── health/        # Health endpoints (live, ready, db, auth)
│   │   ├── itsm/          # ITSM domain (Incident, Change, Problem, CMDB, SLA, ...)
│   │   ├── jobs/          # Background jobs foundation (in-process runner)
│   │   ├── metrics/       # Prometheus-style /metrics endpoint
│   │   ├── migrations/    # TypeORM migrations (85+ migration files)
│   │   ├── notification-engine/  # Rules, templates, delivery, webhooks
│   │   ├── notifications/ # Notifications foundation (email + webhook)
│   │   ├── onboarding/    # Suite-first platform onboarding
│   │   ├── platform/      # Platform core (dynamic features, storage)
│   │   ├── platform-health/  # Smoke test persistence + admin UI
│   │   ├── scripts/       # Seeds, smoke tests, validators, migration tools
│   │   ├── settings/      # Tenant settings
│   │   ├── telemetry/     # Frontend error reporting
│   │   ├── tenants/       # Multi-tenant management
│   │   ├── todos/         # Todos (in-memory demo)
│   │   ├── tool-gateway/  # Tool Gateway v1.1 (ServiceNow read-only, governance)
│   │   └── users/         # User management
│   ├── test/              # E2E test suites
│   ├── Dockerfile         # Production Docker image
│   └── package.json       # Dependencies & scripts
│
├── backend/               # Legacy Express backend (being phased out)
│
├── frontend/              # React 18 + MUI 5 frontend
│   ├── src/
│   │   ├── api/           # API normalizers
│   │   ├── components/    # Shared components (Layout, AdminLayout, ErrorBoundary)
│   │   ├── contexts/      # AuthContext, NotificationContext, OnboardingContext
│   │   ├── hooks/         # Custom React hooks
│   │   ├── pages/         # Feature pages (GRC, ITSM, CMDB, Admin, Copilot)
│   │   ├── services/      # API clients (grcClient, userClient, platformApi)
│   │   ├── theme/         # Enterprise MUI theme
│   │   └── utils/         # Shared utilities
│   ├── nginx.conf         # Reverse proxy config (API routing)
│   ├── Dockerfile         # Frontend Docker image (nginx + React build)
│   └── package.json
│
├── docs/                  # 100+ design docs, runbooks, sprint notes
├── ops/                   # Operational scripts (deploy validation, DB validate)
├── scripts/               # Root-level utility scripts
├── tests/                 # Root-level test configs
│
├── docker-compose.staging.yml   # Staging: DB + Backend + Frontend (nginx)
├── docker-compose.nest.yml      # Local dev: DB + Backend
│
└── .github/workflows/    # 20+ CI/CD workflows
```

---

## 2. Source of Truth — Key Files

| Category | File | Purpose |
|----------|------|---------|
| **App bootstrap** | `backend-nest/src/app.module.ts` | Root module — wires all 25+ modules |
| **Routing** | `frontend/nginx.conf` | Nginx reverse proxy — API prefix stripping |
| **Frontend entry** | `frontend/src/App.tsx` | React Router — all UI routes (100+ routes) |
| **API client** | `frontend/src/services/grcClient.ts` | Axios-based API client with tenant header |
| **Auth context** | `frontend/src/contexts/AuthContext.tsx` | JWT auth + refresh token flow |
| **Data source** | `backend-nest/src/data-source.ts` | TypeORM connection + migration config |
| **Configuration** | `backend-nest/src/config/` | Env validation (fail-fast in prod) |
| **Staging compose** | `docker-compose.staging.yml` | 3-service stack (DB, Backend, Frontend) |
| **Dev compose** | `docker-compose.nest.yml` | 2-service stack (DB, Backend) |
| **Backend Dockerfile** | `backend-nest/Dockerfile` | Multi-stage Node.js build |
| **Frontend Dockerfile** | `frontend/Dockerfile` | Multi-stage React build + nginx |
| **Env template** | `backend-nest/.env.example` | Development env var template |
| **Prod env template** | `backend-nest/.env.production.template` | Production env checklist |
| **Deploy workflow** | `.github/workflows/deploy-staging.yml` | SSH-based staging deploy (700+ lines) |
| **Backend CI** | `.github/workflows/backend-nest-ci.yml` | Lint → Build → Test → E2E → Docker (1100+ lines) |
| **Frontend CI** | `.github/workflows/frontend-ci.yml` | Lint → Build → Test |

---

## 3. Module Inventory

### 3.1 Backend NestJS Modules (registered in `app.module.ts`)

| # | Module | Path | Domain | Status |
|---|--------|------|--------|--------|
| 1 | `HealthModule` | `src/health/` | Platform | **Implemented** |
| 2 | `UsersModule` | `src/users/` | Platform | **Implemented** |
| 3 | `AuthModule` | `src/auth/` | Security | **Implemented** |
| 4 | `TenantsModule` | `src/tenants/` | Platform | **Implemented** |
| 5 | `SettingsModule` | `src/settings/` | Platform | **Implemented** |
| 6 | `GrcModule` | `src/grc/` | GRC | **Implemented** |
| 7 | `ItsmModule` | `src/itsm/` | ITSM | **Implemented** |
| 8 | `CopilotModule` | `src/copilot/` | AI | **Implemented** |
| 9 | `AuditModule` | `src/audit/` | Security | **Implemented** |
| 10 | `MetricsModule` | `src/metrics/` | Observability | **Implemented** |
| 11 | `TelemetryModule` | `src/telemetry/` | Observability | **Implemented** |
| 12 | `DashboardModule` | `src/dashboard/` | Analytics | **Implemented** |
| 13 | `OnboardingModule` | `src/onboarding/` | Platform | **Implemented** |
| 14 | `PlatformModule` | `src/platform/` | Platform | **Implemented** |
| 15 | `AdminModule` | `src/admin/` | Admin | **Implemented** |
| 16 | `AiAdminModule` | `src/ai-admin/` | AI | **Implemented** |
| 17 | `ToolGatewayModule` | `src/tool-gateway/` | AI | **Implemented** |
| 18 | `NotificationsModule` | `src/notifications/` | Platform | **Implemented** |
| 19 | `NotificationEngineModule` | `src/notification-engine/` | Platform | **Implemented** |
| 20 | `ApiCatalogModule` | `src/api-catalog/` | Platform | **Implemented** |
| 21 | `CmdbModule` | `src/itsm/cmdb/` | ITSM/CMDB | **Implemented** |
| 22 | `CmdbImportModule` | `src/itsm/cmdb/import/` | ITSM/CMDB | **Implemented** |
| 23 | `CmdbHealthModule` | `src/itsm/cmdb/health/` | ITSM/CMDB | **Implemented** |
| 24 | `JobsModule` | `src/jobs/` | Platform | **Implemented** |
| 25 | `PlatformHealthModule` | `src/platform-health/` | Observability | **Implemented** |
| 26 | `TodosModule` | `src/todos/` | Demo | **Implemented** (in-memory) |
| 27 | `EventBusModule` | `src/event-bus/` | Platform | **Implemented** |
| 28 | `EventsModule` | `src/events/` | Platform | **Implemented** |

### 3.2 ITSM Sub-modules

| Sub-module | Path | Status |
|------------|------|--------|
| Incident Management | `src/itsm/incident/` | **Implemented** |
| Change Management | `src/itsm/change/` | **Implemented** |
| Problem Management | `src/itsm/problem/` | **Implemented** |
| Known Error DB | `src/itsm/known-error/` | **Implemented** |
| Major Incident | `src/itsm/major-incident/` | **Implemented** |
| Service Catalog | `src/itsm/service/` | **Implemented** |
| SLA Engine | `src/itsm/sla/` | **Implemented** |
| Business Rules | `src/itsm/business-rule/` | **Implemented** |
| Workflow Engine | `src/itsm/workflow/` | **Implemented** |
| UI Policies | `src/itsm/ui-policy/` | **Implemented** |
| Choice Lists | `src/itsm/choice/` | **Implemented** |
| Priority Matrix | `src/itsm/priority-matrix/` | **Implemented** |
| Journal/Work Notes | `src/itsm/journal/` | **Implemented** |
| PIR (Post-Incident) | `src/itsm/pir/` | **Implemented** |
| Analytics | `src/itsm/analytics/` | **Implemented** |
| Diagnostics | `src/itsm/diagnostics/` | **Implemented** |
| CMDB (CI, Classes, Rel) | `src/itsm/cmdb/` | **Implemented** |
| CMDB Import | `src/itsm/cmdb/import/` | **Implemented** |
| CMDB Health | `src/itsm/cmdb/health/` | **Implemented** |
| CMDB Topology | `src/itsm/cmdb/topology/` | **Implemented** |

### 3.3 GRC Sub-areas (within `src/grc/`)

| Area | Controllers | Entities | Status |
|------|------------|----------|--------|
| Risk Management | `grc-risk.controller.ts` | `grc-risk.entity.ts`, `grc-risk-assessment.entity.ts`, `grc-risk-category.entity.ts`, `grc-risk-treatment-action.entity.ts` | **Implemented** |
| Control Management | `grc-control.controller.ts` | `grc-control.entity.ts`, `grc-control-evidence.entity.ts`, `grc-control-test.entity.ts` | **Implemented** |
| Policy Management | `grc-policy.controller.ts` | `grc-policy.entity.ts`, `grc-policy-version.entity.ts` | **Implemented** |
| Evidence Management | `grc-evidence.controller.ts` | `grc-evidence.entity.ts`, `grc-evidence-test-result.entity.ts` | **Implemented** |
| Issue Management | `grc-issue.controller.ts` | `grc-issue.entity.ts` | **Implemented** |
| CAPA Management | `grc-capa.controller.ts` | `grc-capa.entity.ts`, `grc-capa-task.entity.ts` | **Implemented** |
| Audit Management | `grc-audit.controller.ts` | `grc-audit.entity.ts`, `grc-audit-requirement.entity.ts` | **Implemented** |
| Requirements | `grc-requirement.controller.ts` | `grc-requirement.entity.ts` | **Implemented** |
| Frameworks | `grc-frameworks.controller.ts` | `grc-framework.entity.ts`, `grc-tenant-framework.entity.ts` | **Implemented** |
| SOA (Statement of Applicability) | `grc-soa.controller.ts` | `grc-soa-profile.entity.ts`, `grc-soa-item.entity.ts` | **Implemented** |
| BCM | `bcm.controller.ts` | `bcm-service.entity.ts`, `bcm-bia.entity.ts`, `bcm-plan.entity.ts`, `bcm-exercise.entity.ts` | **Implemented** |
| Standards Library | `standard.controller.ts` | `standard.entity.ts`, `standard-clause.entity.ts` | **Implemented** |
| Process Controls | `process.controller.ts` | `process.entity.ts`, `process-control.entity.ts`, `process-violation.entity.ts` | **Implemented** |
| Risk Advisory (AI) | `risk-advisory.controller.ts` | — (uses GRC entities) | **Implemented** |
| Customer Risk Catalog | `customer-risk-catalog.controller.ts` | `customer-risk-catalog.entity.ts`, `customer-risk-binding.entity.ts` | **Implemented** |
| Coverage Analysis | `grc-coverage.controller.ts` | — (computed) | **Implemented** |
| GRC Insights | `grc-insights.controller.ts` | — (computed) | **Implemented** |
| Test Results | `grc-test-result.controller.ts` | `grc-test-result.entity.ts` | **Implemented** |
| Control Tests | `grc-control-test.controller.ts` | `grc-control-test.entity.ts` | **Implemented** |

---

## 4. Endpoint Inventory

### 4.1 Top-level Route Prefixes

> **Routing Convention:** Backend controllers use `@Controller('grc/...')` with NO `api/` prefix.
> Nginx exposes `/api/*` externally and strips the prefix before proxying to the backend.

| Prefix | Domain | Nginx Location |
|--------|--------|---------------|
| `/auth/` | Authentication | `^~ /auth/` |
| `/grc/` | GRC domain (risks, controls, policies, audits, evidence, ...) | `^~ /grc/` |
| `/itsm/` | ITSM domain (incidents, changes, problems, CMDB, SLA) | `^~ /itsm/` |
| `/health/` | Health checks (live, ready, db, auth) | `^~ /health/` |
| `/users/` | User management | `^~ /users/` |
| `/tenants/` | Multi-tenant management | `= /tenants`, `^~ /tenants/` |
| `/settings/` | Tenant settings | `^~ /settings/` |
| `/dashboard/` | Dashboard aggregation | `^~ /dashboard/` |
| `/platform/` | Platform core (modules, form-layouts) | `^~ /platform/` |
| `/onboarding/` | Onboarding flows | `^~ /onboarding/` |
| `/admin/` | Admin APIs (jobs, notifications, data-model) | Multiple `^~ /admin/*` locations |
| `/audit-logs` | Audit log access | `= /audit-logs`, `^~ /audit-logs` |
| `/todos` | Todos demo | `^~ /todos` |
| `/metrics` | Prometheus metrics | `= /metrics` |
| `/api/` | Prefix-stripping proxy (all routes) | `^~ /api/` → `proxy_pass http://backend/;` |
| `/ws/` | WebSocket (future) | `^~ /ws/` |

### 4.2 GRC Controller Routes (Major)

| Controller | Route Prefix | Key Operations |
|------------|-------------|----------------|
| `GrcRiskController` | `grc/risks` | CRUD + list + risk-control links |
| `GrcControlController` | `grc/controls` | CRUD + effectiveness + process links |
| `GrcPolicyController` | `grc/policies` | CRUD + versioning |
| `GrcEvidenceController` | `grc/evidence` | CRUD + file upload + test-result links |
| `GrcIssueController` | `grc/issues` | CRUD + linked requirements/evidence |
| `GrcCapaController` | `grc/capa` | CRUD + task management |
| `GrcAuditController` | `grc/audits` | CRUD + scope + findings + report generation |
| `GrcRequirementController` | `grc/requirements` | CRUD + control/standard mapping |
| `GrcFrameworksController` | `grc/frameworks` | CRUD + tenant assignment |
| `GrcSoaController` | `grc/soa` | Profiles + items + control/evidence links |
| `BcmController` | `grc/bcm` | Services + BIA + plans + exercises |
| `StandardController` | `grc/standards` | Standards + clauses + tree view |
| `ProcessController` | `grc/processes` | CRUD + control links + violations |
| `RiskAdvisoryController` | `grc/risk-advisory` | AI-powered risk analysis |
| `CustomerRiskCatalogController` | `grc/customer-risk-catalog` | Catalog + bindings + observations |
| `GrcCoverageController` | `grc/coverage` | Coverage analysis |
| `GrcInsightsController` | `grc/insights` | GRC health metrics |
| `ExportController` | `grc/export` | CSV/PDF export |
| `SearchController` | `grc/search` | Universal search |
| `CalendarController` | `grc/calendar` | GRC calendar events |
| `ControlResultController` | `grc/control-results` | Control test results |
| `ListOptionsController` | `grc/list-options` | Dynamic list options |
| `MetadataController` | `grc/metadata` | Field metadata |
| `DataModelDictionaryController` | `admin/data-model` | Data model dictionary |
| `PlatformBuilderController` | `grc/platform-builder` | Dynamic tables/forms |

### 4.3 ITSM Controller Routes (Major)

| Controller | Route Prefix | Key Operations |
|------------|-------------|----------------|
| `IncidentController` | `grc/itsm/incidents` | CRUD + assignment + state transitions |
| `IncidentCopilotController` | `grc/itsm/incidents/:id/copilot` | AI analysis + suggestions + apply |
| `ChangeController` | `grc/itsm/changes` | CRUD + approvals + CAB |
| `ProblemController` | `grc/itsm/problems` | CRUD + RCA + known-error maturation |
| `ItsmServiceController` (bridge) | `grc/itsm/services` | CRUD + service catalog |
| `ItsmAnalyticsController` | `itsm/analytics` | ITSM dashboards + KPIs |
| `CmdbCiController` | `grc/itsm/cmdb/cis` | CI CRUD + relationships |
| `CmdbCiClassController` | `grc/itsm/cmdb/classes` | Class hierarchy + effective schema |
| `CmdbImportController` | `grc/itsm/cmdb/imports` | Import jobs + reconciliation |
| `CmdbHealthController` | `grc/itsm/cmdb/health` | Health rules + quality score |

---

## 5. UI Route Inventory

### 5.1 Main Application Routes (`/`)

| Path | Component | Domain |
|------|-----------|--------|
| `/dashboard` | `Dashboard` | Platform |
| `/governance` | `Governance` | GRC |
| `/risk` | `RiskManagement` | GRC |
| `/risks/:id` | `RiskDetail` | GRC |
| `/compliance` | `Compliance` | GRC |
| `/controls` | `ControlList` | GRC |
| `/controls/:id` | `ControlDetail` | GRC |
| `/policies/new`, `/policies/:id` | `PolicyDetail` | GRC |
| `/evidence` | `EvidenceList` | GRC |
| `/evidence/:id` | `EvidenceDetail` | GRC |
| `/issues` | `IssueList` | GRC |
| `/issues/:id` | `IssueDetail` | GRC |
| `/capa` | `CapaList` | GRC |
| `/capa/:id` | `CapaDetail` | GRC |
| `/audits` | `AuditList` | GRC |
| `/audits/:id` | `AuditDetail` | GRC |
| `/standards` | `StandardsLibrary` | GRC |
| `/standards/:id` | `StandardDetail` | GRC |
| `/requirements/:id` | `RequirementDetail` | GRC |
| `/soa` | `SoaProfilesList` | GRC |
| `/soa/:id` | `SoaProfileDetail` | GRC |
| `/bcm/services` | `BcmServiceList` | GRC |
| `/bcm/exercises` | `BcmExerciseList` | GRC |
| `/processes` | `ProcessManagement` | GRC |
| `/violations` | `ProcessViolations` | GRC |
| `/coverage` | `Coverage` | GRC |
| `/insights` | `GrcInsights` | GRC |
| `/test-results` | `TestResultList` | GRC |
| `/control-tests` | `ControlTestList` | GRC |
| `/calendar` | `CalendarPage` | GRC |
| `/dotwalking` | `DotWalkingBuilder` | Platform |
| `/incidents` | `IncidentManagement` | ITSM (legacy) |
| `/todos` | `TodoList` | Demo |
| `/profile` | `Profile` | Platform |
| `/users` | `UserManagement` | Admin |

### 5.2 ITSM Routes (`/itsm/*`)

| Path | Component | Domain |
|------|-----------|--------|
| `/itsm/services` | `ItsmServiceList` | ITSM |
| `/itsm/services/:id` | `ItsmServiceDetail` | ITSM |
| `/itsm/incidents` | `ItsmIncidentList` | ITSM |
| `/itsm/incidents/:id` | `ItsmIncidentDetail` | ITSM |
| `/itsm/changes` | `ItsmChangeList` | ITSM |
| `/itsm/changes/:id` | `ItsmChangeDetail` | ITSM |
| `/itsm/change-calendar` | `ItsmChangeCalendar` | ITSM |
| `/itsm/change-templates` | `ItsmChangeTemplateList` | ITSM |
| `/itsm/change-management/cab` | `ItsmCabMeetingList` | ITSM |
| `/itsm/problems` | `ItsmProblemList` | ITSM |
| `/itsm/known-errors` | `ItsmKnownErrorList` | ITSM |
| `/itsm/major-incidents` | `ItsmMajorIncidentList` | ITSM |
| `/itsm/analytics` | `ItsmAnalyticsDashboard` | ITSM |
| `/itsm/diagnostics` | `ItsmDiagnostics` | ITSM (admin) |
| `/itsm/studio/choices` | `ItsmChoiceAdmin` | ITSM (admin) |
| `/itsm/studio/tables` | `ItsmStudioTables` | ITSM (admin) |
| `/itsm/studio/business-rules` | `ItsmStudioBusinessRules` | ITSM (admin) |
| `/itsm/studio/ui-policies` | `ItsmStudioUiPolicies` | ITSM (admin) |
| `/itsm/studio/ui-actions` | `ItsmStudioUiActions` | ITSM (admin) |
| `/itsm/studio/workflows` | `ItsmStudioWorkflows` | ITSM (admin) |
| `/itsm/studio/sla` | `ItsmStudioSla` | ITSM (admin) |
| `/itsm/studio/priority-matrix` | `ItsmStudioPriorityMatrix` | ITSM (admin) |

### 5.3 CMDB Routes (`/cmdb/*`)

| Path | Component | Domain |
|------|-----------|--------|
| `/cmdb/cis` | `CmdbCiList` | CMDB |
| `/cmdb/cis/:id` | `CmdbCiDetail` | CMDB |
| `/cmdb/classes` | `CmdbCiClassList` | CMDB |
| `/cmdb/classes/tree` | `CmdbCiClassTree` | CMDB |
| `/cmdb/classes/:id` | `CmdbCiClassDetail` | CMDB |
| `/cmdb/services` | `CmdbServiceList` | CMDB |
| `/cmdb/import-jobs` | `CmdbImportJobList` | CMDB |
| `/cmdb/reconcile-rules` | `CmdbReconcileRules` | CMDB (admin) |
| `/cmdb/relationship-types` | `CmdbRelationshipTypeList` | CMDB |

### 5.4 Admin Routes (`/admin/*`)

| Path | Component | Purpose |
|------|-----------|---------|
| `/admin/users` | `AdminUsers` | User management |
| `/admin/roles` | `AdminRoles` | Role + permission management |
| `/admin/settings` | `AdminSettings` | Tenant settings |
| `/admin/tenants` | `AdminTenants` | Tenant management |
| `/admin/audit-logs` | `AdminAuditLogs` | Audit log viewer |
| `/admin/system` | `AdminSystem` | System visibility + security posture |
| `/admin/data-model` | `AdminDataModel` | Data model dictionary |
| `/admin/frameworks` | `AdminFrameworks` | GRC framework management |
| `/admin/platform-builder` | `AdminPlatformBuilder` | Dynamic table/form builder |
| `/admin/event-log` | `AdminEventLog` | System event log |
| `/admin/notification-studio` | `AdminNotificationStudio` | Notification rules + templates |
| `/admin/api-catalog` | `AdminApiCatalog` | API catalog management |
| `/admin/platform-health` | `AdminPlatformHealth` | Platform health dashboard |
| `/admin/ai-control-center` | `AdminAiControlCenter` | AI provider config + feature policy |
| `/admin/tool-gateway` | `AdminToolGateway` | Tool Gateway management |

### 5.5 Dashboard Routes

| Path | Component | Access |
|------|-----------|--------|
| `/dashboards/audit` | `AuditDashboard` | admin, auditor, audit_manager, governance |
| `/dashboards/compliance` | `ComplianceDashboard` | admin, governance, compliance, audit_manager |
| `/dashboards/grc-health` | `GrcHealthDashboard` | admin, governance, executive, director |

---

## 6. Data Model Inventory

### 6.1 GRC Domain Entities

| Entity | Table (inferred) | Key Fields | Relationships |
|--------|-----------------|------------|---------------|
| `GrcRisk` | `grc_risks` | id, title, description, severity, likelihood, impact, status, tenantId | → Controls, Policies, Requirements |
| `GrcRiskAssessment` | `grc_risk_assessments` | id, riskId, assessmentDate, score | → Risk |
| `GrcRiskCategory` | `grc_risk_categories` | id, name, description | → Risks |
| `GrcRiskTreatmentAction` | `grc_risk_treatment_actions` | id, riskId, action, status | → Risk |
| `GrcControl` | `grc_controls` | id, title, description, status, effectiveness | → Risks, Evidence, Tests |
| `GrcControlEvidence` | `grc_control_evidence` | controlId, evidenceId | Control ↔ Evidence (join) |
| `GrcControlTest` | `grc_control_tests` | id, controlId, testDate, result | → Control |
| `GrcControlProcess` | `grc_control_processes` | controlId, processId | Control ↔ Process (join) |
| `GrcPolicy` | `grc_policies` | id, title, content, status, version | → Controls, Risks |
| `GrcPolicyVersion` | `grc_policy_versions` | id, policyId, version, content | → Policy |
| `GrcEvidence` | `grc_evidence` | id, title, type, filePath, status, dueDate | → Controls, Tests |
| `GrcIssue` | `grc_issues` | id, title, severity, status, source | → Requirements, Evidence, Clauses |
| `GrcCapa` | `grc_capa` | id, title, issueId, status | → Issue, Tasks |
| `GrcCapaTask` | `grc_capa_tasks` | id, capaId, title, status | → CAPA |
| `GrcAudit` | `grc_audits` | id, title, scope, status, startDate | → Requirements, Findings |
| `GrcAuditRequirement` | `grc_audit_requirements` | auditId, requirementId | Audit ↔ Requirement (join) |
| `GrcRequirement` | `grc_requirements` | id, title, description, standardId | → Controls, Standards |
| `GrcFramework` | `grc_frameworks` | id, name, version | → Tenant assignments |
| `GrcSoaProfile` | `grc_soa_profiles` | id, name, frameworkId | → SOA Items |
| `GrcSoaItem` | `grc_soa_items` | id, profileId, clauseId, applicability | → Controls, Evidence |
| `Standard` | `standards` | id, name, version, body | → Clauses |
| `StandardClause` | `standard_clauses` | id, standardId, code, title | → Requirements |
| `BcmService` | `bcm_services` | id, name, rto, rpo | → BIA, Plans |
| `BcmBia` | `bcm_bias` | id, serviceId | → Service |
| `BcmPlan` | `bcm_plans` | id, serviceId | → Steps |
| `BcmExercise` | `bcm_exercises` | id, name, date | — |
| `Process` | `processes` | id, name, status | → Controls, Violations |
| `ProcessControl` | `process_controls` | processId, controlId | Process ↔ Control |
| `ProcessViolation` | `process_violations` | id, processId, description | → Process |
| `CustomerRiskCatalog` | `customer_risk_catalogs` | id, name, category | → Bindings |
| `GrcTestResult` | `grc_test_results` | id, evidenceId, status | → Evidence |

### 6.2 ITSM Domain Entities

| Entity | Key Fields | Relationships |
|--------|------------|---------------|
| `Incident` | id, number, shortDescription, state, priority, assignedTo | → Service, CI, Journal |
| `IncidentAiAnalysis` | id, incidentId, analysis, suggestions | → Incident |
| `IncidentCi` | incidentId, ciId | Incident ↔ CI |
| `Change` | id, number, type, state, risk, startDate, endDate | → Approvals, Tasks, CIs |
| `Problem` | id, number, state, rootCause | → Incidents, Changes |
| `KnownError` | id, problemId, workaround | → Problem |
| `MajorIncident` | id, incidentId, severity | → Incident |
| `ItsmService` (bridge) | id, name, status | → Incidents, Changes |
| CMDB CI | id, name, classId, attributes (jsonb) | → Class, Relationships |
| CMDB CI Class | id, name, parentId, schema | → Parent class, CIs |
| CMDB Relationship | id, parentCiId, childCiId, typeId | → CIs, Type |
| CMDB Import Job | id, sourceId, status, mappings | → Source, Mappings |
| CMDB Health Rule | id, classId, expression, severity | → Class |

### 6.3 Platform / Auth Entities

| Entity | Domain | Notes |
|--------|--------|-------|
| `NestUser` | Auth | UUID-based, separate from legacy `users` |
| `NestTenant` | Multi-tenant | Central tenant table |
| `NestTenantSetting` | Settings | Key-value per tenant |
| `AuditLog` | Audit | Action/resource/user audit trail |
| `SysEvent` | Event Bus | Durable event persistence |
| `NotificationRule` | Notifications | Event-driven notification rules |
| `NotificationTemplate` | Notifications | Handlebars templates |
| `WebhookEndpoint` | Notifications | Outbound webhook config |
| `ApiCatalogEntry` | API Catalog | Published API definitions |
| `ApiKey` | API Catalog | API key management |
| `PlatformHealthRun` | Health | Smoke test run records |
| `AiProviderConfig` | AI Admin | AI provider (OpenAI, etc.) config |
| `ToolGatewayEndpoint` | Tool Gateway | External tool registrations |
| `SysDbObject` | Data Model | Table metadata |
| `SysDictionary` | Data Model | Column metadata |

---

## 7. CI/CD Inventory

| Workflow | File | Trigger | Purpose | Blocking? |
|----------|------|---------|---------|-----------|
| **NestJS Backend CI** | `backend-nest-ci.yml` | PR/push to `main`, `devin/**` | Lint → Build → Unit Tests → E2E → Docker Build | Yes (lint, build, unit) |
| **Frontend CI** | `frontend-ci.yml` | PR/push to `main`, `devin/**` | Lint → Build → Unit Tests | Yes |
| **Deploy to Staging** | `deploy-staging.yml` | Manual dispatch | SSH deploy → docker compose up → health checks → smoke tests | Manual |
| **Secret Scanning** | `secret-scanning.yml` | PR/push | TruffleHog secret scanning | Yes |
| **Secret Pattern Check** | `secret-pattern-check.yml` | PR/push | Regex-based credential detection | Yes |
| **Credential Check** | `credential-check.yml` | PR/push | Additional credential validation | Yes |
| **CodeQL** | `codeql.yml` | PR/push | GitHub Advanced Security code scanning | Advisory |
| **E2E Smoke** | `e2e-smoke.yml` | PR/push | Critical-path E2E smoke tests | Yes |
| **Platform Health Smoke** | `platform-health-smoke.yml` | PR/push | Platform health validation | Advisory |
| **Platform Health Nightly** | `platform-health-nightly.yml` | Schedule (nightly) | Nightly regression suite | — |
| **Platform Validate Dist** | `platform-validate-dist.yml` | PR/push | Validates dist build artifacts | Yes |
| **Scenario Pack Smoke** | `scenario-pack-smoke.yml` | PR/push | Scenario-based smoke tests | Advisory |
| **DB Bootstrap Preflight** | `db-bootstrap-preflight.yml` | PR/push | DB migration preflight validation | Yes |
| **Deploy Preflight** | `deploy-preflight.yml` | PR/push | Deployment readiness checks | Advisory |
| **Docker Build Preflight** | `docker-build-preflight.yml` | PR/push | Docker image build verification | Advisory |
| **Staging Smoke** | `staging-smoke.yml` | Manual/post-deploy | Staging endpoint smoke tests | — |
| **Backend CI (Legacy)** | `backend-ci.yml` | PR/push | Legacy Express backend CI | Legacy |
| **E2E Tests** | `e2e-tests.yml` | PR/push | Full E2E test suite | Advisory |
| **E2E Mock UI** | `e2e-mock-ui.yml` | PR/push | Frontend E2E with mocks | Advisory |
| **E2E Smoke Real** | `e2e-smoke-real.yml` | Manual | Real-server E2E smoke | Manual |
| **Dependabot** | `dependabot.yml` | Schedule | Dependency update PRs | — |

---

## 8. Planned vs Implemented Matrix

| Feature | Status | Evidence |
|---------|--------|----------|
| **GRC Risk Management** | Implemented | Entity, controller, service, UI pages, seeds |
| **GRC Control Management** | Implemented | Full CRUD + tests + evidence links |
| **GRC Policy Management** | Implemented | CRUD + versioning |
| **GRC Evidence Management** | Implemented | File upload + test result links |
| **GRC Issue Management** | Implemented | CRUD + source tracking |
| **GRC CAPA Management** | Implemented | CRUD + task breakdown |
| **GRC Audit Management** | Implemented | Scope, findings, report templates |
| **GRC Requirements** | Implemented | CRUD + control/standard mapping |
| **GRC Frameworks** | Implemented | CRUD + tenant assignment |
| **GRC SOA** | Implemented | Profiles, items, control/evidence links |
| **GRC BCM** | Implemented | Services, BIA, plans, exercises |
| **GRC Standards Library** | Implemented | Standards + clause tree |
| **GRC Process Controls** | Implemented | CRUD + violations |
| **GRC Coverage Analysis** | Implemented | Computed analytics |
| **GRC Insights / Analytics** | Implemented | KPI dashboard |
| **GRC Risk Advisory (AI)** | Implemented | Heuristic-based risk analysis |
| **GRC Customer Risk Catalog** | Implemented | Catalog, bindings, observations |
| **ITSM Incident Management** | Implemented | Full CRUD + state machine + CI links |
| **ITSM Change Management** | Implemented | CRUD + approvals + CAB + templates + calendar |
| **ITSM Problem Management** | Implemented | CRUD + RCA + known-error maturation |
| **ITSM Major Incident** | Implemented | Escalation + bridge management |
| **ITSM Service Catalog** | Implemented | Service CRUD + offerings |
| **ITSM SLA Engine** | Implemented | SLA definitions + condition builder |
| **ITSM Business Rules** | Implemented | Rule engine + stop processing |
| **ITSM Workflow Engine** | Implemented | State-based workflow definitions |
| **ITSM UI Policies** | Implemented | Dynamic form behavior |
| **ITSM Priority Matrix** | Implemented | Impact × Urgency matrix |
| **ITSM Studio (Admin)** | Implemented | Full admin UI for all ITSM config |
| **ITSM Analytics Dashboard** | Implemented | KPIs + trend analysis |
| **CMDB CI Management** | Implemented | CI CRUD + class hierarchy + effective schema |
| **CMDB Import/Reconciliation** | Implemented | Import jobs + mapping + reconcile rules |
| **CMDB Health Rules** | Implemented | Quality score + health rules |
| **CMDB Topology** | Implemented | Relationship semantics + traversal |
| **CMDB Service Portfolio** | Implemented | Service-CI mapping |
| **Copilot / Incident AI** | Implemented | Analysis + suggest + apply + learning |
| **AI Control Center** | Implemented | Provider config + feature policies + audit |
| **Tool Gateway** | Implemented | ServiceNow read-only + governance |
| **Notification Engine** | Implemented | Rules, templates, delivery, webhooks |
| **API Catalog** | Implemented | Published APIs + API keys + public gateway |
| **Platform Builder** | Implemented | Dynamic tables + forms |
| **Event Bus** | Implemented | sys_event persistence + event log |
| **Platform Health** | Implemented | Smoke test persistence + admin UI |
| **Risk Assessments (advanced)** | Planned | Route exists as ComingSoonPage |
| **Risk Treatments (advanced)** | Planned | Route exists as ComingSoonPage |
| **Policy Templates** | Planned | Route exists as ComingSoonPage |
| **Policy Reviews** | Planned | Route exists as ComingSoonPage |
| **Control Testing (advanced)** | Planned | Route exists as ComingSoonPage |
| **Audit Reports (advanced)** | Planned | Route exists as ComingSoonPage |
| **SLA Dashboard** | Planned | Route exists as ComingSoonPage |
| **Kubernetes Deployment** | Planned | Only Docker Compose implemented |
| **Redis / Queue System** | Not present | No Redis or queue in compose or deps |
| **Full-text Search (Elasticsearch)** | Not present | Search uses SQL LIKE/ILIKE queries |
| **WebSocket Real-time** | Planned | Nginx location exists, no backend impl |
| **LDAP/SSO Integration** | Partial | Auth module has `ldap/` directory, status unknown |
| **MFA** | Partial | Auth module has `mfa/` directory, status unknown |

---

## 9. Known Gaps & Risks

### 9.1 Documentation Risks (Avoid Overclaiming)

1. **LDAP/MFA status unclear** — Directories exist in `src/auth/` but actual implementation depth unknown. Mark as "partial/experimental" in docs.
2. **WebSocket support** — Nginx config has `/ws/` and `/socket.io/` locations but no backend WebSocket implementation found. Mark as "infrastructure-ready, not implemented."
3. **Legacy Express backend** — `backend/` still exists. Docs should note it is being phased out and is NOT the canonical backend.
4. **ComingSoon pages** — Several UI routes show `ComingSoonPage` placeholders. These are NOT implemented features.
5. **Redis/Queue** — Not present in any compose file or dependency. Do not claim async job processing capability.
6. **Elasticsearch** — Not present. Search is SQL-based. Do not claim full-text search.
7. **Kubernetes** — No K8s manifests exist. Only Docker Compose is a supported deployment option.
8. **Backup/Restore** — No automated backup scripts found. `docs/DB-BACKUP-RUNBOOK.md` exists as documentation only.
9. **Monitoring/Alerting** — `/metrics` endpoint exists (Prometheus-compatible) but no Grafana dashboards or alerting rules are in the repo.
10. **Test coverage** — Unit tests exist for some modules (spec files found) but coverage is not comprehensive across all modules.

### 9.2 Architecture Risks

| Risk | Severity | Notes |
|------|----------|-------|
| DB_SYNC kill switch exists but must be validated on every deploy | Medium | `app.module.ts` has hard exit if DB_SYNC=true in production |
| External volume dependency for staging DB | High | `grc-platform_grc_staging_postgres_data` must pre-exist |
| No automated backup/restore pipeline | High | Manual process only via docs |
| Single-server deployment (no HA) | Medium | Docker Compose is single-node only |
| Legacy Express backend still present | Low | May cause confusion; clearly label in docs |

---

## 10. Documentation Readiness Summary

### What We Can Document Immediately

- Full infrastructure topology (Docker Compose, nginx, health checks)
- Complete backend module architecture (28 modules, all implemented)
- Complete GRC domain model (20+ entity groups with relationships)
- Complete ITSM domain model (incident, change, problem, CMDB)
- All UI routes and admin pages
- CI/CD pipeline architecture (20+ workflows)
- API routing convention (nginx prefix stripping)
- Authentication and multi-tenant architecture
- AI features (Copilot, Risk Advisory, AI Control Center, Tool Gateway)
- Seed data strategy (15+ seed scripts)
- Migration strategy (85+ migration files)

### What Requires Additional Validation

- LDAP/SSO integration actual status (need to inspect `src/auth/ldap/`)
- MFA implementation depth (need to inspect `src/auth/mfa/`)
- Notification engine delivery status (email provider config)
- API Catalog public gateway actual external accessibility
- CMDB Import actual tested import sources
- Platform Builder dynamic table runtime behavior

### Top 10 Doc Risks to Avoid Overclaiming

1. Do NOT claim Kubernetes support — only Docker Compose exists
2. Do NOT claim Redis/queue-based async processing — jobs are in-process only
3. Do NOT claim full-text search — search is SQL LIKE-based
4. Do NOT claim WebSocket real-time features — infrastructure-only, no implementation
5. Do NOT claim "Risk Assessments" advanced module — it's a ComingSoon placeholder
6. Do NOT claim automated backup/restore — it's a manual runbook only
7. Do NOT claim HA/clustering — single Docker Compose node only
8. Do NOT claim SSO/SAML — only JWT auth is confirmed implemented
9. Do NOT claim monitoring dashboards — only raw `/metrics` endpoint exists
10. Do NOT claim the legacy Express backend is active — it is being phased out

---

## 11. Delivery Manifest

### Discovery & Planning Artifacts

| File | Path | Purpose |
|------|------|---------|
| Discovery Pack | `docs/discovery/DISCOVERY_PACK_v1.md` | This file — repo inventory, module map, gaps |
| Evidence Map | `docs/discovery/EVIDENCE_MAP_v1.md` | Traceability index — code refs for every doc claim |
| Style Guide | `docs/templates/DOC_STYLE_GUIDE.md` | Writing tone, callouts, Mermaid standards, citation format |
| Section Template | `docs/templates/DOC_SECTION_TEMPLATE.md` | Reusable skeleton for all six docs |

### Six-Doc Suite Outlines

| # | Document | Path | Status |
|---|----------|------|--------|
| 1 | Infrastructure & Platform Ops | `docs/suite/01_INFRASTRUCTURE.md` | Outline ready |
| 1A | Installation & Deployment Guide (BT Runbook) | `docs/suite/01A_INSTALLATION_GUIDE.md` | Detailed outline ready |
| 2 | Technical Architecture | `docs/suite/02_TECHNICAL.md` | Outline ready |
| 3 | ITSM Module | `docs/suite/03_ITSM.md` | Outline ready |
| 4 | GRC Module | `docs/suite/04_GRC.md` | Outline ready |
| 5 | ITSM-GRC Bridges | `docs/suite/05_ITSM_GRC_BRIDGES.md` | Outline ready |
| 6 | AI Features | `docs/suite/06_AI_FEATURES.md` | Outline ready |

> **Next Steps:** Use this discovery pack alongside `EVIDENCE_MAP_v1.md` to populate the six documentation outlines in `/docs/suite/`. Each outline is ready for final writing — fill in the placeholder sections with content, using the evidence map citations to back every claim.
