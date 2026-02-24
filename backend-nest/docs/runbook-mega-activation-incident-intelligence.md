# Runbook: Change Activation & Incident Intelligence Pack vNext

## Overview

This runbook covers the operational procedures for the features delivered in the mega PR:
- CAB Agenda fix (add Change to agenda)
- Incident Edit/Save fix + Priority Matrix auto-computation
- Major Incident permissions stabilization
- Change Risk Score with Linked Risk Contribution
- ITSM Studio Priority Matrix admin UI

---

## 1. Migration & Seed Commands

### Priority Matrix Table Migration

The migration `1742400000000-CreatePriorityMatrixTable` creates the `itsm_priority_matrix` table.

```bash
# On staging (via docker compose)
docker compose -f docker-compose.staging.yml exec backend npm run migration:run:prod

# Verify migration ran
docker compose -f docker-compose.staging.yml exec db psql -U grc -d grc_platform -c "SELECT * FROM migrations ORDER BY id DESC LIMIT 5;"
```

### Seed Default Priority Matrix

After migration, seed the default ITIL priority matrix:

```bash
# Via API (recommended)
curl -X POST http://46.224.99.150/api/grc/itsm/priority-matrix/seed \
  -H "Authorization: Bearer <TOKEN>" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json"
```

### Full Database Reseed (if needed)

```bash
docker compose -f docker-compose.staging.yml exec backend npm run seed:grc
```

Admin credentials after reseed:
- Email: admin@grc-platform.local
- Password: TestPassword123!

---

## 2. API Validation Curls

### Get Auth Token

```bash
TOKEN=$(curl -s -X POST http://46.224.99.150/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@grc-platform.local","password":"TestPassword123!"}' \
  | jq -r '.data.accessToken // .accessToken')

echo "Token: $TOKEN"
```

### A) CAB Agenda — Add Change

```bash
# List CAB meetings
curl -s http://46.224.99.150/api/grc/itsm/cab-meetings \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" | jq '.data.items[:2]'

# Add change to CAB agenda (replace IDs)
curl -X POST http://46.224.99.150/api/grc/itsm/cab-meetings/<CAB_ID>/agenda \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"changeId":"<CHANGE_ID>","order":1}'
```

Expected: 200/201 (not "Verification failed")

### B) Incident Edit/Save

```bash
# Create incident
curl -s -X POST http://46.224.99.150/api/grc/itsm/incidents \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"shortDescription":"Runbook test incident","impact":"high","urgency":"medium"}' | jq '.data.priority'

# Expected: "p2" (auto-computed from high x medium)

# Edit incident
curl -s -X PATCH http://46.224.99.150/api/grc/itsm/incidents/<INC_ID> \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"shortDescription":"Updated description","impact":"high","urgency":"high"}' | jq '.data.priority'

# Expected: "p1" (recalculated from high x high)
```

### C) Major Incident List

```bash
curl -s http://46.224.99.150/api/grc/itsm/major-incidents \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" | jq '.success, .data.items | length'

# Expected: true, <number> (not "Access denied")
```

### D) Change Risk Assessment with Linked Risk Contribution

```bash
# Get risk assessment for a change
curl -s http://46.224.99.150/api/grc/itsm/changes/<CHANGE_ID>/risk-assessment \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  | jq '.data.assessment.breakdown[] | select(.name == "Linked Risk Contribution")'

# Expected: { name: "Linked Risk Contribution", weight: 12, score: <0-100>, ... }
```

### E) Priority Matrix CRUD

```bash
# Get matrix
curl -s http://46.224.99.150/api/grc/itsm/priority-matrix \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" | jq '.'

# Upsert matrix entries
curl -X PUT http://46.224.99.150/api/grc/itsm/priority-matrix \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"entries":[{"impact":"high","urgency":"high","priority":"p1"},{"impact":"high","urgency":"medium","priority":"p2"}]}'
```

---

## 3. UI Verification Checklist

### CAB Agenda
- [ ] Navigate to ITSM > CAB Meetings
- [ ] Open an existing CAB meeting or create a new one
- [ ] Click "Add Change to Agenda"
- [ ] Select a change and confirm
- [ ] Verify no "Verification failed" error appears
- [ ] Verify the change appears in the agenda list
- [ ] Reorder agenda items and save

### Incident Edit
- [ ] Navigate to ITSM > Incidents
- [ ] Open an existing incident
- [ ] Edit description or other fields
- [ ] Click Save
- [ ] Verify no "Verification failed" error appears
- [ ] Change Impact to "High" and Urgency to "High"
- [ ] Verify Priority field shows "P1" (read-only, auto-computed)
- [ ] Verify Priority field cannot be manually edited

### Major Incident List
- [ ] Navigate to ITSM > Major Incidents
- [ ] Verify the list loads without "Access denied" or "Failed to load"
- [ ] Verify pagination works
- [ ] Open a major incident detail and verify it loads

### Change Risk Score
- [ ] Navigate to ITSM > Changes
- [ ] Open a change with linked risks
- [ ] Expand the "Risk Assessment" section
- [ ] Verify "Linked Risk Contribution" factor appears in the breakdown
- [ ] Verify the factor has a score, weight (12%), and evidence text
- [ ] Link a new risk and recalculate — verify the score updates

### ITSM Studio Priority Matrix
- [ ] Navigate to ITSM > Studio > Priority Matrix
- [ ] Verify the 3x3 matrix table loads with current mappings
- [ ] Edit a cell (e.g., change high x high from P1 to P2)
- [ ] Click Save
- [ ] Verify success message appears
- [ ] Click "Reset to Defaults" and confirm
- [ ] Verify the matrix resets to ITIL defaults

---

## 4. Troubleshooting Matrix

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| "Verification failed" on CAB agenda | Frontend sending forbidden fields in payload | Check ItsmCabMeetingDetail.tsx — ensure payload only contains { changeId, order } |
| "Verification failed" on Incident edit | Frontend sending computed/forbidden fields (priority, number, tenantId) | Check normalizeUpdatePayload in ItsmIncidentDetail.tsx — ensure it strips readonly fields |
| "Access denied" on Major Incident list | Missing ITSM_MAJOR_INCIDENT_READ permission for role | Check permission.service.ts — verify ADMIN/MANAGER/USER roles include itsm:major_incident:read |
| Priority not auto-computing | PriorityMatrixService not injected or matrix not seeded | Run seed command, check itsm.module.ts for PriorityMatrix module import |
| Linked Risk Contribution shows 0 | No risks linked to the change OR repos not injected | Verify ItsmChangeRisk and GrcRisk repos are imported in itsm.module.ts |
| Priority Matrix UI 404 | Route not added in App.tsx or component not exported | Check App.tsx for /itsm/studio/priority-matrix route, check index.ts export |
| Migration fails | Table already exists or enum conflict | Check if table exists first; use IF NOT EXISTS in migration |

---

## 5. Priority Matrix Administration (ITSM Studio)

### Overview
The Priority Matrix defines how Impact x Urgency maps to a Priority level (P1-P5) for incidents.

### Access
- URL: `/itsm/studio/priority-matrix`
- Required role: `admin`
- Navigation: ITSM domain > Studio > Priority Matrix

### Default Matrix (ITIL Standard)

| Impact \ Urgency | High | Medium | Low |
|-------------------|------|--------|-----|
| **High** | P1 | P2 | P3 |
| **Medium** | P2 | P3 | P4 |
| **Low** | P3 | P4 | P5 |

### How It Works
1. Admin configures the matrix in ITSM Studio
2. When an incident is created or updated with impact/urgency changes, the backend looks up the matrix
3. Backend is source of truth — frontend shows priority as read-only
4. If no matrix entry exists for a combination, fallback to hardcoded ITIL defaults
5. Matrix is tenant-scoped — each tenant can have their own configuration

### Change Risk Contribution Model

The Change Risk Scoring now includes a "Linked Risk Contribution" factor (weight: 12/112 = ~10.7%).

**Formula:**
```
For each linked GRC risk:
  severityScore = CRITICAL:100, HIGH:75, MEDIUM:50, LOW:25
  statusWeight  = IDENTIFIED/OPEN/ANALYZING:1.0, MITIGATING/MONITORING:0.6, CLOSED/ACCEPTED:0.2, DRAFT:0.4
  weightedScore = severityScore * statusWeight

avgWeightedScore = sum(weightedScores) / count
scaleFactor = min(2.0, 1 + (count - 1) * 0.25)
finalScore = min(100, round(avgWeightedScore * scaleFactor))
```

The scaleFactor ensures that more linked risks proportionally increase the contribution (capped at 2x).

If no risks are linked, score = 0 (backward compatible).
