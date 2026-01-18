# Platform Builder Smoke Test

This runbook describes the steps to verify Platform Builder functionality on staging.

## Prerequisites

- Admin user credentials for the staging environment
- Access to staging URL: http://46.224.99.150

## Smoke Test Steps

### 1. Login as Admin

Navigate to the staging URL and log in with admin credentials.

### 2. Navigate to Platform Builder

From the sidebar, go to Admin > Platform Builder. Verify that the tables list loads without errors. If no tables exist yet, you should see an empty state (not "Failed to fetch tables" error).

### 3. Create a New Table

Click the "New" button and fill in the form:
- Table Name: `u_demo_assets` (must start with `u_` and contain only lowercase letters, numbers, and underscores)
- Display Label: `Demo Assets`
- Description: (optional) `Test table for demo assets`
- Active: checked

Click "Create" and verify:
- Success toast appears
- List automatically refreshes
- New table `u_demo_assets` is visible in the list

### 4. Verify Persistence

Refresh the browser page. Verify that `u_demo_assets` is still visible in the tables list.

### 5. (Optional) API Verification

Using curl or browser DevTools, verify the API returns the created table:

```bash
curl -H "Authorization: Bearer <token>" \
     -H "x-tenant-id: <tenant-id>" \
     "http://46.224.99.150/api/grc/admin/tables"
```

The response should include `u_demo_assets` in the items array.

## Expected Results

- Tables list loads successfully (empty state if no tables, list of tables otherwise)
- Table creation succeeds with proper validation
- Created tables persist across page refreshes
- Error messages are specific (401 for auth issues, 403 for permission issues, etc.)

## Troubleshooting

### "Session expired or not authenticated" Error

The JWT token has expired. Log out and log back in.

### "You do not have permission" Error

The admin user may not have `ADMIN_TABLES_READ` or `ADMIN_TABLES_WRITE` permissions. Check user permissions in the admin panel.

### "Resource not found" Error

The Platform Builder API endpoints may not be deployed. Verify the backend is running and the routes are registered.

## Related E2E Tests

Backend E2E tests for Platform Builder are located at:
- `backend-nest/test/platform-builder.e2e-spec.ts`

Run with: `npm run test:e2e -- --testPathPattern=platform-builder`
