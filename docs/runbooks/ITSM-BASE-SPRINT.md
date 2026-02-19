# ITSM Base Sprint Runbook

This runbook covers the full ITSM foundation delivered across PRs #374-#377.

## PRs Summary

| PR | Phase | Description |
|----|-------|-------------|
| #374 | A (P0) | Stabilize ITSM CRUD UX - fix frontend enum case mismatch |
| #375 | B (P1) | Choice Admin UI + dynamic choices for ITSM forms |
| #376 | C (P2) | ITSM Studio v1 - 6 admin screens (Tables, Business Rules, UI Policies, UI Actions, Workflows, SLA) |
| #377 | D (P3) | ITIL baseline seed - default workflows, business rules, SLAs, UI policies, UI actions |

---

## Staging Verification

### 1. Deploy to staging

```bash
ssh staging-server
cd /opt/grc-platform
git pull origin main
docker compose -f docker-compose.staging.yml up -d --build backend frontend
```

### 2. Run migrations

```bash
docker compose -f docker-compose.staging.yml exec -T backend sh -lc \
  'npx typeorm migration:run -d dist/data-source.js'
```

### 3. Health checks

```bash
# From staging server
wget -qO- http://localhost:3002/health/live
wget -qO- http://localhost:3002/health/db
wget -qO- http://localhost:3002/health/auth
```

---

## Seed Commands

### ITSM Choices (sys_choice data)

```bash
# Production (inside container)
docker compose -f docker-compose.staging.yml exec -T backend sh -lc \
  'node dist/scripts/seed-itsm-choices.js'

# Development (local)
cd backend-nest && npm run seed:itsm-choices:dev
```

### ITSM Baseline (workflows, rules, SLAs, policies, actions)

```bash
# Production (inside container)
docker compose -f docker-compose.staging.yml exec -T backend sh -lc \
  'node dist/scripts/seed-itsm-baseline.js'

# Development (local)
cd backend-nest && npm run seed:itsm-baseline:dev
```

Both seed scripts are **idempotent** - safe to run multiple times without creating duplicates.

---

## Troubleshooting

### 401 Unauthorized

- Verify JWT token is present in `Authorization: Bearer <token>` header
- Check token has not expired
- Ensure `x-tenant-id` header is set (e.g., `00000000-0000-0000-0000-000000000001`)
- Verify user has required ITSM permissions for the endpoint

### 403 Forbidden

- User lacks the required role/permission for the action
- Check RBAC: admin gets all permissions; manager/user are scoped
- UI Actions have `requiredRoles` - verify user's role matches

### Cloudflare Challenge

- If staging returns Cloudflare challenge page, verify the request includes proper headers
- Check that the staging domain DNS is properly configured
- Use direct IP (`http://46.224.99.150`) to bypass Cloudflare for debugging

### Seed script fails with MODULE_NOT_FOUND

- Production containers only have `dist/` - ensure you use `node dist/scripts/seed-itsm-baseline.js`
- Never use `ts-node` or `src/` paths in production containers
- Run `npm run build` first if dist is stale

### Seed reports "0 created, N skipped"

- This is normal on re-run - records already exist
- Seed checks by `tenantId + name` uniqueness
- To re-seed, delete existing records first (not recommended for production)

---

## How to Extend

### Adding new choices

1. Navigate to **Admin > ITSM Studio > Choices**
2. Select table and field
3. Click **Create** - set value (stored), label (displayed), sort order
4. New choice immediately available in ITSM forms

Or add to `seed-itsm-choices.ts` for deployment-time seeding.

### Adding new business rules

1. Navigate to **Admin > ITSM Studio > Business Rules**
2. Click **Create**
3. Set table, trigger (BEFORE_INSERT/UPDATE, AFTER_INSERT/UPDATE)
4. Add conditions (field, operator, value)
5. Add actions (set_field, reject, add_work_note)
6. Save - rule is immediately active

### Adding new workflow states/transitions

1. Navigate to **Admin > ITSM Studio > Workflows**
2. Select the workflow to edit
3. Add states (name, label, isInitial, isFinal)
4. Add transitions (name, label, from, to, requiredRoles)
5. Save - new transitions appear as UI Actions if configured

### Adding new UI policies

1. Navigate to **Admin > ITSM Studio > UI Policies**
2. Click **Create**
3. Set table and conditions (e.g., state = 'RESOLVED')
4. Add field effects (visible, mandatory, readOnly)
5. Save - policy applies immediately on matching records

### Adding new SLA definitions

1. Navigate to **Admin > ITSM Studio > SLA**
2. Click **Create**
3. Set metric (Response Time / Resolution Time)
4. Set target in seconds, schedule (24x7 / Business Hours)
5. Set priority filter and stop/pause states
6. Save - SLA tracking begins for matching records

---

## Baseline Data Reference

### Incident Workflow

```
NEW --> IN_PROGRESS --> RESOLVED --> CLOSED
         ^               |
         |               |
         +--- (reopen) --+
```

- **NEW -> IN_PROGRESS**: admin, manager, user
- **IN_PROGRESS -> RESOLVED**: admin, manager, user (sets resolvedAt)
- **RESOLVED -> IN_PROGRESS**: admin, manager, user (reopen)
- **RESOLVED -> CLOSED**: admin, manager (sets closedAt)

### Change Workflow

```
DRAFT --> ASSESS --> AUTHORIZE --> IMPLEMENT --> REVIEW --> CLOSED
  ^         |           |                         |
  |         |           |                         |
  +---------+           +--- (reject) ---+        +--- (revert) ---> IMPLEMENT
  (return)                               |
                                         v
                                       DRAFT
```

- Emergency changes: skip AUTHORIZE (auto-approve)
- Authorization sets approvalStatus to REQUESTED/APPROVED/REJECTED

### Service Workflow

```
ACTIVE <--> INACTIVE --> DEPRECATED
   |                         ^
   +-------------------------+
```

### Priority Matrix (Impact x Urgency)

| Impact \ Urgency | HIGH | MEDIUM | LOW |
|-------------------|------|--------|-----|
| **HIGH**          | P1   | P2     | P3  |
| **MEDIUM**        | P2   | P3     | P4  |
| **LOW**           | P3   | P4     | P5  |

### SLA Targets

| Priority | Response Time | Resolution Time | Schedule |
|----------|--------------|-----------------|----------|
| P1       | 15 min       | 4 hours         | 24x7     |
| P2       | 1 hour       | 8 hours         | 24x7     |
| P3       | 4 hours      | 24 hours        | Business |
| P4       | 8 hours      | 72 hours        | Business |
| P5       | 24 hours     | 1 week          | Business |

---

## Acceptance Checklist (20 items)

A non-developer can follow these steps in the UI to verify the ITSM foundation.

### Authentication & Navigation

- [ ] **1.** Log in with admin credentials at https://niles-grc.com
- [ ] **2.** Switch to ITSM module using the module switcher (no "coming soon" badge)
- [ ] **3.** Verify left sidebar shows: Incidents, Changes, Services, and ITSM Studio section

### Incident CRUD

- [ ] **4.** Open Incidents list - loads without errors or infinite spinner
- [ ] **5.** Create a new Incident: fill short description, set impact=HIGH, urgency=HIGH - save succeeds (201)
- [ ] **6.** Verify the new incident appears in the list with priority P1 (auto-calculated)
- [ ] **7.** Open the incident detail - all fields render correctly

### Change CRUD

- [ ] **8.** Open Changes list - loads without errors
- [ ] **9.** Create a new Change: fill title, set type=NORMAL, state=DRAFT - save succeeds
- [ ] **10.** Open the change detail - verify DRAFT state hides implementation/backout plan fields

### Service CRUD

- [ ] **11.** Open Services list - loads without errors
- [ ] **12.** Create a new Service: fill name, set criticality=HIGH, status=ACTIVE - save succeeds

### ITSM Studio - Admin Configuration

- [ ] **13.** Navigate to ITSM Studio > Tables - verify 9 ITSM tables listed with field names
- [ ] **14.** Navigate to ITSM Studio > Choices - verify choices load for itsm_incidents fields (category, impact, urgency, priority, status)
- [ ] **15.** Navigate to ITSM Studio > Workflows - verify 3 workflows exist (Incident Lifecycle, Change Lifecycle, Service Lifecycle)
- [ ] **16.** Navigate to ITSM Studio > Business Rules - verify 15 rules exist (9 priority matrix + 2 create-time + 4 change rules)
- [ ] **17.** Navigate to ITSM Studio > SLA - verify 12 SLA definitions exist (5 response + 5 resolution + 2 change)
- [ ] **18.** Navigate to ITSM Studio > UI Policies - verify 10 policies exist (4 incident + 6 change)
- [ ] **19.** Navigate to ITSM Studio > UI Actions - verify 14 actions exist (4 incident + 7 change + 3 service)

### Tenant Isolation

- [ ] **20.** All data above is scoped to the demo tenant - no cross-tenant data leakage visible
