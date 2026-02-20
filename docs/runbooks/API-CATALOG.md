# API Catalog Runbook

## Overview

The API Catalog allows tenants to publish read-only (or read-write) APIs backed by existing database tables. External systems can access data via API keys without JWT authentication.

Components:
- **Published APIs**: Define which tables/fields are exposed, with filter policies and rate limits
- **API Keys**: bcrypt-hashed keys with prefix-based lookup, scopes, and expiration
- **Public Gateway**: Unauthenticated endpoint using `X-API-Key` header
- **Audit Log**: Every public API request is logged with method, path, status, latency, IP

## Architecture

```
External Client
    |
    | X-API-Key: grc_...
    v
Nginx (/api/grc/public/v1/*)
    |
    v
PublicApiGatewayController
    |-- Validates API key (bcrypt compare)
    |-- Checks rate limit (in-memory, per-minute window)
    |-- Looks up published API config
    |-- Enforces field allowlist
    |-- Applies filter policy
    |-- Logs to sys_api_audit_logs
    |
    v
Database Query (tenant-scoped)
```

## Database Tables

| Table | Purpose |
|-------|---------|
| `sys_published_apis` | API definitions (name, version, table, fields, filters, rate limit) |
| `sys_api_keys` | API keys (bcrypt hash, prefix, scopes, expiration, last used) |
| `sys_api_audit_logs` | Request audit trail (method, path, status, latency, IP, body) |

## API Endpoints

### Admin Endpoints (JWT + tenant required)

#### Published APIs
- `GET /api/grc/published-apis` - List published APIs (Permission: ADMIN_SETTINGS_READ)
- `GET /api/grc/published-apis/:id` - Get API detail
- `POST /api/grc/published-apis` - Create published API (Permission: ADMIN_SETTINGS_WRITE)
- `PUT /api/grc/published-apis/:id` - Update published API
- `DELETE /api/grc/published-apis/:id` - Delete published API

#### API Keys
- `GET /api/grc/api-keys` - List keys (masked) (Permission: ADMIN_SETTINGS_READ)
- `POST /api/grc/api-keys` - Create key (raw key shown once) (Permission: ADMIN_SETTINGS_WRITE)
- `PUT /api/grc/api-keys/:id` - Update key (name, scopes, active status)
- `DELETE /api/grc/api-keys/:id` - Delete key

### Public Gateway (API Key auth, no JWT)
- `GET /api/grc/public/v1/:apiName/records` - List records
- `POST /api/grc/public/v1/:apiName/records` - Create record (if allowCreate=true)
- `PUT /api/grc/public/v1/:apiName/records/:recordId` - Update record (if allowUpdate=true)
- `GET /api/grc/public/v1/:apiName/openapi.json` - Generated OpenAPI spec

## Demo Seeds

Run inside the backend container:

```bash
# Dev (with ts-node)
npm run seed:api-catalog-demo:dev

# Production (compiled)
npm run seed:api-catalog-demo
```

This creates:
- **Published API**: "incidents" v1 - read-only access to `itsm_incidents` table with fields: id, number, short_description, state, priority, category, created_at, updated_at
- **API Key**: "Demo Incidents API Key" with scope `incidents:read`

The raw API key is printed to console on first creation only. Save it immediately.

## Usage Example

```bash
# List incidents via public API
curl -H "X-API-Key: grc_..." \
  http://localhost/api/grc/public/v1/incidents/records

# With pagination
curl -H "X-API-Key: grc_..." \
  "http://localhost/api/grc/public/v1/incidents/records?page=1&pageSize=10"
```

## Security

### API Key Storage
- Keys are hashed with bcrypt (cost factor 10) before storage
- Only the first 8 characters (prefix) are stored in plaintext for display
- Key validation: prefix lookup + bcrypt.compare on each candidate
- Raw key shown only once at creation time

### Field Allowlist
- Only fields listed in `allowedFields.read` are returned in responses
- Only fields listed in `allowedFields.write` can be modified
- Disallowed fields in request body are silently ignored

### Tenant Isolation
- All queries include `WHERE tenant_id = ?` filter
- API keys are bound to a specific tenant
- Published APIs are tenant-scoped

### Rate Limiting
- Per-API, per-minute sliding window
- Default: 60 requests/minute
- In-memory (resets on restart, does not work across instances)
- Configurable via `rateLimitPerMinute` field

### Audit Logging
- Every public API request is logged to `sys_api_audit_logs`
- Captures: tenant_id, api_name, method, path, status_code, response_time_ms, ip_address, request_body

## Troubleshooting

### API key not working
1. Verify key starts with `grc_` prefix
2. Check key is active: `SELECT is_active, expires_at FROM sys_api_keys WHERE key_prefix = 'grc_xxxx'`
3. Check key has correct scope for the API
4. Check key hasn't expired

### 404 on public API
1. Verify the published API exists and is active
2. Check the API name matches exactly (case-sensitive)
3. Verify the target table exists in the database

### Rate limit exceeded (429)
1. Wait for the current minute window to reset
2. Increase `rateLimitPerMinute` on the published API if needed
3. Consider implementing Redis-based rate limiting for production scale
