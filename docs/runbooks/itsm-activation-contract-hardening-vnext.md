# ITSM Activation & Contract Hardening — v.Next Runbook

## Executive Summary

This runbook documents the systematic stabilization of ITSM response contracts, frontend parsing, payload normalization, and activation flows across the GRC+ITSM platform. The changes eliminate "Verification failed / Validation failed / Failed to load" class errors caused by response envelope drift and fragile ad-hoc parsing.

## Root Cause Summary

| Symptom | Root Cause | Fix Strategy | Risk | Test Coverage |
|---------|-----------|--------------|------|---------------|
| CAB → agenda → add change ⇒ "Verification failed" | Frontend ad-hoc parsing didn't handle all envelope variants from backend | Replace with `unwrapArrayResponse` shared helper | Low | Frontend parsing helper tests |
| Incident → update save ⇒ "An unexpected error occurred" | Frontend sent forbidden/computed fields (priority, state vs status drift) | `normalizeUpdatePayload` strips forbidden fields; field mapping corrected | Low | Incident save flow |
| Incident → SLA/Risk/Control missing data | Ad-hoc envelope parsing fragile across response shape variants | Standardize with `unwrapArrayResponse` | Low | Incident detail tests |
| Major Incident → PIR tab ⇒ "Failed to load PIR" | PIR endpoint returns varying shapes (single/array/paginated); frontend didn't handle all | `unwrapResponse` + classified error handling (403/404/transient) | Low | MI PIR tab tests |
| Change detail → guardrail/topology warning blocks form | Enrichment API failures not gracefully degraded | Already uses `Promise.allSettled`; standardized parsing with `unwrapResponse`/`unwrapArrayResponse` | Low | Change detail tests |
| ITSM controllers → double-envelope drift | Controllers manually wrapping `{ data: ... }` while global interceptor also wraps | Remove manual wrapping from 60+ endpoints across 10 controllers | Medium | Backend contract tests |
| Generic "Verification failed" errors | Frontend showed raw backend error instead of classified user-friendly message | `classifyApiError` for 403/404/validation/transient classification | Low | Error classifier tests |

## Endpoint Contract Examples

### Before (Double Envelope)
```json
// Controller returned { data: result } → Interceptor wrapped again
{
  "success": true,
  "data": {
    "data": { "id": "...", "title": "..." }
  }
}
```

### After (Single Envelope)
```json
// Controller returns raw result → Interceptor wraps once
{
  "success": true,
  "data": { "id": "...", "title": "..." }
}
```

### List Endpoint (LIST-CONTRACT)
```json
{
  "success": true,
  "data": {
    "items": [...],
    "total": 42,
    "page": 1,
    "pageSize": 20,
    "totalPages": 3
  }
}
```

## Staging Verification Checklist

### Prerequisites
- [ ] PR merged to main
- [ ] Staging deployed: `docker compose -f docker-compose.staging.yml up -d --build`
- [ ] Health check passes: `curl -s http://localhost:3002/health/live`

### CAB Agenda
- [ ] Navigate to ITSM → CAB Meetings → select a meeting
- [ ] Click "Add Change" → search for a change by number/title
- [ ] Select a change from search results
- [ ] Verify change is added to agenda without "Verification failed"
- [ ] Try adding a duplicate → verify friendly error message

### Incident Detail
- [ ] Create a new incident with required fields → saves without error
- [ ] Open existing incident → verify all sections load
- [ ] Change Impact/Urgency → verify Priority updates live (read-only field)
- [ ] Save incident → verify no "Validation failed" error
- [ ] Expand SLA section → verify data loads (or empty state if none)
- [ ] Expand Linked Risks → verify smart empty state with "Link a Risk" CTA
- [ ] Expand Linked Controls → verify smart empty state with "Link a Control" CTA
- [ ] Link a risk → verify it appears in the list
- [ ] Unlink a risk → verify it's removed

### Major Incident PIR
- [ ] Navigate to ITSM → Major Incidents → select one
- [ ] Click PIR tab
- [ ] If no PIR exists → verify "No PIR exists yet" empty state with Create button
- [ ] If PIR load fails → verify warning alert with Retry button (not full page reload)
- [ ] Click Retry → verify PIR loads or shows appropriate error
- [ ] If PIR exists → verify all sections render correctly

### Change Detail
- [ ] Open an existing change → verify form loads quickly
- [ ] Verify linked risks/controls/conflicts/approvals all load
- [ ] If topology fails → verify warning banner (not form blocking)
- [ ] Verify guardrail evaluate works or shows classified error
- [ ] Save change → verify success

## Troubleshooting Matrix

| Error Message | Likely Cause | Resolution |
|--------------|-------------|------------|
| "Verification failed" | UUID validation or DTO mismatch | Check payload field names match backend DTO; verify UUID format |
| "Validation failed" | Backend DTO validation rejected payload | Check for forbidden fields (priority, state); verify enum values are UPPERCASE |
| "Failed to load PIR" | PIR endpoint returned unexpected shape or 500 | Check backend logs; verify PIR endpoint contract; use Retry button |
| "Permission denied" / 403 | Missing ITSM permission or tenant mismatch | Verify user has ITSM_*_READ/WRITE permissions; check x-tenant-id header |
| "An unexpected error occurred" | Unhandled backend exception | Check backend logs for stack trace; verify request payload format |
| Empty sections (no data) | Endpoint returned empty array or 404 | Normal if no data exists; verify with direct API call if unexpected |
| Double-wrapped response | Controller still manually wrapping | Check controller method — should return raw object, not `{ data: ... }` |

## Controllers Modified (WS1)

All ITSM controllers standardized to let global `ResponseTransformInterceptor` handle envelope wrapping:

1. `incident.controller.ts` — Incident CRUD + linking
2. `pir.controller.ts` — Post-Incident Review
3. `change.controller.ts` — Change CRUD + topology
4. `change-ci.controller.ts` — Change CI associations
5. `priority-matrix.controller.ts` — Priority matrix CRUD
6. `knowledge-candidate.controller.ts` — Knowledge candidates
7. `pir-action.controller.ts` — PIR action items
8. `risk.controller.ts` — Change risk assessment
9. `policy.controller.ts` — Change policy evaluation
10. `topology-impact.controller.ts` — Topology impact analysis

## Frontend Files Modified (WS2-6)

1. `ItsmCabMeetingDetail.tsx` — Agenda fetch uses `unwrapArrayResponse`
2. `ItsmIncidentDetail.tsx` — All parsing standardized; smart empty states for risks/controls
3. `ItsmMajorIncidentDetail.tsx` — PIR classified errors; retry in place
4. `ItsmChangeDetail.tsx` — All enrichment parsing standardized with shared helpers

## Known Deferred Items

- Backend contract tests for specific endpoint shapes (deferred to follow-up PR)
- Frontend component-level tests for WOW cards (covered by PR #487 unit tests for priority matrix)
- MI-SCEN-001 scenario pack smoke test flakiness (pre-existing, tracked separately)
