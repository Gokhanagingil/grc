# Audit Module Phase 2 - Standards-Driven Audit Design

## Executive Summary

This document describes the design for upgrading the GRC Audit module from "simple records" to a standards-driven, evidence-based audit system. Phase 2 introduces first-class Standard and Clause entities, enabling audits to be scoped against specific standards and their hierarchical clauses, with full traceability from findings and CAPAs back to standard clauses.

## Current State Analysis

### Existing Implementation (Phase 1)

The current audit module provides basic audit lifecycle management with requirement-based scope:

**Entities in Place:**
- `GrcAudit` - Audit records with status, type, dates, and text-based scope
- `GrcRequirement` - Compliance requirements with framework enum (ISO27001, SOC2, GDPR, etc.)
- `GrcIssue` - Findings linked to audits via `auditId` foreign key
- `GrcCapa` - Corrective/Preventive actions linked to issues
- `GrcAuditRequirement` - Many-to-many linking audits to requirements
- `GrcIssueRequirement` - Many-to-many linking findings to requirements

**Current Limitations:**
1. **No Standard Ownership**: Audits link to generic "requirements" but don't explicitly declare which standards are in scope
2. **Flat Structure**: Requirements lack hierarchical organization (domain → clause → sub-clause)
3. **Limited Traceability**: Cannot easily navigate from a standard clause to see all related findings across audits
4. **No Scope Immutability**: Audit scope can be modified at any stage
5. **Framework Enum Constraints**: The `ComplianceFramework` enum is limited and doesn't support versioning

### Standards Library (Existing)

A Standards Library exists with JSON data files for:
- ISO 27001:2022
- ISO 27002:2022
- ISO 20000-1:2018
- ISO 9001:2015
- COBIT 2019
- NIST CSF 2.0
- KVKK/GDPR

These are imported into the `grc_requirements` table with extended fields (`family`, `code`, `version`, `hierarchy_level`, `domain`), but the structure remains flat.

## Phase 2 Target Capabilities

### 1. Standard Library (Foundation)

A central registry of standards as first-class entities:

| Standard | Code | Description |
|----------|------|-------------|
| ISO 27001 | iso27001 | Information Security Management System |
| ISO 22301 | iso22301 | Business Continuity Management System |
| ISO 20000 | iso20000 | IT Service Management System |
| COBIT | cobit | IT Governance Framework |
| ITIL | itil | IT Service Management Best Practices |
| NIST CSF | nistcsf | Cybersecurity Framework |
| SOC 2 | soc2 | Service Organization Controls |
| GDPR | gdpr | General Data Protection Regulation |
| KVKK | kvkk | Turkish Data Protection Law |

Each standard has:
- Unique code and name
- Version tracking (e.g., ISO 27001:2022 vs ISO 27001:2013)
- Hierarchical clauses/controls/articles

### 2. Audit Scope Model

An audit explicitly declares:
- Which standards are in scope (full or partial)
- Which specific clauses are in scope per standard
- Scope becomes immutable once audit status is "In Progress"

Scope types:
- **Full Standard**: All clauses of a standard are in scope
- **Selected Clauses**: Only specific clauses are in scope

### 3. Findings & CAPA from Standards

Enhanced finding linkage:
- A finding can be linked to one or more standard clauses
- Optionally linked to process/control/risk (existing functionality)
- From any clause, users can see all findings across all audits
- CAPA lifecycle is visible per clause

### 4. UX Expectations

**Audit Detail Page:**
- "Scope & Standards" tab shows a tree view of in-scope standards and clauses
- Click on clause opens a detail drawer showing:
  - Clause description and guidance
  - Linked findings for this audit
  - Linked CAPAs
  - Historical findings from other audits

## Architecture Overview

### Entity Relationship Diagram

```
┌─────────────────┐
│    Standard     │
│  (first-class)  │
├─────────────────┤
│ id              │
│ code            │
│ name            │
│ version         │
│ description     │
│ isActive        │
└────────┬────────┘
         │ 1:N
         ▼
┌─────────────────┐
│  StandardClause │
│  (hierarchical) │
├─────────────────┤
│ id              │
│ standardId (FK) │
│ parentClauseId  │◄──┐ self-reference
│ code            │   │ for hierarchy
│ title           │───┘
│ description     │
│ level           │
│ sortOrder       │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────────────┐     ┌─────────────────┐
│AuditScopeStandard│     │ AuditScopeClause│
├─────────────────┤     ├─────────────────┤
│ auditId (FK)    │     │ auditId (FK)    │
│ standardId (FK) │     │ clauseId (FK)   │
│ scopeType       │     │ status          │
│ isLocked        │     │ notes           │
└─────────────────┘     └─────────────────┘
         │                       │
         └───────────┬───────────┘
                     │
                     ▼
              ┌─────────────┐
              │   GrcAudit  │
              │  (existing) │
              └─────────────┘
                     │
                     ▼
              ┌─────────────┐
              │   GrcIssue  │
              │  (existing) │
              └──────┬──────┘
                     │ N:M
                     ▼
         ┌─────────────────────┐
         │ GrcIssueClause      │
         │ (new join table)    │
         ├─────────────────────┤
         │ issueId (FK)        │
         │ clauseId (FK)       │
         │ notes               │
         └─────────────────────┘
```

### Coexistence Strategy

Phase 2 entities coexist with Phase 1:
- `GrcRequirement` remains for backward compatibility
- `GrcAuditRequirement` continues to work
- New `Standard` and `StandardClause` entities provide enhanced functionality
- Audits can use either or both approaches during transition

## Implementation Phases

### Phase 2.1: Foundation (Standard & Clause Entities)

1. Create `Standard` entity with CRUD operations
2. Create `StandardClause` entity with hierarchical support
3. Create seed data for ISO 27001, ISO 22301, ISO 20000, COBIT
4. Create API endpoints for standard/clause management
5. Create Standards Library UI enhancements

### Phase 2.2: Audit Scope Integration

1. Create `AuditScopeStandard` entity
2. Create `AuditScopeClause` entity
3. Implement scope selection UI in Audit Detail
4. Implement scope locking when audit starts
5. Add scope validation rules

### Phase 2.3: Finding-Clause Linkage

1. Create `GrcIssueClause` join table
2. Update finding creation to support clause linking
3. Implement clause-centric finding view
4. Add CAPA visibility per clause
5. Create cross-audit finding history view

### Phase 2.4: Reporting & Analytics

1. Clause coverage reports
2. Finding density per clause
3. CAPA effectiveness per standard
4. Audit scope comparison

## Migration Strategy

### Data Migration

No data migration required - Phase 2 is additive:
1. Existing audits continue to work with requirement-based scope
2. New audits can use standard-based scope
3. Gradual migration of existing requirements to standard clauses (optional)

### API Compatibility

All existing endpoints remain unchanged:
- `GET/POST/PATCH/DELETE /grc/audits`
- `GET/POST/DELETE /grc/audits/:id/requirements`
- `GET/POST /grc/audits/:id/findings`

New endpoints are added alongside:
- `GET/POST/DELETE /grc/audits/:id/scope/standards`
- `GET/POST/DELETE /grc/audits/:id/scope/clauses`
- `GET /grc/standards`
- `GET /grc/standards/:id/clauses`

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Data model complexity | Medium | Clear separation between Phase 1 and Phase 2 entities |
| Performance with hierarchical queries | Medium | Proper indexing and materialized paths |
| UI complexity | Medium | Progressive disclosure, tree view components |
| Migration confusion | Low | Clear documentation, optional migration path |

## Success Criteria

Phase 2 is successful when:
1. Audits can be scoped against specific standards and clauses
2. Findings can be linked to standard clauses
3. Users can navigate from clause to all related findings/CAPAs
4. Scope is immutable once audit is in progress
5. Multi-standard audits are supported
6. Zero breaking changes to existing functionality

## Dependencies

- Existing GrcAudit, GrcIssue, GrcCapa entities
- Existing audit UI components
- Tree view component library (Material-UI TreeView or similar)
- Standards data in JSON format

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 2.1 | 2 weeks | None |
| Phase 2.2 | 2 weeks | Phase 2.1 |
| Phase 2.3 | 2 weeks | Phase 2.2 |
| Phase 2.4 | 1 week | Phase 2.3 |

Total: ~7 weeks

## References

- [AUDIT-PHASE1-DESIGN.md](./AUDIT-PHASE1-DESIGN.md) - Phase 1 design document
- [STANDARDS-LIBRARY.md](./STANDARDS-LIBRARY.md) - Existing standards library documentation
- [AUDIT-STANDARDS-DATA-MODEL.md](./AUDIT-STANDARDS-DATA-MODEL.md) - Detailed data model specification
- [AUDIT-SCOPE-UX-FLOW.md](./AUDIT-SCOPE-UX-FLOW.md) - UX flow documentation
