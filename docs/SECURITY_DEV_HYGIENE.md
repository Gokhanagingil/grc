# Security & Development Hygiene Guide

This document outlines security best practices and development hygiene standards for the GRC Platform.

## Secrets Management

### Never Commit Secrets

The following file types and patterns should NEVER be committed to the repository:

- `.env` files (except `.env.example` with placeholder values)
- `*.pem`, `*.key`, `*.crt` (private keys and certificates)
- `credentials.json`, `secrets.json`
- Files containing API keys, tokens, or passwords
- Database connection strings with passwords

### Pre-Commit Checklist

Before committing code, verify:

- [ ] No hardcoded passwords or API keys
- [ ] No `.env` files in staged changes
- [ ] No private keys or certificates
- [ ] No database credentials in code
- [ ] No JWT secrets in code
- [ ] No cloud provider credentials

### Environment Variables

All secrets should be passed via environment variables:

```bash
# Good - using environment variables
JWT_SECRET=${JWT_SECRET}
DB_PASSWORD=${DB_PASSWORD}

# Bad - hardcoded secrets
JWT_SECRET=my-super-secret-key
DB_PASSWORD=postgres123
```

### Secret Rotation

Rotate secrets on the following schedule:

| Secret Type | Rotation Frequency |
|-------------|-------------------|
| JWT Secret | Quarterly |
| Database Password | Quarterly |
| API Keys | Annually |
| Service Accounts | Annually |

## Code Security

### Input Validation

Always validate and sanitize user input:

```typescript
// Good - using class-validator
@IsString()
@MinLength(1)
@MaxLength(255)
title: string;

// Bad - no validation
title: string;
```

### SQL Injection Prevention

Use parameterized queries or ORM methods:

```typescript
// Good - using TypeORM
const user = await userRepository.findOne({ where: { email } });

// Bad - string concatenation
const user = await query(`SELECT * FROM users WHERE email = '${email}'`);
```

### Authentication & Authorization

Every endpoint should:

1. Require authentication (JwtAuthGuard)
2. Validate tenant access (TenantGuard)
3. Check permissions (PermissionsGuard)

```typescript
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Permissions('risk:read')
@Get()
findAll() { ... }
```

### Multi-Tenancy

Always scope queries by tenant:

```typescript
// Good - tenant-scoped query
const risks = await riskRepository.find({
  where: { tenantId, isDeleted: false }
});

// Bad - no tenant scoping
const risks = await riskRepository.find();
```

## Dependency Security

### Vulnerability Scanning

Run security audits regularly:

```bash
# Check for vulnerabilities
npm audit

# Fix automatically where possible
npm audit fix

# Generate detailed report
npm audit --json > audit-report.json
```

### Dependabot

Dependabot is configured to:

- Check for updates weekly (Mondays)
- Group minor and patch updates
- Ignore major version updates for critical packages
- Create PRs for security updates immediately

### Reviewing Dependency Updates

When reviewing Dependabot PRs:

1. Check the changelog for breaking changes
2. Review security advisories if present
3. Run tests locally before merging
4. Verify CI passes

## CI/CD Security

### GitHub Actions Security

- Use specific action versions (not `@latest`)
- Minimize permissions in workflow files
- Never log secrets in CI output
- Use GitHub Secrets for sensitive values

### CodeQL Analysis

CodeQL runs automatically on:

- Push to main branch
- Pull requests to main
- Weekly scheduled scan (Sundays)

Review CodeQL alerts promptly and fix high-severity issues before merging.

### Secret Scanning

GitHub secret scanning is enabled to detect:

- API keys
- OAuth tokens
- Private keys
- Database credentials

If a secret is detected:

1. Immediately rotate the compromised secret
2. Review git history for exposure duration
3. Check for unauthorized access
4. Update the secret in all environments

## Development Practices

### Code Review Checklist

Security items to check during code review:

- [ ] No hardcoded secrets
- [ ] Input validation present
- [ ] SQL injection prevention
- [ ] Authentication/authorization guards
- [ ] Tenant scoping in queries
- [ ] Error messages don't leak sensitive info
- [ ] Logging doesn't include sensitive data

### Logging Best Practices

```typescript
// Good - no sensitive data
logger.log(`User ${userId} logged in`);

// Bad - logging sensitive data
logger.log(`User ${email} logged in with password ${password}`);
```

### Error Handling

```typescript
// Good - generic error message
throw new UnauthorizedException('Invalid credentials');

// Bad - revealing internal details
throw new UnauthorizedException(`User ${email} not found in database`);
```

## Security Tools

### Local Security Checks

Run these commands before pushing:

```bash
# Check for secrets in staged files
git diff --cached --name-only | xargs grep -l -E "(password|secret|api_key|token)" || true

# Run npm audit
cd backend-nest && npm audit

# Run ESLint security rules
npm run lint
```

### Recommended VS Code Extensions

- ESLint (security rules)
- GitLens (review history)
- dotenv (syntax highlighting for .env files)

## Incident Response

### If a Secret is Exposed

1. **Immediate**: Rotate the secret
2. **Within 1 hour**: Update all environments
3. **Within 24 hours**: Review access logs
4. **Within 1 week**: Post-mortem and process improvement

### Reporting Security Issues

Report security vulnerabilities to:

- Internal: Platform Team Lead
- External: security@grc-platform.local (if applicable)

Do NOT create public GitHub issues for security vulnerabilities.

## Compliance

### Data Protection

- PII must be encrypted at rest
- Use HTTPS for all external communication
- Implement data retention policies
- Support data export/deletion requests

### Audit Trail

All sensitive operations should be logged:

- User authentication events
- Permission changes
- Data modifications
- Admin actions

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [NestJS Security](https://docs.nestjs.com/security/authentication)
- [TypeORM Security](https://typeorm.io/security)
