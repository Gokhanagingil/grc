# Environment Variables and Configuration Validation

This document describes the environment variable validation and configuration system for the GRC backend (NestJS).

## Overview

The backend uses a centralized configuration system with validation that ensures:
- **Critical environment variables** are validated at startup (fail-fast)
- **Optional environment variables** have safe defaults
- **No direct `process.env` usage** in application code (except in config files)
- **Type-safe access** to configuration values via `ConfigService`

## Configuration Structure

### Configuration Files

- **`src/config/configuration.ts`**: Maps environment variables to typed configuration object
- **`src/config/validation.ts`**: Validates environment variables using `class-validator`
- **`src/config/index.ts`**: Exports configuration and validation functions

### How It Works

1. **Startup Validation**: When the app starts, `ConfigModule.forRoot()` calls the `validate()` function
2. **Fail-Fast**: If any required environment variable is missing or invalid, the app fails to start with a clear error message
3. **Type-Safe Access**: Services use `ConfigService.get<T>()` with type safety and default values

## Environment Variables

### Critical / Required Variables

These variables **must** be set or the application will fail to start:

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for JWT token signing | `your-secret-key-here` |

### Optional Variables with Defaults

These variables have safe defaults and are optional:

#### Application Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment: `development`, `production`, or `test` |
| `PORT` | `3002` | Port for the NestJS backend |

#### JWT Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_EXPIRES_IN` | `24h` | JWT token expiration time |

#### Database Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `postgres` | PostgreSQL username |
| `DB_PASSWORD` | `postgres` | PostgreSQL password |
| `DB_NAME` | `grc_platform` | PostgreSQL database name |
| `DB_SYNC` | `false` | Enable TypeORM auto-sync (⚠️ NEVER `true` in production) |

#### CORS Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:3001,http://localhost:3002` | Comma-separated list of allowed origins |

#### Audit Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `NEST_AUDIT_LOG_ENABLED` | `true` | Enable/disable audit logging |

#### Demo/Test Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DEMO_ADMIN_EMAIL` | `admin@grc-platform.local` | Demo admin email (used in tests/seeding) |
| `DEMO_ADMIN_PASSWORD` | `TestPassword123!` | Demo admin password (used in tests/seeding) |
| `NEST_API_URL` | `http://localhost:3002` | API base URL (used in smoke tests) |

## Usage in Code

### Accessing Configuration

**✅ Good**: Use `ConfigService` with type safety and defaults:

```typescript
import { ConfigService } from '@nestjs/config';

constructor(private readonly configService: ConfigService) {}

// With default value
const port = configService.get<number>('app.port', 3002);

// Required value (validated at startup)
const jwtSecret = configService.get<string>('jwt.secret');
```

**❌ Bad**: Direct `process.env` access in application code:

```typescript
// Don't do this in services/controllers
const port = process.env.PORT;
```

### Exception: Configuration Files

The only place where `process.env` should be used directly is in:
- `src/config/configuration.ts` (maps env vars to config object)
- `test/setup.ts` (test environment setup)
- Scripts (e.g., `src/scripts/smoke-grc.ts`)

## Validation Rules

### Type Validation

- `NODE_ENV`: Must be one of: `development`, `production`, `test`
- `PORT`: Must be a number >= 1
- `DB_PORT`: Must be a number
- `JWT_SECRET`: Must be a non-empty string

### Startup Behavior

If validation fails, you'll see an error like:

```
Error: Environment validation failed:
JWT_SECRET: JWT_SECRET is required and must not be empty
```

The application will **not start** until all required variables are properly configured.

## Null Safety and Optional Dependencies

### Optional Services

Some services have optional dependencies that are safely handled:

- **AuditService**: Optional in `GrcRiskService` (uses optional chaining: `auditService?.recordCreate()`)
- If audit service is not available, operations continue without audit logging

### Defensive Checks

All `ConfigService.get()` calls include:
- **Type safety**: TypeScript generics ensure correct types
- **Default values**: Safe fallbacks for optional config
- **Null checks**: Where appropriate, values are checked before use

## Testing

### Test Environment

In test environment (`NODE_ENV=test`):
- JWT secret is auto-generated if not provided
- Database defaults to `grc_platform_test`
- `DB_SYNC` is set to `true` for test database setup

### Running Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Smoke tests
npm run smoke:grc
```

## Frontend Configuration

The frontend has a minimal config helper in `src/config.ts`:

```typescript
import { getApiBaseUrl } from '../config';

const API_BASE_URL = getApiBaseUrl(); // Defaults to http://localhost:3001/api
```

Set `REACT_APP_API_URL` environment variable to override the default.

## Troubleshooting

### Application Won't Start

1. Check that `JWT_SECRET` is set
2. Verify all required environment variables are present
3. Check the error message for specific validation failures

### Configuration Not Working

1. Ensure `.env` file exists (or environment variables are set)
2. Restart the application after changing environment variables
3. Check that `ConfigModule` is properly imported in `AppModule`

### Database Connection Issues

1. Verify `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` are correct
2. Ensure PostgreSQL is running
3. Check that `DB_SYNC` is `false` in production

## Best Practices

1. **Never use `process.env` directly** in services, controllers, or modules
2. **Always provide defaults** for optional configuration values
3. **Use type-safe access** via `ConfigService.get<T>()`
4. **Validate critical values** at startup (fail-fast)
5. **Document new environment variables** in this file

## Related Documentation

- [GRC Deployment and Environments](./GRC-DEPLOYMENT-AND-ENVIRONMENTS.md)
- [Security and Secrets Guide](./SECURITY-AND-SECRETS-GUIDE.md)

