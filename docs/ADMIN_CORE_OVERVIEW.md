# Admin Core Overview

## Introduction

This document describes the Admin Core capabilities added in FAZ 3 of the GRC Platform. The Admin Core provides system administrators with visibility into authentication modes, security posture, and system health without exposing sensitive information or allowing destructive actions.

## Admin System Visibility

### Overview

The Admin System page (`/admin/system`) provides a comprehensive view of the platform's operational and security status. This page is accessible only to users with `ADMIN_SETTINGS_READ` permission.

### Capabilities

#### 1. Authentication Modes

Administrators can view the current authentication configuration:

| Feature | Visibility | Configurable |
|---------|------------|--------------|
| Local Authentication | Always shown as enabled | No (always enabled) |
| MFA Available | Yes | No (always available) |
| LDAP Enabled | Yes | Yes (via LDAP config) |
| LDAP Host | Yes (if configured) | Yes (via LDAP config) |

#### 2. MFA Status

Real-time MFA adoption metrics:

| Metric | Description |
|--------|-------------|
| Users with MFA Enabled | Count of users who have enabled MFA |
| Total Users | Total user count for percentage calculation |
| MFA Enforced for Admins | Whether admin users are required to use MFA |
| MFA Enforced for All | Whether all users are required to use MFA |

#### 3. LDAP Status

LDAP integration status:

| Metric | Description |
|--------|-------------|
| Configured | Whether LDAP configuration exists |
| Enabled | Whether LDAP authentication is active |
| Last Connection Test | Timestamp of last connection test |
| Connection Status | Result of last connection test |

#### 4. Security Settings

Current security configuration:

| Setting | Description | Default |
|---------|-------------|---------|
| Password Min Length | Minimum password length | 8 |
| Require Uppercase | Password must contain uppercase | false |
| Require Lowercase | Password must contain lowercase | false |
| Require Number | Password must contain number | false |
| Require Special | Password must contain special char | false |
| Session Timeout | Session timeout in minutes | 60 |

#### 5. System Health

Backend health monitoring:

| Check | Endpoint | Description |
|-------|----------|-------------|
| API Gateway | `/health/live` | Backend API availability |
| Database | `/health/db` | Database connectivity |
| Authentication | `/health/auth` | Auth service status |

### What Is NOT Exposed

The following information is intentionally not exposed in the Admin System page:

- **Secret Values**: No passwords, API keys, encryption keys, or tokens
- **LDAP Bind Password**: Never displayed, even to admins
- **MFA Secrets**: User TOTP secrets are never exposed
- **Recovery Codes**: Only shown once during generation
- **Internal Configuration**: Database connection strings, JWT secrets

### What Is NOT Configurable

The Admin System page is read-only. The following actions are not available:

- **Destructive Actions**: No delete, reset, or purge operations
- **Direct Configuration**: Settings are changed via dedicated admin pages
- **User Impersonation**: No ability to act as another user
- **Audit Log Modification**: Audit logs are immutable

## API Endpoints

### Security Posture

```
GET /admin/system/security-posture
```

Returns the current security posture for the tenant:

```json
{
  "authentication": {
    "localAuthEnabled": true,
    "mfaAvailable": true,
    "ldapEnabled": false,
    "ldapHost": null
  },
  "mfaStatus": {
    "usersWithMfaEnabled": 5,
    "totalUsers": 20,
    "mfaEnforcedForAdmins": true,
    "mfaEnforcedForAll": false
  },
  "ldapStatus": {
    "configured": false,
    "enabled": false,
    "lastConnectionTest": null,
    "lastConnectionStatus": null
  },
  "securitySettings": {
    "passwordMinLength": 12,
    "passwordRequireUppercase": true,
    "passwordRequireLowercase": true,
    "passwordRequireNumber": true,
    "passwordRequireSpecial": false,
    "sessionTimeoutMinutes": 60
  }
}
```

### Authentication Modes

```
GET /admin/system/auth-modes
```

Returns a summary of active authentication modes:

```json
{
  "modes": ["local", "mfa_enforced"],
  "primary": "local",
  "fallback": null
}
```

## Admin UI Components

### AdminSystem Page

Location: `frontend/src/pages/admin/AdminSystem.tsx`

The AdminSystem page displays:

1. **Overall System Status**: Health indicator (healthy/degraded/unhealthy)
2. **Health Checks**: Individual service status cards
3. **System Information**: Version, API URL, uptime, environment
4. **Tenant Diagnostics**: Current tenant ID, header injection status
5. **Security Posture**: Authentication modes and MFA status (FAZ 3)

### Security Posture Section (FAZ 3)

New section added in FAZ 3 displaying:

- Authentication modes summary
- MFA adoption metrics
- LDAP integration status
- Security settings overview

## i18n Support

Admin Core screens use translation keys for all user-facing text. Translation keys are defined in `frontend/src/i18n/keys.ts`.

### Translation Key Structure

```typescript
ADMIN_SECURITY_KEYS = {
  securityPosture: {
    title: 'admin.security.posture.title',
    subtitle: 'admin.security.posture.subtitle',
  },
  authentication: {
    title: 'admin.security.authentication.title',
    localAuth: 'admin.security.authentication.local_auth',
    mfaAvailable: 'admin.security.authentication.mfa_available',
    ldapEnabled: 'admin.security.authentication.ldap_enabled',
  },
  mfa: {
    title: 'admin.security.mfa.title',
    usersWithMfa: 'admin.security.mfa.users_with_mfa',
    enforcedForAdmins: 'admin.security.mfa.enforced_for_admins',
    enforcedForAll: 'admin.security.mfa.enforced_for_all',
  },
  ldap: {
    title: 'admin.security.ldap.title',
    configured: 'admin.security.ldap.configured',
    enabled: 'admin.security.ldap.enabled',
  },
  settings: {
    title: 'admin.security.settings.title',
    passwordPolicy: 'admin.security.settings.password_policy',
  },
}
```

### Default English Translations

All translation keys have English defaults defined in `ADMIN_SECURITY_EN`. The `t()` function returns the English translation or the key if not found.

## Permission Requirements

| Endpoint | Required Permission |
|----------|---------------------|
| `GET /admin/system/security-posture` | `ADMIN_SETTINGS_READ` |
| `GET /admin/system/auth-modes` | `ADMIN_SETTINGS_READ` |

## Future Enhancements (Deferred)

The following features are intentionally deferred to future phases:

1. **Configuration UI**: Direct configuration of security settings from Admin System page
2. **Real-time Monitoring**: WebSocket-based live updates
3. **Alert Configuration**: Threshold-based security alerts
4. **Compliance Reports**: Automated security compliance reporting
5. **Language Switcher**: UI for changing display language
