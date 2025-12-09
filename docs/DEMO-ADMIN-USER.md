# Demo Admin User Guide

This document describes the demo admin user for manual testing in development and staging environments.

## Demo Admin Credentials

| Field | Value |
|-------|-------|
| Email | `demo.admin@grc.local` |
| Username | `demo.admin` |
| Password | Set via `DEMO_ADMIN_PASSWORD` environment variable |
| Role | `admin` |

**Recommended password for local development:** `DemoAdmin!2025`

## Permissions

The demo admin user has full administrative access to all GRC Platform features:

- **Dashboard**: View all metrics, KPIs, and analytics
- **Risk Management**: Create, edit, delete, and view all risks
- **Incident Management**: Create, edit, delete, and view all incidents
- **Governance/Policies**: Create, edit, delete, and view all policies
- **Compliance/Requirements**: Create, edit, delete, and view all requirements
- **User Management**: Create, edit, delete, and manage all users
- **Admin Panel**: Access to administrative settings

## Seeding the Demo Admin User

### Local Development

To seed the demo admin user locally:

```bash
cd backend
DEMO_ADMIN_PASSWORD='DemoAdmin!2025' npm run seed:demo-admin
```

Or add `DEMO_ADMIN_PASSWORD=DemoAdmin!2025` to your `.env` file and run:

```bash
npm run seed:demo-admin
```

The script is idempotent - running it multiple times will not create duplicate users. If the user already exists, the script will ensure the role is set to `admin`.

### Staging Environment

The demo admin user can be seeded in staging by setting the environment variable and running:

```bash
DEMO_ADMIN_PASSWORD='YourSecurePassword' npm run seed:demo-admin
```

### Production Environment

By default, the demo admin user is **NOT** seeded in production (`NODE_ENV=production`).

To force seeding in production (not recommended), set both environment variables:

```bash
DEMO_ADMIN_PASSWORD='YourSecurePassword' SEED_DEMO_ADMIN=true npm run seed:demo-admin
```

## Testing the Demo Admin User

### Manual Login Test

1. Start the backend: `cd backend && npm run dev`
2. Start the frontend: `cd frontend && npm start`
3. Navigate to `http://localhost:3000/login`
4. Enter credentials:
   - Username: `demo.admin`
   - Password: `DemoAdmin!2025`
5. Verify you can access all pages including User Management and Admin Panel

### Automated Tests

Run the demo admin smoke tests:

```bash
cd backend
npm test -- demo-admin.test.js
```

The tests verify:
- Login with demo admin credentials works
- `/api/auth/me` returns the correct role and permissions
- Seeding is idempotent (no duplicates created)

## Troubleshooting

### "User already exists" during seeding

This is expected behavior. The seed script is idempotent and will not create duplicates.

### Login fails with "Invalid credentials"

1. Ensure the demo admin user has been seeded: `npm run seed:demo-admin`
2. Check that the user is active in the database
3. Verify you're using the correct password: `DemoAdmin!2025`

### Demo admin doesn't have admin role

Run the seed script again - it will update the role to `admin` if it's different:

```bash
npm run seed:demo-admin
```

## Security Considerations

- The demo admin user should only be used in development and staging environments
- Never use these credentials in production
- The password is intentionally simple for testing purposes
- Consider disabling or removing the demo admin user before deploying to production
