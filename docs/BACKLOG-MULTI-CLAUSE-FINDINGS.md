# Backlog: Multi-Clause Finding Support

## Overview

This document outlines the intended design for supporting Findings linked to multiple clauses (many-to-many relationship).

## Current State

Currently, a Finding (GrcIssue) can be linked to multiple clauses through the `grc_issue_clauses` join table. The relationship is already many-to-many:

- `grc_issue_clauses` table has:
  - `issueId` (FK to `grc_issues`)
  - `clauseId` (FK to `standard_clauses`)
  - `notes` (optional text)
  - `tenantId` (for multi-tenant isolation)

## Proposed Enhancements

### 1. UI Enhancement: Multi-Clause Selection

When creating a finding from the Standards/Scope tab, allow users to:
- Select multiple clauses before creating the finding
- Use checkboxes in the clause tree for multi-selection
- Show a summary of selected clauses before creation

### 2. Finding Detail Page Enhancement

On the Finding detail page:
- Display all linked clauses in a dedicated section
- Allow adding/removing clause links after creation
- Show clause hierarchy context (Standard → Clause path)

### 3. API Enhancement

Modify the create finding endpoint to accept multiple clause IDs:

```typescript
// POST /grc/audits/:auditId/clauses/:clauseId/findings
// Enhanced body:
{
  title?: string;
  description?: string;
  severity?: string;
  additionalClauseIds?: string[];  // Additional clauses to link
}
```

### 4. Database Considerations

The existing `grc_issue_clauses` table already supports many-to-many relationships. No schema changes required.

## Priority

P2 - Backlog item. Implement when:
- Core finding creation flow is stable
- User feedback indicates need for multi-clause findings
- Sprint capacity allows

## Related Files

- `backend-nest/src/grc/entities/grc-issue-clause.entity.ts`
- `backend-nest/src/grc/services/standards.service.ts`
- `frontend/src/components/audit/StandardsScopeTab.tsx`
- `frontend/src/components/audit/ClauseTree.tsx`

## Created

Date: 2026-01-29
Context: P0 fix for "Create finding for this clause" button
