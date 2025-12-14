# Audit Phase 2 Frontend Validation Checklist

This document provides a manual validation checklist for the Audit Phase 2 (Standards Library + Audit Scope) features in the frontend.

## Prerequisites

1. **Database Setup:**
   - Run migrations: `cd backend-nest && npm run migration:run`
   - Seed standards: `cd backend-nest && npm run seed:standards`
   - Ensure demo tenant and admin user exist (run `npm run seed:grc` if needed)

2. **Application Running:**
   - Backend: `cd backend-nest && npm run start:dev`
   - Frontend: `cd frontend && npm run dev`
   - Login as admin user: `admin@grc-platform.local` / `TestPassword123!`

## Validation Checklist

### 1. Audit Detail Shows Standards Library Tab

**Steps:**
1. Navigate to `/audits`
2. Click on an existing audit or create a new one
3. Look for a "Standards Library" or "Scope" tab in the audit detail view

**Expected Result:**
- Tab is visible and accessible
- Tab shows standards/clauses included in audit scope
- Can add/remove standards from scope

**Status:** ⬜ Pass / ⬜ Fail / ⬜ N/A

**Notes:**
```
[Add any observations or issues here]
```

---

### 2. Standards List Loads

**Steps:**
1. Navigate to `/standards`
2. Wait for the standards list to load

**Expected Result:**
- Standards list displays without errors
- Shows at least one standard (ISO/IEC 27001:2022 if seeded)
- Can see standard code, name, version, domain
- Pagination works if there are many standards
- Filters work (if implemented)

**Status:** ⬜ Pass / ⬜ Fail / ⬜ N/A

**Notes:**
```
[Add any observations or issues here]
```

---

### 3. Clause Tree Expands

**Steps:**
1. Navigate to `/standards`
2. Click on a standard (e.g., ISO/IEC 27001:2022)
3. Look for clause tree/hierarchy view
4. Try expanding parent clauses to see child clauses

**Expected Result:**
- Clause tree displays hierarchical structure
- Parent clauses (e.g., A.5) can be expanded
- Child clauses (e.g., A.5.1, A.5.1.1) are visible when expanded
- Hierarchy levels are visually distinct
- Can navigate through the tree

**Status:** ⬜ Pass / ⬜ Fail / ⬜ N/A

**Notes:**
```
[Add any observations or issues here]
```

---

### 4. Create Finding Navigation Works

**Steps:**
1. Navigate to `/standards`
2. Click on a standard to view details
3. Look for "Create Finding" button (should be in the header or clause details panel)
4. Click the "Create Finding" button
5. Verify navigation to finding create page

**Expected Result:**
- "Create Finding" button is visible and clickable
- Clicking button navigates to `/findings/new` (or finding create page)
- Finding form is pre-filled with context:
  - Standard ID/code
  - Clause ID/code (if viewing clause details)
  - Clause title
  - Audit ID (if coming from audit context)
- Can create finding and it gets linked to the clause

**Status:** ⬜ Pass / ⬜ Fail / ⬜ N/A

**Notes:**
```
[Add any observations or issues here]
```

---

### 5. Finding is Linked to Clause

**Steps:**
1. Create a finding from a clause (using "Create Finding" button)
2. Save the finding
3. Navigate back to the clause/standard detail page
4. Check the "Findings" tab or mappings section

**Expected Result:**
- Finding appears in the clause's findings list
- Finding shows correct details (title, severity, status)
- Can click on finding to view details
- Link is persisted after page refresh

**Status:** ⬜ Pass / ⬜ Fail / ⬜ N/A

**Notes:**
```
[Add any observations or issues here]
```

---

## API Endpoint Validation

### GET /grc/standards

**Test:**
```bash
curl -X GET http://localhost:3002/grc/standards \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: <tenant-id>"
```

**Expected:**
- Returns 200 OK
- Response format: `{ success: true, data: [...], meta: {...} }`
- Data contains array of standards

**Status:** ⬜ Pass / ⬜ Fail

---

### POST /grc/standards

**Test:**
```bash
curl -X POST http://localhost:3002/grc/standards \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: <tenant-id>" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "TEST-STD",
    "name": "Test Standard",
    "version": "1.0",
    "domain": "security"
  }'
```

**Expected:**
- Returns 201 Created (or 200 OK)
- Response format: `{ success: true, data: {...} }`
- Standard is created and can be retrieved

**Status:** ⬜ Pass / ⬜ Fail

---

### GET /grc/audits/:id/scope

**Test:**
```bash
curl -X GET http://localhost:3002/grc/audits/<audit-id>/scope \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: <tenant-id>"
```

**Expected:**
- Returns 200 OK
- Response format: `{ success: true, data: {...} }`
- Data contains standards and clauses in scope

**Status:** ⬜ Pass / ⬜ Fail

---

### POST /grc/issues/:issueId/clauses

**Test:**
```bash
curl -X POST http://localhost:3002/grc/issues/<issue-id>/clauses \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: <tenant-id>" \
  -H "Content-Type: application/json" \
  -d '{
    "clauseId": "<clause-id>",
    "notes": "Optional notes"
  }'
```

**Expected:**
- Returns 201 Created
- Response format: `{ success: true, data: {...} }`
- Issue is linked to clause

**Status:** ⬜ Pass / ⬜ Fail

---

## Common Issues and Troubleshooting

### Issue: Standards list is empty

**Possible Causes:**
- Migrations not run
- Seed script not executed
- Wrong tenant ID

**Solution:**
1. Check migrations: `npm run migration:show`
2. Run seed: `npm run seed:standards`
3. Verify tenant ID in request headers

---

### Issue: "Create Finding" button not visible

**Possible Causes:**
- Button not implemented in component
- User lacks permissions
- Component not updated

**Solution:**
1. Check `StandardDetail.tsx` for button
2. Verify user has `GRC_AUDIT_WRITE` permission
3. Check browser console for errors

---

### Issue: Finding not linked to clause

**Possible Causes:**
- Backend endpoint not called
- API error
- Database constraint violation

**Solution:**
1. Check browser network tab for API calls
2. Verify backend endpoint is registered
3. Check backend logs for errors
4. Verify clause and issue IDs are valid

---

## Test Data

After running seed scripts, you should have:

- **Standard:** ISO/IEC 27001:2022
- **Clauses:** ~15 sample clauses with hierarchy:
  - A.5 (Information security policies)
    - A.5.1 (Management direction)
      - A.5.1.1, A.5.1.2
  - A.6 (Organization of information security)
    - A.6.1 (Internal organization)
      - A.6.1.1, A.6.1.2, A.6.1.3
  - A.9 (Access control)
    - A.9.2 (User access management)
      - A.9.2.3, A.9.2.4
  - A.12 (Operations security)
    - A.12.3 (Backup)
      - A.12.3.1

---

## Sign-off

**Validated By:** _________________  
**Date:** _________________  
**Environment:** ⬜ Local / ⬜ Staging / ⬜ Production  
**Browser:** _________________  
**Overall Status:** ⬜ Pass / ⬜ Fail / ⬜ Partial

**Summary:**
```
[Add summary of validation results]
```
