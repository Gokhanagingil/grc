# Sprint 5.5 - GRC Navigation & Mobile UX Hardening

## PHASE 0 - Recon Findings

### Current State Analysis

#### 1. "New Audit" Button Visibility

**Location:** `frontend/src/pages/AuditList.tsx`

**Current Implementation (lines 79, 120-129, 241-249):**
```tsx
const [canCreate, setCanCreate] = useState(false);

const fetchCanCreate = useCallback(async () => {
  try {
    const response = await api.get('/grc/audits/can/create');
    setCanCreate(response.data.allowed);
  } catch {
    // Fallback: allow admin and manager users to create audits even if the check fails
    const userRole = user?.role;
    setCanCreate(userRole === 'admin' || userRole === 'manager');
  }
}, [user?.role]);

// Button rendering:
{canCreate && (
  <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/audits/new')}>
    New Audit
  </Button>
)}
```

**Issues Identified:**
1. The button visibility depends on an async API call (`/grc/audits/can/create`)
2. If the API response envelope is not unwrapped correctly, `response.data.allowed` may be undefined
3. The fallback only triggers on error, not on unexpected response format
4. On tablet viewports, the header layout may cause the button to be pushed off-screen or hidden

**Comparison with Other Modules:**
- `RiskManagement.tsx`: Always shows "New Risk" button without permission check
- `ProcessManagement.tsx`: Always shows "New Process" button without permission check

#### 2. Process / Controls Navigation

**Current Routes (App.tsx lines 70-71):**
```tsx
<Route path="processes" element={<ProcessManagement />} />
<Route path="violations" element={<ProcessViolations />} />
```

**Current Navigation (Layout.tsx lines 53-67):**
```tsx
const menuItems: NavMenuItem[] = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'To-Do', icon: <TodoIcon />, path: '/todos' },
  { text: 'Governance', icon: <GovernanceIcon />, path: '/governance', moduleKey: 'policy' },
  { text: 'Risk Management', icon: <RiskIcon />, path: '/risk', moduleKey: 'risk' },
  { text: 'Compliance', icon: <ComplianceIcon />, path: '/compliance', moduleKey: 'compliance' },
  { text: 'Audits', icon: <AuditIcon />, path: '/audits', moduleKey: 'audit' },
  { text: 'Incidents', icon: <IncidentIcon />, path: '/incidents', moduleKey: 'itsm.incident' },
  // ... dashboards and admin items
];
```

**Issue:** Process Management and Process Violations are NOT in the navigation menu!
- Routes exist at `/processes` and `/violations`
- Pages are fully implemented (`ProcessManagement.tsx` - 1062 lines, `ProcessViolations.tsx` - 675 lines)
- But there is NO way to navigate to them from the sidebar

#### 3. Responsive Behavior

**Layout.tsx Drawer Implementation:**
- Uses MUI Drawer with `drawerWidth = 240`
- Mobile drawer: `display: { xs: 'block', sm: 'none' }` - temporary drawer
- Desktop drawer: `display: { xs: 'none', sm: 'block' }` - permanent drawer
- Breakpoint `sm` = 600px (MUI default)

**Tablet Considerations:**
- Tablets typically have viewport widths of 768px-1024px
- At these widths, the permanent drawer is shown
- The main content area has `width: { sm: calc(100% - 240px) }`
- Header buttons should remain visible, but filter controls may wrap

### Summary of Required Changes

#### PHASE 1 - Audit Button Robustness
1. Improve `canCreate` logic to handle envelope unwrapping properly
2. Add immediate role-based visibility for admin/manager (don't wait for API)
3. Ensure button remains visible on tablet viewports

#### PHASE 2 - Navigation Additions
1. Add "Processes" menu item to `menuItems` array
2. Add "Violations" menu item to `menuItems` array
3. Use appropriate icons (AccountTree for Processes, Warning for Violations)
4. Consider adding a moduleKey for RBAC (e.g., 'process')

### Files to Modify

1. `frontend/src/pages/AuditList.tsx` - Improve canCreate logic
2. `frontend/src/components/Layout.tsx` - Add Process/Violations navigation
