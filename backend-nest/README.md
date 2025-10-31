# GRC Backend (NestJS 11 + TypeORM 0.3 + Postgres)

## Quickstart

Prereqs:
- Node.js 18+
- Docker Desktop (optional but recommended)

### Env
Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
# Edit .env with your DB credentials and secrets
```

**Fail-fast Env**: Missing or invalid environment variables will stop the app at boot. Check the console for detailed validation errors.

Required keys:
- `NODE_ENV`, `PORT`, `API_PREFIX`, `API_VERSION`
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`, `DB_SSL`
- `JWT_SECRET`, `JWT_EXPIRES`, `BCRYPT_SALT_ROUNDS`
- `TENANT_HEADER`, `DEFAULT_TENANT_ID`
- `LOG_LEVEL`, `REQUEST_ID_HEADER`, `BUILD_TAG`, `HEALTH_PATH`

See `.env.example` for full list and defaults.

### Install
```
cd backend-nest
npm i
```

### Database (Docker)
```
npm run db:up
```
pgAdmin: http://localhost:5050 (admin@local / admin)

### Migrations
```
npm run typeorm:run
```

### Seed
```
npm run seed
```

### Run
```
npm run start:dev
```

- Swagger: http://localhost:5002/api-docs (includes x-tenant-id header on operations)
- Health (v1):  GET http://localhost:5002/api/v1/health
- Auth (v2):    POST http://localhost:5002/api/v2/auth/login (Headers: x-tenant-id, Body: email/password)

## DB password reset & smoke

If you encounter "password authentication failed" errors, reset the PostgreSQL password and sync .env:

**Windows (PowerShell):**
```bash
npm run db:reset:ps
```

**Linux/WSL (Bash):**
```bash
npm run db:reset:sh
```

The script will:
- Read DB credentials from `.env` (or use defaults: `grc` user, `grc` database)
- Reset PostgreSQL password (prompts for `postgres` superuser password)
- Sync `.env` with the new password
- Start backend in background and run smoke login tests

**Note:** The script uses `DB_PASS` from `.env` if present; otherwise defaults to `123456`.

## Notes
- synchronize is disabled; use migrations to evolve schema
- Env validation is enforced at boot; missing/invalid keys will stop the app early
- API versioning is via URI; core policies under `/api/v2/policies`, stub modules under `/api/v1/*`
 - Default API version is v1, so `/api/governance/...` works without explicit version
 - Server-side pagination: list endpoints return `{ items, total, page, limit }` with default limit=20
