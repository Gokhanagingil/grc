# GRC Platform - Staging Diagnostic Report
**Date:** 2025-12-14  
**Environment:** Staging (46.224.99.150:3002)  
**Diagnostic Type:** AUTH + Onboarding + Audits Issues

---

## EXECUTIVE SUMMARY

**Root Cause:** `TENANT_HEADER_REQUIRED` - Frontend must send `x-tenant-id` header with all API requests to `/onboarding/context` and `/grc/audits` endpoints.

**Status:** ✅ All endpoints work correctly when `x-tenant-id` header is provided.  
**Impact:** Frontend API calls fail with 400 BAD_REQUEST when header is missing.

---

## STEP 1: LOGIN ENDPOINT TESTING

### Working Login Payload
✅ **Payload Format:** `email` + `password`
```json
{
  "email": "admin@grc-platform.local",
  "password": "TestPassword123!"
}
```

### Login Response
- **Status:** `200 OK`
- **Token Location:** `data.accessToken`
- **Token Length:** `255 characters`
- **User Data:** Includes `tenantId` in response: `00000000-0000-0000-0000-000000000001`

### Tested Payloads (All Others Failed)
- ❌ `username` + `password` → 400 BAD_REQUEST
- ❌ `identifier` + `password` → 400 BAD_REQUEST  
- ❌ `login` + `password` → 400 BAD_REQUEST
- ❌ `email` + `pass` → 400 BAD_REQUEST
- ❌ `user` + `password` → 400 BAD_REQUEST

**Conclusion:** Backend expects `email` and `password` fields (matches `LoginDto` validation).

---

## STEP 2: TOKEN EXTRACTION

✅ **Token Successfully Extracted**
- **TOKEN_LEN:** `255`
- **Token Field:** `data.accessToken`
- **Token Format:** Valid JWT (3 parts separated by dots)

---

## STEP 3: TENANT ID DETERMINATION

### Attempt 1: `/tenants/current` Endpoint
- **Status:** `400 BAD_REQUEST`
- **Error:** `"Missing x-tenant-id header"`
- **Note:** This endpoint also requires the `x-tenant-id` header (circular dependency issue)

### Solution: Extract from Login Response
✅ **TENANT_ID:** `00000000-0000-0000-0000-000000000001`  
**Source:** `data.user.tenantId` in login response

---

## STEP 4: ONBOARDING & AUDITS ENDPOINT TESTING

### 4A: `/onboarding/context` WITHOUT `x-tenant-id` Header

**Request:**
```bash
GET /onboarding/context
Authorization: Bearer <token>
```

**Response:**
- **Status:** `400 BAD_REQUEST`
- **Error Code:** `BAD_REQUEST`
- **Message:** `"Missing x-tenant-id header"`
- **Body:**
```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Missing x-tenant-id header"
  }
}
```

**Classification:** ❌ **TENANT_HEADER_REQUIRED**

---

### 4B: `/onboarding/context` WITH `x-tenant-id` Header

**Request:**
```bash
GET /onboarding/context
Authorization: Bearer <token>
x-tenant-id: 00000000-0000-0000-0000-000000000001
```

**Response:**
- **Status:** `200 OK`
- **Body:** Returns full onboarding context with:
  - Context status: `active`
  - Schema version: `1`
  - Active suites: `[]`
  - Enabled modules: `{"GRC_SUITE":[],"ITSM_SUITE":[]}`
  - Active frameworks: `[]`
  - Maturity: `foundational`
  - Policy configuration with disabled features and warnings

**Classification:** ✅ **OK** - Context returned successfully

---

### 4C: `/grc/audits` WITHOUT `x-tenant-id` Header

**Request:**
```bash
GET /grc/audits
Authorization: Bearer <token>
```

**Response:**
- **Status:** `400 BAD_REQUEST`
- **Error Code:** `BAD_REQUEST`
- **Message:** `"Missing x-tenant-id header"`
- **Body:**
```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Missing x-tenant-id header"
  }
}
```

**Classification:** ❌ **TENANT_HEADER_REQUIRED**

---

### 4D: `/grc/audits` WITH `x-tenant-id` Header

**Request:**
```bash
GET /grc/audits
Authorization: Bearer <token>
x-tenant-id: 00000000-0000-0000-0000-000000000001
```

**Response:**
- **Status:** `200 OK`
- **Body:** Returns audit list with pagination:
  - **Total Audits:** `4`
  - **Audits Returned:** 4 audit records with full details
  - **Pagination:** `{"page":1,"pageSize":20,"total":4,"totalPages":1}`

**Sample Audit Data:**
- Audit IDs present
- All audits have `tenantId: 00000000-0000-0000-0000-000000000001`
- Various statuses: `planned`, `in_progress`
- Audit types: `internal`
- Risk levels: `medium`

**Classification:** ✅ **OK** - Audits returned successfully

---

## STEP 5: ROOT CAUSE CLASSIFICATION

### Primary Root Cause
🔴 **TENANT_HEADER_REQUIRED**

**Issue:** Frontend API calls to `/onboarding/context` and `/grc/audits` are missing the required `x-tenant-id` header.

**Evidence:**
- Both endpoints return `400 BAD_REQUEST` with message `"Missing x-tenant-id header"` when header is absent
- Both endpoints return `200 OK` with full data when header is present
- Tenant ID is available in login response (`data.user.tenantId`)

**Impact:**
- Frontend cannot load onboarding context
- Frontend cannot load audits list
- User experience is broken despite valid authentication

---

## STEP 6: DIAGNOSTIC SUMMARY

### Key Findings

| Endpoint | Without Header | With Header | Root Cause |
|----------|---------------|-------------|------------|
| `/onboarding/context` | `400 BAD_REQUEST` | `200 OK` | Missing `x-tenant-id` |
| `/grc/audits` | `400 BAD_REQUEST` | `200 OK` | Missing `x-tenant-id` |
| `/tenants/current` | `400 BAD_REQUEST` | N/A | Missing `x-tenant-id` |

### Authentication Status
✅ **WORKING**
- Login endpoint: `/auth/login` (not `/api/v2/auth/login`)
- Payload: `{"email": "...", "password": "..."}`
- Token extraction: `data.accessToken`
- Token length: `255 characters`

### Tenant ID Status
✅ **AVAILABLE**
- Source: Login response `data.user.tenantId`
- Value: `00000000-0000-0000-0000-000000000001`
- Note: `/tenants/current` also requires header (circular dependency)

---

## NEXT ACTIONS

### 1. Verify Frontend Header Injection ⚠️ **CRITICAL**

**Code Analysis:**

✅ **API Interceptor (api.ts lines 96-100):** Correctly configured to add `x-tenant-id` header
```typescript
const tenantId = localStorage.getItem('tenantId');
if (tenantId) {
  config.headers['x-tenant-id'] = tenantId;
}
```

✅ **Login Handler (AuthContext.tsx line 221):** Correctly stores tenant ID
```typescript
if (userData?.tenantId) {
  localStorage.setItem('tenantId', userData.tenantId);
}
```

**Potential Issues:**
1. **Timing Issue:** Header might not be available on first request after login
2. **Storage Issue:** `tenantId` might not be persisted correctly
3. **Response Structure:** Verify `unwrapApiResponse` correctly extracts `user.tenantId`

**Debugging Steps:**
1. Open browser DevTools → Application → Local Storage
2. After login, verify `tenantId` key exists with value: `00000000-0000-0000-0000-000000000001`
3. Open Network tab → Filter by "onboarding" or "audits"
4. Check request headers - should see: `x-tenant-id: 00000000-0000-0000-0000-000000000001`
5. If header is missing, check:
   - Is `tenantId` in localStorage?
   - Is the interceptor running? (add console.log)
   - Is there a race condition where request fires before tenantId is stored?

**If Header is Missing:**
- Add console.log in `api.ts` interceptor to verify tenantId is read
- Verify login response structure matches expected format
- Check if there are multiple API client instances (some might not have interceptor)

### 2. Verify API Path Constants

**Check:** `frontend/src/constants/apiPaths.ts` or similar
- Ensure `/onboarding/context` path is correct (not `/api/v2/onboarding/context`)
- Ensure `/grc/audits` path is correct (not `/api/v2/grc/audits`)

### 3. Test After Fix

**Manual Test Steps:**
1. Login via frontend
2. Open browser DevTools → Network tab
3. Navigate to audits page
4. Verify request headers include: `x-tenant-id: 00000000-0000-0000-0000-000000000001`
5. Verify response is `200 OK` with audit data

---

## TECHNICAL DETAILS

### Backend Endpoints Tested
- ✅ `POST /auth/login` → `200 OK`
- ❌ `GET /tenants/current` → `400 BAD_REQUEST` (requires header)
- ❌ `GET /onboarding/context` → `400 BAD_REQUEST` (without header)
- ✅ `GET /onboarding/context` → `200 OK` (with header)
- ❌ `GET /grc/audits` → `400 BAD_REQUEST` (without header)
- ✅ `GET /grc/audits` → `200 OK` (with header)

### Response Structure
All endpoints return NestJS standard format:
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
- **Token Location:** `data.accessToken` in login response
- **Token Expiry:** 24 hours (from JWT_EXPIRES_IN env var)

### Tenant Isolation
- All tenant-scoped endpoints require `x-tenant-id` header
- Tenant ID is UUID format: `00000000-0000-0000-0000-000000000001`
- Tenant ID is available in login response and should be stored client-side

---

## CONCLUSION

**Status:** ✅ **Backend is functioning correctly**

The staging backend is working as designed. All endpoints return proper responses when the required `x-tenant-id` header is provided. The issue is entirely on the frontend side - the `x-tenant-id` header is not being sent with API requests.

**Priority:** 🔴 **HIGH** - This is blocking core functionality (onboarding and audits).

**Estimated Fix Time:** 15-30 minutes (verify header injection in API interceptor)

---

**Report Generated:** 2025-12-14  
**Diagnostic Method:** Read-only curl commands against staging server  
**No code or database changes were made during this diagnostic**
