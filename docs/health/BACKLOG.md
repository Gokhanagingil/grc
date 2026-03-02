# Platform Health Backlog (Out of Scope)

Prioritized list of remaining issues identified during the health audit but out of scope for this fix pack. Created 2026-03-02.

## Priority 1 (High Impact)

### B1: CMDB CI Create Failure
- **Cluster**: C6
- **Symptom**: "Failed to save configuration item" when creating CIs via the UI
- **Root cause hypothesis**: Reference fields modeled as strings instead of proper FK references; field validation mismatch between frontend form and backend DTO
- **Impact**: Blocks CMDB module usability
- **Effort**: Medium (2-3 days)

### B2: Client/API Method Mismatch - `listAffectedCis`
- **Cluster**: C2
- **Symptom**: `grcClient.itsmApi.changes.listAffectedCis is not a function`
- **Root cause**: Client method not exposed or method name mismatch between frontend grcClient and backend controller
- **Impact**: Change detail page crashes when viewing affected CIs
- **Effort**: Small (1 day)

## Priority 2 (Medium Impact)

### B3: MUI Status Select Not Selectable
- **Cluster**: C2
- **Symptom**: Status select in ITSM Services and modals doesn't respond to selection
- **Root cause hypothesis**: MUI controlled value mismatch (value doesn't match any option)
- **Effort**: Small (0.5 day)

### B4: Class Hierarchy Parent Selection Load Failure
- **Cluster**: C6
- **Symptom**: Parent class dropdown fails to load; "View CIs of this class" filtering broken
- **Effort**: Medium (1-2 days)

### B5: Expand MOCK_UI MSW Coverage
- **Cluster**: C3
- **Symptom**: Unhandled requests cause console errors in E2E MOCK_UI tests
- **Root cause**: New API endpoints added without corresponding MSW handlers
- **Effort**: Ongoing (add handlers as new endpoints are created)

## Priority 3 (Low Impact / Noise Reduction)

### B6: MUI Out-of-Range Select Warning
- **Symptom**: `MUI: You have provided an out-of-range value '20' for the select component`
- **Root cause**: Page size value 20 not in the allowed options [5, 10, 25, 50]
- **Impact**: Console warning noise only; not a user-facing bug
- **Effort**: Trivial (add 20 to rowsPerPageOptions or change default)

### B7: List Standardization Migration
- **Cluster**: C1
- **Symptom**: Older list pages lack `data-testid="list-toolbar"` and shared filter/search controls
- **Root cause**: Pre-dates the shared ListPageShell component
- **Effort**: Large (ongoing, 1-2 pages per sprint)

### B8: Console Warning Silencing for Test Environment
- **Cluster**: C4
- **Symptom**: `listQueryUtils "Failed to parse filter..."` warning logged during tests with intentionally invalid input
- **Root cause**: Warning is correct behavior for invalid input, but adds noise to test output
- **Effort**: Trivial (guard with `NODE_ENV !== 'test'` or mock in specific test)
