# Change Calendar + CAB Maturity Pack v1 — Runbook

## Overview
This runbook covers the v1 delivery of the Change Calendar, CAB (Change Advisory Board), Conflict Detection, and Blackout Window features for the GRC ITSM module.

---

## 1. Migrations

The following migrations are included in this pack. They run automatically on backend startup via TypeORM synchronize or via explicit migration commands.

### Entities Added/Modified
| Entity | Table | Notes |
|---|---|---|
| CalendarEvent | `itsm_change_calendar_event` | Types: CHANGE, MAINTENANCE, FREEZE, BLACKOUT, ADVISORY |
| CalendarConflict | `itsm_calendar_conflict` | Types: OVERLAP, FREEZE_WINDOW, BLACKOUT_WINDOW, ADJACENCY |
| FreezeWindow | `itsm_freeze_window` | Scopes: GLOBAL, SERVICE, CI |
| CabMeeting | `itsm_cab_meeting` | Statuses: DRAFT, SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED |
| CabAgendaItem | `itsm_cab_agenda_item` | Decision statuses: PENDING, APPROVED, REJECTED, DEFERRED, MORE_INFO |

### Running Migrations on Staging
```bash
# SSH into staging server
ssh root@46.224.99.150

# Navigate to platform directory
cd /opt/grc-platform

# Run migrations
docker compose -f docker-compose.staging.yml exec backend node dist/data-source.js migration:run

# Verify migrations
docker compose -f docker-compose.staging.yml exec backend node dist/data-source.js migration:show
```

---

## 2. Seed Commands

### Seed the database (includes all ITSM data)
```bash
# On staging server
docker compose -f docker-compose.staging.yml exec backend npm run seed:grc
```

### Post-seed credentials
- Email: `admin@grc-platform.local`
- Password: `TestPassword123!`
- Demo tenant ID: `00000000-0000-0000-0000-000000000001`

---

## 3. API Validation Commands

All API endpoints require:
- `Authorization: Bearer <token>` header
- `x-tenant-id: 00000000-0000-0000-0000-000000000001` header

### 3.1 Calendar Events CRUD
```bash
TENANT="00000000-0000-0000-0000-000000000001"
BASE="http://localhost/api"

# List calendar events
curl -s -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: $TENANT" \
  "$BASE/grc/itsm/calendar-events" | jq .

# Create a blackout window event
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: $TENANT" \
  -H "Content-Type: application/json" \
  -d '{"title":"Maintenance Blackout","type":"BLACKOUT","status":"SCHEDULED","startAt":"2026-04-01T00:00:00Z","endAt":"2026-04-01T06:00:00Z"}' \
  "$BASE/grc/itsm/calendar-events" | jq .
```

### 3.2 Change Calendar Time-Range
```bash
# Get changes for a time range
curl -s -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: $TENANT" \
  "$BASE/grc/itsm/changes/calendar-range?start=2026-03-01T00:00:00Z&end=2026-04-01T00:00:00Z" | jq .

# With filters
curl -s -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: $TENANT" \
  "$BASE/grc/itsm/changes/calendar-range?start=2026-03-01T00:00:00Z&end=2026-04-01T00:00:00Z&state=DRAFT&type=STANDARD" | jq .
```

### 3.3 Conflict Detection
```bash
# Preview conflicts for a time range
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: $TENANT" \
  -H "Content-Type: application/json" \
  -d '{"startAt":"2026-03-15T10:00:00Z","endAt":"2026-03-15T14:00:00Z"}' \
  "$BASE/grc/itsm/conflicts/preview" | jq .

# Get conflicts for a specific change
curl -s -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: $TENANT" \
  "$BASE/grc/itsm/changes/<CHANGE_ID>/conflicts" | jq .

# Refresh conflicts for a change
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: $TENANT" \
  "$BASE/grc/itsm/changes/<CHANGE_ID>/refresh-conflicts" | jq .
```

### 3.4 Freeze Windows
```bash
# List freeze windows
curl -s -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: $TENANT" \
  "$BASE/grc/itsm/freeze-windows" | jq .

# Create a freeze window
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: $TENANT" \
  -H "Content-Type: application/json" \
  -d '{"name":"Q1 Freeze","scope":"GLOBAL","startAt":"2026-03-28T00:00:00Z","endAt":"2026-04-01T00:00:00Z"}' \
  "$BASE/grc/itsm/freeze-windows" | jq .
```

### 3.5 CAB Meetings CRUD
```bash
# List CAB meetings
curl -s -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: $TENANT" \
  "$BASE/grc/itsm/cab-meetings" | jq .

# Create a CAB meeting
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: $TENANT" \
  -H "Content-Type: application/json" \
  -d '{"title":"Weekly CAB Review","meetingAt":"2026-03-10T14:00:00Z"}' \
  "$BASE/grc/itsm/cab-meetings" | jq .

# Get a specific meeting
curl -s -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: $TENANT" \
  "$BASE/grc/itsm/cab-meetings/<MEETING_ID>" | jq .

# Add change to agenda
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: $TENANT" \
  -H "Content-Type: application/json" \
  -d '{"changeId":"<CHANGE_ID>"}' \
  "$BASE/grc/itsm/cab-meetings/<MEETING_ID>/agenda" | jq .

# Record a decision
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: $TENANT" \
  -H "Content-Type: application/json" \
  -d '{"decisionStatus":"APPROVED","decisionNote":"Approved with no issues"}' \
  "$BASE/grc/itsm/cab-meetings/<MEETING_ID>/agenda/<ITEM_ID>/decision" | jq .

# Get CAB summary for a change
curl -s -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: $TENANT" \
  "$BASE/grc/itsm/changes/<CHANGE_ID>/cab-summary" | jq .
```

---

## 4. UI Validation Checklist

### 4.1 Change Calendar Page (`/itsm/change-calendar`)
- [ ] Page loads without errors
- [ ] Calendar grid view renders with current month
- [ ] Month navigation (prev/next/today) works
- [ ] Events display on correct calendar days
- [ ] Type filter works (CHANGE, MAINTENANCE, FREEZE, BLACKOUT, ADVISORY)
- [ ] Status filter works (SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED)
- [ ] List view tab shows events in table format
- [ ] Click on event navigates to change detail
- [ ] Conflict badges/warnings display on events
- [ ] Freeze windows display with distinct styling
- [ ] Blackout events display with distinct styling
- [ ] Create freeze window dialog works
- [ ] Delete freeze window works

### 4.2 CAB Meeting List (`/itsm/change-management/cab`)
- [ ] Page loads without errors
- [ ] Meeting list table renders
- [ ] Pagination works
- [ ] Status filter works
- [ ] Search works
- [ ] Create meeting dialog opens and creates meeting
- [ ] Click on meeting navigates to detail
- [ ] Delete meeting works (with confirmation)

### 4.3 CAB Meeting Detail (`/itsm/change-management/cab/:id`)
- [ ] Page loads without errors
- [ ] Meeting details display correctly
- [ ] Agenda items list renders
- [ ] Add change to agenda works
- [ ] Remove change from agenda works
- [ ] Reorder agenda items works (drag or button)
- [ ] Record decision works (APPROVED, REJECTED, DEFERRED, MORE_INFO)
- [ ] Decision note and conditions save correctly

### 4.4 Change Detail Integration
- [ ] "Scheduling & Conflicts" section renders
- [ ] Conflict list shows warnings with severity badges
- [ ] Refresh conflicts button works
- [ ] "CAB Decisions" section renders
- [ ] Linked CAB meetings display
- [ ] Latest decision status shows
- [ ] No crashes when conflict/CAB data is null/empty

---

## 5. Troubleshooting Matrix

| Symptom | Likely Cause | Fix |
|---|---|---|
| 404 on `/api/grc/itsm/calendar-events` | Nginx routing not proxying `/api/*` | Check nginx config: `location ^~ /api/` must have `proxy_pass http://backend/;` with trailing slash |
| 401 on any endpoint | Token expired or missing | Re-login and get fresh JWT token |
| 403 on calendar/CAB endpoints | Missing permissions | Ensure user role has ITSM_CALENDAR_READ/WRITE, ITSM_CAB_READ/WRITE, ITSM_FREEZE_READ/WRITE |
| Empty calendar events list | No events for selected month/filters | Check date range, reset filters, verify events exist in DB |
| Conflict detection returns empty | No overlapping events/freezes/blackouts | Create overlapping events to test; verify change has plannedStartAt/plannedEndAt |
| CAB meeting list empty | No meetings for tenant | Create a meeting via API or UI |
| Frontend crash on change detail | Null/undefined data in conflict or CAB section | Check browser console; likely API returned unexpected envelope |
| Migration fails | Table already exists or enum conflict | Run `migration:show` to check pending; use additive approach only |
| CodeQL loop-bound alert | Unbounded loop iteration | Verify `Math.min(safeInput.length, MAX_AGENDA_ITEMS)` pattern is in place |

---

## 6. Warning-Only Behavior Note (v1)

### Important: Conflict Detection is Warning-Only in v1

In this version, conflict detection is **advisory only**:
- Conflicts are detected and displayed as **warnings** to the user
- **No changes are blocked** by conflicts — users can still create/update changes during blackout windows, freeze windows, or overlapping schedules
- The UI shows severity badges (LOW, MEDIUM, HIGH, CRITICAL) to help users make informed decisions
- Blackout window conflicts are flagged as CRITICAL severity but do **not** prevent the change from being saved

### Future Enhancements (v2+)
- Enforced blackout window blocking (hard block on create/update)
- Service-level conflict detection (same service overlap)
- CI-level conflict detection (same configuration item overlap)
- Automated CAB escalation for high-severity conflicts
- Calendar event webhook notifications
- iCal/Google Calendar integration

---

## 7. Architecture Notes

### Backend Controller Routes (Critical)
All controllers use `@Controller('grc/...')` with **NO** `api/` prefix. Nginx strips `/api` before proxying:
- External: `/api/grc/itsm/changes/calendar-range` 
- Backend: `/grc/itsm/changes/calendar-range`

### Multi-Tenant Isolation
All queries are tenant-scoped via `x-tenant-id` header. Cross-tenant data leakage is prevented at the service layer.

### Enum Values
All enum values are UPPERCASE to match Postgres enum labels:
- CalendarEventType: `CHANGE`, `MAINTENANCE`, `FREEZE`, `BLACKOUT`, `ADVISORY`
- CalendarEventStatus: `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`
- ConflictType: `OVERLAP`, `FREEZE_WINDOW`, `BLACKOUT_WINDOW`, `ADJACENCY`
- ConflictSeverity: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
- CabMeetingStatus: `DRAFT`, `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`
- CabDecisionStatus: `PENDING`, `APPROVED`, `REJECTED`, `DEFERRED`, `MORE_INFO`
