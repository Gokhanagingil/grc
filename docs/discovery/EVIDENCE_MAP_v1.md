# Evidence Map v1 — Traceability Index

> **Purpose:** Links every major documentation section to concrete code references (files, classes, endpoints, UI routes, seeds, tests).
>
> **Usage:** When writing each document in the six-doc suite, reference this map to cite evidence for every claim.
>
> **Convention:** `[IMPL]` = implemented and verified in code | `[PARTIAL]` = partially implemented | `[PLANNED]` = placeholder only

---

## Table of Contents

1. [Infrastructure](#1-infrastructure)
2. [Technical (Backend Architecture)](#2-technical-backend-architecture)
3. [ITSM](#3-itsm)
4. [GRC](#4-grc)
5. [ITSM-GRC Bridges](#5-itsm-grc-bridges)
6. [AI Features](#6-ai-features)

---

## 1. Infrastructure

### 1.1 Docker Compose — Staging

| Evidence | Reference |
|----------|-----------|
| Staging compose file | `docker-compose.staging.yml` |
| Services defined | `db` (postgres:15-alpine), `backend` (NestJS), `frontend` (nginx+React) |
| Project name pinning | `name: grc-platform` (line 32) |
| External volume | `grc-platform_grc_staging_postgres_data` (line 162-164) |
| Upload volume | `grc_uploads` mounted at `/app/data/uploads` (lines 106-108) |
| Backend port | `3002:3002` (line 100) |
| Frontend port | `80:80` (line 135) |
| Health checks | Backend: `wget http://localhost:3002/health/ready`; Frontend: `wget http://localhost/frontend-health` |
| Network | `grc-staging-network` (bridge) |

### 1.2 Docker Compose — Local Dev

| Evidence | Reference |
|----------|-----------|
| Dev compose file | `docker-compose.nest.yml` |
| Services defined | `db` (postgres:15-alpine), `backend-nest` (NestJS) |
| DB_SYNC default | `true` in dev (line 71), kill-switched in prod (`app.module.ts` lines 88-114) |
| Health checks | Same `wget` pattern as staging |

### 1.3 Nginx Reverse Proxy

| Evidence | Reference |
|----------|-----------|
| Config file | `frontend/nginx.conf` (399 lines) |
| API prefix stripping | `location ^~ /api/` → `proxy_pass http://backend/;` (trailing slash critical, lines 288-299) |
| Direct proxies | `/auth/`, `/grc/`, `/itsm/`, `/health/`, `/users/`, `/tenants/`, `/settings/`, `/dashboard/`, `/platform/`, `/onboarding/`, `/admin/*`, `/audit-logs`, `/todos`, `/metrics` |
| WebSocket ready | `/ws/` and `/socket.io/` locations defined (lines 344-369) `[PLANNED]` |
| SPA fallback | `location /` → `try_files $uri $uri/ /index.html` (line 390) |
| Frontend health | `location = /frontend-health` returns 200 "healthy" (lines 376-380) |
| Security headers | X-Frame-Options, X-Content-Type-Options, X-XSS-Protection (lines 20-22) |
| Gzip | Enabled for text/css/js/json (lines 14-17) |
| HTTPS config | `frontend/nginx-https.conf` (separate file for TLS) |

### 1.4 Backend Dockerfile

| Evidence | Reference |
|----------|-----------|
| File | `backend-nest/Dockerfile` |
| Base image | Node.js (multi-stage build) |
| Production artifact | `dist/` only — no `src/` in container |
| Entrypoint | `node dist/main` |

### 1.5 Frontend Dockerfile

| Evidence | Reference |
|----------|-----------|
| File | `frontend/Dockerfile` |
| Build stage | `react-scripts build` |
| Serve stage | nginx with `frontend/nginx.conf` |

### 1.6 Environment Configuration

| Evidence | Reference |
|----------|-----------|
| Dev env template | `backend-nest/.env.example` (100 lines) |
| Prod env template | `backend-nest/.env.production.template` (55 lines, with checklist) |
| Staging env template | `backend-nest/.env.staging.example` |
| Frontend env | `frontend/.env.example`, `frontend/.env.staging` |
| Config validation | `backend-nest/src/config/` — fail-fast if invalid |
| DB_SYNC kill switch | `app.module.ts` lines 88-114 — `process.exit(1)` if `DB_SYNC=true` in production/staging |

### 1.7 CI/CD Workflows

| Workflow | File | Key Evidence |
|----------|------|-------------|
| Backend CI | `.github/workflows/backend-nest-ci.yml` (1166 lines) | Lint → Security Audit → Build → Unit Tests → E2E → Docker Build → API Contract Check |
| Frontend CI | `.github/workflows/frontend-ci.yml` (184 lines) | Lint → Security Audit → Build → Unit Tests |
| Deploy Staging | `.github/workflows/deploy-staging.yml` (703 lines) | SSH key setup → Connectivity preflight → Disk preflight → Docker Compose up → Health checks → Smoke tests |
| Secret Scanning | `.github/workflows/secret-scanning.yml` | TruffleHog-based credential scanning |
| Secret Pattern | `.github/workflows/secret-pattern-check.yml` | Regex-based pattern matching |
| Credential Check | `.github/workflows/credential-check.yml` | Additional credential validation |
| CodeQL | `.github/workflows/codeql.yml` | GitHub Advanced Security |
| E2E Smoke | `.github/workflows/e2e-smoke.yml` | Critical-path E2E validation |
| Platform Health | `.github/workflows/platform-health-smoke.yml` | Platform health validation |
| DB Preflight | `.github/workflows/db-bootstrap-preflight.yml` | Migration preflight |
| Dependabot | `.github/dependabot.yml` | Automated dependency updates |

### 1.8 Operational Scripts

| Script | Path | Purpose |
|--------|------|---------|
| DB Validate | `ops/staging-db-validate.sh` | Validate staging DB volume + connectivity |
| Deploy Validate | `ops/staging-deploy-validate.sh` | Post-deploy validation |
| Golden Flow Verify | `ops/rc1-golden-flow-verify.sh` | RC1 golden flow smoke test |
| Sourcemap Trace | `ops/sourcemap_trace.py` | Debug minified frontend stack traces |
| Ops Tests | `ops/tests/` | Bash regression tests for deploy scripts |

---

## 2. Technical (Backend Architecture)

### 2.1 App Module & Bootstrap

| Evidence | Reference |
|----------|-----------|
| Root module | `backend-nest/src/app.module.ts` (294 lines) |
| Module registration | 28 modules imported (lines 65-245) |
| Global guards | `MethodBasedThrottlerGuard` (rate limiting, lines 259-261) |
| Global interceptors | `RequestTimingInterceptor`, `PerformanceInterceptor`, `ResponseTransformInterceptor` (lines 263-281) |
| Global filters | `GlobalExceptionFilter` (lines 252-255) |
| Middleware | `SecurityHeadersMiddleware`, `CorrelationIdMiddleware` (lines 288-292) |
| Rate limiting | Read: 120/min, Write: 30/min, Auth: 10/min (lines 222-244) |
| Response envelope | `ResponseTransformInterceptor` wraps all responses in `{ success, data }` |

### 2.2 Authentication & Authorization

| Evidence | Reference |
|----------|-----------|
| Auth module | `backend-nest/src/auth/auth.module.ts` |
| Auth controller | `backend-nest/src/auth/auth.controller.ts` |
| Auth service | `backend-nest/src/auth/auth.service.ts` |
| JWT strategy | `backend-nest/src/auth/strategies/` |
| Guards | `backend-nest/src/auth/guards/jwt-auth.guard.ts`, `roles.guard.ts` |
| Permissions | `backend-nest/src/auth/permissions/permission.enum.ts` — all permission constants |
| Permissions guard | `backend-nest/src/auth/permissions/permissions.guard.ts` |
| Permissions decorator | `backend-nest/src/auth/permissions/permissions.decorator.ts` |
| Guard stack pattern | `JwtAuthGuard` + `TenantGuard` + `PermissionsGuard` (used on all protected endpoints) |
| LDAP directory | `backend-nest/src/auth/ldap/` `[PARTIAL]` |
| MFA directory | `backend-nest/src/auth/mfa/` `[PARTIAL]` |
| Security module | `backend-nest/src/auth/security/` |
| Test | `backend-nest/src/auth/auth.service.spec.ts` |

### 2.3 Multi-Tenancy

| Evidence | Reference |
|----------|-----------|
| Tenant module | `backend-nest/src/tenants/` |
| Tenant header | `x-tenant-id` (used in every API call) |
| Tenant guard | `backend-nest/src/common/guards/` (TenantGuard) |
| Multi-tenant base | `backend-nest/src/common/multi-tenant-service.base.ts` |
| Demo tenant ID | `00000000-0000-0000-0000-000000000001` |
| All entities have | `tenantId` column (uuid FK to `nest_tenants`) |

### 2.4 Common Infrastructure

| Evidence | Reference |
|----------|-----------|
| Context | `backend-nest/src/common/context/` |
| Decorators | `backend-nest/src/common/decorators/` |
| DTOs | `backend-nest/src/common/dto/` |
| Entities | `backend-nest/src/common/entities/` |
| Filters | `backend-nest/src/common/filters/` — `GlobalExceptionFilter` |
| Guards | `backend-nest/src/common/guards/` — `MethodBasedThrottlerGuard`, TenantGuard |
| Interceptors | `backend-nest/src/common/interceptors/` — timing, perf, response transform |
| List query | `backend-nest/src/common/list-query/` — LIST-CONTRACT implementation |
| Logger | `backend-nest/src/common/logger/` — `StructuredLoggerService` |
| Middleware | `backend-nest/src/common/middleware/` — SecurityHeaders, CorrelationId |
| Pipes | `backend-nest/src/common/pipes/` |
| Services | `backend-nest/src/common/services/` |
| Types | `backend-nest/src/common/types/` |
| Utils | `backend-nest/src/common/utils/` — `safeArray`, `ensureArray`, etc. |

### 2.5 Health Endpoints

| Evidence | Reference |
|----------|-----------|
| Health module | `backend-nest/src/health/health.module.ts` |
| Health controller | `backend-nest/src/health/health.controller.ts` — `/health/live`, `/health/ready`, `/health/db`, `/health/auth` |
| Health v2 | `backend-nest/src/health/health-v2.controller.ts` |
| Health service | `backend-nest/src/health/health.service.ts` |
| Tests | `backend-nest/src/health/health.controller.spec.ts`, `health.service.spec.ts` |

### 2.6 Database & Migrations

| Evidence | Reference |
|----------|-----------|
| Data source | `backend-nest/src/data-source.ts` |
| Migrations dir | `backend-nest/src/migrations/` (85+ files) |
| Migration scripts | `migration:run`, `migration:run:prod`, `migration:show:prod` (package.json) |
| Schema contract | `backend-nest/src/scripts/schema-contract.ts`, `schema-contract.cli.ts` |
| DB validation | `backend-nest/src/scripts/validate-db.ts`, `validate-migrations.ts` |
| Enum convention | Postgres enum labels are UPPERCASE (e.g., `BASELINE`, `PLANNED`, `IN_PROGRESS`) |

### 2.7 Seed Scripts

| Seed | Script | Purpose |
|------|--------|---------|
| GRC core | `seed-grc.ts` | Base GRC data (risks, controls, policies) |
| Standards | `seed-standards.ts` | ISO 27001, NIST, etc. |
| Frameworks | `seed-frameworks.ts` | Compliance frameworks |
| Golden Flow | `seed-golden-flow.ts` | Demo golden-path data |
| Demo Story | `seed-demo-story.ts` | Demo scenario data |
| ITSM Choices | `seed-itsm-choices.ts` | ITSM picklist values |
| ITSM Baseline | `seed-itsm-baseline.ts` | ITSM baseline data |
| Dictionary Core | `seed-dictionary-core.ts` | Data dictionary metadata |
| SOA | `seed-soa.ts` | Statement of Applicability |
| Onboarding | `seed-onboarding.ts` | Onboarding wizard data |
| Notification Demo | `seed-notification-demo.ts` | Notification templates |
| Change Governance | `seed-change-governance-demo.ts` | Change management demo |
| Webhook Demo | `seed-webhook-demo.ts` | Webhook endpoint demo |
| API Catalog Demo | `seed-api-catalog-demo.ts` | API catalog entries |
| ITSM Analytics | `seed-itsm-analytics-demo.ts` | Analytics demo data |
| Scenario Pack | `seed-scenario-pack.ts` | Full scenario demo |
| CMDB MI Demo | `seed-cmdb-mi-demo.ts` | CMDB Model Intelligence demo |
| CMDB Content Pack | `seed-cmdb-content-pack-v1.ts` | CMDB baseline classes/CIs |

### 2.8 Smoke & Validation Scripts

| Script | Purpose |
|--------|---------|
| `smoke-grc.ts` | GRC endpoint smoke tests |
| `smoke-soa.ts` | SOA endpoint smoke tests |
| `smoke-golden-flow.ts` | Golden flow E2E validation |
| `smoke-auth-onboarding.ts` | Auth + onboarding smoke |
| `smoke-security.ts` | Security posture validation |
| `smoke-topology-intelligence.ts` | CMDB topology validation |
| `platform-validate.ts` | Full platform validation (`platform:validate:prod`) |
| `acceptance-runner.ts` | Acceptance test orchestrator |
| `validate-env.ts` | Environment variable validation |
| `validate-db.ts` | Database schema validation |
| `validate-migrations.ts` | Migration consistency check |
| `validate-seed-dist.ts` | Verify seed scripts exist in dist |

---

## 3. ITSM

### 3.1 Incident Management

| Evidence | Reference |
|----------|-----------|
| Entity | `backend-nest/src/itsm/incident/incident.entity.ts` |
| AI Analysis entity | `backend-nest/src/itsm/incident/incident-ai-analysis.entity.ts` |
| CI link entity | `backend-nest/src/itsm/incident/incident-ci.entity.ts` |
| Controller | `backend-nest/src/itsm/incident/incident.controller.ts` |
| Copilot controller | `backend-nest/src/itsm/incident/incident-copilot.controller.ts` |
| Service | `backend-nest/src/itsm/incident/incident.service.ts` |
| CI service | `backend-nest/src/itsm/incident/incident-ci.service.ts` |
| Copilot service | `backend-nest/src/itsm/incident/incident-copilot.service.ts` |
| DTOs | `backend-nest/src/itsm/incident/dto/` |
| Tests | `backend-nest/src/itsm/incident/__tests__/`, `incident.service.spec.ts` |
| UI - List | `frontend/src/pages/itsm/ItsmIncidentList.tsx` |
| UI - Detail | `frontend/src/pages/itsm/ItsmIncidentDetail.tsx` |
| UI route | `/itsm/incidents`, `/itsm/incidents/:id` |
| Bridge entity (GRC) | `backend-nest/src/grc/entities/itsm-incident.entity.ts` |
| Bridge risk link | `backend-nest/src/grc/entities/itsm-incident-risk.entity.ts` |
| Bridge control link | `backend-nest/src/grc/entities/itsm-incident-control.entity.ts` |

### 3.2 Change Management

| Evidence | Reference |
|----------|-----------|
| Entity | `backend-nest/src/itsm/change/change.entity.ts` |
| CI link entity | `backend-nest/src/itsm/change/change-ci.entity.ts` |
| Controller | `backend-nest/src/itsm/change/change.controller.ts` |
| CI controller | `backend-nest/src/itsm/change/change-ci.controller.ts` |
| Service | `backend-nest/src/itsm/change/change.service.ts` |
| CI service | `backend-nest/src/itsm/change/change-ci.service.ts` |
| Approval sub-module | `backend-nest/src/itsm/change/approval/` |
| CAB sub-module | `backend-nest/src/itsm/change/cab/` |
| Calendar sub-module | `backend-nest/src/itsm/change/calendar/` |
| Task sub-module | `backend-nest/src/itsm/change/task/` |
| Template sub-module | `backend-nest/src/itsm/change/template/` |
| Risk sub-module | `backend-nest/src/itsm/change/risk/` |
| DTOs | `backend-nest/src/itsm/change/dto/` |
| Tests | `change.service.spec.ts`, `change-ci.service.spec.ts`, `change-linked.service.spec.ts` |
| UI - List | `frontend/src/pages/itsm/ItsmChangeList.tsx` |
| UI - Detail | `frontend/src/pages/itsm/ItsmChangeDetail.tsx` |
| UI - Calendar | `frontend/src/pages/itsm/ItsmChangeCalendar.tsx` |
| UI - Templates | `frontend/src/pages/itsm/ItsmChangeTemplateList.tsx`, `ItsmChangeTemplateDetail.tsx` |
| UI - CAB | `frontend/src/pages/itsm/ItsmCabMeetingList.tsx`, `ItsmCabMeetingDetail.tsx` |
| Bridge entity (GRC) | `backend-nest/src/grc/entities/itsm-change.entity.ts` |
| Bridge risk link | `backend-nest/src/grc/entities/itsm-change-risk.entity.ts` |
| Bridge control link | `backend-nest/src/grc/entities/itsm-change-control.entity.ts` |

### 3.3 Problem Management

| Evidence | Reference |
|----------|-----------|
| Entity | `backend-nest/src/itsm/problem/problem.entity.ts` |
| Join entities | `problem-incident.entity.ts`, `problem-change.entity.ts` |
| Controller | `backend-nest/src/itsm/problem/problem.controller.ts` |
| Service | `backend-nest/src/itsm/problem/problem.service.ts` |
| Tests | `problem.service.spec.ts`, `problem-phase2.service.spec.ts` |
| UI - List | `frontend/src/pages/itsm/ItsmProblemList.tsx` |
| UI - Detail | `frontend/src/pages/itsm/ItsmProblemDetail.tsx` |

### 3.4 Known Error Database

| Evidence | Reference |
|----------|-----------|
| Module | `backend-nest/src/itsm/known-error/` |
| UI - List | `frontend/src/pages/itsm/ItsmKnownErrorList.tsx` |
| UI - Detail | `frontend/src/pages/itsm/ItsmKnownErrorDetail.tsx` |

### 3.5 Major Incident

| Evidence | Reference |
|----------|-----------|
| Module | `backend-nest/src/itsm/major-incident/` |
| UI - List | `frontend/src/pages/itsm/ItsmMajorIncidentList.tsx` |
| UI - Detail | `frontend/src/pages/itsm/ItsmMajorIncidentDetail.tsx` |

### 3.6 Service Catalog

| Evidence | Reference |
|----------|-----------|
| Entity | `backend-nest/src/itsm/service/service.entity.ts` |
| Controller | `backend-nest/src/itsm/service/service.controller.ts` |
| Service | `backend-nest/src/itsm/service/service.service.ts` |
| Tests | `service.service.spec.ts` |
| UI - List | `frontend/src/pages/itsm/ItsmServiceList.tsx` |
| UI - Detail | `frontend/src/pages/itsm/ItsmServiceDetail.tsx` |

### 3.7 SLA Engine

| Evidence | Reference |
|----------|-----------|
| Module | `backend-nest/src/itsm/sla/` |
| Migration | `1738700000000-CreateSlaEngine.ts`, `1742000000000-SlaEngine2ConditionBuilder.ts` |
| UI | `frontend/src/pages/itsm/studio/ItsmStudioSla.tsx` (admin) |

### 3.8 ITSM Studio (Configuration)

| Feature | Backend Path | UI Path |
|---------|-------------|---------|
| Business Rules | `src/itsm/business-rule/` | `ItsmStudioBusinessRules.tsx` |
| UI Policies | `src/itsm/ui-policy/` | `ItsmStudioUiPolicies.tsx`, `ItsmStudioUiActions.tsx` |
| Workflows | `src/itsm/workflow/` | `ItsmStudioWorkflows.tsx` |
| Choices | `src/itsm/choice/` | `ItsmChoiceAdmin.tsx` |
| SLA | `src/itsm/sla/` | `ItsmStudioSla.tsx` |
| Priority Matrix | `src/itsm/priority-matrix/` | `ItsmStudioPriorityMatrix.tsx` |
| Tables | — (platform) | `ItsmStudioTables.tsx` |

### 3.9 ITSM Analytics

| Evidence | Reference |
|----------|-----------|
| Controller | `backend-nest/src/itsm/analytics/analytics.controller.ts` |
| Service | `backend-nest/src/itsm/analytics/analytics.service.ts` |
| Module | `backend-nest/src/itsm/analytics/analytics.module.ts` |
| Tests | `analytics.service.spec.ts` |
| UI | `frontend/src/pages/itsm/ItsmAnalyticsDashboard.tsx` |
| Seed | `seed-itsm-analytics-demo.ts` |

### 3.10 CMDB

| Feature | Backend Path | UI Path |
|---------|-------------|---------|
| CI Management | `src/itsm/cmdb/ci/` | `CmdbCiList.tsx`, `CmdbCiDetail.tsx` |
| CI Classes | `src/itsm/cmdb/ci-class/` | `CmdbCiClassList.tsx`, `CmdbCiClassDetail.tsx`, `CmdbCiClassTree.tsx` |
| CI Relationships | `src/itsm/cmdb/ci-rel/` | (in CI detail) |
| Relationship Types | `src/itsm/cmdb/relationship-type/` | `CmdbRelationshipTypeList.tsx`, `CmdbRelationshipTypeDetail.tsx` |
| Import/Reconciliation | `src/itsm/cmdb/import/` | `CmdbImportJobList.tsx`, `CmdbImportJobDetail.tsx` |
| Health/Quality | `src/itsm/cmdb/health/` | (admin) |
| Topology | `src/itsm/cmdb/topology/` | — |
| Service Portfolio | `src/itsm/cmdb/service/` | `CmdbServiceList.tsx`, `CmdbServiceDetail.tsx` |
| Service-CI Mapping | `src/itsm/cmdb/service-ci/` | — |
| Service Offering | `src/itsm/cmdb/service-offering/` | — |
| Content Pack | `src/itsm/cmdb/content-pack/` | — (seed-driven) |
| Effective Schema | — | `EffectiveSchemaPanel.tsx` |
| Relationship Semantics | — | `RelationshipSemanticsTab.tsx` |
| Class Workbench | — | `ClassWorkbenchDetailPanel.tsx` |

---

## 4. GRC

### 4.1 Risk Management

| Evidence | Reference |
|----------|-----------|
| Entity | `src/grc/entities/grc-risk.entity.ts` |
| Assessment entity | `src/grc/entities/grc-risk-assessment.entity.ts` |
| Category entity | `src/grc/entities/grc-risk-category.entity.ts` |
| Treatment entity | `src/grc/entities/grc-risk-treatment-action.entity.ts` |
| Risk-Control link | `src/grc/entities/grc-risk-control.entity.ts` |
| Risk-Policy link | `src/grc/entities/grc-risk-policy.entity.ts` |
| Risk-Requirement link | `src/grc/entities/grc-risk-requirement.entity.ts` |
| Controller | `src/grc/controllers/grc-risk.controller.ts` |
| Service | `src/grc/services/grc-risk.service.ts` |
| Tests | `src/grc/services/grc-risk.service.spec.ts` |
| UI - List | `frontend/src/pages/RiskManagement.tsx` |
| UI - Detail | `frontend/src/pages/RiskDetail.tsx` |
| Seed | `seed-grc.ts`, `seed-golden-flow.ts` |
| Smoke | `smoke-grc.ts` |

### 4.2 Control Management

| Evidence | Reference |
|----------|-----------|
| Entity | `src/grc/entities/grc-control.entity.ts` |
| Evidence link | `src/grc/entities/grc-control-evidence.entity.ts` |
| Test entity | `src/grc/entities/grc-control-test.entity.ts` |
| Process link | `src/grc/entities/grc-control-process.entity.ts` |
| Controller | `src/grc/controllers/grc-control.controller.ts` |
| Service | `src/grc/services/grc-evidence.service.ts` |
| Tests | `src/grc/controllers/grc-control.controller.spec.ts` |
| UI - List | `frontend/src/pages/ControlList.tsx` |
| UI - Detail | `frontend/src/pages/ControlDetail.tsx` |

### 4.3 Policy Management

| Evidence | Reference |
|----------|-----------|
| Entity | `src/grc/entities/grc-policy.entity.ts` |
| Version entity | `src/grc/entities/grc-policy-version.entity.ts` |
| Policy-Control link | `src/grc/entities/grc-policy-control.entity.ts` |
| Controller | `src/grc/controllers/grc-policy.controller.ts` |
| Version controller | `src/grc/controllers/grc-policy-version.controller.ts` |
| Service | `src/grc/services/grc-policy.service.ts` |
| Tests | `src/grc/services/grc-policy.service.spec.ts` |
| UI | `frontend/src/pages/PolicyDetail.tsx` |

### 4.4 Evidence Management

| Evidence | Reference |
|----------|-----------|
| Entity | `src/grc/entities/grc-evidence.entity.ts` |
| Test result link | `src/grc/entities/grc-evidence-test-result.entity.ts` |
| Controller | `src/grc/controllers/grc-evidence.controller.ts` |
| Service | `src/grc/services/grc-evidence.service.ts` |
| Tests | `src/grc/controllers/grc-evidence.controller.spec.ts`, `src/grc/services/grc-evidence.service.spec.ts` |
| UI - List | `frontend/src/pages/EvidenceList.tsx` |
| UI - Detail | `frontend/src/pages/EvidenceDetail.tsx` |

### 4.5 Issue & CAPA Management

| Evidence | Reference |
|----------|-----------|
| Issue entity | `src/grc/entities/grc-issue.entity.ts` |
| Issue links | `grc-issue-clause.entity.ts`, `grc-issue-evidence.entity.ts`, `grc-issue-requirement.entity.ts` |
| CAPA entity | `src/grc/entities/grc-capa.entity.ts` |
| CAPA task | `src/grc/entities/grc-capa-task.entity.ts` |
| Issue controller | `src/grc/controllers/grc-issue.controller.ts` |
| CAPA controller | `src/grc/controllers/grc-capa.controller.ts` |
| UI | `IssueList.tsx`, `IssueDetail.tsx`, `CapaList.tsx`, `CapaDetail.tsx` |

### 4.6 Audit Management

| Evidence | Reference |
|----------|-----------|
| Audit entity | `src/grc/entities/grc-audit.entity.ts` |
| Audit requirement | `src/grc/entities/grc-audit-requirement.entity.ts` |
| Scope standard | `src/grc/entities/audit-scope-standard.entity.ts` |
| Scope clause | `src/grc/entities/audit-scope-clause.entity.ts` |
| Report template | `src/grc/entities/grc-audit-report-template.entity.ts` |
| Controller | `src/grc/controllers/grc-audit.controller.ts` |
| Report controller | `src/grc/controllers/audit-report-template.controller.ts` |
| Service | `src/grc/services/grc-audit.service.ts` |
| UI | `AuditList.tsx`, `AuditDetail.tsx`, `ReportViewer.tsx`, `FindingDetail.tsx` |
| Dashboard | `frontend/src/pages/dashboards/AuditDashboard.tsx` (role-protected) |

### 4.7 Requirements & Standards

| Evidence | Reference |
|----------|-----------|
| Requirement entity | `src/grc/entities/grc-requirement.entity.ts` |
| Requirement-Control | `src/grc/entities/grc-requirement-control.entity.ts` |
| Standard entity | `src/grc/entities/standard.entity.ts` (table: `standards`) |
| Clause entity | `src/grc/entities/standard-clause.entity.ts` (table: `standard_clauses`) |
| Controllers | `grc-requirement.controller.ts`, `standard.controller.ts`, `standards.controller.ts`, `standard-clause.controller.ts` |
| Service | `src/grc/services/grc-requirement.service.ts`, `src/grc/services/standards.service.ts` |
| Tests | `grc-requirement.service.spec.ts`, `grc-frameworks.service.spec.ts` |
| UI | `StandardsLibrary.tsx`, `StandardDetail.tsx`, `ClauseDetail.tsx`, `RequirementDetail.tsx` |
| Seed | `seed-standards.ts` |

### 4.8 SOA (Statement of Applicability)

| Evidence | Reference |
|----------|-----------|
| Profile entity | `src/grc/entities/grc-soa-profile.entity.ts` |
| Item entity | `src/grc/entities/grc-soa-item.entity.ts` |
| Item-Control link | `src/grc/entities/grc-soa-item-control.entity.ts` |
| Item-Evidence link | `src/grc/entities/grc-soa-item-evidence.entity.ts` |
| Controller | `src/grc/controllers/grc-soa.controller.ts` |
| Service | `src/grc/services/grc-soa.service.ts` |
| UI | `SoaProfilesList.tsx`, `SoaProfileDetail.tsx`, `SoaItemDetail.tsx` |
| Seed | `seed-soa.ts` |
| Smoke | `smoke-soa.ts` |

### 4.9 BCM (Business Continuity Management)

| Evidence | Reference |
|----------|-----------|
| Service entity | `src/grc/entities/bcm-service.entity.ts` |
| BIA entity | `src/grc/entities/bcm-bia.entity.ts` |
| Plan entity | `src/grc/entities/bcm-plan.entity.ts` |
| Plan step | `src/grc/entities/bcm-plan-step.entity.ts` |
| Exercise entity | `src/grc/entities/bcm-exercise.entity.ts` |
| Controller | `src/grc/controllers/bcm.controller.ts` |
| Service | `src/grc/services/bcm.service.ts` |
| UI | `BcmServiceList.tsx`, `BcmServiceDetail.tsx`, `BcmExerciseList.tsx` |

### 4.10 Frameworks

| Evidence | Reference |
|----------|-----------|
| Framework entity | `src/grc/entities/grc-framework.entity.ts` |
| Tenant framework | `src/grc/entities/grc-tenant-framework.entity.ts` |
| Controller | `src/grc/controllers/grc-frameworks.controller.ts` |
| Service | `src/grc/services/grc-frameworks.service.ts` |
| Tests | `grc-frameworks.service.spec.ts` |
| UI | `frontend/src/pages/admin/AdminFrameworks.tsx` |
| Seed | `seed-frameworks.ts` |

### 4.11 Process Controls

| Evidence | Reference |
|----------|-----------|
| Process entity | `src/grc/entities/process.entity.ts` |
| Process-Control | `src/grc/entities/process-control.entity.ts` |
| Process-Control-Risk | `src/grc/entities/process-control-risk.entity.ts` |
| Violation entity | `src/grc/entities/process-violation.entity.ts` |
| Controllers | `process.controller.ts`, `process-control.controller.ts`, `process-violation.controller.ts` |
| Services | `process.service.ts`, `process-control.service.ts`, `process-violation.service.ts`, `process-compliance.service.ts` |
| Tests | `process.service.spec.ts` |
| UI | `ProcessManagement.tsx`, `ProcessDetail.tsx`, `ProcessViolations.tsx`, `ViolationDetail.tsx` |

---

## 5. ITSM-GRC Bridges

### 5.1 Incident ↔ GRC

| Evidence | Reference |
|----------|-----------|
| Incident entity (GRC side) | `src/grc/entities/itsm-incident.entity.ts` |
| Incident-Risk link | `src/grc/entities/itsm-incident-risk.entity.ts` |
| Incident-Control link | `src/grc/entities/itsm-incident-control.entity.ts` |
| GRC controller | `src/grc/controllers/itsm-incident.controller.ts` |
| GRC service | `src/grc/services/itsm-incident.service.ts` |

### 5.2 Change ↔ GRC

| Evidence | Reference |
|----------|-----------|
| Change entity (GRC side) | `src/grc/entities/itsm-change.entity.ts` |
| Change-Risk link | `src/grc/entities/itsm-change-risk.entity.ts` |
| Change-Control link | `src/grc/entities/itsm-change-control.entity.ts` |
| GRC controller | `src/grc/controllers/itsm-change.controller.ts` |
| GRC service | `src/grc/services/itsm-change.service.ts` |

### 5.3 Service ↔ GRC

| Evidence | Reference |
|----------|-----------|
| Service entity (GRC side) | `src/grc/entities/itsm-service.entity.ts` |
| GRC controller | `src/grc/controllers/itsm-service.controller.ts` |
| GRC service | `src/grc/services/itsm-service.service.ts` |

### 5.4 Closure Loop

| Evidence | Reference |
|----------|-----------|
| Service | `src/grc/services/closure-loop.service.ts` |
| Tests | `src/grc/services/closure-loop.service.spec.ts` |
| Doc | `docs/CLOSURE-LOOP-API.md` |

### 5.5 Coverage Analysis (Cross-domain)

| Evidence | Reference |
|----------|-----------|
| Controller | `src/grc/controllers/grc-coverage.controller.ts` |
| UI | `frontend/src/pages/Coverage.tsx` |

---

## 6. AI Features

### 6.1 Incident Copilot

| Evidence | Reference |
|----------|-----------|
| Copilot module | `backend-nest/src/copilot/copilot.module.ts` |
| Copilot controller | `backend-nest/src/copilot/copilot.controller.ts` |
| Suggest sub-module | `backend-nest/src/copilot/suggest/` |
| Apply sub-module | `backend-nest/src/copilot/apply/` |
| Learning sub-module | `backend-nest/src/copilot/learning/` |
| Indexing sub-module | `backend-nest/src/copilot/indexing/` |
| ServiceNow adapter | `backend-nest/src/copilot/servicenow/` |
| DTOs | `backend-nest/src/copilot/dto/` |
| Entities | `backend-nest/src/copilot/entities/` |
| ITSM-side controller | `backend-nest/src/itsm/incident/incident-copilot.controller.ts` |
| ITSM-side service | `backend-nest/src/itsm/incident/incident-copilot.service.ts` |
| AI analysis entity | `backend-nest/src/itsm/incident/incident-ai-analysis.entity.ts` |
| Tests | `copilot.controller.spec.ts` |
| UI | `frontend/src/pages/copilot/CopilotPage.tsx` |
| UI route | `/copilot` |
| Apply allowlist | Only `work_notes` and `additional_comments` fields |

### 6.2 Risk Advisory (AI)

| Evidence | Reference |
|----------|-----------|
| Controller | `backend-nest/src/grc/risk-advisory/risk-advisory.controller.ts` |
| Service | `backend-nest/src/grc/risk-advisory/risk-advisory.service.ts` |
| Adapters | `backend-nest/src/grc/risk-advisory/adapters/` |
| Heuristics | `backend-nest/src/grc/risk-advisory/heuristics/` |
| Draft mapper | `backend-nest/src/grc/risk-advisory/advisory-draft-mapper.ts` |
| Tests | `advisory-draft-mapper.spec.ts` |

### 6.3 AI Control Center

| Evidence | Reference |
|----------|-----------|
| Module | `backend-nest/src/ai-admin/ai-admin.module.ts` |
| Controller | `backend-nest/src/ai-admin/ai-admin.controller.ts` |
| Service | `backend-nest/src/ai-admin/ai-admin.service.ts` |
| Entities | `backend-nest/src/ai-admin/entities/` — `AiProviderConfig`, feature policies |
| Encryption | `backend-nest/src/ai-admin/encryption/` — API key encryption at rest |
| DTOs | `backend-nest/src/ai-admin/dto/` |
| Tests | `ai-admin.service.spec.ts` |
| UI | `frontend/src/pages/admin/AdminAiControlCenter.tsx` |
| Admin route | `/admin/ai-control-center` |
| Migration | `1742600000000-CreateAiControlCenterTables.ts` |

### 6.4 Tool Gateway

| Evidence | Reference |
|----------|-----------|
| Module | `backend-nest/src/tool-gateway/tool-gateway.module.ts` |
| Controller | `backend-nest/src/tool-gateway/tool-gateway.controller.ts` |
| Service | `backend-nest/src/tool-gateway/tool-gateway.service.ts` |
| Entities | `backend-nest/src/tool-gateway/entities/` — endpoint registrations |
| Providers | `backend-nest/src/tool-gateway/providers/` — ServiceNow provider |
| DTOs | `backend-nest/src/tool-gateway/dto/` |
| Tests | `backend-nest/src/tool-gateway/__tests__/` |
| UI | `frontend/src/pages/admin/AdminToolGateway.tsx` |
| Admin route | `/admin/tool-gateway` |
| Migration | `1742700000000-CreateToolGatewayTables.ts` |
| SSRF controls | Tool Gateway has governance layer for outbound calls |

---

> **Usage:** When writing any claim in the six-doc suite, find the matching row in this map and cite the reference path. If no evidence row exists, the claim needs validation or should be marked `[PLANNED]`.
