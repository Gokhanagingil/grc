# Audit Phase 2 UI Validation Guide

This document describes the new features added in Audit Phase 2 for standards-based audit scope management, clause navigation, and finding linkage.

## New Routes and Components

### Frontend Components

**New Components:**
- `ClauseTree.tsx` - Hierarchical tree view for displaying standard clauses with expand/collapse functionality
- `StandardsScopeTab.tsx` - Tab component for managing standards in audit scope with clause navigation

**Modified Components:**
- `AuditDetail.tsx` - Added new "Standards Library" tab (index 1) for Phase 2 standards-based scope management

### Backend Endpoints (NestJS)

**Standards Library Endpoints:**
- `GET /grc/standards` - List all active standards for tenant
- `POST /grc/standards` - Create a new standard
- `GET /grc/standards/:id` - Get a single standard
- `GET /grc/standards/:id/with-clauses` - Get standard with full clause tree
- `PATCH /grc/standards/:id` - Update a standard
- `DELETE /grc/standards/:id` - Soft delete a standard
- `GET /grc/standards/summary` - Get standards statistics
- `GET /grc/standards/:id/clauses` - Get clauses flat list
- `GET /grc/standards/:id/clauses/tree` - Get clauses as hierarchical tree
- `POST /grc/standards/:id/clauses` - Create a clause
- `GET /grc/standards/clauses/:clauseId` - Get a single clause
- `PATCH /grc/standards/clauses/:clauseId` - Update a clause

**Audit Scope Endpoints:**
- `GET /grc/audits/:auditId/scope` - Get audit scope (standards and clauses)
- `POST /grc/audits/:auditId/scope` - Set audit scope (select standards)
- `POST /grc/audits/:auditId/scope/lock` - Lock audit scope
- `GET /grc/audits/:auditId/clauses/:clauseId/findings` - Get findings linked to clause
- `POST /grc/audits/:auditId/clauses/:clauseId/findings` - Link finding to clause
- `DELETE /grc/audits/:auditId/clauses/:clauseId/findings/:issueId` - Unlink finding from clause

## New Database Entities

- `Standard` - Compliance/regulatory standards (ISO 27001, SOC2, COBIT, NIST CSF, etc.)
- `StandardClause` - Hierarchical clauses/controls within standards
- `AuditScopeStandard` - Links audits to standards with scope type (full/partial) and locking
- `AuditScopeClause` - Links audits to specific clauses for partial scope
- `GrcIssueClause` - Links findings/issues to clauses for traceability

## Manual Validation Steps

### Prerequisites
1. Start the backend: `cd backend-nest && npm run start:dev`
2. Start the frontend: `cd frontend && npm start`
3. Log in as an admin user

### Test Scenarios

**1. View Standards Library Tab in Audit Detail**
- Navigate to an existing audit detail page (`/audits/:id`)
- Verify the new "Standards Library" tab appears between "Scope & Standards" and "Findings & CAPA"
- Click on the "Standards Library" tab

**2. Add Standards to Audit Scope**
- In the Standards Library tab, click "Manage Standards" button
- Select one or more standards from the list
- Click "Save Scope"
- Verify the selected standards appear in the left panel

**3. Navigate Clause Tree**
- Click on a standard in the left panel
- Verify the clause tree loads in the middle panel
- Expand/collapse clause nodes
- Click on a clause to view its details in the right panel

**4. Scope Locking**
- With standards in scope, click "Lock Scope"
- Verify the "Scope Locked" chip appears
- Verify the "Manage Standards" button is disabled
- Verify scope cannot be modified when audit status is "in_progress" or beyond

**5. Clause Details**
- Select a clause from the tree
- Verify code, title, description, and properties are displayed
- Verify "Create Finding for this Clause" button appears for auditable clauses

## What's Intentionally Deferred

- **CAPA Deep Workflow**: Full CAPA management integration with clauses
- **Clause-level Status Tracking**: Individual clause audit status (not_started, in_progress, completed)
- **Evidence Attachment**: Attaching evidence to clause assessments
- **Bulk Clause Selection**: Selecting multiple clauses at once for partial scope
- **Standards Import**: Importing standards from external sources (CSV, API)
- **Clause Search/Filter**: Searching and filtering within clause tree

## API Client Integration

The frontend uses the following new API objects in `grcClient.ts`:
- `standardsLibraryApi` - Methods for standards and clause management
- `auditScopeApi` - Methods for audit scope management and finding linkage

All API calls automatically include tenant headers and authentication via the existing `api` interceptors.
