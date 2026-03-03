# Staging Hardening — Post-PR #550 Evidence

**Date**: 2026-03-03
**Scope**: Features broken after merging PR #550 (Notification v1.2 — Actionable Workflows)

---

## Evidence Table

| # | Feature | Status | Root Cause | Fix |
|---|---------|--------|------------|-----|
| 1 | Notification: Assign to Me | BROKEN | Controller `executeAction` looks up action by numeric index in `notification.actions[]`. Frontend `handleSuggestedStep` sends an out-of-bounds index when the action type isn't in the notification's persisted `actions` array. `deliverInApp` only populates `OPEN_RECORD`; never includes `ASSIGN_TO_ME`, `SET_DUE_DATE`, or `CREATE_FOLLOWUP_TODO`. | **Backend**: Controller falls back to `actionType` from request body when index lookup fails. **Backend**: `deliverInApp` now populates a full action suggestion pack when `entityType` is present. |
| 2 | Notification: Follow-up | BROKEN | Same root cause as #1 — `CREATE_FOLLOWUP_TODO` action not in persisted `actions[]`, index out of bounds. | Same fix as #1. |
| 3 | Notification: Deep link | BROKEN | `handleOpenRecord` works correctly but notifications created via `deliverInApp` have `type: 'GENERAL'`. The frontend `suggestedStepsByType` only defines steps for `ASSIGNMENT`, `DUE_DATE`, `STATUS_CHANGE`, and `PERSONAL_REMINDER` — not `GENERAL`. So no "Open Record" suggested step renders for GENERAL notifications. | **Frontend**: Added `GENERAL` to `suggestedStepsByType` with Open Record, Assign to Me, and Create Follow-up steps. Note: `deliverInApp` still sets `type: 'GENERAL'`; the frontend now handles this type correctly. |
| 4 | Groups: Menu entry missing | BROKEN | `sharedMenuGroups` in `Layout.tsx` has no "Groups" item under Administration. Route `/groups` exists in `App.tsx` but is unreachable via sidebar navigation. | **Frontend**: Added `{ text: 'Groups', icon: <GroupsIcon />, path: '/groups', roles: ['admin'] }` to the Administration section in `sharedMenuGroups`. |
| 5 | Groups: Admin self-add | BROKEN | Primary issue is #4 — admin can't navigate to `/groups`. Secondary: the addMember endpoint and user search work correctly once the page is reachable. | Fixed by #4 (navigation). Backend addMember endpoint verified correct. |
| 6 | Groups: Assignment dropdown in To-Do | FUNCTIONAL | The `/grc/groups/directory` endpoint is functional. `PermissionsGuard` allows access when no `@Permissions()` decorator is present (returns true at line 61). Response shape (`items[]`, `total`, `page`, `pageSize`, `totalPages`) matches frontend expectations. TodoWorkspace already handles both enveloped and bare responses at lines 970-972. If dropdown appears empty, root cause is no groups exist in tenant yet. | No code change needed. Create groups first via the now-accessible /groups page (fix #4). |
| 7 | Reminders: Personal save | BROKEN | `createPersonalReminder` sets status to `PENDING_REMINDER` when `remindAt` is in the future. `getUserNotifications` filters by `status = 'ACTIVE'` only (line 551). Newly created reminders are invisible — user thinks save failed. | **Backend**: `getUserNotifications` now supports `reminders` tab that includes both `ACTIVE` and `PENDING_REMINDER` personal reminders. **Frontend**: Added Reminders tab, auto-switches to it after creating a reminder, shows "Pending" chip with fire date. |

---

## Endpoints Verified

| Endpoint | Method | Controller | Status |
|----------|--------|------------|--------|
| `/grc/user-notifications` | GET | UserNotificationController | OK (routing correct) |
| `/grc/user-notifications/reminders` | POST | UserNotificationController | OK (routing correct, save logic fixed) |
| `/grc/user-notifications/:id/actions/:actionId/execute` | POST | UserNotificationController | FIXED (actionType fallback) |
| `/grc/groups/directory` | GET | GroupsController | OK (routing correct) |
| `/grc/groups/:id/members` | POST | GroupsController | OK (routing correct, RBAC correct) |
| `/todos/:taskId` | GET | TodoController | OK (deep link fetch) |

## Deploy Notes

- **No migrations required** — all changes are code-level (controller logic, service query, DTO, frontend components).
- **No new env vars** — existing configuration is sufficient.
- Rebuild and deploy both `backend` and `frontend` containers.
