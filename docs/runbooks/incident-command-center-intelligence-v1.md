# Incident Command Center & Operational Intelligence Pack v1

## Feature Overview

This pack transforms the ITSM Incident Detail page into an **operational decision center** by adding three new high-visibility sections at the top of the page:

1. **Operational Summary Card** — A gradient hero card showing key metrics at a glance: priority, impact x urgency matrix source, SLA count/breach status, linked risks/controls/CIs, service binding, and state.

2. **Health Indicators** — Four deterministic badges that assess incident readiness:
   - **Data Completeness** — checks key field population (shortDescription, state, impact, urgency, category, service, assignment)
   - **Risk Coverage** — whether risks and controls are linked
   - **SLA Coverage** — whether SLA records exist and breach status
   - **CI Context** — whether affected CIs are linked

3. **Next Best Actions** — A rule-based recommendation panel that surfaces actionable suggestions based on the current incident state (e.g., "Add Affected CIs", "Link Risks", "Verify SLA Policy", "Consider Major Incident Designation").

### Additional Improvements

- **Priority Matrix Source Visibility**: The priority field now shows the exact computation formula (Impact x Urgency) and identifies whether the Tenant-specific or ITIL Default matrix was used.
- **Inline Re-evaluate Hooks**: "Recalculate Priority" and "Refresh SLA" action buttons in the toolbar for on-demand re-computation.
- **Error UX Standardization**: All link/unlink/refresh operations now use classified error handling (permission, not_found, network, validation) instead of generic error messages.

## API Dependency List

This feature is **frontend-only** — no new backend endpoints are required. It relies on data already fetched by the Incident Detail page:

| Data Source | API Endpoint | Purpose |
|---|---|---|
| Incident record | `GET /api/grc/itsm/incidents/:id` | Core incident data |
| Linked risks | `GET /api/grc/itsm/incidents/:id/risks` | Risk count for health/NBA |
| Linked controls | `GET /api/grc/itsm/incidents/:id/controls` | Control count for health/NBA |
| SLA instances | `GET /api/grc/itsm/sla/record-slas?taskType=Incident&taskId=:id` | SLA health/breach detection |
| Affected CIs | `GET /api/grc/itsm/incidents/:id/affected-cis?page=1&pageSize=1` | CI count for summary card |
| Priority matrix | `GET /api/grc/itsm/priority-matrix` | Matrix source detection |

## Files Changed

### New Files
- `frontend/src/utils/incidentCommandCenter.ts` — Pure derivation utilities (health indicators, next best actions, operational summary)
- `frontend/src/components/itsm/IncidentCommandCenter.tsx` — Command Center React component
- `frontend/src/utils/__tests__/incidentCommandCenter.test.ts` — 28 unit tests
- `docs/runbooks/incident-command-center-intelligence-v1.md` — This runbook

### Modified Files
- `frontend/src/pages/itsm/ItsmIncidentDetail.tsx` — Replaced old intelligence card with Command Center, added inline re-evaluate hooks, improved error classification

## Manual Validation Checklist (Staging)

```
[ ] Navigate to an existing incident detail page
[ ] Verify Command Center summary card renders with correct priority gradient
[ ] Verify metric strip shows correct counts for SLAs, Risks, Controls, CIs
[ ] Hover over "Impact x Urgency" pill to see priority matrix tooltip
[ ] Verify Health Indicators section shows 4 badges with appropriate colors
[ ] Hover over each health badge to see detail text
[ ] Verify Next Best Actions panel shows relevant recommendations
[ ] Click "Recalculate Priority" button — verify notification shows new priority
[ ] Click "Refresh SLA" button — verify SLA data refreshes
[ ] Link a risk → verify summary card risk count updates
[ ] Unlink a risk → verify summary card risk count updates
[ ] Link a control → verify summary card control count updates
[ ] Navigate to a new incident form → verify Command Center is NOT shown
[ ] Verify Priority field helper text shows "Computed: Impact (X) x Urgency (Y) via [Tenant/ITIL] Matrix"
[ ] Change Impact dropdown → verify priority auto-recalculates
[ ] Change Urgency dropdown → verify priority auto-recalculates
[ ] Test with a P1 unresolved incident → verify "Consider Major Incident" action appears
[ ] Test with a fully-equipped resolved incident → verify "All Clear" state appears
```

## Troubleshooting Matrix

| Symptom | Likely Cause | Resolution |
|---|---|---|
| Command Center not showing | `isNew` is true or `incident.id` missing | Ensure viewing an existing incident (not `/new`) |
| Health indicators all "unknown" | Data not loaded yet | Check network tab for API failures; verify auth token |
| Priority shows "ITIL Matrix" when tenant matrix is configured | `fetchTenantMatrix()` failing | Check `/api/grc/itsm/priority-matrix` endpoint; may need ITSM Studio config |
| CI count always 0 | `listAffectedCis` endpoint not returning total | Verify endpoint returns `{ data: { total: N } }` envelope |
| "Recalculate Priority" shows old value | Matrix hasn't changed | Expected if impact/urgency unchanged; matrix is deterministic |
| Error notifications show generic messages | `classifyApiError` not matching | Check response status codes; may need to extend classifier |

## Known Limitations / Deferreds

1. **Affected CI count** is fetched with a lightweight `pageSize=1` call to get the total. If the `listAffectedCis` endpoint doesn't return a `total` field, the count will show 0.
2. **Matrix source detection** currently always sets `tenant` on successful fetch (even if the result matches the default ITIL matrix). A future improvement could compare entries to detect true customization.
3. **Next Best Actions are read-only** — they don't trigger actions directly. Future iterations could add click-to-navigate or click-to-open-dialog behavior.
4. **Health indicator thresholds are hardcoded** in the frontend utility. A future version could make them configurable via ITSM Studio.
5. **No backend changes** in this PR. If additional intelligence requires server-side computation, a follow-up PR would be needed.

## Architecture Decision

All Command Center intelligence is derived in the frontend via pure functions (`incidentCommandCenter.ts`). This was intentional:

- **No extra API calls** — everything derives from data already fetched
- **Deterministic and testable** — 28 unit tests cover all derivation logic
- **Instant updates** — health indicators and actions update immediately when linked items change
- **No backend coupling** — can ship independently without backend deployment risk
