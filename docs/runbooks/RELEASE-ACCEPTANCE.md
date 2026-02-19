# Release Acceptance Checklist

## ITSM + Integration Acceptance (v1)

This checklist covers the Notification Engine, Webhook Channel, API Catalog, and Admin UI features. All items must pass before a release is approved.

### Prerequisites
- [ ] All migrations run successfully (`migration:show` shows no pending)
- [ ] Demo seeds run without errors (idempotent)
- [ ] Backend health checks pass: `/health/live`, `/health/db`, `/health/auth`

---

### 1. Authentication & Authorization
- [ ] 1.1 Login with valid credentials returns JWT token
- [ ] 1.2 All API calls include `Authorization: Bearer <token>` header
- [ ] 1.3 All API calls include `x-tenant-id` header
- [ ] 1.4 Unauthenticated requests to admin endpoints return 401
- [ ] 1.5 Requests without proper permissions return 403

### 2. API Prefix & Routing
- [ ] 2.1 Frontend calls use `/api/grc/...` prefix (not `/grc/...` directly)
- [ ] 2.2 ITSM endpoints: `/api/grc/itsm/services`, `/api/grc/itsm/incidents`, `/api/grc/itsm/changes` return data
- [ ] 2.3 Notification endpoints: `/api/grc/notification-rules` accessible
- [ ] 2.4 Webhook endpoints: `/api/grc/webhook-endpoints` accessible
- [ ] 2.5 Published APIs: `/api/grc/published-apis` accessible
- [ ] 2.6 Public gateway: `/api/grc/public/v1/:apiName/records` accessible with API key
- [ ] 2.7 No Cloudflare "Just a moment..." HTML responses on API calls

### 3. Notification Engine
- [ ] 3.1 Create notification rule via Admin UI (Notification Studio > Rules)
- [ ] 3.2 Rule with `incident.created` event and IN_APP channel saved successfully
- [ ] 3.3 Create notification template with variable substitution
- [ ] 3.4 Template preview renders correctly with sample payload
- [ ] 3.5 Trigger event (create incident) -> notification appears in bell icon
- [ ] 3.6 Bell icon shows correct unread count
- [ ] 3.7 Clicking notification opens drawer panel
- [ ] 3.8 Mark notification as read updates count
- [ ] 3.9 Delivery log shows successful delivery record
- [ ] 3.10 Rate limiting prevents excessive notifications (verify in delivery log)

### 4. Webhook Channel
- [ ] 4.1 Create webhook endpoint via Admin UI (Notification Studio > Webhooks)
- [ ] 4.2 Webhook endpoint fields: name, base URL, headers, active toggle
- [ ] 4.3 Test webhook delivery endpoint returns success/failure status
- [ ] 4.4 Webhook delivery includes HMAC-SHA256 signature header (when secret set)
- [ ] 4.5 SSRF guard blocks private/internal IP addresses
- [ ] 4.6 Disabled webhook endpoint does not receive deliveries
- [ ] 4.7 Webhook retry logic works on transient failures (check delivery log)

### 5. API Catalog
- [ ] 5.1 Create published API via Admin UI (API Catalog > Published APIs)
- [ ] 5.2 Published API fields: name, table, allowed fields, filter policy, rate limit
- [ ] 5.3 Create API key -> raw key shown once in dialog
- [ ] 5.4 API key list shows masked keys (prefix only)
- [ ] 5.5 Revoke API key -> subsequent requests with that key return 401/403
- [ ] 5.6 Public API with valid key: `GET /api/grc/public/v1/incidents/records` returns 200
- [ ] 5.7 Public API with invalid key returns 401/403
- [ ] 5.8 Public API without key returns 401/403
- [ ] 5.9 Public API respects field allowlist (only allowed fields returned)
- [ ] 5.10 Public API respects rate limit (returns 429 when exceeded)
- [ ] 5.11 Audit log captures public API requests

### 6. Admin UI
- [ ] 6.1 Notification Studio menu item visible under Admin/Platform Builder
- [ ] 6.2 Notification Studio has 4 tabs: Rules, Templates, Webhooks, Delivery Log
- [ ] 6.3 API Catalog menu item visible under Admin/Platform Builder
- [ ] 6.4 API Catalog has 4 tabs: Published APIs, API Keys, OpenAPI, Try It
- [ ] 6.5 All admin screens show loading states (no infinite spinners)
- [ ] 6.6 401/403 errors surface as error messages in UI
- [ ] 6.7 5xx errors surface as error messages in UI
- [ ] 6.8 Empty states shown when no data exists

### 7. Tenant Isolation
- [ ] 7.1 Notifications only visible to users in the same tenant
- [ ] 7.2 Notification rules scoped to tenant (cannot see other tenant's rules)
- [ ] 7.3 Webhook endpoints scoped to tenant
- [ ] 7.4 Published APIs scoped to tenant
- [ ] 7.5 API keys scoped to tenant
- [ ] 7.6 Public API queries enforce `tenant_id` filter

### 8. Data Integrity
- [ ] 8.1 Demo seeds are idempotent (run twice, no duplicates)
- [ ] 8.2 Deleting a rule does not delete associated template
- [ ] 8.3 Deleting a published API does not delete associated API keys
- [ ] 8.4 Delivery log entries persist after rule deletion

### 9. Performance & Reliability
- [ ] 9.1 Notification bell polling does not cause excessive server load (30s interval)
- [ ] 9.2 Public API rate limiting works correctly under load
- [ ] 9.3 Webhook delivery timeout (10s default) does not block notification processing
- [ ] 9.4 Template rendering handles missing variables gracefully (no crashes)

### 10. Security
- [ ] 10.1 API keys hashed with bcrypt (not SHA-256 or plaintext)
- [ ] 10.2 Raw API key never stored in database
- [ ] 10.3 No secrets or credentials in committed code
- [ ] 10.4 TruffleHog secret scan passes
- [ ] 10.5 CodeQL security scan passes (no HIGH findings)
- [ ] 10.6 SSRF prevention active on webhook delivery
- [ ] 10.7 Template rendering is safe (no code injection)

---

## Sign-off

| Role | Name | Date | Status |
|------|------|------|--------|
| QA Lead | | | |
| Security Engineer | | | |
| Product Owner | | | |
| Platform Architect | | | |
