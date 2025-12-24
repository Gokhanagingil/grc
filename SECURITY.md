# Security Policy

This document outlines the security practices, vulnerability reporting process, and secrets management guidelines for the GRC Platform.

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly:

1. **Do NOT create a public GitHub issue** for security vulnerabilities.
2. Contact the security team directly via email or the team's secure communication channel.
3. Provide a detailed description of the vulnerability, including steps to reproduce.
4. Allow reasonable time for the issue to be addressed before any public disclosure.

We aim to acknowledge vulnerability reports within 48 hours and provide a timeline for remediation.

## Secrets and Credentials Policy

### Never Commit Secrets

The following must NEVER be committed to this repository:

- Passwords or passphrases
- API keys or tokens
- Private keys or certificates
- Database credentials
- JWT secrets
- Any environment-specific sensitive values

### Where to Store Secrets

- **Local Development:** Use `.env` files (which are gitignored)
- **Staging/Production:** Use the team password manager or a secrets management service (e.g., AWS Secrets Manager, HashiCorp Vault)
- **CI/CD:** Use GitHub Secrets or your CI provider's secure environment variables

### If You Accidentally Commit a Secret

1. **Immediately rotate the exposed credential** - assume it has been compromised.
2. Remove the secret from the repository history using `git filter-branch` or BFG Repo-Cleaner.
3. Force push the cleaned history (coordinate with the team first).
4. Notify the Release Captain and security team.

## Secret Rotation Guidelines

Regular rotation of secrets reduces the impact of potential compromises:

| Secret Type | Recommended Rotation Frequency |
|-------------|-------------------------------|
| JWT Secrets | Every 90 days |
| Database Passwords | Every 90 days |
| API Keys | Every 90 days or on personnel changes |
| Service Account Credentials | Every 90 days |

### Rotation Checklist

1. Generate new credentials in the secrets manager.
2. Update the application configuration to use new credentials.
3. Verify the application works with new credentials.
4. Revoke or disable old credentials.
5. Document the rotation in the security log.

## Supported Versions

We provide security updates for the following versions:

| Version | Supported |
|---------|-----------|
| Latest main branch | Yes |
| Previous releases | Best effort |

## Security Best Practices

### For Developers

- Never log sensitive information (passwords, tokens, PII).
- Use parameterized queries to prevent SQL injection.
- Validate and sanitize all user inputs.
- Keep dependencies updated and run `npm audit` regularly.
- Use HTTPS for all external communications.
- Follow the principle of least privilege for access controls.

### For Reviewers

- Check PRs for accidentally committed secrets.
- Verify that new environment variables are documented in `.env.example`.
- Ensure sensitive operations have proper authorization checks.
- Look for hardcoded credentials or configuration values.

## Security Headers

The application implements the following security headers via Helmet.js:

- Content-Security-Policy
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection
- Strict-Transport-Security (in production)

## Rate Limiting

The API implements rate limiting to prevent abuse:

- Default: 100 requests per 60 seconds
- Strict endpoints: 10 requests per 60 seconds
- Authentication endpoints have additional brute-force protection

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [NestJS Security Documentation](https://docs.nestjs.com/security/authentication)
