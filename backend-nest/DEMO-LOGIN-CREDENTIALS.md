# Demo Login Credentials

This document contains the default demo tenant and user credentials for development and testing.

## Default Tenant

- **ID**: `217492b2-f814-4ba0-ae50-4e4f8ecf6216`
- **Name**: Default Tenant
- **Slug**: default

## Demo Users

### User 1: GRC Admin User
- **Email**: `grc1@local`
- **Password**: `grc1`
- **Display Name**: GRC Admin User
- **Roles**: `admin`, `user`
- **Status**: Active, Email Verified

### User 2: GRC Regular User
- **Email**: `grc2@local`
- **Password**: `grc2`
- **Display Name**: GRC Regular User
- **Roles**: `user`
- **Status**: Active, Email Verified

## Usage

### API Login Example

```bash
POST /api/v2/auth/login
Headers:
  x-tenant-id: 217492b2-f814-4ba0-ae50-4e4f8ecf6216
Body (JSON):
  {
    "email": "grc1@local",
    "password": "grc1"
  }
```

### Expected Response

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "...",
  "user": {
    "id": "...",
    "email": "grc1@local",
    "displayName": "GRC Admin User",
    "roles": ["admin", "user"],
    "mfaEnabled": false,
    "tenantId": "217492b2-f814-4ba0-ae50-4e4f8ecf6216"
  }
}
```

## Seeding

These users are automatically created when running:

```bash
npm run db:reset:dev
```

Or manually:

```bash
npm run seed:dev-users
```

The seed script is idempotent: it can be run multiple times safely. If users already exist, they will be updated to match the canonical model.

