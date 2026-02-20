# Security and Identity Overview

## Introduction

This document provides a comprehensive overview of the authentication, authorization, and identity management capabilities implemented in FAZ 3 of the GRC Platform. The platform now supports enterprise-grade security features including Multi-Factor Authentication (MFA), LDAP/Active Directory integration, and hardened Role-Based Access Control (RBAC).

## Authentication Modes

The GRC Platform supports three authentication modes that can work together:

### 1. Local Authentication (Always Enabled)

Local authentication is the default and always-available authentication method. Users authenticate with email and password stored in the platform's database.

**Features:**
- Email/password authentication
- Secure password hashing with bcrypt
- Brute force protection (5 attempts, exponential backoff 1s-60s)
- JWT-based session management with access and refresh tokens
- Automatic token refresh with request queuing

**Endpoints:**
- `POST /auth/login` - Authenticate user
- `POST /auth/refresh` - Refresh access token
- `GET /auth/me` - Get current user profile

### 2. Multi-Factor Authentication (MFA)

TOTP-based MFA adds a second layer of security to user authentication. MFA is opt-in per user but can be enforced by administrators.

**Features:**
- TOTP (Time-based One-Time Password) implementation
- Per-user MFA enable/disable
- Admin enforcement for admin users or all users
- Secure secret storage (AES-256-CBC encrypted)
- Recovery codes (10 codes, 8-character hex, bcrypt hashed)
- QR code generation for authenticator app setup

**Configuration:**
- TOTP Algorithm: SHA1
- TOTP Digits: 6
- TOTP Period: 30 seconds
- Secret Length: 20 bytes
- Time Step Drift Tolerance: 1 step (±30 seconds)

**Endpoints:**
- `POST /auth/mfa/setup` - Initialize MFA setup (returns QR code and secret)
- `POST /auth/mfa/verify-setup` - Verify and enable MFA
- `POST /auth/mfa/verify` - Verify MFA code during login
- `POST /auth/mfa/disable` - Disable MFA for user
- `GET /auth/mfa/recovery-codes` - Generate new recovery codes

**MFA Login Flow:**
1. User submits email/password to `/auth/login`
2. If MFA is enabled, response includes `mfaRequired: true` and `mfaToken`
3. User submits TOTP code with `mfaToken` to `/auth/mfa/verify`
4. On success, full access token is returned

### 3. LDAP/Active Directory Integration

LDAP integration allows users to authenticate against an external directory service. This is config-driven and disabled by default.

**Features:**
- Config-driven (disabled by default)
- Support for LDAP host, bind DN/password, base DN
- User authentication against LDAP
- LDAP group to platform role mapping
- Fallback to local auth when LDAP disabled or unavailable
- Connection testing capability

**Configuration (per tenant):**
- `host`: LDAP server hostname
- `port`: LDAP server port (default: 389, LDAPS: 636)
- `bindDn`: Bind DN for LDAP queries
- `bindPassword`: Bind password (encrypted at rest)
- `baseDn`: Base DN for user searches
- `userSearchFilter`: Filter for finding users (default: `(uid={username})`)
- `useSsl`: Enable SSL/TLS
- `allowLocalFallback`: Allow local auth when LDAP fails

**Endpoints:**
- `GET /auth/ldap/config` - Get LDAP configuration (admin only)
- `PUT /auth/ldap/config` - Update LDAP configuration (admin only)
- `POST /auth/ldap/test` - Test LDAP connection (admin only)
- `GET /auth/ldap/group-mappings` - Get group-to-role mappings
- `PUT /auth/ldap/group-mappings` - Update group-to-role mappings

## How Authentication Modes Interact

The authentication modes work together in a layered approach:

1. **Primary Authentication**: Either local or LDAP (based on configuration)
2. **Secondary Authentication**: MFA challenge (if enabled for user)
3. **Fallback**: Local auth when LDAP is unavailable (if configured)

**Authentication Flow:**
```
User Login Request
       │
       ▼
┌─────────────────┐
│ LDAP Enabled?   │
└────────┬────────┘
    Yes  │  No
         │
    ▼    ▼
┌────────┐ ┌────────┐
│  LDAP  │ │ Local  │
│  Auth  │ │  Auth  │
└────┬───┘ └────┬───┘
     │          │
     │  Fallback│
     ▼          ▼
┌─────────────────┐
│ MFA Enabled?    │
└────────┬────────┘
    Yes  │  No
         │
    ▼    ▼
┌────────┐ ┌────────┐
│  MFA   │ │ Return │
│Challenge│ │ Token  │
└────┬───┘ └────────┘
     │
     ▼
┌─────────────────┐
│ Return Token    │
└─────────────────┘
```

## Security Boundaries

### Tenant Isolation

Every security feature respects tenant boundaries:
- MFA settings are per-user within a tenant
- LDAP configuration is per-tenant
- Security settings are per-tenant
- Audit logs include tenant context

**Enforcement:**
- `TenantGuard` validates `x-tenant-id` header on every request
- All queries automatically scoped to tenant
- Cross-tenant access is strictly forbidden

### Role-Based Access Control (RBAC)

The platform implements a comprehensive RBAC system with 58 granular permissions mapped to 3 roles:

**Roles:**
- `ADMIN`: Full access to all features including admin settings
- `MANAGER`: Full GRC and ITSM read/write access
- `USER`: Read-only access to GRC and ITSM data

**Permission Categories:**
- GRC permissions (risks, controls, policies, requirements, issues, CAPAs, evidence)
- ITSM permissions (incidents, problems, changes)
- Admin permissions (users, roles, settings, audit logs, tenants)

**Guard Pipeline:**
```
Request → JwtAuthGuard → TenantGuard → PermissionsGuard → Controller
```

### Security Settings (Per Tenant)

Administrators can configure security settings per tenant:
- MFA enforcement (for admins only or all users)
- Password policy (min length, complexity requirements)
- Session timeout
- LDAP configuration

## Audit Logging

All security-relevant actions are logged to the audit system:

**Logged Events:**
- Login success/failure
- MFA enable/disable
- MFA challenge success/failure
- LDAP authentication attempts
- Role/permission changes
- User creation/modification/deletion

**Audit Record Fields:**
- `userId`: User performing the action
- `tenantId`: Tenant context
- `action`: Action type (e.g., `LOGIN_SUCCESS`, `MFA_ENABLED`)
- `timestamp`: When the action occurred
- `result`: Success or failure
- `metadata`: Additional context (IP address, user agent, etc.)

## Security Best Practices

### For Administrators

1. **Enable MFA enforcement** for all admin users
2. **Configure LDAP** for enterprise environments
3. **Review audit logs** regularly for suspicious activity
4. **Set strong password policies** (min 12 characters, complexity)
5. **Configure session timeouts** appropriate for your security requirements

### For Developers

1. **Always use guards** on protected endpoints
2. **Never bypass tenant isolation**
3. **Log security events** using the audit service
4. **Encrypt sensitive data** at rest (MFA secrets, LDAP passwords)
5. **Validate all input** before processing

## Configuration Reference

### Environment Variables

```bash
# JWT Configuration
JWT_SECRET=your-secret-key
JWT_EXPIRATION=24h
REFRESH_TOKEN_SECRET=your-refresh-secret
REFRESH_TOKEN_EXPIRATION=7d

# MFA Configuration (optional)
MFA_ENCRYPTION_KEY=your-mfa-encryption-key  # Falls back to JWT_SECRET

# LDAP Configuration (per-tenant, stored in database)
# No environment variables - configured via admin API
```

### Database Tables

**MFA Tables:**
- `user_mfa_settings`: Per-user MFA configuration
- `user_mfa_recovery_codes`: Hashed recovery codes
- `tenant_security_settings`: Tenant-level security configuration

**LDAP Tables:**
- `tenant_ldap_config`: Per-tenant LDAP configuration
- `ldap_group_role_mapping`: LDAP group to platform role mappings

## Deferred Features

The following features are intentionally deferred to future phases:

- SMS/push/hardware key MFA methods
- OAuth/SAML external IdP integration
- Complex LDAP sync/provisioning logic
- UI-heavy LDAP management screens
- Language switcher UI for i18n
