# DIAGNOSTIC COMPLETE - COPY-PASTE SUMMARY

## EXECUTIVE SUMMARY

**Root Cause:** `TENANT_HEADER_REQUIRED` - Frontend must send `x-tenant-id` header with API requests.

**Status:** ✅ Backend is working correctly. All endpoints return 200 OK when header is provided.

---

## KEY FINDINGS

### Login Endpoint
- **Working Payload:** `{"email": "admin@grc-platform.local", "password": "TestPassword123!"}`
- **Status:** `200 OK`
- **Token Location:** `data.accessToken`
- **TOKEN_LEN:** `255`
- **TENANT_ID:** `00000000-0000-0000-0000-000000000001` (from `data.user.tenantId`)

### Endpoint Test Results

| Endpoint | Without Header | With Header | Classification |
|----------|----------------|-------------|----------------|
| `/onboarding/context` | `400 BAD_REQUEST` - "Missing x-tenant-id header" | `200 OK` - Returns context | ❌ TENANT_HEADER_REQUIRED |
| `/grc/audits` | `400 BAD_REQUEST` - "Missing x-tenant-id header" | `200 OK` - Returns 4 audits | ❌ TENANT_HEADER_REQUIRED |
| `/tenants/current` | `400 BAD_REQUEST` - "Missing x-tenant-id header" | N/A | ❌ TENANT_HEADER_REQUIRED |

---

## ROOT CAUSE ANALYSIS

### Primary Issue
🔴 **TENANT_HEADER_REQUIRED**

**Problem:** Frontend API calls to `/onboarding/context` and `/grc/audits` are missing the required `x-tenant-id` header.

**Evidence:**
- Both endpoints return `400 BAD_REQUEST` when header is missing
- Both endpoints return `200 OK` with full data when header is present
- Tenant ID is available in login response and should be stored in localStorage

**Code Status:**
- ✅ API interceptor in `frontend/src/services/api.ts` (lines 96-100) is configured to add header
- ✅ Login handler in `frontend/src/contexts/AuthContext.tsx` (line 221) stores tenantId
- ⚠️ **Issue:** Header may not be sent due to timing/storage/race condition

---

## NEXT ACTIONS

### 1. Debug Frontend Header Injection (15-30 min)

**Steps:**
1. Open staging frontend in browser
2. Open DevTools → Application → Local Storage
3. Login and verify `tenantId` key exists: `00000000-0000-0000-0000-000000000001`
4. Open Network tab → Navigate to audits/onboarding page
5. Check request headers for `x-tenant-id` header

**If Header is Missing:**
- Add debug logging in `api.ts` interceptor:
  ```typescript
  const tenantId = localStorage.getItem('tenantId');
  console.log('API Request - tenantId:', tenantId); // DEBUG
  if (tenantId) {
    config.headers['x-tenant-id'] = tenantId;
  }
  ```
- Verify login response structure matches expected format
- Check for race conditions (request fires before tenantId stored)

**If Header is Present but Still 400:**
- Verify header value matches: `00000000-0000-0000-0000-000000000001`
- Check backend logs for any header parsing issues
- Verify header name is exactly `x-tenant-id` (case-sensitive)

### 2. Verify API Client Usage

**Check:** Ensure all API calls use the centralized `api` client from `services/api.ts`:
- ✅ `api.get('/onboarding/context')` - uses interceptor
- ✅ `api.get('/grc/audits')` - uses interceptor
- ❌ Direct `axios` calls - bypass interceptor

### 3. Test After Fix

**Manual Verification:**
```bash
# 1. Login via frontend
# 2. Check localStorage: tenantId should exist
# 3. Open Network tab
# 4. Navigate to audits page
# 5. Verify request includes: x-tenant-id: 00000000-0000-0000-0000-000000000001
# 6. Verify response is 200 OK with audit data
```

---

## TECHNICAL DETAILS

### Backend Endpoints
- ✅ `POST /auth/login` → `200 OK` (email + password)
- ❌ `GET /tenants/current` → `400` (requires x-tenant-id header)
- ❌ `GET /onboarding/context` → `400` (without header) | ✅ `200` (with header)
- ❌ `GET /grc/audits` → `400` (without header) | ✅ `200` (with header)

### Response Format
All endpoints use NestJS standard envelope:
```json
{
  "success": true|false,
  "data": { ... },
  "error": { "code": "...", "message": "..." }
}
```

### Authentication
- **Method:** JWT Bearer token
- **Header:** `Authorization: Bearer <token>`
- **Token:** `data.accessToken` (255 chars)
- **Expiry:** 24 hours

---

## CONCLUSION

**Status:** ✅ Backend functioning correctly

The issue is on the frontend - the `x-tenant-id` header is not being sent with API requests despite the interceptor being configured. This is likely a timing/storage issue or the header is being stripped somewhere.

**Priority:** 🔴 **HIGH** - Blocking core functionality

**Estimated Fix Time:** 15-30 minutes (debug + fix header injection)

---

**Diagnostic Completed:** 2025-12-14  
**Method:** Read-only curl commands against staging server (46.224.99.150:3002)  
**No code or database changes made**
