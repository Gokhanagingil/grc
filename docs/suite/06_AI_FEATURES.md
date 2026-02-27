# 06 — AI Features

> **Version:** 1.0  
> **Last Updated:** 2026-02-27  
> **Status:** Final  
> **Audience:** Platform Operators, Security Auditors, GRC Analysts, Developers  
> **Evidence Map:** [EVIDENCE_MAP_v1.md](../discovery/EVIDENCE_MAP_v1.md) — Section 6

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Security](#3-security)
4. [Feature: AI Control Center](#4-feature-ai-control-center)
5. [Feature: Tool Gateway and Playground](#5-feature-tool-gateway-and-playground)
6. [Feature: Incident Copilot](#6-feature-incident-copilot)
7. [Feature: Risk Advisory](#7-feature-risk-advisory)
8. [Operations Guide](#8-operations-guide)
9. [AI Roadmap — Implemented vs Planned](#9-ai-roadmap--implemented-vs-planned)
10. [Safety and Governance Checklist](#10-safety-and-governance-checklist)
11. [Appendix: Evidence Index](#11-appendix-evidence-index)

---

## 1. Executive Summary

The GRC platform integrates AI capabilities under a **governance-first** architecture
aligned with ISO/IEC 42001 (AI Management System) principles. Every AI action — from
generating incident suggestions to querying external systems — passes through centralized
policy enforcement, tenant isolation, encrypted credential management, and immutable
audit logging.

### How AI Is Governed Here

| Governance Layer | What It Enforces | Evidence |
|---|---|---|
| **AI Control Center** | Global kill switch per tenant, per-feature enable/disable, human-approval defaults, provider selection | `ai-admin/entities/ai-feature-policy.entity.ts` |
| **Tool Gateway** | Tool allowlists, table/field allowlists, SSRF validation, rate limits, per-call audit | `tool-gateway/tool-gateway.service.ts` |
| **Guard Stack** | JWT authentication, tenant isolation, permission-based access on every endpoint | `auth/guards/jwt-auth.guard.ts`, `tenants/guards/tenant.guard.ts` |
| **Encryption Service** | AES-256-GCM encryption of all secrets at rest; secrets never returned in API responses | `ai-admin/encryption/encryption.service.ts` |
| **Audit Trail** | Every AI action logged with tenant, user, feature, action type, status, latency, content hashes | `ai-admin/entities/ai-audit-event.entity.ts` |

> All paths above are relative to `backend-nest/src/`.

> **SECURITY:** No AI feature can execute without passing through all five governance
> layers. The platform defaults to **AI-disabled** for new tenants — an administrator
> must explicitly enable AI via the Control Center.

### Design Principles

1. **Governance before capability** — Every AI feature checks policy before executing.
2. **Human-in-the-loop by default** — AI generates drafts and suggestions; humans approve and apply.
3. **Local-first model support** — The platform recommends self-hosted models (Ollama, vLLM) for data sovereignty.
4. **Audit everything** — Every AI call, tool execution, and configuration change is logged immutably.
5. **Least privilege** — Tools access only allowlisted tables and fields; write-back is restricted to safe fields only.
6. **No prompt/response storage** — Only SHA-256 hashes of prompts and responses are stored for traceability without data exposure.

---

## 2. Architecture Overview

### 2.1 AI Governance Architecture

```mermaid
graph TD
    subgraph "Admin Layer"
        ACC[AI Control Center<br/>Provider Config + Policies]
        TGAdmin[Tool Gateway Admin<br/>Integration Providers + Tool Policies]
    end

    subgraph "Governance Layer"
        FP[Feature Policy Engine<br/>isAiEnabled + allowedFeatures<br/>+ humanApprovalRequired]
        TP[Tool Policy Engine<br/>isToolsEnabled + allowedTools<br/>+ rateLimits]
        ENC[Encryption Service<br/>AES-256-GCM]
        SSRF[SSRF Guard<br/>Private IP blocking<br/>+ hostname blocklist]
    end

    subgraph "Feature Layer"
        COP[Incident Copilot<br/>Suggest + Apply + Learning]
        RA[Risk Advisory<br/>Heuristics + Draft Creation]
    end

    subgraph "Runtime Layer"
        TGR[Tool Gateway Runtime<br/>POST /grc/tools/run]
        SN[ServiceNow Provider<br/>Read-only tools]
    end

    subgraph "Audit Layer"
        AL[AI Audit Log<br/>nest_ai_audit_event]
    end

    ACC -->|config resolution| FP
    TGAdmin -->|policy resolution| TP
    ACC -->|encrypt secrets| ENC
    TGAdmin -->|encrypt secrets| ENC

    COP -->|check policy| FP
    RA -->|check policy| FP
    COP -->|execute tools| TGR
    TGR -->|check policy| TP
    TGR -->|validate URL| SSRF
    TGR -->|decrypt creds| ENC
    TGR -->|execute| SN

    COP -->|log| AL
    RA -->|log| AL
    TGR -->|log| AL
    ACC -->|log| AL
```

> **EVIDENCE:** `backend-nest/src/ai-admin/ai-admin.module.ts`,
> `backend-nest/src/tool-gateway/tool-gateway.module.ts`

### 2.2 AI Control Center (Providers and Policies)

The AI Control Center is the centralized administration layer for all AI capabilities.
It manages:

- **Provider configurations** — Connection details for AI model backends (Local, OpenAI,
  Azure OpenAI, Anthropic, or custom)
- **Feature policies** — Per-tenant toggles for each AI feature with human-approval defaults
- **Config resolution** — Runtime API for feature modules to determine effective AI configuration

Provider types supported:

| Provider Type | Use Case | Recommended |
|---|---|---|
| `LOCAL` | Self-hosted models (Ollama, vLLM, LM Studio) | Yes (data sovereignty) |
| `OPENAI` | OpenAI API | Cloud option |
| `AZURE_OPENAI` | Azure-hosted OpenAI models | Enterprise cloud |
| `ANTHROPIC` | Anthropic Claude API | Cloud option |
| `OTHER` | Custom OpenAI-compatible endpoints | Extensibility |

> **EVIDENCE:** `backend-nest/src/ai-admin/entities/ai-provider-config.entity.ts`
> (lines 19-25)

### 2.3 Tool Gateway (Integration Broker)

The Tool Gateway is a governed broker for external system integrations. In v1.1, it
supports ServiceNow read-only tools with strict security controls:

- **Table allowlist** — Only 7 tables: `incident`, `change_request`, `cmdb_ci`,
  `problem`, `kb_knowledge`, `sc_req_item`, `sys_user`
- **Field allowlist** — Per-table safe field sets (e.g., 17 fields for `incident`,
  18 for `change_request`)
- **SSRF validation** — Every outbound URL checked against private IP ranges and
  blocked hostnames
- **Audit logging** — Every tool execution logged with latency, status, and request metadata

Available tool keys:

| Tool Key | Description | ServiceNow API |
|---|---|---|
| `SERVICENOW_QUERY_TABLE` | Query any allowlisted table | `GET /api/now/table/{table}` |
| `SERVICENOW_GET_RECORD` | Get single record by sys_id | `GET /api/now/table/{table}/{sys_id}` |
| `SERVICENOW_QUERY_INCIDENTS` | Shorthand for incident queries | `GET /api/now/table/incident` |
| `SERVICENOW_QUERY_CHANGES` | Shorthand for change queries | `GET /api/now/table/change_request` |

> **EVIDENCE:** `backend-nest/src/tool-gateway/entities/tool-policy.entity.ts`
> (lines 19-24),
> `backend-nest/src/tool-gateway/providers/servicenow-tool.provider.ts` (lines 11-19)

### 2.4 Feature Runtime (Copilot and Advisory)

Both AI features follow a consistent runtime pattern:

1. **Policy check** — Verify AI is enabled for the tenant and the specific feature
   is allowed
2. **Context assembly** — Gather incident/risk data from local DB or external systems
3. **Analysis** — Generate suggestions using heuristics (Phase 1) or LLM (Phase 2)
4. **Human review** — Present results as draft cards; user selects which to apply
5. **Governed apply** — Execute approved actions through allowlisted channels only
6. **Audit log** — Record the action, outcome, and metadata

### 2.5 Audit and Explainability Model

Every AI action produces an `AiAuditEvent` record with the following fields:

| Field | Type | Purpose |
|---|---|---|
| `tenantId` | UUID | Tenant isolation |
| `userId` | UUID | Actor attribution |
| `featureKey` | varchar(50) | Which AI feature (`RISK_ADVISORY`, `INCIDENT_COPILOT`, etc.) |
| `providerType` | varchar(30) | Which provider was used |
| `modelName` | varchar(255) | Specific model identifier |
| `actionType` | enum | `ANALYZE`, `DRAFT_CREATE`, `TOOL_RUN`, `CONFIG_CHANGE`, `POLICY_CHANGE`, etc. |
| `status` | enum | `SUCCESS`, `FAIL`, `SKIPPED` |
| `latencyMs` | int | Response time for performance monitoring |
| `tokensIn` / `tokensOut` | int | Token usage tracking |
| `requestHash` / `responseHash` | varchar(64) | SHA-256 hashes for traceability without storing content |
| `toolKey` | varchar(50) | Tool Gateway: which tool was called |
| `providerKey` | varchar(30) | Tool Gateway: which integration provider |
| `requestMeta` | jsonb | Structured metadata (table name, record count, etc.) |

> **SECURITY:** Full prompts and responses are **never** stored in the audit log. Only
> SHA-256 hashes are recorded for forensic traceability. This satisfies data-minimization
> requirements under ISO/IEC 42001 Annex A.

> **EVIDENCE:** `backend-nest/src/ai-admin/entities/ai-audit-event.entity.ts`

### 2.6 Local-First Model Support

The platform recommends self-hosted models for data sovereignty:

| Local Provider | Setup | Compatibility |
|---|---|---|
| **Ollama** | `ollama serve` on localhost or LAN | OpenAI-compatible `/v1/chat/completions` |
| **vLLM** | GPU-accelerated server | OpenAI-compatible API |
| **LM Studio** | Desktop app with local models | OpenAI-compatible API |

Configuration in the AI Control Center:

- **Provider Type:** `LOCAL`
- **Base URL:** `http://localhost:11434/v1` (Ollama default)
- **Model Name:** e.g., `llama3.1:8b`, `mistral:7b`
- **API Key:** Not required for local providers (leave blank)

> **OPS:** Local models keep all data on-premises. No prompts or data leave your
> network boundary.

---

## 3. Security

### 3.1 Secrets Handling — Encrypted at Rest

All AI and integration credentials are encrypted using **AES-256-GCM** before
database storage:

| Secret Type | Entity Column | Encryption |
|---|---|---|
| AI API keys | `api_key_encrypted` | AES-256-GCM via EncryptionService |
| AI custom headers | `custom_headers_encrypted` | AES-256-GCM via EncryptionService |
| SN username | `username_encrypted` | AES-256-GCM via EncryptionService |
| SN password | `password_encrypted` | AES-256-GCM via EncryptionService |
| SN API token | `token_encrypted` | AES-256-GCM via EncryptionService |
| SN custom headers | `custom_headers_encrypted` | AES-256-GCM via EncryptionService |

**Encryption implementation:**

- **Algorithm:** AES-256-GCM with 16-byte IV and 16-byte auth tag
- **Key source:** `AI_ENCRYPTION_KEY` environment variable (recommended), falls back
  to derived key from `JWT_SECRET`
- **Storage format:** `base64(iv + authTag + ciphertext)`
- **API safety:** Secrets are **never** returned in API responses. The
  `toSafeProvider()` method returns only boolean flags (`hasUsername`, `hasPassword`,
  `hasToken`, `hasCustomHeaders`)

> **SECURITY:** Always set a dedicated `AI_ENCRYPTION_KEY` in production. The
> `JWT_SECRET` fallback is functional but not recommended for production deployments.

> **EVIDENCE:** `backend-nest/src/ai-admin/encryption/encryption.service.ts`
> (lines 17-112)

### 3.2 SSRF Protections

The `SsrfGuardService` validates every outbound URL before any external request:

| Check | Rule | Blocks |
|---|---|---|
| Protocol | HTTPS required (unless `allowInsecure` explicitly set) | `http://`, `ftp://`, `file://` |
| Private IPs | Regex matching against RFC 1918 and link-local ranges | `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `100.64.0.0/10` |
| IPv6 private | Blocks `::1`, `fc00:`, `fd`, `fe80:` prefixes | All IPv6 private/link-local |
| Blocked hosts | Hardcoded set of dangerous hostnames | `localhost`, `metadata.google.internal`, `metadata`, `instance-data` |
| Embedded creds | Rejects URLs with username/password components | `https://user:pass@host` |
| Port range | Validates port is 1-65535 | Out-of-range ports |

**SSRF validation is applied at three points:**

1. **Provider creation** — When an admin creates a new integration provider
   (`createProvider`)
2. **Provider update** — When an admin changes the base URL (`updateProvider`)
3. **Tool execution** — Before every outbound request in `runTool`

> **EVIDENCE:** `backend-nest/src/notification-engine/services/ssrf-guard.service.ts`
> (lines 4-100)

### 3.3 Allowlists (Tables and Fields)

The Tool Gateway enforces strict allowlists at two levels:

**Table allowlist** (7 tables):

```
incident, change_request, cmdb_ci, problem, kb_knowledge, sc_req_item, sys_user
```

**Field allowlist** (per table, excerpt):

| Table | Allowed Fields (count) | Example Fields |
|---|---|---|
| `incident` | 17 | `sys_id`, `number`, `short_description`, `state`, `priority`, `category`, `assignment_group` |
| `change_request` | 18 | `sys_id`, `number`, `short_description`, `state`, `type`, `risk`, `priority` |
| `cmdb_ci` | 11 | `sys_id`, `name`, `sys_class_name`, `operational_status`, `environment` |
| `problem` | 10 | `sys_id`, `number`, `short_description`, `state`, `priority` |
| `kb_knowledge` | 8 | `sys_id`, `number`, `short_description`, `text`, `category` |
| `sc_req_item` | 7 | `sys_id`, `number`, `short_description`, `state`, `priority` |
| `sys_user` | 7 | `sys_id`, `user_name`, `name`, `email`, `title`, `department` |

**Additional query guardrails:**

| Guardrail | Value | Purpose |
|---|---|---|
| `MAX_LIMIT` | 100 | Maximum records per query |
| `DEFAULT_LIMIT` | 20 | Default if not specified |
| `MAX_QUERY_LENGTH` | 1000 chars | Prevents query injection via oversized `sysparm_query` |
| `SYS_ID_PATTERN` | `/^[a-f0-9]{32}$/i` | Validates sys_id format for `getRecord` |

> **EVIDENCE:** `backend-nest/src/tool-gateway/providers/servicenow-tool.provider.ts`
> (lines 11-126)

### 3.4 Tenant Isolation and RBAC

All AI endpoints are protected by the standard three-guard stack:

```
JwtAuthGuard -> TenantGuard -> PermissionsGuard
```

| Guard | AI-Specific Enforcement |
|---|---|
| `JwtAuthGuard` | Validates Bearer JWT on every AI endpoint |
| `TenantGuard` | Extracts `x-tenant-id` header; all AI queries scoped to `WHERE tenantId = ?` |
| `PermissionsGuard` | AI admin: `ADMIN_SETTINGS_READ/WRITE`; Copilot: `ITSM_INCIDENT_READ/WRITE`; Advisory: `GRC_RISK_READ/WRITE` |

**Permission matrix for AI features:**

| Feature | Read Permission | Write Permission |
|---|---|---|
| AI Control Center | `ADMIN_SETTINGS_READ` | `ADMIN_SETTINGS_WRITE` |
| Tool Gateway Admin | `ADMIN_SETTINGS_READ` | `ADMIN_SETTINGS_WRITE` |
| Tool Gateway Runtime | `ADMIN_SETTINGS_READ` | -- |
| Incident Copilot (view) | `ITSM_INCIDENT_READ` | -- |
| Incident Copilot (apply) | -- | `ITSM_INCIDENT_WRITE` |
| Risk Advisory (analyze) | `GRC_RISK_READ` | -- |
| Risk Advisory (create drafts) | -- | `GRC_RISK_WRITE` |

> **SECURITY:** Each tenant has its own `AiFeaturePolicy` row (unique index on
> `tenantId`). Provider configs with `tenantId = null` are global defaults;
> tenant-specific configs override globals.

> **EVIDENCE:** `backend-nest/src/ai-admin/ai-admin.controller.ts` (lines 42-43),
> `backend-nest/src/tool-gateway/tool-gateway.controller.ts` (lines 44-45)

### 3.5 Prompt and Response Handling Policy

The platform follows a **data-minimization** approach to AI content:

| Aspect | Policy | Implementation |
|---|---|---|
| **Prompt storage** | Not stored | Only `requestHash` (SHA-256) recorded in audit log |
| **Response storage** | Not stored | Only `responseHash` (SHA-256) recorded in audit log |
| **Description excerpts** | Bounded to 500 chars | `suggest.service.ts` truncates descriptions before including in summaries |
| **Resolution notes** | Bounded to 200 chars | Similar incident resolution notes truncated in work notes drafts |
| **Search text** | Bounded to 8 terms | `extractSearchTerms()` limits to 8 keywords after stop-word removal |
| **Token tracking** | `tokensIn` / `tokensOut` | Usage metering without content exposure |

> **SECURITY:** This approach satisfies ISO/IEC 42001 Annex A controls for data
> minimization in AI systems. Hashes provide forensic traceability without retaining
> sensitive content.

---

## 4. Feature: AI Control Center

### 4.1 User Experience

The AI Control Center is accessed at **Admin > AI Control Center**
(`/admin/ai-control-center`) in the Admin UI. It provides:

- **Provider management** — Add, edit, test, and delete AI model providers
- **Feature policies** — Toggle AI globally and per-feature for the current tenant
- **Connection testing** — One-click health check against configured providers
- **Audit log viewer** — Paginated, filterable view of all AI audit events

> **EVIDENCE:** `frontend/src/pages/admin/AdminAiControlCenter.tsx`

### 4.2 API Reference

**Base path:** `/api/grc/admin/ai` (external) | `/grc/admin/ai` (backend controller)

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `GET` | `/providers` | `ADMIN_SETTINGS_READ` | List all provider configs (secrets excluded) |
| `GET` | `/providers/:id` | `ADMIN_SETTINGS_READ` | Get single provider config |
| `POST` | `/providers` | `ADMIN_SETTINGS_WRITE` | Create provider config |
| `PATCH` | `/providers/:id` | `ADMIN_SETTINGS_WRITE` | Update provider (supports secret rotation) |
| `DELETE` | `/providers/:id` | `ADMIN_SETTINGS_WRITE` | Soft-delete provider |
| `POST` | `/providers/:id/test` | `ADMIN_SETTINGS_READ` | Test provider connection |
| `GET` | `/policies` | `ADMIN_SETTINGS_READ` | Get tenant AI feature policy |
| `PUT` | `/policies/:tenantId` | `ADMIN_SETTINGS_WRITE` | Upsert tenant AI feature policy |
| `GET` | `/audit` | `ADMIN_SETTINGS_READ` | Query AI audit events (paginated) |
| `GET` | `/config/resolve?featureKey=X` | `ADMIN_SETTINGS_READ` | Resolve effective AI config for a feature |

> **EVIDENCE:** `backend-nest/src/ai-admin/ai-admin.controller.ts` (242 lines)

### 4.3 Data Model

**Table: `nest_ai_provider_config`**

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Auto-generated |
| `tenant_id` | UUID FK (nullable) | `null` = global config |
| `provider_type` | varchar(30) | `LOCAL`, `OPENAI`, `AZURE_OPENAI`, `ANTHROPIC`, `OTHER` |
| `display_name` | varchar(255) | Human-readable label |
| `is_enabled` | boolean | Default: `true` |
| `base_url` | varchar(1024) | Model endpoint URL |
| `model_name` | varchar(255) | e.g., `llama3.1:8b` |
| `request_timeout_ms` | int | Default: 30000 |
| `max_tokens` | int | Nullable |
| `temperature` | decimal(3,2) | Nullable |
| `api_key_encrypted` | text | AES-256-GCM; never returned in API |
| `custom_headers_encrypted` | text | AES-256-GCM; never returned in API |
| `is_deleted` | boolean | Soft delete flag |

**Table: `nest_ai_feature_policy`**

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Auto-generated |
| `tenant_id` | UUID FK | Unique index -- one policy per tenant |
| `is_ai_enabled` | boolean | Global AI kill switch; default: `false` |
| `default_provider_config_id` | UUID FK (nullable) | Fallback provider |
| `human_approval_required_default` | boolean | Default: `true` |
| `allowed_features` | jsonb | Map of feature keys to enabled status |

Feature keys: `RISK_ADVISORY`, `INCIDENT_COPILOT`, `CHANGE_ASSISTANT`,
`KNOWLEDGE_DRAFTING`, `EVIDENCE_SUMMARY`

**Table: `nest_ai_audit_event`**

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Auto-generated |
| `tenant_id` | UUID | Indexed |
| `user_id` | UUID (nullable) | Actor |
| `feature_key` | varchar(50) | `RISK_ADVISORY`, `INCIDENT_COPILOT`, etc. |
| `action_type` | varchar(30) | `TEST_CONNECTION`, `ANALYZE`, `DRAFT_CREATE`, `CONFIG_CHANGE`, `POLICY_CHANGE`, `TOOL_RUN`, `TOOL_TEST_CONNECTION`, `OTHER` |
| `status` | varchar(20) | `SUCCESS`, `FAIL`, `SKIPPED` |
| `latency_ms` | int | Response time |
| `tokens_in` / `tokens_out` | int | Usage metering |
| `request_hash` / `response_hash` | varchar(64) | SHA-256 hashes |
| `tool_key` | varchar(50) | Tool Gateway tool identifier |
| `provider_key` | varchar(30) | Integration provider key |
| `external_request_id` | varchar(255) | External correlation ID |
| `request_meta` | jsonb | Structured metadata |
| `created_at` | timestamptz | Immutable creation time |

> **EVIDENCE:** `backend-nest/src/ai-admin/entities/` (3 entity files)

### 4.4 Validation Checklist

| # | Check | Expected | How to Verify | Status |
|---|---|---|---|---|
| 1 | Provider list returns no secrets | Response contains boolean flags, no plaintext | `GET /api/grc/admin/ai/providers` | [IMPL] |
| 2 | Global kill switch defaults to off | New tenant: `isAiEnabled: false` | `GET /api/grc/admin/ai/policies` | [IMPL] |
| 3 | Human approval defaults to on | `humanApprovalRequiredDefault: true` | Entity default | [IMPL] |
| 4 | Connection test is audited | `AiAuditEvent` with `actionType: TEST_CONNECTION` | `POST /api/grc/admin/ai/providers/:id/test` | [IMPL] |
| 5 | Cross-tenant policy rejected | `400` if URL tenant differs from header | `PUT /api/grc/admin/ai/policies/:otherTenantId` | [IMPL] |

---

## 5. Feature: Tool Gateway and Playground

### 5.1 User Experience

The Tool Gateway is managed at **Admin > Tool Gateway** (`/admin/tool-gateway`)
in the Admin UI. It provides:

- **Integration provider management** — Configure ServiceNow connections with
  encrypted credentials
- **Tool policy management** — Enable/disable tools, set rate limits, manage allowlists
- **Connection testing** — Verify ServiceNow connectivity with audit-logged results
- **Playground** — Interactive tool execution for testing queries and validating
  integration

> **EVIDENCE:** `frontend/src/pages/admin/AdminToolGateway.tsx`

### 5.2 Tool Gateway Security Envelope

```mermaid
sequenceDiagram
    participant UI as Admin UI / Copilot
    participant TGC as Tool Gateway Controller
    participant TGS as Tool Gateway Service
    participant SSRF as SSRF Guard Service
    participant ENC as Encryption Service
    participant SN as ServiceNow Instance
    participant AUD as Audit Log

    UI->>TGC: POST /grc/tools/run {toolKey, input}
    Note over TGC: Guards: JWT + Tenant + Permissions

    TGC->>TGS: runTool(tenantId, userId, dto)

    TGS->>TGS: 1. Validate toolKey against known tool keys
    TGS->>TGS: 2. Check ToolPolicy: isToolsEnabled + allowedTools
    TGS->>TGS: 3. Find active SN provider for tenant

    TGS->>SSRF: 4. validateUrl(baseUrl)
    SSRF-->>TGS: {valid: true}

    TGS->>ENC: 5. Decrypt credentials
    ENC-->>TGS: plaintext (in memory only)

    TGS->>SN: 6. GET /api/now/table/{table} + allowlisted fields only
    SN-->>TGS: {result: [...]}

    TGS->>TGS: 7. Filter response to safe field set

    TGS->>AUD: 8. Log audit event (toolKey, status, latency, table, recordCount)

    TGS-->>TGC: ToolRunResult
    TGC-->>UI: {success, data, meta}
```

> **EVIDENCE:** `backend-nest/src/tool-gateway/tool-gateway.service.ts`
> (lines 373-493)

### 5.3 API Reference

**Admin endpoints -- Base path:** `/api/grc/admin/tools` (external) |
`/grc/admin/tools` (backend)

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `GET` | `/providers` | `ADMIN_SETTINGS_READ` | List integration providers (secrets excluded) |
| `GET` | `/providers/:id` | `ADMIN_SETTINGS_READ` | Get single provider |
| `POST` | `/providers` | `ADMIN_SETTINGS_WRITE` | Create integration provider (SSRF-validated) |
| `PATCH` | `/providers/:id` | `ADMIN_SETTINGS_WRITE` | Update provider (supports credential rotation) |
| `DELETE` | `/providers/:id` | `ADMIN_SETTINGS_WRITE` | Soft-delete provider |
| `POST` | `/providers/:id/test` | `ADMIN_SETTINGS_READ` | Test ServiceNow connection (audit-logged) |
| `GET` | `/policies` | `ADMIN_SETTINGS_READ` | Get tool policy |
| `PUT` | `/policies/:tenantId` | `ADMIN_SETTINGS_WRITE` | Upsert tool policy |

**Runtime endpoints -- Base path:** `/api/grc/tools` (external) |
`/grc/tools` (backend)

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `POST` | `/run` | `ADMIN_SETTINGS_READ` | Execute a governed tool |
| `GET` | `/status` | `ADMIN_SETTINGS_READ` | Check tool availability for tenant |

> **EVIDENCE:** `backend-nest/src/tool-gateway/tool-gateway.controller.ts` (213 lines)

### 5.4 Data Model

**Table: `nest_integration_provider_config`**

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Auto-generated |
| `tenant_id` | UUID FK | Per-tenant isolation |
| `provider_key` | varchar(30) | `SERVICENOW` |
| `display_name` | varchar(255) | Human-readable label |
| `is_enabled` | boolean | Default: `true` |
| `base_url` | varchar(1024) | SSRF-validated on create/update |
| `auth_type` | varchar(30) | `BASIC` or `API_TOKEN` |
| `username_encrypted` | text | AES-256-GCM; never returned |
| `password_encrypted` | text | AES-256-GCM; never returned |
| `token_encrypted` | text | AES-256-GCM; never returned |
| `custom_headers_encrypted` | text | AES-256-GCM; never returned |
| `is_deleted` | boolean | Soft delete flag |

**Table: `nest_tool_policy`**

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Auto-generated |
| `tenant_id` | UUID FK | Unique index -- one policy per tenant |
| `is_tools_enabled` | boolean | Global tool kill switch; default: `false` |
| `allowed_tools` | jsonb | Array of allowed tool keys |
| `rate_limit_per_minute` | int | Default: 60 |
| `max_tool_calls_per_run` | int | Default: 10 |

> **EVIDENCE:** `backend-nest/src/tool-gateway/entities/` (2 entity files)

### 5.5 Custom Header Safety

When custom headers are configured on an integration provider, the system applies
a safety filter:

```
Blocked header keys (case-insensitive): authorization, host, cookie
```

This prevents custom headers from overriding authentication headers or injecting
cookies.

> **EVIDENCE:** `backend-nest/src/tool-gateway/providers/servicenow-tool.provider.ts`
> (lines 489-493)

### 5.6 Validation Checklist

| # | Check | Expected | How to Verify | Status |
|---|---|---|---|---|
| 1 | Tools disabled by default | New tenant: `isToolsEnabled: false` | `GET /api/grc/admin/tools/policies` | [IMPL] |
| 2 | Unlisted tool rejected | Error for tool not in `allowedTools` | `POST /api/grc/tools/run` with disallowed tool | [IMPL] |
| 3 | Private IP blocked | SSRF validation rejects `http://127.0.0.1` | Provider creation with private IP | [IMPL] |
| 4 | Non-HTTPS blocked | SSRF validation rejects `http://` URLs | Provider creation with HTTP URL | [IMPL] |
| 5 | Table not in allowlist rejected | Error for non-allowlisted table | Tool run with disallowed table | [IMPL] |
| 6 | Fields filtered to safe set | Response contains only allowlisted fields | Query with non-allowlisted fields | [IMPL] |
| 7 | Query length capped | Error if `sysparm_query` exceeds 1000 chars | Oversized query | [IMPL] |
| 8 | sys_id format validated | Error for non-hex sys_id | `getRecord` with invalid sys_id | [IMPL] |
| 9 | Max 100 records per query | `limit` capped at 100 regardless of input | Query with `limit: 999` | [IMPL] |
| 10 | Audit event on tool run | `AiAuditEvent` with `actionType: TOOL_RUN` | Any tool execution | [IMPL] |

---

## 6. Feature: Incident Copilot

### 6.1 User Experience

The Incident Copilot is accessed at **`/copilot`** in the main navigation. It provides:

- **Incident browser** — List and search ServiceNow incidents with pagination
- **AI suggestions** — Generate action cards for a selected incident:
  - **Incident Summary** — Key fields and description (bounded to 500 chars)
  - **Next Best Steps** — Contextual recommendations based on incident state
  - **Customer Update Draft** — Pre-written customer communication
    (apply to `additional_comments`)
  - **Work Notes Draft** — Internal analysis with similar incident references
    (apply to `work_notes`)
- **Similar incidents** — Full-text search across indexed resolved incidents
- **KB suggestions** — Matching knowledge base articles
- **Apply actions** — One-click apply of drafts to ServiceNow (governed write-back)
- **Learning events** — Record user feedback for future model improvement

### 6.2 Incident Copilot Sequence

```mermaid
sequenceDiagram
    participant User as Analyst
    participant UI as Copilot UI
    participant CC as Copilot Controller
    participant SS as Suggest Service
    participant AS as Apply Service
    participant SNC as ServiceNow Client
    participant IDX as Incident Index (PostgreSQL)
    participant SN as ServiceNow Instance

    User->>UI: Select incident
    UI->>CC: POST /grc/copilot/incidents/:sysId/suggest
    Note over CC: Guards: JWT + Tenant + Permissions

    CC->>SS: suggest(tenantId, sysId)
    SS->>SNC: getIncident(tenantId, sysId)
    SNC->>SN: GET /api/now/table/incident/{sysId}
    SN-->>SNC: Incident data
    SNC-->>SS: SnIncident

    par Find similar incidents
        SS->>IDX: Full-text search (ts_rank + to_tsvector)
        IDX-->>SS: SimilarIncident[]
    and Find KB articles
        SS->>IDX: Full-text search (kb_index)
        IDX-->>SS: KbSuggestion[]
    end

    SS->>SS: Generate action cards
    SS-->>CC: CopilotSuggestResponse
    CC-->>UI: Action cards + similar + KB

    User->>UI: Click Apply on Customer Update card
    UI->>CC: POST /grc/copilot/incidents/:sysId/apply
    CC->>AS: apply(tenantId, sysId, ...)
    AS->>AS: Validate targetField in ALLOWED_FIELDS
    AS->>SNC: postComment(tenantId, sysId, comments, text)
    SNC->>SN: PATCH /api/now/table/incident/{sysId}
    SN-->>SNC: 200 OK
    AS-->>CC: CopilotApplyResponse
    CC-->>UI: success: true

    Note over UI: Record learning event
    UI->>CC: POST /grc/copilot/learning/events
```

> **EVIDENCE:** `backend-nest/src/copilot/copilot.controller.ts`,
> `backend-nest/src/copilot/suggest/suggest.service.ts`,
> `backend-nest/src/copilot/apply/apply.service.ts`

### 6.3 Apply-Back Allowlist

The Copilot enforces a strict allowlist for write-back operations:

```typescript
const ALLOWED_FIELDS: ReadonlySet<string> = new Set([
  'work_notes',
  'additional_comments',
]);
```

| Allowed Field | ServiceNow Mapping | Purpose |
|---|---|---|
| `work_notes` | `work_notes` | Internal analyst notes |
| `additional_comments` | `comments` | Customer-visible updates |

Any attempt to write to a field outside this allowlist is **blocked and logged**:

```
BadRequestException: Field "state" is not allowed.
Only work_notes and additional_comments are permitted in Sprint 1.
```

> **SECURITY:** The apply-back allowlist is a hard-coded `ReadonlySet` — it cannot
> be modified at runtime or via configuration. This prevents accidental or malicious
> state changes to ServiceNow records through the Copilot.

> **EVIDENCE:** `backend-nest/src/copilot/apply/apply.service.ts` (lines 7-10)

### 6.4 API Reference

**Base path:** `/api/grc/copilot` (external) | `/grc/copilot` (backend)

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `GET` | `/incidents` | `ITSM_INCIDENT_READ` | List ServiceNow incidents (paginated) |
| `GET` | `/incidents/:sysId` | `ITSM_INCIDENT_READ` | Get single incident |
| `POST` | `/incidents/:sysId/suggest` | `ITSM_INCIDENT_READ` | Generate AI suggestions |
| `POST` | `/incidents/:sysId/apply` | `ITSM_INCIDENT_WRITE` | Apply action to ServiceNow |
| `POST` | `/learning/events` | `ITSM_INCIDENT_READ` | Record learning event |
| `POST` | `/indexing/incidents` | `ITSM_INCIDENT_WRITE` | Index resolved incidents |
| `POST` | `/indexing/kb` | `ITSM_INCIDENT_WRITE` | Index KB articles |
| `GET` | `/indexing/stats` | `ITSM_INCIDENT_READ` | Get indexing statistics |

> **EVIDENCE:** `backend-nest/src/copilot/copilot.controller.ts` (268 lines)

### 6.5 Data Model

**Table: `copilot_incident_index`**

Stores indexed resolved incidents for similarity search:

| Column | Purpose |
|---|---|
| `sys_id` | ServiceNow incident sys_id |
| `tenant_id` | Tenant isolation |
| `number` | Incident number (e.g., INC0012345) |
| `short_description` | Incident title |
| `description` | Full description |
| `search_text` | Concatenated searchable text (supports PostgreSQL `ts_rank` / `to_tsvector`) |
| `state` | Incident state at time of indexing |
| `priority` | Incident priority |
| `category` | Incident category |
| `resolution_notes` | Resolution details from resolved incidents |
| `close_code` / `close_notes` | Closure information |

**Table: `copilot_kb_index`**

Stores indexed KB articles for suggestion matching:

| Column | Purpose |
|---|---|
| `sys_id` | ServiceNow KB article sys_id |
| `tenant_id` | Tenant isolation |
| `number` | KB article number |
| `title` | Article title |
| `text` | Article content |
| `search_text` | Concatenated searchable text |

**Full-text search implementation:**

The suggest service uses PostgreSQL full-text search (`ts_rank` + `to_tsvector` +
`to_tsquery`) for similarity matching, with ILIKE fallback if full-text indexes are
not available.

> **EVIDENCE:** `backend-nest/src/copilot/entities/` (index entities)

### 6.6 Validation Checklist

| # | Check | Expected | How to Verify | Status |
|---|---|---|---|---|
| 1 | Apply rejects disallowed field | `400 Bad Request` | `POST .../apply` with `targetField: "state"` | [IMPL] |
| 2 | Empty text rejected | `400 Bad Request` | Apply with empty `text` | [IMPL] |
| 3 | Suggest requires tenant | `400 Bad Request` without `x-tenant-id` | Missing header | [IMPL] |
| 4 | Similar incidents via full-text | `ts_rank` ordering | `suggest.service.ts` (line 175) | [IMPL] |
| 5 | Description bounded to 500 chars | Truncated with `...` | `suggest.service.ts` (lines 400-403) | [IMPL] |
| 6 | Resolution notes bounded to 200 chars | Truncated in work notes | `suggest.service.ts` (lines 473-476) | [IMPL] |
| 7 | Learning event on apply | `SUGGESTION_APPLIED` logged | `copilot.controller.ts` (lines 182-186) | [IMPL] |
| 8 | Index stats available | Returns counts | `GET /api/grc/copilot/indexing/stats` | [IMPL] |

---

## 7. Feature: Risk Advisory

### 7.1 User Experience

The Risk Advisory is accessed from the **Risk Detail** page in the GRC module.
It provides:

- **Analyze risk** — Generate advisory recommendations using deterministic heuristics
- **Risk theme classification** — Categorize risk by theme (e.g., access control,
  operational, compliance)
- **Mitigation suggestions** — Suggested records: CAPA, Control Test, Change (Phase 2)
- **Create drafts** — Human-in-the-loop: select which suggestions to create as draft
  records
- **Explainable results** — Each suggestion includes confidence scores and reasoning

> **PLANNED:** LLM-powered analysis via the `AiProviderAdapter` interface. Phase 1
> uses the `StubAiProvider` (returns `null`) with deterministic heuristics as the
> primary engine.

### 7.2 API Reference

**Base path:** `/api/grc/risks` (external) | `/grc/risks` (backend)

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `POST` | `/:id/advisory/analyze` | `GRC_RISK_READ` | Analyze risk and generate advisory |
| `GET` | `/:id/advisory/latest` | `GRC_RISK_READ` | Get latest advisory result (from cache) |
| `POST` | `/:id/advisory/create-drafts` | `GRC_RISK_WRITE` | Create draft records from selected suggestions |

> **EVIDENCE:** `backend-nest/src/grc/risk-advisory/risk-advisory.controller.ts`
> (139 lines)

### 7.3 Architecture

The Risk Advisory uses a layered architecture:

| Layer | Component | Responsibility |
|---|---|---|
| **Controller** | `RiskAdvisoryController` | HTTP endpoints, guard stack, input validation |
| **Service** | `RiskAdvisoryService` | Orchestration: load risk, build context, call heuristics, create drafts |
| **Heuristics** | `RiskAdvisoryHeuristics` | Deterministic theme classification and mitigation suggestions |
| **AI Adapter** | `AiProviderAdapter` (interface) | Phase 2: LLM integration point. Phase 1: `StubAiProvider` (returns null) |
| **Draft Mapper** | `advisory-draft-mapper.ts` | Maps advisory suggestions to validated domain records (CAPA, Control Test) |

**Draft creation routing:**

| Suggested Type | Effective Target | Status |
|---|---|---|
| `CAPA` | CAPA record | [IMPL] -- Creates via `GrcCapaService` |
| `TASK` | CAPA record (domain-mapped) | [IMPL] -- TASK items create CAPA records |
| `CONTROL_TEST` | Control Test | [PARTIAL] -- Requires linked control; returns `skipped` |
| `CHANGE` | Change record | [PLANNED] -- Deferred to Phase 2 (cross-module dependency) |

> **EVIDENCE:** `backend-nest/src/grc/risk-advisory/risk-advisory.service.ts`
> (626 lines),
> `backend-nest/src/grc/risk-advisory/advisory-draft-mapper.ts`

### 7.4 Data Model

The Risk Advisory does not introduce new database tables. It uses:

- **Input:** `grc_risks` table (risk entity) + linked controls and policies
- **Cache:** In-memory `Map<string, AdvisoryResult>` keyed by `tenantId:riskId`
- **Output:** Creates records in existing tables (`grc_capas`, `grc_control_tests`)
  via established service layer

**AdvisoryResult contract:**

| Field | Type | Description |
|---|---|---|
| `riskTheme` | string | Classified risk theme |
| `confidence` | number | Confidence score (0-1) |
| `suggestedRecords` | array | Mitigation suggestions with type, title, description |
| `analysisNotes` | string | Human-readable analysis |

> **EVIDENCE:** `backend-nest/src/grc/risk-advisory/dto/advisory.dto.ts`,
> `backend-nest/src/grc/risk-advisory/heuristics/risk-advisory-heuristics.ts`

### 7.5 Validation Checklist

| # | Check | Expected | How to Verify | Status |
|---|---|---|---|---|
| 1 | Analyze requires tenant | `400 Bad Request` | Missing `x-tenant-id` header | [IMPL] |
| 2 | Non-existent risk returns 404 | `NotFoundException` | Invalid risk ID | [IMPL] |
| 3 | Create-drafts requires selection | `400 Bad Request` | Empty `selectedItems` | [IMPL] |
| 4 | Create-drafts requires prior analyze | `400 Bad Request` | No cached advisory | [IMPL] |
| 5 | Change creation deferred | `skipped`, code: `CHANGE_NOT_SUPPORTED_YET` | CHANGE type suggestion | [IMPL] |
| 6 | CAPA draft created | `created` with `createdRecordId` | CAPA type suggestion | [IMPL] |
| 7 | Partial success supported | Mixed `created`/`failed`/`skipped` | Multiple mixed selections | [IMPL] |

---

## 8. Operations Guide

### 8.1 Operator Quick Start (15 Minutes)

This guide configures a **Local AI provider** and the **Tool Gateway** for a
development or staging environment.

#### Step 1: Start a Local Model (5 min)

```bash
# Install Ollama (if not installed)
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3.1:8b

# Verify it is running
curl http://localhost:11434/v1/models
```

#### Step 2: Configure AI Control Center (3 min)

1. Navigate to **Admin > AI Control Center** (`/admin/ai-control-center`)
2. Click **Add Provider**:
   - **Display Name:** `Local Ollama`
   - **Provider Type:** `LOCAL`
   - **Base URL:** `http://localhost:11434/v1`
   - **Model Name:** `llama3.1:8b`
   - **Timeout:** `30000` ms
3. Click **Save**, then **Test Connection** -- expect a green status
4. Go to **Policies** tab:
   - Toggle **AI Enabled** to ON
   - Enable **RISK_ADVISORY** and **INCIDENT_COPILOT**
   - Keep **Human Approval Required** ON
5. Click **Save Policy**

#### Step 3: Configure Tool Gateway (5 min)

1. Navigate to **Admin > Tool Gateway** (`/admin/tool-gateway`)
2. Click **Add Provider**:
   - **Display Name:** `ServiceNow Dev`
   - **Provider Key:** `SERVICENOW`
   - **Base URL:** `https://your-instance.service-now.com`
   - **Auth Type:** `BASIC`
   - **Username:** Your ServiceNow integration user
   - **Password:** The integration user password
3. Click **Save**, then **Test Connection** -- expect success with latency
4. Go to **Policies** tab:
   - Toggle **Tools Enabled** to ON
   - Add tools to allowlist: `SERVICENOW_QUERY_TABLE`,
     `SERVICENOW_GET_RECORD`, `SERVICENOW_QUERY_INCIDENTS`,
     `SERVICENOW_QUERY_CHANGES`
   - Rate limit: `60` per minute
   - Max calls per run: `10`
5. Click **Save Policy**

#### Step 4: Validate via Playground (2 min)

1. In the Tool Gateway page, use the **Playground** section
2. Select tool: `SERVICENOW_QUERY_INCIDENTS`
3. Input: `{"query": "state=1", "limit": 5}`
4. Click **Run** -- expect a list of new incidents
5. Check the **Audit Log** in AI Control Center to verify the event was recorded

> **OPS:** If the test connection fails, check: (1) ServiceNow instance URL is HTTPS,
> (2) credentials are correct, (3) the integration user has Table API read permissions,
> (4) the URL does not point to a private IP range.

### 8.2 How to Configure Local Provider

| Setting | Value | Notes |
|---|---|---|
| Provider Type | `LOCAL` | Required |
| Base URL | `http://localhost:11434/v1` | Ollama default; adjust port if needed |
| Model Name | e.g., `llama3.1:8b` | Must be pulled/available on the local server |
| API Key | Leave blank | Not required for local providers |
| Timeout | `30000` ms | Increase for larger models |
| Temperature | `0.3` | Lower = more deterministic |
| Max Tokens | `2048` | Adjust based on model capability |

> **OPS:** For production deployments with local models, consider running Ollama or
> vLLM on a dedicated GPU server accessible via your private network. Set the Base URL
> to the server internal address (e.g., `http://gpu-server.internal:11434/v1`).

### 8.3 How to Configure ServiceNow Provider (Read-Only)

**Prerequisites:**

- A ServiceNow integration user with **Table API** read access
- The instance URL must be HTTPS (SSRF guard will reject HTTP)
- The integration user should have read-only roles (e.g., `itil` or custom read-only)

**Configuration:**

| Setting | Value | Notes |
|---|---|---|
| Provider Key | `SERVICENOW` | Only supported provider in v1.1 |
| Base URL | `https://your-instance.service-now.com` | Must be HTTPS; no trailing slash |
| Auth Type | `BASIC` or `API_TOKEN` | Basic auth uses username + password |
| Credentials | Integration user credentials | Encrypted at rest via AES-256-GCM |

> **SECURITY:** Create a dedicated read-only integration user in ServiceNow. Do not
> use an admin account. The Tool Gateway only performs read operations, but
> least-privilege is enforced at the ServiceNow level as well.

### 8.4 Troubleshooting Guide

| Symptom | Likely Cause | Resolution |
|---|---|---|
| "Tools are disabled for this tenant" | Tool policy not enabled | Tool Gateway > Policies > Enable tools |
| "Tool X is not allowed by tenant policy" | Tool not in allowlist | Add the tool key to `allowedTools` in policy |
| "No active ServiceNow provider configured" | Missing or disabled provider | Create/enable a ServiceNow provider |
| "Base URL failed SSRF validation" | URL points to private IP or uses HTTP | Use HTTPS and a public/resolvable hostname |
| "ServiceNow returned HTTP 401" | Invalid credentials | Rotate credentials in provider config |
| "ServiceNow returned HTTP 403" | Integration user lacks permissions | Grant Table API read access to the SN user |
| "Table X is not in the allowlist" | Querying non-allowlisted table | Only 7 tables are allowed (see Section 3.3) |
| "Connection failed: ECONNREFUSED" | ServiceNow instance unreachable | Check network connectivity and firewall rules |
| "AI features disabled" | AI policy not enabled for tenant | AI Control Center > Policies > Enable AI |
| "ServiceNow integration is not configured" | Copilot has no SN credentials | Configure ServiceNow in Copilot admin settings |
| Test connection times out | Instance slow or unreachable | Check SN instance health; timeout is 15 seconds |
| Suggest returns empty cards | No indexed incidents for similarity | Run indexing: `POST /api/grc/copilot/indexing/incidents` |

---

## 9. AI Roadmap -- Implemented vs Planned

### 9.1 Currently Implemented (Phase 1)

| Feature | Status | Version | Description |
|---|---|---|---|
| AI Control Center | [IMPL] | v1.0 | Provider CRUD, feature policies, connection testing, audit log |
| Tool Gateway | [IMPL] | v1.1 | ServiceNow read-only tools, table/field allowlists, SSRF protection |
| Tool Playground | [IMPL] | v1.1 | Interactive tool testing in admin UI |
| Incident Copilot (Suggest) | [IMPL] | v1.0 | Action cards, similar incidents, KB suggestions |
| Incident Copilot (Apply) | [IMPL] | v1.0 | Write-back to `work_notes` and `additional_comments` only |
| Incident Copilot (Indexing) | [IMPL] | v1.0 | Resolved incident + KB article indexing |
| Incident Copilot (Learning) | [IMPL] | v1.0 | User feedback recording |
| Risk Advisory (Heuristics) | [IMPL] | v1.0 | Deterministic theme classification and mitigation suggestions |
| Risk Advisory (Draft Creation) | [IMPL] | v1.0 | CAPA draft creation from advisory suggestions |
| AES-256-GCM Encryption | [IMPL] | v1.0 | All AI/integration secrets encrypted at rest |
| SSRF Guard | [IMPL] | v1.0 | Private IP, hostname, and protocol blocking |
| AI Audit Trail | [IMPL] | v1.0 | Immutable audit log for all AI actions |

### 9.2 Phase 2 -- Deferred

| Feature | Status | Reason | Alternative |
|---|---|---|---|
| Write-back actions (state changes) | [PLANNED] | Safety -- only comment fields are safe for automated write-back | Manual state changes in ServiceNow |
| Agentic orchestration | [PLANNED] | Requires multi-step planning with intermediate human approval | Single-step suggest-then-apply pattern |
| Change creation from advisory | [PLANNED] | Cross-module dependency (ItsmModule) | Create changes manually from ITSM > Changes |
| LLM-powered risk advisory | [PLANNED] | `AiProviderAdapter` interface ready; `StubAiProvider` in use | Deterministic heuristics |
| Control test creation from advisory | [PARTIAL] | Requires linked control; returns `skipped` | Create from control detail page |
| Full CMDB topology in advisory | [PLANNED] | Lightweight context in Phase 1; full traversal deferred | Basic risk context without CMDB |

### 9.3 Future Planned Features

| Feature | Target | Description |
|---|---|---|
| Global AI Search | Phase 3 | Cross-module semantic search across GRC, ITSM, CMDB |
| Knowledge Base Drafting | Phase 3 | Auto-generate KB articles from resolved incident patterns |
| Change Assistant | Phase 3 | AI-guided change request creation with risk assessment |
| Evidence Summary | Phase 3 | Auto-summarize control evidence for audit readiness |
| Multi-provider routing | Phase 3 | Route different features to different AI providers |

> **NOTE:** Phase 2 and 3 features are subject to change based on customer feedback
> and regulatory developments. Dates are not committed. The `AiFeatureKey` enum
> already includes placeholders: `CHANGE_ASSISTANT`, `KNOWLEDGE_DRAFTING`,
> `EVIDENCE_SUMMARY`.

> **EVIDENCE:** `backend-nest/src/ai-admin/entities/ai-feature-policy.entity.ts`
> (lines 20-26)

---

## 10. Safety and Governance Checklist

This checklist is designed for auditors evaluating the platform's AI governance
posture against ISO/IEC 42001 and related frameworks.

### 10.1 AI Management System Controls

| # | Control Area | Question | Expected Answer | Evidence |
|---|---|---|---|---|
| 1 | **AI Policy** | Is there a per-tenant AI enable/disable control? | Yes -- `isAiEnabled` flag in `nest_ai_feature_policy` | `ai-feature-policy.entity.ts` |
| 2 | **AI Policy** | Can individual AI features be disabled independently? | Yes -- `allowedFeatures` JSONB map per feature key | `ai-feature-policy.entity.ts` |
| 3 | **Human Oversight** | Is human-in-the-loop enforced by default? | Yes -- `humanApprovalRequiredDefault: true` | `ai-feature-policy.entity.ts` |
| 4 | **Human Oversight** | Can AI modify records without human approval? | Only `work_notes` and `additional_comments` via Copilot Apply | `apply.service.ts` |
| 5 | **Data Minimization** | Are full prompts/responses stored? | No -- only SHA-256 hashes (`requestHash`, `responseHash`) | `ai-audit-event.entity.ts` |
| 6 | **Data Minimization** | Are descriptions bounded before AI processing? | Yes -- 500 chars for descriptions, 200 chars for resolution notes, 8 search terms | `suggest.service.ts` |
| 7 | **Encryption** | Are AI secrets encrypted at rest? | Yes -- AES-256-GCM with dedicated `AI_ENCRYPTION_KEY` | `encryption.service.ts` |
| 8 | **Encryption** | Are secrets exposed in API responses? | Never -- `toSafeProvider()` returns boolean flags only | `tool-gateway.service.ts` |
| 9 | **Access Control** | Is tenant isolation enforced on AI endpoints? | Yes -- `TenantGuard` + `tenantId` scoping on all queries | All AI controllers |
| 10 | **Access Control** | Are AI admin functions restricted to authorized roles? | Yes -- `ADMIN_SETTINGS_READ/WRITE` permissions required | All AI admin controllers |
| 11 | **SSRF Protection** | Are outbound URLs validated before requests? | Yes -- private IPs, blocked hostnames, protocol validation | `ssrf-guard.service.ts` |
| 12 | **SSRF Protection** | Is SSRF validation applied on every outbound call? | Yes -- at provider creation, update, and runtime execution | `tool-gateway.service.ts` |
| 13 | **Audit Trail** | Are all AI actions logged? | Yes -- `nest_ai_audit_event` with tenant, user, action, status, latency | `ai-audit-event.entity.ts` |
| 14 | **Audit Trail** | Are configuration changes logged? | Yes -- `CONFIG_CHANGE` and `POLICY_CHANGE` action types | `ai-admin.service.ts` |
| 15 | **Tool Governance** | Are external tools restricted to an allowlist? | Yes -- `allowedTools` in `nest_tool_policy` + table/field allowlists | `tool-policy.entity.ts`, `servicenow-tool.provider.ts` |
| 16 | **Tool Governance** | Are rate limits enforced? | Yes -- `rateLimitPerMinute` (default 60) and `maxToolCallsPerRun` (default 10) | `tool-policy.entity.ts` |
| 17 | **Data Sovereignty** | Can AI run entirely on-premises? | Yes -- `LOCAL` provider type supports Ollama/vLLM on self-hosted infrastructure | `ai-provider-config.entity.ts` |
| 18 | **Explainability** | Are AI suggestions explainable? | Yes -- heuristics produce classification theme, confidence score, and reasoning | `risk-advisory-heuristics.ts` |
| 19 | **Write-Back Safety** | Are write-back fields restricted? | Yes -- hard-coded `ReadonlySet` of `{work_notes, additional_comments}` | `apply.service.ts` |
| 20 | **Custom Headers** | Are dangerous custom headers blocked? | Yes -- `authorization`, `host`, `cookie` blocked (case-insensitive) | `servicenow-tool.provider.ts` |

### 10.2 Key Governance Defaults

| Setting | Default Value | Override Location |
|---|---|---|
| AI enabled for new tenants | `false` (disabled) | Admin > AI Control Center > Policies |
| Human approval required | `true` | Admin > AI Control Center > Policies |
| Tools enabled for new tenants | `false` (disabled) | Admin > Tool Gateway > Policies |
| Rate limit | 60 calls/minute | Admin > Tool Gateway > Policies |
| Max tool calls per run | 10 | Admin > Tool Gateway > Policies |
| Copilot apply-back fields | `work_notes`, `additional_comments` | Hard-coded; cannot be changed at runtime |
| ServiceNow table allowlist | 7 tables | Hard-coded; cannot be changed at runtime |

---

## 11. Appendix: Evidence Index

### 11.1 AI Control Center

| Evidence | Reference |
|---|---|
| Module | `backend-nest/src/ai-admin/ai-admin.module.ts` |
| Controller | `backend-nest/src/ai-admin/ai-admin.controller.ts` |
| Service | `backend-nest/src/ai-admin/ai-admin.service.ts` |
| Provider entity | `backend-nest/src/ai-admin/entities/ai-provider-config.entity.ts` |
| Feature policy entity | `backend-nest/src/ai-admin/entities/ai-feature-policy.entity.ts` |
| Audit event entity | `backend-nest/src/ai-admin/entities/ai-audit-event.entity.ts` |
| Encryption service | `backend-nest/src/ai-admin/encryption/encryption.service.ts` |
| DTOs | `backend-nest/src/ai-admin/dto/` |
| Tests | `backend-nest/src/ai-admin/ai-admin.service.spec.ts`, `encryption.service.spec.ts` |
| UI | `frontend/src/pages/admin/AdminAiControlCenter.tsx` |
| Admin route | `/admin/ai-control-center` |

### 11.2 Tool Gateway

| Evidence | Reference |
|---|---|
| Module | `backend-nest/src/tool-gateway/tool-gateway.module.ts` |
| Controller | `backend-nest/src/tool-gateway/tool-gateway.controller.ts` |
| Service | `backend-nest/src/tool-gateway/tool-gateway.service.ts` |
| Provider entity | `backend-nest/src/tool-gateway/entities/integration-provider-config.entity.ts` |
| Tool policy entity | `backend-nest/src/tool-gateway/entities/tool-policy.entity.ts` |
| ServiceNow provider | `backend-nest/src/tool-gateway/providers/servicenow-tool.provider.ts` |
| DTOs | `backend-nest/src/tool-gateway/dto/` |
| Tests | `backend-nest/src/tool-gateway/__tests__/tool-gateway.service.spec.ts` |
| UI | `frontend/src/pages/admin/AdminToolGateway.tsx` |
| Admin route | `/admin/tool-gateway` |
| SSRF guard | `backend-nest/src/notification-engine/services/ssrf-guard.service.ts` |

### 11.3 Incident Copilot

| Evidence | Reference |
|---|---|
| Module | `backend-nest/src/copilot/copilot.module.ts` |
| Controller | `backend-nest/src/copilot/copilot.controller.ts` |
| Suggest service | `backend-nest/src/copilot/suggest/suggest.service.ts` |
| Apply service | `backend-nest/src/copilot/apply/apply.service.ts` |
| Learning service | `backend-nest/src/copilot/learning/` |
| Indexing service | `backend-nest/src/copilot/indexing/` |
| ServiceNow client | `backend-nest/src/copilot/servicenow/servicenow-client.service.ts` |
| Entities | `backend-nest/src/copilot/entities/` |
| DTOs | `backend-nest/src/copilot/dto/` |
| Tests | `backend-nest/src/copilot/copilot.controller.spec.ts`, `suggest.service.spec.ts`, `apply.service.spec.ts` |
| ITSM-side controller | `backend-nest/src/itsm/incident/incident-copilot.controller.ts` |
| ITSM-side service | `backend-nest/src/itsm/incident/incident-copilot.service.ts` |
| AI analysis entity | `backend-nest/src/itsm/incident/incident-ai-analysis.entity.ts` |
| UI | `frontend/src/pages/copilot/CopilotPage.tsx` |
| UI route | `/copilot` |

### 11.4 Risk Advisory

| Evidence | Reference |
|---|---|
| Controller | `backend-nest/src/grc/risk-advisory/risk-advisory.controller.ts` |
| Service | `backend-nest/src/grc/risk-advisory/risk-advisory.service.ts` |
| Heuristics | `backend-nest/src/grc/risk-advisory/heuristics/risk-advisory-heuristics.ts` |
| AI adapter | `backend-nest/src/grc/risk-advisory/adapters/ai-provider.adapter.ts` |
| Draft mapper | `backend-nest/src/grc/risk-advisory/advisory-draft-mapper.ts` |
| Tests | `backend-nest/src/grc/risk-advisory/advisory-draft-mapper.spec.ts`, `risk-advisory-heuristics.spec.ts` |

### A. Related Documents

- [ITSM Guide -- Incident Copilot](./03_ITSM.md)
- [GRC Guide -- Risk Advisory](./04_GRC.md)
- [Technical Architecture](./02_TECHNICAL.md)
- [Evidence Map -- AI Features](../discovery/EVIDENCE_MAP_v1.md#6-ai-features)

---

> **Audit Tip:** When verifying any claim in this document, locate the corresponding
> evidence path in Section 11 and verify the claim against the source code at that
> path. If no evidence row exists, the claim needs validation or should be treated
> as `[PLANNED]`.

> **EVIDENCE:** `docs/discovery/EVIDENCE_MAP_v1.md` -- Section 6
