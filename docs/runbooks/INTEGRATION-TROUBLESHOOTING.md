# Integration Troubleshooting Guide

## Common Issues and Solutions

### 1. Cloudflare "Just a moment..." (403 HTML response)

**Symptom**: API calls return HTML with "Just a moment..." instead of JSON.

**Root Cause**: Frontend calling backend directly without nginx proxy, triggering Cloudflare managed challenge.

**Fix**: Ensure all frontend API calls use `/api/grc/...` prefix (not `/grc/...` directly).

**Verification**:
```bash
# This should return JSON (via nginx proxy):
curl -i http://localhost/api/grc/controls

# This may trigger Cloudflare on public-facing deployments:
curl -i http://localhost/grc/controls
```

### 2. API Prefix Mismatch

**Symptom**: 404 errors on API calls, or requests not reaching the backend.

**Architecture**:
```
Frontend -> /api/grc/... -> Nginx (strips /api/) -> Backend /grc/...
```

**Rules**:
- Backend controllers: `@Controller('grc/...')` with NO `api/` prefix
- Frontend calls: `/api/grc/...` (Nginx strips `/api/`)
- Nginx location: `^~ /api/` with `proxy_pass http://backend/;` (trailing slash critical)

**Verification**:
```bash
# Should return 401 (not 404) when unauthenticated:
curl -i http://localhost/api/grc/controls

# Inside backend container (direct, no nginx):
wget -qO- http://localhost:3002/grc/controls 2>&1 | head -5
```

### 3. Missing Authorization Header

**Symptom**: 401 Unauthorized on authenticated endpoints.

**Common Causes**:
- Token not stored after login
- Token not included in API interceptor
- Token expired and not refreshed

**Verification**:
```javascript
// In browser console, check stored token:
localStorage.getItem('accessToken')

// Check API interceptor adds header:
// frontend/src/services/api.ts should have:
// headers: { Authorization: `Bearer ${token}` }
```

### 4. Missing x-tenant-id Header

**Symptom**: 400 Bad Request or empty data returned.

**Root Cause**: `x-tenant-id` header not included in API requests.

**Fix**: Ensure the API service includes tenant header on all requests:
```typescript
headers: {
  'x-tenant-id': tenantId,
  'Authorization': `Bearer ${token}`,
}
```

### 5. Webhook Delivery Failures

**Symptom**: Webhook deliveries show FAILED status in delivery log.

**Common Causes**:

| Cause | Solution |
|-------|----------|
| SSRF guard blocking URL | Use public, non-private IP addresses |
| Timeout | Increase `timeoutMs` on endpoint (max 60000) |
| SSL certificate errors | Set `allowInsecure: true` (dev only) |
| Network unreachable | Verify endpoint URL from within container |

**Verification**:
```sql
SELECT status, error_message, attempted_at
FROM sys_notification_deliveries
WHERE channel = 'WEBHOOK'
ORDER BY created_at DESC LIMIT 10;
```

### 6. Notification Bell Not Updating

**Symptom**: Bell icon shows stale count or no notifications.

**Common Causes**:
- Polling interval (30s default) hasn't elapsed
- User not in the rule's recipient list
- Rule condition not matching the event payload

**Verification**:
```sql
-- Check if notification was created for the user:
SELECT * FROM sys_user_notifications
WHERE user_id = $USER_ID
ORDER BY created_at DESC LIMIT 5;

-- Check if rule matched:
SELECT * FROM sys_notification_deliveries
WHERE rule_id = $RULE_ID
ORDER BY created_at DESC LIMIT 5;
```

### 7. Public API Key Authentication Issues

**Symptom**: 401/403 on public API calls with X-API-Key header.

**Debugging Steps**:
1. Verify key format: must start with `grc_`
2. Check key is active and not expired
3. Check key has the required scope (e.g., `incidents:read`)
4. Verify published API exists and is active

```sql
-- Find key by prefix (first 8 chars):
SELECT id, name, is_active, expires_at, scopes, last_used_at
FROM sys_api_keys
WHERE key_prefix = 'grc_xxxx';

-- Check published API:
SELECT name, is_active, allow_list, allowed_fields
FROM sys_published_apis
WHERE tenant_id = $TENANT_ID AND name = 'incidents';
```

### 8. Docker/Staging Specific Issues

**Container has no `src/` directory**:
- Production containers only have `dist/`
- Use `node dist/scripts/...` not `ts-node src/scripts/...`
- Seeds: `npm run seed:notification-demo` (not `:dev`)

**Database migrations not run**:
```bash
docker compose -f docker-compose.staging.yml exec -T backend \
  sh -lc 'npx typeorm migration:show -d dist/data-source.js'

docker compose -f docker-compose.staging.yml exec -T backend \
  sh -lc 'npx typeorm migration:run -d dist/data-source.js'
```

**Health checks**:
```bash
curl http://localhost:3002/health/live
curl http://localhost:3002/health/db
curl http://localhost:3002/health/auth
```

### 9. CORS Issues

**Symptom**: Browser console shows CORS errors.

**Fix**: Ensure the backend CORS configuration allows the frontend origin:
- Development: `http://localhost:3000`
- Staging: `http://46.224.99.150`

### 10. Event Not Triggering Notification

**Symptom**: Action performed but no notification created.

**Debugging**:
1. Check event was emitted: `SELECT * FROM sys_event_log WHERE event_name = $EVENT ORDER BY created_at DESC`
2. Check rule exists and is active for that event
3. Check condition evaluates to true for the payload
4. Check rate limit not exceeded
5. Check delivery log for errors
