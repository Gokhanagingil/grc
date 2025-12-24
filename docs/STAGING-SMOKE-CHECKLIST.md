# Staging Smoke Test Checklist

**Environment:** Staging (http://46.224.99.150)  
**Sprint:** UI Recovery Sprint (UI-1)  
**Date:** 2024-12-19

## Purpose

This checklist is used to verify that all UI routes are functional and accessible in the staging environment after the UI Recovery Sprint. It focuses on ensuring no white screens, proper error handling, and basic functionality.

---

## Pre-Test Setup

- [ ] Clear browser cache and cookies
- [ ] Use a fresh browser session or incognito mode
- [ ] Have admin credentials ready
- [ ] Have regular user credentials ready
- [ ] Verify staging backend is running and accessible

---

## Authentication & Access

### Login
- [ ] Navigate to `/login`
- [ ] Login with valid credentials
- [ ] Verify redirect to `/dashboard` after successful login
- [ ] Verify user information is displayed in top-right corner
- [ ] Verify tenant ID is set in localStorage

### Logout
- [ ] Click profile menu (top-right)
- [ ] Click "Logout"
- [ ] Verify redirect to `/login`
- [ ] Verify token is cleared from localStorage

---

## Main Application Routes

### Dashboard
- [ ] Navigate to `/dashboard`
- [ ] Verify page loads without white screen
- [ ] Verify loading state appears during data fetch
- [ ] Verify dashboard cards display (Risks, Compliance, Policies, Incidents, Users)
- [ ] Verify charts render (Risk Trends, Compliance by Regulation)
- [ ] Verify error state appears if API fails (graceful degradation)

### To-Do List
- [ ] Navigate to `/todos`
- [ ] Verify page loads without white screen
- [ ] Verify loading state appears
- [ ] Verify empty state if no todos exist
- [ ] Verify todos list displays if data exists

### Profile
- [ ] Navigate to `/profile` (via profile menu)
- [ ] Verify page loads without white screen
- [ ] Verify user information displays correctly
- [ ] Verify tenant ID is shown

---

## GRC Module Routes

### Risk Management
- [ ] Navigate to `/risk`
- [ ] Verify page loads without white screen
- [ ] Verify loading state appears
- [ ] Verify risks table/list displays
- [ ] Verify error state if API fails
- [ ] Verify empty state if no risks exist
- [ ] Click "Create Risk" button (if available)
- [ ] Verify risk detail/edit page loads

### Governance (Policies)
- [ ] Navigate to `/governance`
- [ ] Verify page loads without white screen
- [ ] Verify loading state appears
- [ ] Verify policies table/list displays
- [ ] Verify error state if API fails
- [ ] Verify empty state if no policies exist
- [ ] Click "Create Policy" button (if available)
- [ ] Verify policy detail/edit page loads

### Compliance (Requirements)
- [ ] Navigate to `/compliance`
- [ ] Verify page loads without white screen
- [ ] Verify loading state appears
- [ ] Verify requirements table/list displays
- [ ] Verify error state if API fails
- [ ] Verify empty state if no requirements exist
- [ ] Click "Create Requirement" button (if available)
- [ ] Verify requirement detail/edit page loads

### Audits
- [ ] Navigate to `/audits`
- [ ] Verify page loads without white screen
- [ ] Verify loading state appears
- [ ] Verify audits table/list displays
- [ ] Verify error state if API fails
- [ ] Verify empty state if no audits exist
- [ ] Click "Create Audit" button (if available)
- [ ] Navigate to `/audits/new`
- [ ] Verify audit creation page loads
- [ ] Navigate to `/audits/:id` (replace :id with actual audit ID)
- [ ] Verify audit detail page loads

### Findings
- [ ] Navigate to `/findings/:id` (replace :id with actual finding ID)
- [ ] Verify page loads without white screen
- [ ] Verify loading state appears
- [ ] Verify finding details display
- [ ] Verify error state if API fails

### Standards Library
- [ ] Navigate to `/standards`
- [ ] Verify page loads without white screen
- [ ] Verify loading state appears
- [ ] Verify standards list displays
- [ ] Verify error state if API fails
- [ ] Navigate to `/standards/:id` (replace :id with actual standard ID)
- [ ] Verify standard detail page loads

### Processes
- [ ] Navigate to `/processes`
- [ ] Verify page loads without white screen
- [ ] Verify loading state appears
- [ ] Verify processes list displays
- [ ] Verify error state if API fails

### Process Violations
- [ ] Navigate to `/violations`
- [ ] Verify page loads without white screen
- [ ] Verify loading state appears
- [ ] Verify violations list displays
- [ ] Verify error state if API fails

---

## ITSM Module Routes

### Incidents
- [ ] Navigate to `/incidents`
- [ ] Verify page loads without white screen
- [ ] Verify loading state appears
- [ ] Verify incidents table/list displays
- [ ] Verify error state if API fails
- [ ] Verify empty state if no incidents exist

---

## Dashboard Routes

### Audit Dashboard
- [ ] Navigate to `/dashboards/audit`
- [ ] Verify page loads without white screen (admin/auditor/audit_manager/governance roles)
- [ ] Verify loading state appears
- [ ] Verify dashboard charts/visualizations display
- [ ] Verify error state if API fails
- [ ] Verify access denied message for unauthorized users

### Compliance Dashboard
- [ ] Navigate to `/dashboards/compliance`
- [ ] Verify page loads without white screen (admin/governance/compliance/audit_manager roles)
- [ ] Verify loading state appears
- [ ] Verify dashboard charts/visualizations display
- [ ] Verify error state if API fails
- [ ] Verify access denied message for unauthorized users

### GRC Health Dashboard
- [ ] Navigate to `/dashboards/grc-health`
- [ ] Verify page loads without white screen (admin/governance/executive/director roles)
- [ ] Verify loading state appears
- [ ] Verify dashboard charts/visualizations display
- [ ] Verify error state if API fails
- [ ] Verify access denied message for unauthorized users

---

## User Management

### User Management (Main App)
- [ ] Navigate to `/users` (admin/manager roles)
- [ ] Verify page loads without white screen
- [ ] Verify loading state appears
- [ ] Verify users table/list displays
- [ ] Verify error state if API fails
- [ ] Verify access denied message for unauthorized users

---

## Admin Panel Routes

### Admin Panel Entry
- [ ] Navigate to `/admin`
- [ ] Verify redirect to `/admin/users`
- [ ] Verify AdminLayout sidebar displays
- [ ] Verify "Back to App" link works

### Admin Users
- [ ] Navigate to `/admin/users`
- [ ] Verify page loads without white screen
- [ ] Verify loading state appears
- [ ] Verify users table/list displays
- [ ] Verify error state if API fails

### Admin Roles
- [ ] Navigate to `/admin/roles`
- [ ] Verify page loads without white screen
- [ ] Verify loading state appears
- [ ] Verify roles list displays
- [ ] Verify error state if API fails

### Admin Tenants
- [ ] Navigate to `/admin/tenants`
- [ ] Verify page loads without white screen
- [ ] Verify loading state appears
- [ ] Verify tenants list displays
- [ ] Verify error state if API fails

### Admin Audit Logs
- [ ] Navigate to `/admin/audit-logs`
- [ ] Verify page loads without white screen
- [ ] Verify loading state appears
- [ ] Verify audit logs display
- [ ] Verify error state if API fails

### Admin System (Diagnostics)
- [ ] Navigate to `/admin/system`
- [ ] Verify page loads without white screen
- [ ] Verify loading state appears
- [ ] Verify "Diagnostics" section displays:
  - [ ] Frontend Version
  - [ ] API Base URL
  - [ ] Tenant ID
  - [ ] Logged-in User (email and role)
- [ ] Verify "Backend Ping Test" section displays
- [ ] Click "Ping Backend" button
- [ ] Verify ping result displays (success/failure, response time, timestamp)
- [ ] Verify "Health Checks" section displays (API Gateway, Database, Authentication)
- [ ] Verify "System Information" section displays (Uptime, Environment)
- [ ] Click "Refresh" button
- [ ] Verify system status updates

### Admin Settings
- [ ] Navigate to `/admin/settings`
- [ ] Verify page loads without white screen
- [ ] Verify loading state appears
- [ ] Verify settings form/options display
- [ ] Verify error state if API fails

---

## Utility Routes

### Query Builder (Dot Walking)
- [ ] Navigate to `/dotwalking`
- [ ] Verify page loads without white screen
- [ ] Verify loading state appears
- [ ] Verify query builder interface displays
- [ ] Verify error state if API fails

---

## Error Handling & Edge Cases

### 404 Errors
- [ ] Navigate to `/nonexistent-route`
- [ ] Verify appropriate 404 page or redirect

### Network Errors
- [ ] Disconnect network (or block API in DevTools)
- [ ] Navigate to any page that requires API calls
- [ ] Verify error state displays (not white screen)
- [ ] Verify retry button works (if available)

### API Timeouts
- [ ] Simulate slow network in DevTools
- [ ] Navigate to pages with API calls
- [ ] Verify loading state displays during wait
- [ ] Verify timeout error handling

### Empty States
- [ ] Navigate to pages with no data
- [ ] Verify empty state messages display (not white screen)
- [ ] Verify empty state is user-friendly

### Unauthorized Access
- [ ] Log in as regular user
- [ ] Try to access `/admin/*` routes
- [ ] Verify access denied message (not white screen)
- [ ] Try to access role-restricted routes
- [ ] Verify access denied message

---

## Browser Console Checks

- [ ] Open browser DevTools Console
- [ ] Navigate through all major routes
- [ ] Verify no uncaught JavaScript errors
- [ ] Verify no 404 errors for missing assets
- [ ] Verify no CORS errors
- [ ] Verify no authentication errors (except for unauthorized routes)

---

## Network Tab Checks

- [ ] Open browser DevTools Network tab
- [ ] Navigate through major routes
- [ ] Verify API calls include `Authorization` header
- [ ] Verify API calls include `x-tenant-id` header (where required)
- [ ] Verify API endpoints match expected paths (no legacy prefixes)
- [ ] Verify no failed API calls (except for intentional error tests)

---

## Summary Checklist

### Critical Issues (Must Fix)
- [ ] No white screens on any route
- [ ] All routes load without JavaScript errors
- [ ] Authentication works correctly
- [ ] Diagnostics page (`/admin/system`) displays all required information
- [ ] Backend ping test works

### Important Issues (Should Fix)
- [ ] All pages have loading states
- [ ] All pages have error states
- [ ] All pages have empty states (where applicable)
- [ ] API calls use correct endpoints
- [ ] Tenant headers are correctly applied

### Nice to Have (Can Fix Later)
- [ ] All lint warnings resolved
- [ ] All pages have consistent UI patterns
- [ ] Breadcrumb navigation works correctly
- [ ] All menu items are accessible

---

## Notes

- Test with both admin and regular user accounts
- Test with different tenant IDs if multi-tenant is enabled
- Document any issues found with screenshots if possible
- Note any API endpoint mismatches or missing endpoints
- Note any routes that are hidden or deprecated

---

## Test Results

**Tester:** _________________  
**Date:** _________________  
**Environment:** Staging (http://46.224.99.150)  
**Browser:** _________________  
**OS:** _________________

### Issues Found

| Route | Issue | Severity | Status |
|-------|-------|----------|--------|
|       |       |          |        |

### Overall Status

- [ ] ✅ All critical checks passed
- [ ] ⚠️ Some issues found (see above)
- [ ] ❌ Critical issues found (see above)

---

## Sign-off

**Approved for Production:** ☐ Yes ☐ No  
**Approved By:** _________________  
**Date:** _________________
