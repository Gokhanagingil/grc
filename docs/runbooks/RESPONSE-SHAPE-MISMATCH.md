# How to Detect and Avoid Response Shape Mismatches

> Phase 0 — Stabilization Gate runbook entry.
> Last updated: 2026-02-22

## Problem

A **response shape mismatch** occurs when the backend returns a different
data structure than the frontend expects. Common symptoms:

- `TypeError: w.map is not a function` (expected array, got object)
- Blank screen / white screen of death (component crashes on render)
- Infinite spinner (loading state never resolves because data parsing fails)
- `Cannot read properties of undefined` (expected nested object, got flat)

## Common Mismatch Patterns

| Backend Returns | Frontend Expects | Symptom |
|----------------|-----------------|---------|
| `Record<string, T>` | `T[]` (array) | `.map()` crash |
| `T[]` (array) | `Record<string, T>` | `obj[key]` returns undefined |
| `{ success: true, data: T }` | `T` (flat) | Double-wrapped access |
| `T` (flat) | `{ success: true, data: T }` | Missing `.data` access |
| `{ items: T[], total }` | `T[]` | `.map()` on pagination object |

## Prevention

### 1. Backend: Use Stable Contracts

Every endpoint must declare and follow one of two contracts:

- **LIST-CONTRACT**: `{ items: T[], total: number, page: number, pageSize: number, totalPages: number }`
- **RECORD-CONTRACT**: `{ field1: type, field2: type, ... }` (single object)

Both are wrapped in the NestJS envelope: `{ success: true, data: <contract> }`.

### 2. Frontend: Use Guard Utilities

Use `guardListResponse()` and `guardRecordResponse()` from `src/utils/apiResponseGuard.ts`:

```typescript
import { guardListResponse } from '../utils/apiResponseGuard';

// Instead of:
const items = response.data.items; // Crashes if shape is wrong

// Use:
const guarded = guardListResponse<MyItem>(response.data, 'ChangeList');
if (guarded.shapeMismatch) {
  // Show banner, don't crash
  showBanner(guarded.mismatchDetail, guarded.correlationId);
}
const items = guarded.items; // Always safe (empty array on mismatch)
```

### 3. Frontend: Use Normalizer Functions

For complex nested shapes (like RCA decisions), use dedicated normalizer functions:

```typescript
import { normalizeRcaDecisionsSummary } from '../services/grcClient';

// Handles both legacy array and current Record shapes
const normalized = normalizeRcaDecisionsSummary(rawApiResponse);
```

### 4. Add Regression Tests

Every response shape fix must include:

- **Backend unit test**: Verify the controller/service returns the documented contract shape
- **Frontend unit test**: Verify the normalizer handles both old and new shapes
- **Playwright assertion**: Verify the page doesn't crash/spinner on unexpected shapes

## Detection

### In Development

1. Check browser console for `[apiResponseGuard]` warnings
2. Look for `shapeMismatch: true` in React DevTools state
3. Run `npm run test` to catch shape mismatches in unit tests

### In CI

1. Playwright smoke tests catch infinite spinners and blank crashes
2. Backend unit tests verify response shapes match DTOs
3. TypeScript compiler catches type mismatches at build time

### In Production

1. Monitor for `[apiResponseGuard]` log entries
2. Track correlation IDs in mismatch events for debugging
3. Error banner shows correlation ID to users for support tickets

## Recovery

If a shape mismatch is found in production:

1. **Immediate**: The `apiResponseGuard` utility prevents crashes — users see a banner instead
2. **Short-term**: Identify which endpoint changed and whether it's a backend or frontend issue
3. **Fix**: Prefer fixing at the backend layer (return stable contract); if urgent, add a normalizer in FE
4. **Prevent**: Add regression test covering both old and new shapes

## References

- PR #448: Original RCA decisions shape mismatch (backend returned array, frontend expected Record)
- `src/utils/apiResponseGuard.ts`: Guard utility implementation
- `src/services/grcClient.ts`: `normalizeRcaDecisionsSummary()` normalizer
