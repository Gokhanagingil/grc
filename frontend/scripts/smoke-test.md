# Frontend Smoke Test Script

This document provides a manual QA checklist for verifying the frontend application works correctly with the backend API.

## Prerequisites

1. Backend server running on `http://localhost:3002` (NestJS)
2. Frontend server running on `http://localhost:3000`
3. Database with demo admin user seeded

## Test Credentials

- **Email:** admin@grc-platform.local
- **Password:** TestPassword123!

## Smoke Test Checklist

### 1. Login Flow

- [ ] Navigate to `http://localhost:3000/login`
- [ ] Verify login form displays correctly
- [ ] Enter valid credentials (email and password)
- [ ] Click "Sign In" button
- [ ] Verify successful redirect to `/dashboard`
- [ ] Verify user info is displayed in the header/sidebar

### 2. Error Handling

- [ ] Navigate to `http://localhost:3000/login`
- [ ] Enter invalid credentials
- [ ] Verify error message displays in standard format
- [ ] Verify error message is user-friendly

### 3. Dashboard Access

- [ ] After login, verify dashboard loads
- [ ] Verify no console errors in browser developer tools
- [ ] Verify API calls return standard response envelope format

### 4. GRC Module Access

- [ ] Navigate to Risk Management page
- [ ] Verify risks list loads with pagination
- [ ] Verify pagination meta is present (total, page, pageSize)
- [ ] Navigate to Policies page
- [ ] Verify policies list loads correctly
- [ ] Navigate to Requirements page
- [ ] Verify requirements list loads correctly

### 5. Logout Flow

- [ ] Click logout button
- [ ] Verify redirect to login page
- [ ] Verify token is cleared from localStorage
- [ ] Verify protected routes redirect to login

## Expected API Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "total": 100,
    "page": 1,
    "pageSize": 20,
    "totalPages": 5
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

## Troubleshooting

### Login fails with network error
- Check if backend is running on correct port
- Check CORS configuration
- Check `REACT_APP_API_URL` environment variable

### API calls return 401
- Check if token is stored in localStorage
- Check if Authorization header is being sent
- Try logging out and logging in again

### API calls return 400 (missing tenant ID)
- Check if tenantId is stored in localStorage
- Check if x-tenant-id header is being sent
- Verify user has a valid tenant assigned

## Notes

This is a manual QA script. Automated E2E tests are available in the backend test suite.
