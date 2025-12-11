# Process Controls & Process Violations UX Design Notes

## PHASE 0 Summary - Current State Analysis

### 1. Process Management Page (ProcessManagement.tsx)

**Current Process List UX:**
- Displays: Name, Code, Category, Status (Active/Inactive), Compliance Score
- Missing columns: Owner, # Controls, # Violations
- Filter bar includes: Category and Status filters
- Actions: View, View Violations, Edit, Delete
- Pagination is implemented with configurable rows per page

**Process Detail View:**
- Opens in a dialog with two tabs: Details and Controls
- Details tab shows: Description, Category chip, Active status chip, Compliance score
- Controls tab shows a table with: Name, Method, Frequency, Type (expectedResultType), Status
- Missing in Controls table: Automated badge is inline with name, Owner column, Last Result/Status columns
- Actions available: Record Result, Edit, Delete

**Add Control Flow:**
- Opens a dialog with form fields: Name, Description, Method (dropdown), Frequency (dropdown), Expected Result Type (dropdown), Automated (switch), Active (switch)
- Enum values are lowercase in frontend constants (matching backend after PR #79 fix)
- Form validation: Only name is required

**Current Issues:**
- Process list doesn't show Owner, # Controls, # Violations counts
- Controls table in detail view is basic - missing Owner, Last Result columns
- No inline error messages for form validation

### 2. Process Violations Page (ProcessViolations.tsx)

**Current Violations List UX:**
- Displays: Title, Process/Control, Severity, Status, Linked Risk, Due Date, Created, Actions
- Filter bar includes: Status, Severity dropdowns
- Process filter chip appears when `?processId=...` query param is present
- Process name is fetched and displayed in the chip (good!)
- Chip can be deleted to clear the filter

**Query Param Handling:**
- `useSearchParams()` hook reads `processId` from URL
- `processFilter` state is initialized from URL param
- When chip is deleted, `processFilter` is cleared and page resets
- Backend supports `processId` filter in `ProcessViolationFilterDto`

**Violation Detail View:**
- Opens in a dialog showing: Title, Description, Severity chip, Status chip
- Shows Control name and Process name if available
- Shows Linked Risk if present
- Shows Due Date and Resolution Notes if present
- Edit button transitions to edit dialog

**Edit Violation Flow:**
- Status dropdown (open, in_progress, resolved)
- Due Date picker
- Resolution Notes textarea
- Link Risk dialog allows selecting from available risks

**Current Issues:**
- No Owner column in the list
- No text search filter
- Detail view is a simple dialog, not a drawer/panel
- Missing "closed" status in frontend (backend enum has only open, in_progress, resolved)

### 3. Backend API Capabilities

**Process Endpoints:**
- GET /grc/processes - List with filters (name, code, category, ownerUserId, isActive, search)
- GET /grc/processes/:id - Get with controls relation
- POST/PATCH/DELETE - Full CRUD

**ProcessControl Endpoints:**
- GET /grc/process-controls - List with filters (processId, isActive, frequency)
- GET /grc/process-controls/:id - Get with relations
- POST/PATCH/DELETE - Full CRUD
- PUT /grc/process-controls/:id/risks - Link risks

**ProcessViolation Endpoints:**
- GET /grc/process-violations - List with filters (processId, controlId, status, severity, linkedRiskId, ownerUserId, date ranges)
- GET /grc/process-violations/:id - Get with relations (control, control.process, controlResult, linkedRisk, owner)
- PATCH /grc/process-violations/:id - Update (status, dueDate, resolutionNotes, etc.)
- PATCH /grc/process-violations/:id/link-risk - Link risk
- PATCH /grc/process-violations/:id/unlink-risk - Unlink risk

**Enums (lowercase values):**
- ViolationSeverity: low, medium, high, critical
- ViolationStatus: open, in_progress, resolved
- ProcessControlMethod: script, sampling, interview, walkthrough, observation
- ProcessControlFrequency: daily, weekly, monthly, quarterly, annually, event_driven
- ControlResultType: boolean, numeric, qualitative

---

## PHASE 1 - UX Design Plan

### Process Management Page Improvements

#### 1.1 Process List Table Enhancements

**Target Columns:**
| Column | Source | Notes |
|--------|--------|-------|
| Name | process.name | Clickable, opens detail view |
| Code | process.code | Chip style |
| Owner | process.ownerUserId | Display email/name if available, else "N/A" |
| Category | process.category | Text or "N/A" |
| Active? | process.isActive | Badge: Active (green) / Inactive (gray) |
| # Controls | Derived | Count from controls relation or placeholder |
| # Violations | Derived | Placeholder "N/A" (requires additional API call) |
| Compliance | complianceScore | Percentage chip with color coding |
| Actions | - | View, Violations, Edit, Delete |

**Implementation Notes:**
- Backend `GET /grc/processes/:id` returns `controls` relation, but list endpoint doesn't include count
- For now, show "N/A" for # Controls and # Violations in list view
- These counts can be shown in detail view where we fetch with relations

#### 1.2 Process Detail View - Controls Section

**Target Controls Table Columns:**
| Column | Source | Notes |
|--------|--------|-------|
| Name | control.name | With "Automated" badge if isAutomated |
| Automated? | control.isAutomated | Badge or icon |
| Method | control.method | Capitalize for display |
| Frequency | control.frequency | Capitalize, replace underscores |
| Expected Result | control.expectedResultType | Capitalize |
| Owner | control.ownerUserId | Display email/name or "N/A" |
| Active? | control.isActive | Badge |
| Last Result | - | Placeholder (requires ControlResult query) |
| Last Status | - | Placeholder (requires ControlResult query) |
| Actions | - | Record Result, Edit, Delete |

**Implementation Notes:**
- Owner display: For MVP, show ownerUserId truncated or "N/A"
- Last Result/Status: Mark as "N/A" for now (would require additional API call)
- Keep existing Record Result, Edit, Delete actions

#### 1.3 Add/Edit Control Form Improvements

**Form Fields:**
- Name (required) - TextField with inline error
- Description - TextField multiline
- Method - Select dropdown
- Frequency - Select dropdown  
- Expected Result Type - Select dropdown
- Automated - Switch
- Active - Switch
- Owner - Optional (future: user selector)

**Validation:**
- Name is required - show inline error message
- All enum dropdowns use lowercase values matching backend

### Process Violations Page Improvements

#### 2.1 Filter Bar Enhancements

**Target Filters:**
| Filter | Type | Notes |
|--------|------|-------|
| Process | Chip (from URL) | Shows process name, deletable |
| Status | Dropdown | open, in_progress, resolved |
| Severity | Dropdown | low, medium, high, critical |
| Search | TextField | Frontend filter on title/description |

**Implementation Notes:**
- Process chip already works well with query param
- Add a simple text search input for frontend filtering
- Keep existing Status and Severity dropdowns

#### 2.2 Violations List Table Enhancements

**Target Columns:**
| Column | Source | Notes |
|--------|--------|-------|
| Title | violation.title | With description tooltip |
| Process | violation.control.process.name | Text |
| Control | violation.control.name | Text |
| Severity | violation.severity | Colored chip |
| Status | violation.status | Colored chip |
| Owner | violation.ownerUserId | Display or "N/A" |
| Created At | violation.createdAt | Formatted date |
| Due Date | violation.dueDate | Formatted date or "-" |
| Actions | - | View, Edit |

**Implementation Notes:**
- Split Process/Control into separate columns for clarity
- Add Owner column
- Keep existing severity/status color coding

#### 2.3 Violation Detail View Enhancement

**Current:** Simple dialog
**Target:** Keep dialog but improve content organization

**Detail View Sections:**
1. **Header**: Title, Severity badge, Status badge
2. **Description**: Full description text
3. **Context**: Process name, Control name (with links if possible)
4. **Linked Risk**: Risk title with link/unlink action
5. **Timeline**: Created date, Due date
6. **Resolution**: Resolution notes (editable in edit mode)
7. **Actions**: Edit button, Status change dropdown + Update button

**Implementation Notes:**
- Keep as dialog for simplicity (drawer would require more refactoring)
- Add inline status change capability in detail view
- Show all relevant context information

#### 2.4 Query Param & Filter Chip Behavior

**Current Behavior (already good):**
- `/violations?processId=...` shows process name chip
- Chip deletion clears filter
- Clear Filters button resets all

**No changes needed** - current implementation is correct.

### Loading & Error States

**Both Pages:**
- Loading: Use existing `LoadingState` component with appropriate message
- Error: Use existing `ErrorState` component with retry button
- Empty: Use existing `EmptyState` component with contextual message

**Implementation Notes:**
- Already implemented in both pages
- Ensure error messages are user-friendly (not technical)
- Console.log technical errors for debugging

---

## Implementation Priority

### Phase 2 (Process Management):
1. Enhance process list table columns (Owner, keep # Controls/Violations as N/A)
2. Enhance controls table in detail view
3. Improve Add Control form with inline validation
4. Verify loading/error states

### Phase 3 (Process Violations):
1. Add search filter to filter bar
2. Split Process/Control into separate columns
3. Add Owner column
4. Enhance detail view with better organization
5. Verify query param chip behavior

### Non-Breaking Changes:
- All changes are additive/cosmetic
- No backend API changes required
- No migration changes
- Existing functionality preserved
