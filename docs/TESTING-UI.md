# UI Testing Guidelines

This document describes the UI testing strategy for the GRC+ITSM platform frontend using Playwright.

## Overview

We use Playwright for end-to-end (E2E) UI tests. These tests run against the real running application (local dev or staging) and validate actual user workflows. Tests are designed to be "smoke-level" - they verify critical navigation and page loading without hard dependency on seeded data (empty state acceptable).

## Strategy

- **Stable Selectors**: All tests use `data-testid` attributes for reliable element selection
- **Smoke Tests First**: Focus on critical navigation and page loading, not complex workflows
- **No Seed Dependency**: Tests should work with empty database (empty state acceptable)
- **CI Integration**: Tests run automatically on push/PR to main/develop branches
- **Retry on Failure**: Tests retry up to 2 times in CI to handle flaky network conditions

## Test ID Naming Convention

We use `data-testid` attributes to provide stable selectors for UI elements in tests. This avoids brittle selectors based on CSS classes or text that may change.

### Naming Patterns

#### Navigation Elements
- Main menu items: `nav-{section}` (e.g., `nav-admin`, `nav-audit`, `nav-dashboard`)
- Admin menu items: `nav-admin-{page}` (e.g., `nav-admin-users`, `nav-admin-audit-logs`)
- Breadcrumbs: `breadcrumb-{level}` (e.g., `breadcrumb-1`, `breadcrumb-2`)

#### Page Headers
- Page title: `page-{section}-title` (e.g., `page-admin-users-title`, `page-audit-logs-title`)
- Page subtitle: `page-{section}-subtitle`

#### Buttons
- Primary actions: `btn-{action}-{entity}` (e.g., `btn-create-user`, `btn-edit-audit`)
- Secondary actions: `btn-{action}` (e.g., `btn-refresh`, `btn-cancel`, `btn-save`)
- Navigation buttons: `btn-back`, `btn-next`

#### Forms
- Form containers: `form-{entity}` (e.g., `form-login`, `form-create-user`)
- Form fields: `input-{field}` (e.g., `input-email`, `input-password`, `input-username`)
- Form submit: `btn-submit-{form}` (e.g., `btn-submit-login`)

#### Tables
- Table container: `table-{entity}` (e.g., `table-users`, `table-audit-logs`)
- Table rows: `table-{entity}-row-{id}` (for specific rows) or use nth-child selectors
- Table actions: `table-action-{action}-{id}` (e.g., `table-action-edit-user-123`)

#### Modals/Dialogs
- Modal container: `modal-{name}` (e.g., `modal-create-user`, `modal-confirm-delete`)
- Modal title: `modal-{name}-title`
- Modal actions: `modal-{name}-btn-{action}` (e.g., `modal-create-user-btn-cancel`)

#### Status Indicators
- Loading states: `loading-{component}` (e.g., `loading-users-table`)
- Error messages: `error-{component}` (e.g., `error-login-form`)
- Success messages: `success-{component}`

#### Coming Soon / Disabled Features
- Disabled sections: `section-{name}-coming-soon` (e.g., `section-tables-coming-soon`)

### Guidelines

1. **Be Descriptive**: Test IDs should clearly indicate what element they represent
2. **Be Consistent**: Use the same patterns across similar elements
3. **Use Kebab Case**: All test IDs use lowercase with hyphens (kebab-case)
4. **Keep It Short**: Test IDs should be concise but descriptive
5. **Group by Component**: Use prefixes to group related elements (e.g., `form-`, `btn-`, `nav-`)

### Examples

```tsx
// Navigation menu item
<ListItemButton data-testid="nav-admin-users">
  <ListItemText primary="Users" />
</ListItemButton>

// Page header
<Typography variant="h4" data-testid="page-admin-users-title">
  User Management
</Typography>

// Primary button
<Button data-testid="btn-create-user" variant="contained">
  Create User
</Button>

// Form input
<TextField
  data-testid="input-email"
  label="Email"
  type="email"
/>

// Table
<Table data-testid="table-users">
  {/* table content */}
</Table>
```

## Test Organization

Tests are organized in the `frontend/e2e` directory:

```
e2e/
  ├── auth.spec.ts       # Authentication tests
  ├── navigation.spec.ts # Navigation tests
  ├── admin.spec.ts      # Admin panel tests
  └── audit.spec.ts      # Audit module tests
```

## Running Tests

### Local Run (Dev Server)

**Prerequisites:**
- Frontend application must be running (default: http://localhost:3000)
- NestJS backend must be running on port 3002 (for E2E tests)
- Test user credentials must be available (see Environment Variables)

**Setup:**
1. Start the NestJS backend: `cd backend-nest && npm run start:dev`
2. Start the frontend: `cd frontend && npm start`
3. Ensure test user exists (default: `admin@grc-platform.local` / `TestPassword123!`)

```bash
# Navigate to frontend directory
cd frontend

# IMPORTANT: Start the dev server with E2E API mode set
# The REACT_APP_ prefix is required for Create React App to embed the variable
REACT_APP_E2E_API_MODE=nest npm start

# In a separate terminal, run E2E tests
npm run test:e2e

# Or use explicit API base URL when starting dev server
REACT_APP_E2E_API_BASE_URL=http://localhost:3002 npm start

# Run E2E tests with UI (headed browser)
npm run test:e2e:ui

# Run a specific test file
npx playwright test e2e/auth.spec.ts

# Run tests in debug mode
npx playwright test --debug
```

**Alternative: Use .env file**

Create a `.env.e2e` file in the `frontend` directory:
```
REACT_APP_E2E_API_MODE=nest
```

Then start the dev server normally:
```bash
npm start
```

### Local Run (Docker)

**Prerequisites:**
- Docker and docker-compose installed
- Services running via `docker-compose up`

```bash
# Start services (if not already running)
docker-compose up -d

# Run E2E tests against dockerized services
cd frontend
# Set REACT_APP_E2E_API_MODE when starting dev server (if running separately)
# Or ensure docker-compose sets the environment variable
E2E_BASE_URL=http://localhost:3000 npm run test:e2e
```

### Run Against Staging

**Prerequisites:**
- Staging environment accessible at http://46.224.99.150
- Valid test credentials for staging

```bash
# Navigate to frontend directory
cd frontend

# Run tests against staging (uses staging project with higher timeouts)
# Note: Staging app is already built, so REACT_APP_* vars are baked in
# The staging build should have REACT_APP_E2E_API_MODE=nest set at build time
E2E_BASE_URL=http://46.224.99.150 npx playwright test --project=staging

# Or use the default project
E2E_BASE_URL=http://46.224.99.150 npm run test:e2e

# Run specific test against staging
E2E_BASE_URL=http://46.224.99.150 npx playwright test e2e/admin.spec.ts --project=staging
```

**Note:** 
- Staging uses NestJS backend via reverse proxy
- The staging build should be configured with `REACT_APP_E2E_API_MODE=nest` at build time
- The frontend automatically detects staging URL and uses the correct API base (same origin, no `/api` prefix)

### CI/CD

Tests run automatically in CI on every push and PR to `main` or `develop` branches. The CI configuration:
- Runs tests in headless mode
- Retries failed tests up to 2 times
- Generates HTML reports with screenshots/videos on failure
- Uploads reports as artifacts (retained for 30 days)
- Uses GitHub Actions secrets for test credentials (E2E_BASE_URL, E2E_EMAIL, E2E_PASSWORD)

**Workflow Location:** `.github/workflows/e2e-tests.yml`

## Environment Variables

Tests use the following environment variables:

### Frontend Base URL
- `E2E_BASE_URL`: Base URL of the running frontend application (default: `http://localhost:3000`)
  - For staging: `http://46.224.99.150`
  - For local dev: `http://localhost:3000`

### API Configuration
- `REACT_APP_E2E_API_MODE`: API mode for E2E tests - `"nest"` or `"express"` (default: not set, uses Express)
  - Set to `"nest"` to use NestJS backend (port 3002) for E2E tests
  - **Must use REACT_APP_ prefix** - this is embedded at build time by Create React App
  - **Recommended:** Always use `REACT_APP_E2E_API_MODE=nest` for E2E tests
  - Set this when starting the dev server: `REACT_APP_E2E_API_MODE=nest npm start`
- `REACT_APP_E2E_API_BASE_URL`: Explicit API base URL override (highest priority)
  - Example: `REACT_APP_E2E_API_BASE_URL=http://localhost:3002`
  - If set, overrides all other API URL resolution logic
  - Must use REACT_APP_ prefix for build-time embedding

### Authentication
- `E2E_EMAIL`: Test user email for authentication (default: `admin@grc-platform.local`)
- `E2E_PASSWORD`: Test user password (default: `TestPassword123!`)

**Note:** In CI, these values can be set as GitHub Actions secrets. If not set, defaults are used.

## How API Base URL is Selected

The frontend uses a priority-based system to determine the API base URL:

1. **REACT_APP_E2E_API_BASE_URL** (highest priority) - Explicit override for E2E tests
2. **REACT_APP_E2E_API_MODE=nest** - Forces NestJS backend (port 3002 for local, same origin for staging)
3. **REACT_APP_API_URL** - Standard environment variable (used in production builds)
4. **Default** - `http://localhost:3001/api` (Express backend for local dev)

**For E2E Tests:**
- Always set `REACT_APP_E2E_API_MODE=nest` when starting the dev server
- Use REACT_APP_ prefix - these variables are embedded at build time by Create React App
- Staging automatically uses NestJS (same origin, reverse proxy handles routing)
- Local dev requires NestJS on port 3002

**Example API URL Resolution:**
```bash
# Local E2E with NestJS (set when starting dev server)
REACT_APP_E2E_API_MODE=nest npm start
# → API URL: http://localhost:3002

# Staging E2E (staging build has REACT_APP_E2E_API_MODE=nest baked in)
E2E_BASE_URL=http://46.224.99.150 npm run test:e2e
# → API URL: http://46.224.99.150 (same origin, reverse proxy)

# Explicit override (set when starting dev server)
REACT_APP_E2E_API_BASE_URL=http://localhost:3002 npm start
# → API URL: http://localhost:3002
```

**Important:** The NestJS backend does NOT use the `/api` prefix. Endpoints are directly under the base URL (e.g., `/audit-logs`, not `/api/audit-logs`).

## Best Practices

1. **Use test IDs First**: Prefer `data-testid` selectors over text/CSS selectors
2. **Wait for Elements**: Use Playwright's auto-waiting; avoid manual `waitFor` when possible
3. **Assert Meaningfully**: Check actual behavior, not just element presence
4. **Keep Tests Focused**: Each test should verify one user workflow
5. **Handle Async Operations**: Wait for API calls and navigation to complete
6. **Clean Up**: Reset state between tests if needed (e.g., logout)
7. **Use Page Objects Sparingly**: Only for complex, reusable interactions

## Troubleshooting

### Tests Fail Intermittently

- Check if elements are properly loaded before interaction
- Increase timeouts for slow operations
- Verify network requests complete before assertions

### Elements Not Found

- Ensure `data-testid` attributes are present in the component
- Check if element is conditionally rendered
- Verify the correct page/route is loaded

### Authentication Issues

- Verify test credentials in environment variables
- Check if user session expires
- Ensure authentication state is reset between tests

### API Base URL Issues

- **404 errors on API calls**: 
  - Ensure `REACT_APP_E2E_API_MODE=nest` is set when starting the dev server
  - Check that the dev server was started with the correct environment variable
  - Verify NestJS backend is running on port 3002
- **Wrong backend (Express vs NestJS)**: 
  - Check that `REACT_APP_E2E_API_MODE=nest` is set when starting dev server
  - Restart the dev server after changing environment variables (they're embedded at build time)
- **Staging API errors**: 
  - Verify staging reverse proxy is routing correctly to NestJS backend
  - Ensure staging build was created with `REACT_APP_E2E_API_MODE=nest`

## How to Read Playwright Report Artifacts

After test runs, Playwright generates several types of artifacts:

### HTML Report

```bash
# Generate and open HTML report
npx playwright show-report
```

The HTML report includes:
- Test execution timeline
- Screenshots on failure
- Video recordings (if enabled)
- Network request logs
- Console logs
- Trace viewer links

### Artifacts Location

- **HTML Report**: `frontend/playwright-report/index.html`
- **Test Results**: `frontend/test-results/` (screenshots, videos, traces)
- **CI Artifacts**: Available in GitHub Actions workflow runs (retained for 30 days)

### Trace Viewer

For detailed debugging, use the trace viewer:

```bash
# Open trace for a specific test
npx playwright show-trace frontend/test-results/path-to-trace.zip
```

The trace viewer shows:
- Step-by-step execution
- DOM snapshots at each step
- Network requests and responses
- Console logs and errors
- Screenshots at each action

### CI Artifacts

In GitHub Actions:
1. Go to the workflow run
2. Scroll to "Artifacts" section
3. Download `playwright-report` for HTML report
4. Download `playwright-artifacts` for screenshots/videos/traces

### Reading Test Failures

1. **Check the HTML report** for test status and error messages
2. **View screenshots** to see what the page looked like at failure
3. **Watch videos** to see the full test execution
4. **Check network tab** in trace viewer to see API call failures
5. **Review console logs** for JavaScript errors

