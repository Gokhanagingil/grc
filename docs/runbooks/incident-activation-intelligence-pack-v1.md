# Incident Activation & Intelligence Pack v1 — Runbook

## Overview

This pack hardens the Incident Management module for production-ready operational use.
It covers priority intelligence, save reliability, link/unlink workflows, error classification,
and contract consistency.

---

## Issues Solved

| # | Issue | Root Cause | Fix |
|---|-------|------------|-----|
| 1 | Frontend used hardcoded ITIL matrix for live priority preview | No API to fetch tenant-specific matrix | Added `fetchTenantMatrix()` + backend `GET /evaluate` endpoint |
| 2 | Studio PriorityMatrix page used ad-hoc response parsing | Missing shared helper usage | Replaced with `unwrapArrayResponse()` |
| 3 | Unlink risk/control errors showed generic messages | Missing error classification in catch blocks | Added `classifyApiError()` to all link/unlink handlers |
| 4 | Priority field was editable by users | No enforcement of read-only computed field | Already read-only; confirmed with `data-testid` and helper text |
| 5 | No backend endpoint for priority evaluation | Frontend had no way to query single priority | Added `GET /grc/itsm/priority-matrix/evaluate?impact=X&urgency=Y` |
| 6 | P5 priority level not supported in frontend | Missing from label/color maps | Added P5 to `getPriorityLabel()` and `getPriorityColor()` |

---

## API Validation Commands

```bash
# Priority Matrix — Get full matrix
curl -s -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  http://localhost/api/grc/itsm/priority-matrix | jq .

# Priority Matrix — Evaluate single combination
curl -s -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  "http://localhost/api/grc/itsm/priority-matrix/evaluate?impact=HIGH&urgency=HIGH" | jq .

# Priority Matrix — Seed default (idempotent)
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  http://localhost/api/grc/itsm/priority-matrix/seed | jq .

# Incident — Update (priority stripped from payload)
curl -s -X PUT -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"shortDescription":"Test","impact":"HIGH","urgency":"MEDIUM"}' \
  http://localhost/api/grc/itsm/incidents/<ID> | jq .
```

---

## UI Smoke Checklist

- [ ] Open existing incident → fields load correctly
- [ ] Change Impact dropdown → priority badge updates instantly
- [ ] Change Urgency dropdown → priority badge updates instantly
- [ ] Priority field shows "Auto-computed from Impact × Urgency — updates live"
- [ ] Priority field is NOT editable (read-only)
- [ ] Save incident → success notification, no "Validation failed" error
- [ ] Save with invalid data → field-level error message (not generic)
- [ ] Link Risk dialog → search, select, link works
- [ ] Unlink Risk → removes from list, success notification
- [ ] Link Control dialog → search, select, link works
- [ ] Unlink Control → removes from list, success notification
- [ ] SLA panel loads or shows empty state (no crash)
- [ ] ITSM Studio → Priority Matrix page loads matrix grid
- [ ] Studio → Edit matrix cell → Save → success
- [ ] After Studio save → incident priority reflects new rules

---

## Troubleshooting

| Symptom | Check | Fix |
|---------|-------|-----|
| Priority doesn't update on impact/urgency change | Console for fetchTenantMatrix errors | Verify `/api/grc/itsm/priority-matrix` returns 200 |
| "Validation failed" on save | Check backend logs for DTO validation | Ensure payload normalizer strips forbidden fields |
| Link Risk shows empty list | Check `/api/grc/risks` returns items | Verify tenant has risks seeded |
| SLA panel empty | Check `/api/grc/itsm/incidents/:id/sla` | May need SLA policies configured |
| Studio matrix save fails | Check PUT `/api/grc/itsm/priority-matrix` payload | Ensure entries array has all 9 cells |

---

## Deferred Items

- Matrix drift detection (frontend vs backend matrix divergence warning)
- "Matrix source: ITSM Studio" label on priority preview
- SLA "Re-evaluate" button stabilization (depends on SLA engine maturity)
- E2E Playwright test for full incident edit flow
