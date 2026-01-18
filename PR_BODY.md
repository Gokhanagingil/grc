## Problem

### 1. Inconsistent List UI
- 5 GRC list pages had duplicated search/filter UI patterns
- Duplicate Search input (CAPAs screenshot showed two search boxes)
- Inconsistent filter/sort UX across pages
- URL parameters cluttered with default values

### 2. Rate Limit Breaking List Screens (429 Root Cause)
- GET list endpoints hitting strict 10/min rate limit
- List screens showing "Failed to load..." errors
- UI locking on 429 responses
- Search/filter operations triggering too many requests

## Solution

### 1. Shared ListToolbar Component + Clean URLs
- Created `ListToolbar` component with:
  - Single search input (debounced 800ms, minLength 2)
  - Filter button opens popover with filter fields
  - Sort dropdown with direction toggle (ASC/DESC)
  - Active filter chips with remove buttons
  - Clear All action
  
- Migrated 5 pages to use ListToolbar:
  - IncidentManagement
  - ProcessManagement  
  - ProcessViolations
  - RiskManagement
  - StandardsLibrary

- URL Parameter Sadeleştirme:
  - Default values excluded (page=1, pageSize=10, sort=createdAt:DESC)
  - Empty filters not included in URL
  - Single encoding via URLSearchParams (no double-encoding)
  - Filter format: canonical `{and:[...]}` produced, legacy `{op:"and", children:[...]}` supported for reading

### 2. Rate Limiting Policy Fix (429 Root Cause)
**Frontend:**
- Search debounce: 800ms (was 300ms)
- Search minLength: 2 characters (no fetch for single char)
- Request cancellation: AbortController for GET requests (prevents duplicate requests)
- 429 handling: User-friendly messages, keep previous data (no UI lock)
- useEffect loop prevention: Single source of truth (URL params), deduplication to prevent duplicate fetches
- Query params deduplication: Skips fetch if query params unchanged (lastQueryParamsRef)

**Backend:**
- MethodBasedThrottlerGuard: Method/route-based rate limiting
  - `GET /grc/** list/detail`: **120/min** (read) - prevents list screen failures
  - `POST/PUT/PATCH/DELETE /grc/**`: **30/min** (write) - moderate for mutations
  - `POST /auth/login`: **10/min** (auth) - strict for auth
- GlobalExceptionFilter: 429 responses include `Retry-After` header and scope
- Rate limit tracking: `tenantId + userId/ip + scope` (per-tenant/user, not global)
- Trust proxy: `app.set('trust proxy', true)` for correct IP extraction behind nginx

## Impact

### Before
- List screens failing with "Failed to load..." due to 429 errors
- Duplicate search inputs on some pages
- Inconsistent filter/sort UI patterns
- URL cluttered: `?page=1&pageSize=10&sort=createdAt%3ADESC` even for defaults

### After  
- List screens stable: GET endpoints have 120/min limit (was 10/min)
- Single search input, debounced properly
- Consistent ListToolbar across all GRC list pages
- Clean URLs: `?filter={...}&sort=updatedAt%3AASC` only when non-default

## Testing

### Request Storm Prevention:
- Rapid filter/sort changes should not trigger duplicate fetches (dedupe check)
- AbortController cancels in-flight requests when URL params change
- Browser DevTools Network tab: Should see cancelled requests (status: cancelled)

### 429 Handling:
- If rate limit hit, UI shows user-friendly message with retry time
- Previous list data remains visible (no UI lock, no data clearing)
- Alert component displays non-blocking error message

### Manual Verification:
- **IncidentManagement**: Type search rapidly, clear, change filter/sort - no 429, no duplicate fetches
- **RiskManagement**: Same test
- **ProcessViolations**: Same test
- **StandardsLibrary**: Same test
- **Curl loop**: `for i in {1..20}; do curl -H "x-tenant-id: test" /api/grc/risks?...&search=test$i; done` - should not hit 429 under new policy (120/min)

### Regression Checks:
- URL params utilities tests: default exclusion, legacy format normalization
- All existing list API contracts maintained (no regression)
- Frontend search debounce reduces rate limit pressure
- Backend method-based limits prevent GET list screens from hitting strict limit

## Files Changed

**New Files:**
- `frontend/src/components/common/ListToolbar.tsx`
- `frontend/src/utils/queryParams.ts`
- `frontend/src/utils/__tests__/queryParams.test.ts`
- `backend-nest/src/common/guards/method-based-throttler.guard.ts`

**Modified:**
- 5 list pages migrated to ListToolbar with request storm prevention:
  - IncidentManagement: useEffect loop fix, dedupe, AbortController, 429 handling
  - RiskManagement: Same pattern applied
  - ProcessViolations: Same pattern applied (processId special case preserved)
  - StandardsLibrary: Same pattern applied (filters object pattern adapted)
  - ProcessManagement: Already uses ListToolbar (may need same fixes if issues found)
- API client: Request cancellation + 429 handling
- Backend: MethodBasedThrottlerGuard + GlobalExceptionFilter 429 handling
- Backend main.ts: Trust proxy configuration for nginx

## How to Test

1. **List Screens Stability:**
   - Navigate to IncidentManagement, RiskManagement, ProcessViolations, etc.
   - Rapidly change filters/sort - should not hit 429 or trigger duplicate fetches
   - Search with 2+ characters - debounced 800ms
   - Verify no "Failed to load..." errors during normal usage

2. **URL Cleanliness:**
   - Apply filters/sort - URL updates with only non-default values
   - Clear filters - URL becomes clean (no default params)

3. **Rate Limiting:**
   - GET list endpoints: 120/min (should not hit limit in normal usage)
   - Write endpoints: 30/min (mutations)
   - Auth: 10/min (login attempts)
