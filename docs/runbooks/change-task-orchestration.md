# Change Task Orchestration — Runbook

## Overview

Change Task Orchestration enables structured task workflows within ITSM Change records.
Tasks can have dependencies (serial/parallel), readiness tracking, and can be generated
from reusable templates.

**Introduced in:** PR #474 (Change Task Orchestration & Templates)
**Hardened in:** Change Task Reliability Pack (this PR)

---

## 1. Migration Steps

No new migrations required for the reliability pack. The schema was established in PR #474.

Verify existing migrations are applied:

```bash
# Staging (inside container)
docker compose -f docker-compose.staging.yml exec -T backend \
  sh -lc 'npx typeorm migration:show -d dist/data-source.js'

# Dev
npx ts-node -r tsconfig-paths/register node_modules/typeorm/cli.js migration:show -d src/data-source.ts
```

Tables used:
- `itsm_change_tasks` — task records
- `itsm_change_task_dependencies` — dependency edges
- `itsm_change_templates` — template headers
- `itsm_change_template_tasks` — template task definitions
- `itsm_change_template_dependencies` — template dependency definitions

---

## 2. Seed Commands

### Change Task Demo Seed

Creates a deterministic demo dataset with:
- 1 template ("Standard Deployment Pack") with 7 tasks and 6 dependencies
- 1 change ("Database Platform Upgrade v15.4") with applied template
- Tasks in mixed states (2 COMPLETED, 1 IN_PROGRESS, 4 OPEN)
- Demonstrates readiness calculation and dependency graph

```bash
# Dev
npx ts-node -r tsconfig-paths/register src/scripts/seed-change-task-demo.ts

# Staging/Production
node dist/scripts/seed-change-task-demo.js
```

**Idempotency:** Safe to run multiple times. Uses deterministic UUIDs (prefix `eeee`).
Second run logs `REUSED` for all records with zero duplicates.

---

## 3. API Validation Examples

All examples use the demo tenant ID. Replace `$TOKEN` with a valid JWT.

### 3.1 List Tasks for a Change

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
     -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
     "http://localhost:3002/grc/itsm/changes/eeee0400-0000-0000-0000-000000000001/tasks" | jq .
```

Expected: paginated response with 7 tasks, each with `readiness` object.

### 3.2 Get Task Summary

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
     -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
     "http://localhost:3002/grc/itsm/changes/eeee0400-0000-0000-0000-000000000001/tasks/summary" | jq .
```

Expected: `{ total: 7, completed: 2, inProgress: 1, open: 4, ready: 2, blocked: 3 }`

### 3.3 List Dependencies

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
     -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
     "http://localhost:3002/grc/itsm/changes/eeee0400-0000-0000-0000-000000000001/tasks/dependencies" | jq .
```

Expected: 6 dependency records.

### 3.4 List Templates

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
     -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
     "http://localhost:3002/grc/itsm/change-templates" | jq .
```

### 3.5 Apply Template to a Change

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
     -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
     -H "Content-Type: application/json" \
     -d '{"templateId":"eeee0100-0000-0000-0000-000000000001","changeId":"<CHANGE_ID>"}' \
     "http://localhost:3002/grc/itsm/change-templates/apply" | jq .
```

Expected: `{ tasksCreated: 7, dependenciesCreated: 6, skipped: [], conflicts: [] }`

### 3.6 Attempt Invalid Status Transition

```bash
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" \
     -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
     -H "Content-Type: application/json" \
     -d '{"status":"COMPLETED"}' \
     "http://localhost:3002/grc/itsm/changes/eeee0400-0000-0000-0000-000000000001/tasks/eeee0500-0000-0000-0000-000000000004" | jq .
```

Expected: 400 Bad Request — "Invalid status transition from OPEN to COMPLETED"

### 3.7 Attempt to Start Blocked Task

```bash
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" \
     -H "x-tenant-id: 00000000-0000-0000-0000-000000000001" \
     -H "Content-Type: application/json" \
     -d '{"status":"IN_PROGRESS"}' \
     "http://localhost:3002/grc/itsm/changes/eeee0400-0000-0000-0000-000000000001/tasks/eeee0500-0000-0000-0000-000000000004" | jq .
```

Expected: 409 Conflict — task is blocked by incomplete predecessors.

---

## 4. UI Validation Checklist

### Change Detail Page

- [ ] Navigate to change detail for `CHG-TASK-DEMO-001`
- [ ] "Change Tasks" section is visible and expanded
- [ ] Progress bar shows correct completion percentage (2/7 = 28%)
- [ ] "2 ready" and "3 blocked" chips visible in header
- [ ] Task table displays all 7 tasks with correct statuses
- [ ] Readiness indicators: green "Ready" for implement_1 and backout_prep
- [ ] Readiness indicators: orange "Blocked(N)" for implement_2, validate_1, validate_2
- [ ] "Blocking" chip visible on blocking tasks
- [ ] "Auto" chip visible on all tasks (auto-generated from template)
- [ ] Stage labels (Pre-Flight, Execute, Validate, Backout) displayed correctly

### Task Actions

- [ ] Click "Add Task" opens create form
- [ ] Submit create form creates new task (appears in list after refresh)
- [ ] Click edit icon opens edit form with pre-populated fields
- [ ] Status transition via quick action works for valid transitions
- [ ] Invalid status transition shows error notification
- [ ] Blocked task start attempt shows conflict error

### Template Application

- [ ] Click "Apply Template" opens template dialog
- [ ] Template list loads with "Standard Deployment Pack"
- [ ] Selecting and applying shows result summary
- [ ] Duplicate apply shows conflict error (already applied)

### Linked Risks/Controls (Stabilization)

- [ ] Change detail does NOT show "Linked risks could not be loaded" error
- [ ] Change detail does NOT show "Linked controls could not be loaded" error
- [ ] Empty linked sections show friendly empty state (not error)
- [ ] No "Something went wrong" crash boundary triggered

### Backward Compatibility

- [ ] Changes without tasks still load and display correctly
- [ ] Change detail renders all sections without regression
- [ ] Create/edit change forms work normally

---

## 5. Troubleshooting Guide

### 5.1 Dependency Cycle Validation Error

**Symptom:** 400 Bad Request with "cycle detected" message when adding dependency.

**Cause:** The dependency graph would form a cycle (A -> B -> C -> A).

**Resolution:** Review the dependency graph. Remove one edge to break the cycle.
Use the dependencies list endpoint to visualize the current graph.

### 5.2 Blocked Task Not Ready

**Symptom:** Task shows "Blocked" but you expect it to be ready.

**Check:**
1. List dependencies for the task (check predecessorTaskId)
2. Verify all predecessor tasks are in COMPLETED or SKIPPED status
3. All blocking predecessors must be done for the task to become ready

### 5.3 Invalid Status Transition

**Symptom:** 400 Bad Request when updating task status.

**Valid transitions:**
| From | Allowed To |
|------|-----------|
| DRAFT | OPEN, CANCELLED |
| OPEN | IN_PROGRESS, SKIPPED, CANCELLED |
| IN_PROGRESS | COMPLETED, FAILED, PENDING, CANCELLED |
| PENDING | IN_PROGRESS, CANCELLED |
| COMPLETED | (terminal) |
| FAILED | OPEN, CANCELLED |
| SKIPPED | (terminal) |
| CANCELLED | (terminal) |

### 5.4 Duplicate Template Apply

**Symptom:** 409 Conflict when applying template.

**Cause:** Template was already applied to this change.

**Resolution:**
- Use `force=true` in the apply request to skip existing tasks
- Or create a new change and apply the template there

### 5.5 Linked Risks/Controls Load Errors

**Root Cause (identified in this PR):** Backend ChangeController was missing
`/grc/itsm/changes/:id/risks` and `/grc/itsm/changes/:id/controls` endpoints.
The frontend was correctly calling these URLs but receiving 404s.

**Classification:**
| Error | Meaning | Action |
|-------|---------|--------|
| Empty list | No linked items | Normal state, no action needed |
| 401 | Session expired | Re-login |
| 403 | Insufficient permissions | Check RBAC roles |
| 404 | Endpoint not configured | Check backend deployment |
| 5xx | Server error | Check backend logs |
| Network Error | Connection issue | Check connectivity |

---

## 6. Rollback / Compatibility Notes

- **No breaking changes:** All new endpoints are additive
- **Backward compatible:** Changes without tasks continue to work
- **Template data is separate:** Template records don't affect existing changes
- **Soft deletes:** All delete operations are soft deletes (isDeleted flag)
- **Seed data:** Uses unique UUID prefix (`eeee`) to avoid collision

---

## 7. Known Deferred Items

These are explicitly out of scope for this release:

1. **Standard Change Catalog** — Pre-approved change types with automatic template application
2. **Task-Level SLA Execution Engine** — Automated SLA monitoring and escalation per task
3. **CAB/Approval Workflow Redesign** — Multi-stage approval gates within task orchestration
4. **Gantt/Timeline Visualization** — Visual dependency graph and timeline view
5. **Advanced Scheduling** — Automatic scheduling based on dependency graph and resource availability
6. **Cross-Change Dependencies** — Dependencies between tasks in different change records
7. **Task Assignment Rules** — Automatic assignment based on task type and team capacity
