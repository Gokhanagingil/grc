# ITSM Studio Foundation Runbook

## Overview

The ITSM Studio Foundation provides centralized management of choice fields, priority matrices, business rules, and UI policies for ITSM modules (Incidents, Changes, Services).

## Architecture

### Choice System (`sys_choice`)

All dropdown/select fields in ITSM modules are managed through the `sys_choice` table. This replaces scattered string/enum fields with a centralized, tenant-scoped configuration.

**Table schema:**
- `tenant_id` (uuid, FK) - tenant isolation
- `table_name` (varchar) - target table (e.g., `itsm_incidents`)
- `field_name` (varchar) - target field (e.g., `category`)
- `value` (varchar) - stored value
- `label` (varchar) - display label
- `sort_order` (int) - display ordering
- `is_active` (boolean) - soft enable/disable
- `parent_value` (varchar, nullable) - for dependent dropdowns
- `metadata` (jsonb, nullable) - extensible attributes

**Unique constraint:** `(tenant_id, table_name, field_name, value)`

### Choice-Managed Fields

| Table | Fields |
|-------|--------|
| `itsm_incidents` | category, impact, urgency, status, source, priority |
| `itsm_changes` | type, state, risk |
| `itsm_services` | criticality, status |

### Server-Side Validation

On create/update of any ITSM entity, the `ChoiceService` validates that choice-managed fields contain values that exist in `sys_choice` for the tenant. Invalid values are rejected with error code `INVALID_CHOICE`.

---

## How-To Guides

### How to Add a New Choice Field

1. **Add the field to the entity** (if not already present):
   ```typescript
   // In src/itsm/<module>/<entity>.entity.ts
   @Column({ type: 'varchar', length: 100, nullable: true })
   newField: string;
   ```

2. **Register the field in `CHOICE_MANAGED_FIELDS`**:
   ```typescript
   // In src/itsm/choice/choice.service.ts
   const CHOICE_MANAGED_FIELDS: Record<string, string[]> = {
     itsm_incidents: ['category', 'impact', 'urgency', 'status', 'source', 'priority', 'newField'],
     // ...
   };
   ```

3. **Seed default values** (add to `src/scripts/seed-itsm-choices.ts`):
   ```typescript
   { tableName: 'itsm_incidents', fieldName: 'newField', value: 'option1', label: 'Option 1', sortOrder: 10 },
   { tableName: 'itsm_incidents', fieldName: 'newField', value: 'option2', label: 'Option 2', sortOrder: 20 },
   ```

4. **Run the seed** (idempotent):
   ```bash
   # Development
   npm run seed:itsm-choices:dev

   # Production
   npm run seed:itsm-choices
   ```

5. **Validation is automatic** - the `ChoiceService` will now validate the new field on create/update.

### How to Edit the Priority Matrix

> Note: Priority matrix management is part of PR2 (Admin Studio MVP).

The impact x urgency -> priority matrix is stored in the database and used to auto-calculate incident priority on the backend.

1. Navigate to **Admin > Studio > Incidents > Priority Matrix**
2. Edit the matrix cells to map impact/urgency combinations to priority levels
3. New incidents will use the updated matrix for priority calculation

### How to Add a Business Rule

> Note: Business rules management is part of PR4 (Workflow + Business Rules).

1. Navigate to **Admin > Studio > [Table] > Business Rules**
2. Click **New Rule**
3. Configure:
   - **When**: BEFORE or AFTER insert/update
   - **Condition**: Use the condition builder (AND/OR)
   - **Actions**: set_field, add_work_note, reject(with message)
4. Save and test with a sample record

---

## API Endpoints

### Choice Management

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/grc/itsm/choices?table=X&field=Y` | ITSM_CHOICE_READ | List choices |
| GET | `/grc/itsm/choices/tables` | ITSM_CHOICE_READ | Get managed tables/fields |
| GET | `/grc/itsm/choices/:id` | ITSM_CHOICE_READ | Get single choice |
| POST | `/grc/itsm/choices` | ITSM_CHOICE_WRITE | Create choice |
| PATCH | `/grc/itsm/choices/:id` | ITSM_CHOICE_WRITE | Update choice |
| DELETE | `/grc/itsm/choices/:id` | ITSM_CHOICE_WRITE | Deactivate choice |

### Validation Error Response

When a choice-managed field contains an invalid value:

```json
{
  "statusCode": 400,
  "message": "Invalid choice values: category='invalid_value' is not a valid choice for itsm_incidents.category",
  "error": "Bad Request"
}
```

---

## Seed Scripts

### ITSM Choices Seed

Seeds ITIL-aligned default choices for the demo tenant.

```bash
# Development (ts-node)
npm run seed:itsm-choices:dev

# Production (compiled JS)
npm run seed:itsm-choices
```

The seed is **idempotent**: running it multiple times will not create duplicates. It checks for existing records by `(tenant_id, table_name, field_name, value)` before inserting.

---

## ITSM Studio Entity Management

### How to Create and Verify a UI Policy

1. Navigate to **Admin > ITSM Studio > UI Policies**
2. Click **Create Policy**
3. Fill in:
   - **Name**: descriptive name (e.g., "Hide priority for low-impact incidents")
   - **Table**: target table (e.g., `itsm_incidents`)
   - **Field Effects**: add one or more field effects (field, visible, mandatory, readOnly)
4. Click **Save**
5. **Verify**: the new policy should appear in the list immediately

### How to Create and Verify a UI Action

1. Navigate to **Admin > ITSM Studio > UI Actions**
2. Click **Create Action**
3. Fill in:
   - **Name**: internal name (e.g., "escalate_to_manager")
   - **Label**: button label (e.g., "Escalate to Manager")
   - **Table**: target table (e.g., `itsm_incidents`)
   - **Style**: button style (primary, secondary, danger, etc.)
4. Click **Save**
5. **Verify**: the new action should appear in the list immediately

### How to Create and Verify an SLA Definition

1. Navigate to **Admin > ITSM Studio > SLA**
2. Click **Create SLA**
3. Fill in:
   - **Name**: SLA name (e.g., "P1 Resolution Time")
   - **Metric**: `RESOLUTION_TIME` or `RESPONSE_TIME`
   - **Target**: duration in seconds (e.g., 14400 = 4 hours)
   - **Schedule**: `24X7` or `BUSINESS_HOURS`
4. Click **Save**
5. **Verify**: the new SLA should appear in the list immediately

### Staging Verification

```bash
# Verify UI Policies endpoint
wget -qO- --header='Authorization: Bearer <TOKEN>' \
  --header='x-tenant-id: 00000000-0000-0000-0000-000000000001' \
  http://localhost:3002/grc/itsm/ui-policies

# Verify UI Actions endpoint
wget -qO- --header='Authorization: Bearer <TOKEN>' \
  --header='x-tenant-id: 00000000-0000-0000-0000-000000000001' \
  http://localhost:3002/grc/itsm/ui-policies/actions

# Verify SLA Definitions endpoint (returns paginated response)
wget -qO- --header='Authorization: Bearer <TOKEN>' \
  --header='x-tenant-id: 00000000-0000-0000-0000-000000000001' \
  http://localhost:3002/grc/itsm/sla/definitions
```

### Troubleshooting

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| SLA list shows empty despite saved items | Response envelope not parsed correctly; SLA returns paginated `{items, total, ...}` wrapped in `{success, data}` | Use `unwrapArrayResponse()` helper which handles both raw arrays and paginated envelopes |
| UI Policy/Action list empty | Response parsing falls through to empty array | Use `unwrapArrayResponse()` helper for consistent parsing |
| 403 on create/list | Missing RBAC permission for user role | Check user role has ITSM_UI_POLICY_WRITE / ITSM_SLA_WRITE permissions |
| 400 on create | DTO validation failure | Check required fields: name (max 100), tableName, fieldEffects (array) for policies; name, label, tableName for actions; name, targetSeconds (min 60) for SLA |

---

## Rollback Notes

### Reverting the Choice System

1. Remove `ChoiceService` injection from ITSM services (incident, change, service)
2. Remove `ChoiceController` and `ChoiceService` from `itsm.module.ts`
3. Drop the `sys_choice` table via a down migration
4. Remove `ITSM_CHOICE_READ/WRITE` from permission enum and role mappings
