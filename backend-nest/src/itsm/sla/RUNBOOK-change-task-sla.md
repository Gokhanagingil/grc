# Change Task SLA Integration — Runbook

## Preconditions

1. Migrations up to date (`npx typeorm migration:show -d dist/data-source.js`)
2. Base seeds applied (`npm run seed:grc`)
3. SLA v2 demo seed applied (optional but helpful)
4. User has `ITSM_SLA_READ` + `ITSM_SLA_WRITE` permissions

## Seed Commands

```bash
# DEV
npx ts-node -r tsconfig-paths/register src/scripts/seed-change-task-sla-demo.ts

# PROD (container)
node dist/scripts/seed-change-task-sla-demo.js
```

Creates 4 CHANGE_TASK SLA policies:
- `SLA-CTASK-Critical-All` — CRITICAL priority: 1h response, 4h resolution
- `SLA-CTASK-High-Implementation` — HIGH + IMPLEMENTATION: 2h response, 8h resolution
- `SLA-CTASK-Blocking-Fallback` — Blocking tasks: 4h resolution
- `SLA-CTASK-Generic-Fallback` — All tasks: 8h resolution

## API Validation Commands

Replace `$TOKEN` with a valid JWT and `$TENANT` with `00000000-0000-0000-0000-000000000001`.

### 1. Field Registry for CHANGE_TASK

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
     -H "x-tenant-id: $TENANT" \
     "http://localhost:3002/grc/itsm/sla/field-registry?recordType=CHANGE_TASK" | jq .
```

Expected: `fields` array containing `priority`, `status`, `taskType`, `assignmentGroupId`, `assigneeId`, `isBlocking`, `stageLabel`, `sourceTemplateId`, `change.type`, `change.risk`, `change.serviceId`, `change.state`.

### 2. Validate Condition Tree

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
     -H "x-tenant-id: $TENANT" \
     -H "Content-Type: application/json" \
     "http://localhost:3002/grc/itsm/sla/validate-condition" \
     -d '{
       "recordType": "CHANGE_TASK",
       "conditionTree": {
         "operator": "AND",
         "children": [
           {"field": "priority", "operator": "is", "value": "CRITICAL"},
           {"field": "taskType", "operator": "is", "value": "IMPLEMENTATION"}
         ]
       }
     }' | jq .
```

Expected: `{ valid: true, errors: [] }`

### 3. Evaluate SLA for a Context

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
     -H "x-tenant-id: $TENANT" \
     -H "Content-Type: application/json" \
     "http://localhost:3002/grc/itsm/sla/evaluate" \
     -d '{
       "recordType": "CHANGE_TASK",
       "context": {
         "priority": "CRITICAL",
         "taskType": "IMPLEMENTATION",
         "status": "OPEN"
       }
     }' | jq .
```

Expected: `{ matched: true, selectedPolicy: { name: "SLA-CTASK-Critical-All", ... } }`

### 4. Fetch Task SLAs

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
     -H "x-tenant-id: $TENANT" \
     "http://localhost:3002/grc/itsm/sla/records/CHANGE_TASK/$TASK_ID" | jq .
```

Expected: Array of SLA instances (empty if no SLA applied yet).

### 5. Reapply SLA

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
     -H "x-tenant-id: $TENANT" \
     -H "Content-Type: application/json" \
     "http://localhost:3002/grc/itsm/sla/records/CHANGE_TASK/$TASK_ID/reapply" \
     -d '{ "context": { "priority": "CRITICAL", "status": "OPEN" } }' | jq .
```

## UI Validation Steps

1. Navigate to ITSM > Changes
2. Open the seeded change (CHG-TASK-DEMO-001) or any change with tasks
3. Scroll to "Change Tasks" section
4. Verify the table now has an **SLA** column
5. Each task with a matching SLA should show a chip:
   - **On Track** (info/blue) — active SLA, plenty of time remaining
   - **At Risk** (warning/orange) — active SLA, <=15 min remaining
   - **Breached** (error/red) — SLA breached
   - **Met** (success/green) — SLA completed within target
   - **-** (dash) — no SLA assigned
6. Hover over the SLA chip to see tooltip with objective breakdown
7. Create a new task with CRITICAL priority → SLA should appear after save
8. Update a task's priority from MEDIUM to CRITICAL → SLA should re-evaluate

## Troubleshooting Matrix

| Symptom | Possible Cause | Resolution |
|---------|---------------|------------|
| No SLA shown for any task | No CHANGE_TASK policies seeded | Run `seed-change-task-sla-demo` |
| No SLA shown for specific task | No matching policy for task's context | Check field values against policy conditions |
| SLA shows "-" after create | Event not emitted | Check ChangeTaskService has EventEmitter2 injected |
| Duplicate SLA rows | Idempotency check failed | Check `createV2Instance` dedup logic |
| Stale SLA after update | Re-evaluation not triggered | Verify field is in `CHANGE_TASK_SLA_RELEVANT_FIELDS` |
| Missing parent change fields | Change not found or deleted | Verify changeId references valid change |
| 403 on SLA fetch | Missing ITSM_SLA_READ permission | Grant permission to user role |
| 500 on SLA fetch | Backend error | Check backend logs for stack trace |

## Compatibility Notes

- Existing Incident SLA flow is unchanged
- CHANGE_TASK uses SLA v2 engine exclusively (no v1 legacy path)
- The `TASK` enum value in `SlaRecordType` is preserved for backward compatibility; `CHANGE_TASK` is the new value used for Change Task SLAs
- The `records/:recordType/:recordId` endpoint is generic and works for all record types
- Parent change-derived fields (change.type, change.risk, etc.) are evaluated at SLA apply time and snapshotted
