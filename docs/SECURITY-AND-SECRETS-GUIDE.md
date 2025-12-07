# Security and Secrets Guide

This document describes the security practices and secrets management for the GRC Platform.

## Overview

The GRC Platform handles sensitive governance, risk, and compliance data. This guide ensures that secrets are properly managed and security best practices are followed.

## Secrets Management

### Environment Files

The project uses environment files for configuration. Here's the hierarchy:

| File | Purpose | Tracked in Git | Contains Real Secrets |
|------|---------|----------------|----------------------|
| `.env` | Local overrides | No | Yes (local only) |
| `.env.example` | Template with documentation | Yes | No (placeholders) |
| `.env.development` | Development defaults | Yes | No (dev-only values) |
| `.env.test` | Test environment | Yes | No (test-only values) |
| `.env.production.template` | Production template | Yes | No (placeholders) |

### Secret Categories

1. **JWT Secret** (`JWT_SECRET`)
   - Used for signing and verifying JWT tokens
   - Must be at least 32 characters
   - Generate with: `openssl rand -base64 32`
   - Never commit production values

2. **Database Credentials** (`DB_PASSWORD`)
   - PostgreSQL connection password
   - Use strong, unique passwords in production
   - Consider using managed database services (AWS RDS, Azure Database)

3. **Demo Credentials** (`DEMO_ADMIN_EMAIL`, `DEMO_ADMIN_PASSWORD`)
   - Used for initial setup and testing
   - Change or disable in production
   - Never use default values in production

### Local Development

For local development:

1. Copy the example file:
   ```bash
   cp backend-nest/.env.example backend-nest/.env
   ```

2. Update values as needed (the defaults work for local development)

3. Never commit your local `.env` file

### Production Deployment

For production:

1. Use the production template as a reference:
   ```bash
   cat backend-nest/.env.production.template
   ```

2. Set all secrets via environment variables or a secrets manager

3. Never commit production secrets to version control

4. Use a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.) for production

## CI/CD Security

### GitHub Actions Secrets

The CI pipeline uses GitHub Secrets for sensitive values. Required secrets:

| Secret Name | Description | Required For |
|-------------|-------------|--------------|
| `JWT_SECRET` | JWT signing key for tests | E2E tests |
| `DB_PASSWORD` | Database password | E2E tests |

To set up GitHub Secrets:

1. Go to repository Settings > Secrets and variables > Actions
2. Click "New repository secret"
3. Add each required secret

### CI Security Scanning

The CI pipeline includes a security audit job that runs `npm audit`:

```yaml
security-audit:
  name: Security Audit
  runs-on: ubuntu-latest
  steps:
    - name: Run npm audit
      run: npm audit --audit-level=high || true
```

Current status: Report-only mode (does not fail builds)

Future improvements:
- Remove `|| true` to fail builds on high/critical vulnerabilities
- Add SAST (Static Application Security Testing) tools
- Add dependency scanning with Dependabot

## Security Best Practices

### Authentication

1. **Password Hashing**
   - Passwords are hashed using bcrypt with 10 salt rounds
   - Never store plaintext passwords
   - Never log passwords

2. **JWT Tokens**
   - Tokens expire after 24 hours (configurable)
   - Use HTTPS in production to protect tokens in transit
   - Store tokens securely on the client (httpOnly cookies preferred)

3. **Brute Force Protection**
   - BruteForceService limits login attempts
   - Configurable lockout thresholds
   - IP-based rate limiting

### Authorization

1. **Role-Based Access Control (RBAC)**
   - Roles: admin, manager, user
   - Guards enforce role requirements on endpoints
   - Tenant isolation prevents cross-tenant data access

2. **Tenant Isolation**
   - All data is scoped to tenant context
   - x-tenant-id header required for tenant-specific operations
   - Backend validates tenant membership

### Data Protection

1. **Soft Deletes**
   - Data is soft-deleted (marked as deleted, not removed)
   - Preserves audit trail
   - Can be restored if needed

2. **Audit Logging**
   - All significant actions are logged
   - Logs include user, action, timestamp, IP address
   - Audit logs are immutable

### Network Security

1. **CORS Configuration**
   - Strict origin validation in production
   - Only allow known frontend domains
   - No wildcards in production

2. **HTTPS**
   - Always use HTTPS in production
   - Configure TLS certificates properly
   - Use HSTS headers

## Security Checklist

### Before Deployment

- [ ] All secrets are set via environment variables or secrets manager
- [ ] JWT_SECRET is strong and unique (at least 32 characters)
- [ ] Database credentials are strong and unique
- [ ] Demo credentials are changed or disabled
- [ ] CORS_ORIGINS only includes production domains
- [ ] DB_SYNC is set to false (use migrations)
- [ ] HTTPS is configured
- [ ] Rate limiting is enabled

### Regular Maintenance

- [ ] Run `npm audit` regularly
- [ ] Update dependencies to patch vulnerabilities
- [ ] Review audit logs for suspicious activity
- [ ] Rotate secrets periodically
- [ ] Review and update access controls

## Vulnerability Reporting

If you discover a security vulnerability:

1. Do NOT create a public GitHub issue
2. Contact the security team directly
3. Provide detailed information about the vulnerability
4. Allow time for the issue to be addressed before disclosure

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NestJS Security](https://docs.nestjs.com/security/authentication)
- [JWT Best Practices](https://auth0.com/blog/jwt-security-best-practices/)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)
