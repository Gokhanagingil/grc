# Audit Scope UX Flow - Phase 2

## Overview

This document describes the user experience flows for the standards-driven audit scope management system. It covers the UI components, interactions, and API integrations needed to support multi-standard audits with clause-level granularity.

## User Stories

### US-1: Select Standards for Audit Scope
**As an** auditor,  
**I want to** select which standards are in scope for my audit,  
**So that** I can define the audit boundaries clearly.

### US-2: Select Specific Clauses
**As an** auditor,  
**I want to** select specific clauses within a standard,  
**So that** I can conduct a focused audit on relevant areas.

### US-3: View Clause Details
**As an** auditor,  
**I want to** view detailed information about a clause,  
**So that** I understand what needs to be audited.

### US-4: Link Findings to Clauses
**As an** auditor,  
**I want to** link findings to specific standard clauses,  
**So that** there is clear traceability between findings and requirements.

### US-5: View Historical Findings
**As an** auditor,  
**I want to** see historical findings for a clause from previous audits,  
**So that** I can identify recurring issues.

### US-6: Lock Scope
**As an** audit manager,  
**I want** the scope to be locked when the audit starts,  
**So that** the audit boundaries remain consistent throughout.

---

## Page Layouts

### Audit Detail Page - Enhanced Tab Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back to Audits                                    [Edit] [Save]  │
├─────────────────────────────────────────────────────────────────────┤
│  ISO 27001 Internal Audit 2024                                      │
│  Status: Planned  │  Risk Level: High  │  Lead: John Smith          │
├─────────────────────────────────────────────────────────────────────┤
│  [Overview] [Scope & Standards] [Findings & CAPA] [Reports]         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Tab Content Area                                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Tab: Scope & Standards

### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Scope & Standards                                                  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Standards in Scope                        [+ Add Standard]  │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │                                                              │   │
│  │  ┌─────────────────────────────────────────────────────┐    │   │
│  │  │ ▼ ISO 27001:2022                    [Full] [Remove] │    │   │
│  │  │   Information Security Management System             │    │   │
│  │  │   93 clauses in scope │ 12 tested │ 3 findings      │    │   │
│  │  │                                                      │    │   │
│  │  │   ├─ ▶ A.5 Organizational controls (8 clauses)      │    │   │
│  │  │   ├─ ▶ A.6 People controls (8 clauses)              │    │   │
│  │  │   ├─ ▼ A.7 Physical controls                        │    │   │
│  │  │   │    ├─ ☑ A.7.1 Physical security perimeters      │    │   │
│  │  │   │    ├─ ☑ A.7.2 Physical entry                    │    │   │
│  │  │   │    └─ ☑ A.7.3 Securing offices...               │    │   │
│  │  │   └─ ▶ A.8 Technological controls (34 clauses)      │    │   │
│  │  └─────────────────────────────────────────────────────┘    │   │
│  │                                                              │   │
│  │  ┌─────────────────────────────────────────────────────┐    │   │
│  │  │ ▶ ISO 22301:2019                  [Partial] [Remove]│    │   │
│  │  │   Business Continuity Management System              │    │   │
│  │  │   15 of 42 clauses in scope │ 8 tested │ 1 finding  │    │   │
│  │  └─────────────────────────────────────────────────────┘    │   │
│  │                                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Legacy Requirements (Phase 1)             [+ Add Requirement]│   │
│  │  ─────────────────────────────────────────────────────────── │   │
│  │  Framework    │ Code      │ Title              │ Status      │   │
│  │  ISO27001     │ A.5.1     │ Policies for...    │ Tested      │   │
│  │  GDPR         │ Art.32    │ Security of...     │ Planned     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Components

#### 1. Standards Accordion

Each standard in scope is displayed as an expandable accordion:

```typescript
// Component: StandardScopeAccordion
interface StandardScopeAccordionProps {
  auditId: string;
  standardId: string;
  standardName: string;
  standardVersion: string;
  scopeType: 'full' | 'partial';
  clauseCount: number;
  testedCount: number;
  findingCount: number;
  isLocked: boolean;
  onRemove: () => void;
  onScopeTypeChange: (type: 'full' | 'partial') => void;
}
```

#### 2. Clause Tree View

Hierarchical tree view of clauses within a standard:

```typescript
// Component: ClauseTreeView
interface ClauseTreeViewProps {
  standardId: string;
  clauses: ClauseNode[];
  selectedClauseIds: string[];
  scopeType: 'full' | 'partial';
  isLocked: boolean;
  onClauseSelect: (clauseId: string, selected: boolean) => void;
  onClauseClick: (clauseId: string) => void;
}

interface ClauseNode {
  id: string;
  code: string;
  title: string;
  level: number;
  children: ClauseNode[];
  isAuditable: boolean;
  status?: 'planned' | 'in_progress' | 'tested' | 'not_applicable';
  findingCount?: number;
}
```

#### 3. Add Standard Modal

Modal for selecting standards to add to audit scope:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Add Standard to Audit Scope                                    [X] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Search: [________________________] [🔍]                            │
│                                                                     │
│  Filter by Domain: [All Domains ▼]                                  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ☐ ISO 27001:2022 - Information Security Management          │   │
│  │   Publisher: ISO/IEC │ Domain: Security │ 93 clauses        │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ ☐ ISO 22301:2019 - Business Continuity Management           │   │
│  │   Publisher: ISO │ Domain: Continuity │ 42 clauses          │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ ☐ COBIT 2019 - IT Governance Framework                      │   │
│  │   Publisher: ISACA │ Domain: Governance │ 40 objectives     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Scope Type:                                                        │
│  ○ Full Standard - All clauses will be in scope                    │
│  ● Partial - Select specific clauses after adding                  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                        [Cancel]  [Add Selected]     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Clause Detail Drawer

When a user clicks on a clause, a drawer opens from the right:

```
┌──────────────────────────────────────────────────────────────┐
│  A.5.1 Policies for information security               [X]  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Standard: ISO 27001:2022                                    │
│  Level: Control                                              │
│  Status: Tested ✓                                            │
│                                                              │
│  ─────────────────────────────────────────────────────────── │
│                                                              │
│  Description                                                 │
│  ─────────────────────────────────────────────────────────── │
│  Information security policy and topic-specific policies     │
│  shall be defined, approved by management, published,        │
│  communicated to and acknowledged by relevant personnel      │
│  and relevant interested parties, and reviewed at planned    │
│  intervals and if significant changes occur.                 │
│                                                              │
│  ─────────────────────────────────────────────────────────── │
│                                                              │
│  Findings in This Audit (2)                [+ Add Finding]   │
│  ─────────────────────────────────────────────────────────── │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ ⚠ HIGH - Missing policy review schedule                │ │
│  │   Status: Open │ Owner: Jane Doe │ Due: 2024-03-15     │ │
│  │   [View Finding →]                                      │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ ℹ MEDIUM - Policy acknowledgment tracking incomplete   │ │
│  │   Status: In Progress │ Owner: Bob Smith               │ │
│  │   [View Finding →]                                      │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ─────────────────────────────────────────────────────────── │
│                                                              │
│  Historical Findings (Other Audits)                          │
│  ─────────────────────────────────────────────────────────── │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ ISO 27001 Audit 2023 (Closed)                          │ │
│  │ • LOW - Policy format inconsistency (Resolved)         │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ ISO 27001 Audit 2022 (Closed)                          │ │
│  │ • MEDIUM - Missing mobile device policy (Resolved)     │ │
│  │ • LOW - Policy version control (Resolved)              │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ─────────────────────────────────────────────────────────── │
│                                                              │
│  Related CAPAs                                               │
│  ─────────────────────────────────────────────────────────── │
│  • CAPA-2024-001: Implement policy review calendar          │
│    Status: In Progress │ Due: 2024-04-01                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Component Definition

```typescript
// Component: ClauseDetailDrawer
interface ClauseDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  auditId: string;
  clauseId: string;
  clause: {
    id: string;
    code: string;
    title: string;
    description: string;
    descriptionLong?: string;
    level: number;
    standard: {
      id: string;
      name: string;
      version: string;
    };
  };
  scopeStatus?: 'planned' | 'in_progress' | 'tested' | 'not_applicable';
  findings: Finding[];
  historicalFindings: HistoricalFinding[];
  relatedCapas: Capa[];
  onAddFinding: () => void;
  onViewFinding: (findingId: string) => void;
  onStatusChange: (status: string) => void;
}

interface HistoricalFinding {
  auditId: string;
  auditName: string;
  auditStatus: string;
  findings: {
    id: string;
    title: string;
    severity: string;
    status: string;
  }[];
}
```

---

## Tab: Findings & CAPA (Enhanced)

### Layout with Clause Linkage

```
┌─────────────────────────────────────────────────────────────────────┐
│  Findings & CAPA                                                    │
│                                                                     │
│  [+ Add Finding]                                                    │
│                                                                     │
│  Filter: [All Severities ▼] [All Statuses ▼] [All Clauses ▼]       │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Title          │ Severity │ Status  │ Clauses    │ CAPAs    │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ Missing policy │ HIGH     │ Open    │ A.5.1      │ 1        │   │
│  │ review schedule│          │         │            │          │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ Incomplete     │ MEDIUM   │ In Prog │ A.5.1,     │ 0        │   │
│  │ acknowledgment │          │         │ A.6.2      │          │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ Weak access    │ HIGH     │ Open    │ A.8.2,     │ 2        │   │
│  │ controls       │          │         │ A.8.3      │          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Add Finding Modal (Enhanced)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Add Finding                                                    [X] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Title *                                                            │
│  [________________________________________________________]        │
│                                                                     │
│  Description                                                        │
│  [________________________________________________________]        │
│  [________________________________________________________]        │
│                                                                     │
│  Severity *              Status                                     │
│  [Medium ▼]              [Open ▼]                                   │
│                                                                     │
│  Owner                   Due Date                                   │
│  [Select User ▼]         [📅 Select Date]                          │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  Link to Standard Clauses                                           │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  Standard: [ISO 27001:2022 ▼]                                       │
│                                                                     │
│  ☑ A.5.1 - Policies for information security                       │
│  ☐ A.5.2 - Information security roles and responsibilities         │
│  ☑ A.6.2 - Terms and conditions of employment                      │
│  ☐ A.6.3 - Information security awareness...                       │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  Link to Legacy Requirements (Optional)                             │
│  [Select Requirements ▼]                                            │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                        [Cancel]  [Create Finding]   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Standards Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/grc/standards` | List all active standards |
| GET | `/grc/standards/:id` | Get standard details |
| GET | `/grc/standards/:id/clauses` | Get clause hierarchy for standard |
| GET | `/grc/standards/:id/clauses/:clauseId` | Get clause details |

### Audit Scope - Standards

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/grc/audits/:id/scope/standards` | Get standards in audit scope |
| POST | `/grc/audits/:id/scope/standards` | Add standard to audit scope |
| DELETE | `/grc/audits/:id/scope/standards/:standardId` | Remove standard from scope |
| PATCH | `/grc/audits/:id/scope/standards/:standardId` | Update scope type (full/partial) |

### Audit Scope - Clauses

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/grc/audits/:id/scope/clauses` | Get clauses in audit scope |
| POST | `/grc/audits/:id/scope/clauses` | Add clauses to audit scope |
| DELETE | `/grc/audits/:id/scope/clauses/:clauseId` | Remove clause from scope |
| PATCH | `/grc/audits/:id/scope/clauses/:clauseId` | Update clause status |

### Finding-Clause Linkage

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/grc/issues/:id/clauses` | Get clauses linked to finding |
| POST | `/grc/issues/:id/clauses` | Link clauses to finding |
| DELETE | `/grc/issues/:id/clauses/:clauseId` | Unlink clause from finding |
| GET | `/grc/standards/:id/clauses/:clauseId/findings` | Get all findings for clause |

### Scope Locking

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/grc/audits/:id/scope/lock` | Lock audit scope |
| GET | `/grc/audits/:id/scope/status` | Get scope lock status |

---

## API Request/Response Examples

### GET /grc/standards

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-1",
      "code": "iso27001",
      "name": "ISO/IEC 27001:2022",
      "shortName": "ISO 27001",
      "version": "2022",
      "description": "Information security management systems",
      "publisher": "ISO/IEC",
      "domain": "security",
      "isActive": true,
      "clauseCount": 93
    },
    {
      "id": "uuid-2",
      "code": "iso22301",
      "name": "ISO 22301:2019",
      "shortName": "ISO 22301",
      "version": "2019",
      "description": "Business continuity management systems",
      "publisher": "ISO",
      "domain": "continuity",
      "isActive": true,
      "clauseCount": 42
    }
  ]
}
```

### GET /grc/standards/:id/clauses

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "clause-uuid-1",
      "code": "A.5",
      "title": "Organizational controls",
      "level": 1,
      "isAuditable": false,
      "children": [
        {
          "id": "clause-uuid-2",
          "code": "A.5.1",
          "title": "Policies for information security",
          "level": 2,
          "isAuditable": true,
          "description": "Information security policy and topic-specific policies...",
          "children": []
        },
        {
          "id": "clause-uuid-3",
          "code": "A.5.2",
          "title": "Information security roles and responsibilities",
          "level": 2,
          "isAuditable": true,
          "children": []
        }
      ]
    }
  ]
}
```

### POST /grc/audits/:id/scope/standards

**Request:**
```json
{
  "standardId": "uuid-1",
  "scopeType": "partial"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "scope-uuid-1",
    "auditId": "audit-uuid",
    "standardId": "uuid-1",
    "scopeType": "partial",
    "isLocked": false,
    "standard": {
      "code": "iso27001",
      "name": "ISO/IEC 27001:2022"
    }
  }
}
```

### POST /grc/audits/:id/scope/clauses

**Request:**
```json
{
  "clauseIds": ["clause-uuid-2", "clause-uuid-3", "clause-uuid-4"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "added": 3,
    "clauses": [
      {
        "id": "scope-clause-uuid-1",
        "clauseId": "clause-uuid-2",
        "status": "planned",
        "clause": {
          "code": "A.5.1",
          "title": "Policies for information security"
        }
      }
    ]
  }
}
```

### GET /grc/standards/:id/clauses/:clauseId/findings

**Response:**
```json
{
  "success": true,
  "data": {
    "clause": {
      "id": "clause-uuid-2",
      "code": "A.5.1",
      "title": "Policies for information security"
    },
    "currentAuditFindings": [
      {
        "id": "finding-uuid-1",
        "title": "Missing policy review schedule",
        "severity": "high",
        "status": "open",
        "auditId": "current-audit-uuid"
      }
    ],
    "historicalFindings": [
      {
        "auditId": "past-audit-uuid-1",
        "auditName": "ISO 27001 Audit 2023",
        "auditStatus": "closed",
        "findings": [
          {
            "id": "finding-uuid-old-1",
            "title": "Policy format inconsistency",
            "severity": "low",
            "status": "resolved"
          }
        ]
      }
    ]
  }
}
```

---

## State Management

### Frontend State Structure

```typescript
// Audit Scope State
interface AuditScopeState {
  // Standards in scope
  scopeStandards: {
    id: string;
    standardId: string;
    standard: Standard;
    scopeType: 'full' | 'partial';
    isLocked: boolean;
    clauseCount: number;
    testedCount: number;
    findingCount: number;
  }[];
  
  // Clauses in scope (for partial scope)
  scopeClauses: {
    id: string;
    clauseId: string;
    clause: StandardClause;
    status: ClauseTestingStatus;
    notes?: string;
  }[];
  
  // UI state
  expandedStandards: string[];
  selectedClauseId: string | null;
  isLoading: boolean;
  error: string | null;
}

// Actions
type AuditScopeAction =
  | { type: 'LOAD_SCOPE_SUCCESS'; payload: { standards: any[]; clauses: any[] } }
  | { type: 'ADD_STANDARD'; payload: { standardId: string; scopeType: string } }
  | { type: 'REMOVE_STANDARD'; payload: { standardId: string } }
  | { type: 'ADD_CLAUSES'; payload: { clauseIds: string[] } }
  | { type: 'REMOVE_CLAUSE'; payload: { clauseId: string } }
  | { type: 'UPDATE_CLAUSE_STATUS'; payload: { clauseId: string; status: string } }
  | { type: 'TOGGLE_STANDARD_EXPAND'; payload: { standardId: string } }
  | { type: 'SELECT_CLAUSE'; payload: { clauseId: string | null } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };
```

---

## Interaction Flows

### Flow 1: Add Standard to Audit Scope

```
1. User clicks [+ Add Standard] button
2. Modal opens with list of available standards
3. User searches/filters standards
4. User selects one or more standards
5. User chooses scope type (Full/Partial)
6. User clicks [Add Selected]
7. API call: POST /grc/audits/:id/scope/standards
8. On success:
   - Modal closes
   - Standard appears in scope list
   - If partial, clause tree is expanded for selection
9. On error:
   - Error message displayed in modal
```

### Flow 2: Select Clauses for Partial Scope

```
1. User expands standard accordion
2. Clause tree is displayed
3. User checks/unchecks individual clauses
4. On each change:
   - API call: POST or DELETE /grc/audits/:id/scope/clauses
   - UI updates optimistically
5. User can expand clause groups to see children
6. Selecting a parent optionally selects all children
```

### Flow 3: View Clause Details and Add Finding

```
1. User clicks on a clause in the tree
2. Clause detail drawer opens from right
3. Drawer shows:
   - Clause description
   - Current audit findings
   - Historical findings
   - Related CAPAs
4. User clicks [+ Add Finding]
5. Add Finding modal opens with clause pre-selected
6. User fills finding details
7. User clicks [Create Finding]
8. API call: POST /grc/audits/:id/findings
9. API call: POST /grc/issues/:id/clauses
10. Drawer updates to show new finding
```

### Flow 4: Lock Scope When Audit Starts

```
1. User changes audit status from "Planned" to "In Progress"
2. System prompts: "This will lock the audit scope. Continue?"
3. User confirms
4. API call: PATCH /grc/audits/:id (status change)
5. API call: POST /grc/audits/:id/scope/lock
6. UI updates:
   - [+ Add Standard] button disabled
   - Clause checkboxes disabled
   - [Remove] buttons hidden
   - "Scope Locked" indicator shown
```

---

## Error Handling

### Scope Modification Errors

| Error Code | Message | UI Behavior |
|------------|---------|-------------|
| SCOPE_LOCKED | "Audit scope is locked and cannot be modified" | Show toast, disable controls |
| STANDARD_ALREADY_IN_SCOPE | "This standard is already in audit scope" | Show toast, highlight existing |
| CLAUSE_NOT_IN_STANDARD | "Clause does not belong to the specified standard" | Show error in modal |
| INVALID_SCOPE_TYPE | "Invalid scope type. Must be 'full' or 'partial'" | Show validation error |

### Finding Linkage Errors

| Error Code | Message | UI Behavior |
|------------|---------|-------------|
| CLAUSE_NOT_IN_SCOPE | "Cannot link finding to clause not in audit scope" | Show toast, suggest adding to scope |
| FINDING_NOT_IN_AUDIT | "Finding does not belong to this audit" | Show error message |

---

## Accessibility Considerations

### Keyboard Navigation

- Tab through standards and clauses
- Enter/Space to expand/collapse
- Arrow keys to navigate tree
- Escape to close drawer/modal

### Screen Reader Support

- ARIA labels for tree structure
- Live regions for status updates
- Descriptive button labels

### Visual Indicators

- Clear focus states
- Color-blind friendly severity indicators
- Icons paired with text labels

---

## Mobile Responsiveness

### Tablet View (768px - 1024px)

- Clause tree collapses to single column
- Drawer becomes full-width modal
- Touch-friendly expand/collapse

### Mobile View (< 768px)

- Standards shown as cards
- Clause selection via separate screen
- Bottom sheet for clause details

---

## Component Library Requirements

### New Components Needed

1. `StandardScopeAccordion` - Expandable standard card
2. `ClauseTreeView` - Hierarchical clause tree with checkboxes
3. `ClauseDetailDrawer` - Right-side drawer for clause details
4. `AddStandardModal` - Modal for standard selection
5. `ClauseFindingCard` - Finding summary card for drawer
6. `HistoricalFindingSection` - Collapsible historical findings

### Existing Components to Extend

1. `AuditDetail.tsx` - Add new tab and state management
2. `AddFindingModal` - Add clause selection
3. `FindingDetail.tsx` - Show linked clauses

---

## Implementation Checklist

### Phase 2.2: Audit Scope Integration

- [ ] Create `StandardScopeAccordion` component
- [ ] Create `ClauseTreeView` component
- [ ] Create `AddStandardModal` component
- [ ] Add "Scope & Standards" tab to AuditDetail
- [ ] Implement standard addition flow
- [ ] Implement clause selection flow
- [ ] Implement scope locking
- [ ] Add API integration for scope endpoints

### Phase 2.3: Finding-Clause Linkage

- [ ] Create `ClauseDetailDrawer` component
- [ ] Extend `AddFindingModal` with clause selection
- [ ] Implement finding-clause linkage API calls
- [ ] Add historical findings view
- [ ] Update findings table with clause column
- [ ] Add clause filter to findings list
