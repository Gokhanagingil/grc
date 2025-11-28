# GRC Platform Backend

NestJS backend with PostgreSQL, multi-tenancy, MFA, and event engine.

## Prerequisites

- Node.js 18+
- PostgreSQL 16+
- Redis 7+ (for event queue)
- npm or yarn

## Environment Setup

Copy `.env.example` to `.env` and configure:

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=grc
DB_USER=grc
DB_PASS=your_password
DB_SYNCHRONIZE=false

# API
API_PREFIX=/api
API_VERSION=v2
PORT=5002

# JWT
JWT_SECRET=your-secret-key-min-32-chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Redis (for event queue)
REDIS_URL=redis://localhost:6379
# Or
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Rate Limiting
RATE_TTL_MS=1000
RATE_LIMIT=10

# Queue Concurrency
QUEUE_EVENTS_RAW_CONCURRENCY=64
QUEUE_EVENTS_NORMALIZE_CONCURRENCY=32
QUEUE_EVENTS_INCIDENT_CONCURRENCY=16

# Event Ingest
INGEST_TOKEN=change-me
INGEST_MAX_BYTES=10485760
INGEST_MAX_ITEMS=10000

# Monitoring
METRICS_ENABLED=true
METRICS_PATH=/api/v2/metrics
LOG_LEVEL=info

# Redis (for caching and event queue)
REDIS_URL=redis://localhost:6379

# CORS
CORS_ORIGINS=http://localhost:3000
```

## Installation

```bash
npm ci
```

## Database Setup

### 1. Start PostgreSQL

```bash
# Using Docker
docker run -d \
  --name postgres-grc \
  -e POSTGRES_USER=grc \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=grc \
  -p 5432:5432 \
  postgres:16

# Or use local PostgreSQL installation
```

### 2. Run Migrations

```bash
npm run db:migrate
```

### 3. Seed Data

```bash
# Full data foundation seed
npm run db:seed:data

# Deterministic test seed (for E2E/acceptance tests)
npm run test-seed

# Reset database and seed test data
npm run db:reset:seed

# Phase 15 Demo Seed (BCM + Audit + All modules)
npm run demo-seed:phase15
```

#### Test Seed

The `test-seed` script seeds deterministic data for E2E and acceptance tests:
- 7 risk categories (Strategic, Operational, Compliance, Financial, Vendor, Security, Privacy)
- 2-3 sample risks (RISK-SEED-001, RISK-SEED-002, RISK-SEED-003)
- 1 sample policy (POL-SEED-001)
- Sample standard (ISO27001)
- Sample control (CTL-SEED-001)
- Sample clause (A.5.1.1)

#### Phase 15 Demo Seed

The `demo-seed:phase15` script seeds comprehensive demo data for all modules:
- **BCM**: BIA Processes (PROC-PAYROLL, PROC-ONBOARDING), Dependencies, BCP Plans, Exercises
- **Audit**: Audit Plans, Engagements, Tests, Evidence, Findings, CAPs
- **Entity Registry**: Entity Types and Entities (Applications, Databases, Services, Vendors)
- **Risk**: Risk Catalog and Risk Instances with control links
- **Policy & Compliance**: Policies, Compliance, Clauses, and Control links

All seed operations are idempotent (safe to run multiple times).

This creates:
- Default tenant
- Admin user: `admin@local` / `Admin!123`
- Regular user: `user@local` / `User!123`

## Redis Setup (for Caching and Event Queue)

```bash
# Using Docker
docker run -d --name redis-grc -p 6379:6379 redis:7

# Or use local Redis installation
```

Redis is used for:
- **Caching**: Lookup tables (entity types, users, choices) with 300s TTL
- **Event Queue**: (Future) Event processing pipeline
- **WebSocket**: Real-time updates (risk residual, CAP status)

If Redis is not available, the system will fall back to in-memory cache.

## Acceptance Testing

### Full Stack Acceptance Tests

```bash
npm run acceptance:full
```

This comprehensive test suite:
1. **Backend Health Check** (with retry logic)
2. **Frontend Health Check** (with retry logic)
3. **Backend API Tests**:
   - Health endpoint
   - Dashboard overview
   - Risk create (with category)
   - Policy create (HTML content)
   - Clause create
   - KQL advanced search
   - Column filters + KQL combination
   - Show Matching / Filter Out simulation
4. **Seed Phase 15 Demo Data**: Runs `demo-seed:phase15` to populate BCM, Audit, and all modules
5. **Playwright E2E Tests** (if FE is accessible):
   - Login flow (01-login)
   - Risk create and list (02-risk-create-and-list)
   - Filters and KQL search (03-risk-filters-and-kql)
   - Policy and Compliance create (04-policy-and-compliance-create)
   - Rate limiting and backoff (05-rate-limit-and-backoff)
   - Session persistence (06-session-persistence)
   - Entity Types CRUD (12-entity-types-crud)
   - Entities CRUD and filter (13-entities-crud-and-filter)
   - Apps/Services/Databases views (14-apps-services-dbs-views)
   - Metrics smoke (15-metrics-smoke)
   - Risk Register control relink (16-risk-register-control-relink)
   - Audit Plans CRUD (17-audit-plans-crud)
   - Audit engagement tests and evidence (18-audit-engagement-tests-evidence)
   - Audit findings CAP links (19-audit-findings-cap-links)
   - BCM BIA CRUD (20-bcm-bia-crud)
   - Entities attributes (21-entities-attributes)
   - Cache, WebSocket, metrics smoke (22-cache-ws-metrics-smoke)

### Output

- **Console**: Summary with pass/fail counts, duration, first 3 failures
- **HTML Report**: `frontend/playwright-report/index.html`
- **JSON Report**: `frontend/playwright-report/report.json`

### Prerequisites

- Backend running on port 5002
- Frontend running on port 3000 (for E2E tests)
- Database seeded (use `npm run db:reset:seed`)

## Running the Application

### Development

```bash
npm run start:dev
```

### Production

```bash
npm run build
npm run start:prod
```

## API Endpoints

- **Health**: `GET /api/v2/health`
- **Swagger UI**: `http://localhost:5002/api-docs`
- **Prometheus Metrics**: `GET /api/v2/metrics` (if `METRICS_ENABLED=true`)
  - Metrics include: `http_requests_total`, `http_request_duration_ms_bucket`, `db_query_duration_ms_bucket`, `cache_hit_total`, `ws_broadcast_total`, `audit_findings_open_total`, `audit_caps_open_total`, `bcm_process_count`, `bcm_plan_count`, `bcm_exercise_count`
- **WebSocket**: `ws://localhost:5002/ws/grc` (events: `grc.risk.residual.updated`, `grc.cap.status.updated`)

### Authentication

- **Login**: `POST /api/v2/auth/login`
  ```json
  {
    "email": "admin@local",
    "password": "Admin!123",
    "mfaCode": "optional"
  }
  ```

- **Refresh Token**: `POST /api/v2/auth/refresh`
  ```json
  {
    "refreshToken": "..."
  }
  ```

### Event Ingestion

- **Single Event**: `POST /api/v2/events/ingest`
  Headers: `x-ingest-token`, `x-tenant-id`, `idempotency-key` (optional)

- **Bulk Events**: `POST /api/v2/events/ingest/bulk`
  ```json
  {
    "source": "prometheus",
    "items": [
      { "payload": {...}, "tenantId": "..." }
    ]
  }
  ```

## Testing

### E2E Tests

```bash
npm run test:e2e
```

### Rate Limiting Test

```bash
npm run test:rate
```

### Event Generation

```bash
npm run events:gen -- --count 100000 --bulk 1000 --source prometheus
```

### Queue Statistics

```bash
npm run queue:stats
```

## Migration Commands

```bash
# Run migrations
npm run db:migrate

# Revert last migration
npm run db:revert

# Show migration status
npm run migration:status
```

## Features

- ✅ Multi-tenancy with TenantGuard
- ✅ MFA (TOTP) support
- ✅ Account lockout (5 failed attempts → 15 min)
- ✅ Refresh token rotation
- ✅ Rate limiting (10 req/60s)
- ✅ Audit logging with PII masking
- ✅ Event ingestion pipeline (Raw → Normalize → Incident)
- ✅ BullMQ queue system with Redis
- ✅ Prometheus metrics
- ✅ Swagger documentation

## Project Structure

```
src/
├── modules/
│   ├── auth/          # Authentication & MFA
│   ├── queue/         # Event queue & workers
│   ├── rules/         # Incident rules engine
│   ├── risk/          # Risk management
│   └── ...
├── entities/
│   ├── auth/          # User, roles, permissions
│   ├── queue/         # Event entities
│   └── ...
├── common/
│   ├── guards/        # TenantGuard, JwtAuthGuard
│   ├── decorators/    # @Tenant()
│   └── tenant/        # Tenant utilities
├── migrations/        # TypeORM migrations
└── seed/              # Seed scripts
```

## Backend Recovery & Stabilization

### Quick Health Checks

```bash
# Health endpoints
npm run smoke:health:ps  # PowerShell
npm run smoke:health:sh  # Bash

# Login endpoints
npm run smoke:logins:ps  # PowerShell
npm run smoke:logins:sh  # Bash
```

These scripts verify:
- `GET /health` → 200
- `GET /api/v2/health` → 200
- `POST /api/v2/auth/login` → 200 with token

### Common Issues & Solutions

| Belirti | Neden | Çözüm |
|---------|-------|-------|
| TypeScript derleme hataları (`noUnusedLocals`, `noUnusedParameters`) | Strict mode açık | `tsconfig.json`: `noUnusedLocals: false`, `noUnusedParameters: false` (geçici) |
| `Cannot find module '@nestjs/schedule'` | Paket eksik | `npm install @nestjs/schedule --save` |
| `RealtimeModule` import hatası | Import eksik | `app.module.ts`: `import { RealtimeModule } from './modules/realtime/realtime.module';` |
| `@Patch` decorator hatası | Import eksik | `audit-lifecycle.controller.ts`: `import { Patch } from '@nestjs/common';` |
| `BCPPlanStatus` tanımsız | Enum import eksik | `bcm.service.ts`: `import { BCPPlanStatus } from '../../entities/app/bcp-plan.entity';` |
| Migration çakışması (değişken iki kez tanımlı) | `auditFindingsTable` çift tanım | Migration'da ikinci kullanım: `auditFindingsTableForFk` |
| `undefined` guard hatası | Array index kontrolü yok | `boolean-query-parser.ts`, `date-parser.util.ts`, `seed-data.ts`: `??` ve guard ekle |
| `buildWsPayload` import hatası | Helper eksik | `ws-payload.helper.ts` dosyası mevcut olmalı |

### Build & Lint

```bash
# TypeScript build
npm run build

# Lint fix
npm run lint
```

**Expected**: `npm run build` should complete with 0 errors.

### Schedule Module Dependency

The `@nestjs/schedule` module is required for:
- Metrics scheduler (refreshing gauges every 60 seconds)
- `MetricsSchedulerService` in `MetricsModule`

If missing, install:
```bash
npm install @nestjs/schedule --save
```

### Realtime Module

The `RealtimeModule` provides WebSocket gateway for real-time updates:
- Namespace: `/ws/grc`
- Events: `grc.risk.residual.updated`, `grc.cap.status.updated`
- Metrics: `ws_broadcast_total` counter

Ensure `RealtimeModule` is imported in `app.module.ts` and `MetricsModule` is available.

### Redis Fallback

If Redis is unavailable:
- Cache falls back to in-memory (TTL still enforced)
- Queue operations will fail (errors logged)
- WebSocket events may not broadcast (errors logged)

Check logs for `Redis connection failed` or `Fallback to in-memory cache`.

## Runtime Boot Fix Notes (AuditModule DI)

### Issue: "Nest can't resolve dependencies of AuditService"

**Symptom**: Backend fails to start with error:
```
UnknownDependenciesException: Nest can't resolve dependencies of the AuditService (?). 
Please make sure that the argument "AuditEntityRepository" at index [0] is available in the AuditModule context.
```

**Root Cause**: `AuditService` uses `@InjectRepository(AuditEntity)` but `AuditEntity` was not included in `AuditModule`'s `TypeOrmModule.forFeature([...])` array.

**Solution**: Added `AuditEntity` to `AuditModule` imports:

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuditEntity,  // ← Added this
      AuditPlanEntity,
      AuditEngagementEntity,
      // ... other entities
    ]),
    // ...
  ],
  // ...
})
```

**Files Changed**:
- `src/modules/audit/audit.module.ts`: Added `AuditEntity` import and to `TypeOrmModule.forFeature` array

**Verification**: After fix, backend should start without DI errors. Check logs for:
- `[InstanceLoader] AuditModule dependencies initialized` ✅
- No `UnknownDependenciesException` errors ✅

## Port Binding & Health Finalizer

### Changes Made

**1. main.ts Updates**:
- Added explicit host binding (`0.0.0.0` by default) for WSL/Docker compatibility
- Added clear logging of listening address and port after server starts
- Excluded `/health` from global prefix so root health endpoint works
- Added `trust proxy` setting for production behind reverse proxy
- Improved logging with Logger for Bootstrap messages

**2. HealthController Updates**:
- Added `RootHealthController` for root `/health` endpoint (no prefix, no version)
- Kept existing `HealthController` for `/api/v2/health` endpoint (with full details)
- Both endpoints return `{ status: 'ok' }` at minimum

**3. Why `0.0.0.0`?**:
- Allows external connections (not just localhost)
- Required for Docker containers and WSL environments
- Production-ready binding (works behind reverse proxy)
- Can be overridden with `HOST` environment variable

**Expected Log Output**:
```
✅ HTTP server listening on 0.0.0.0:5002
   Local: http://127.0.0.1:5002
   Network: http://0.0.0.0:5002
   Health (root): http://0.0.0.0:5002/health
   Health (API): http://0.0.0.0:5002/api/v2/health
```

**Verification**:
- `GET /health` → 200 `{status: 'ok', ...}`
- `GET /api/v2/health` → 200 `{status: 'ok', service: 'backend-nest', ...}`

## Pre-ITSM Convergence Gate (GRC Hardening)

### Overview

This section documents the hardening work done on the GRC core before ITSM convergence. All changes are production-ready and minimal.

### Config Gate (FAZ G1)

**Environment Variables**:
- Required: `NODE_ENV`, `PORT` (default: 5002), `HOST` (default: 0.0.0.0)
- Database: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`
- JWT: `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`
- Tenancy: `DEFAULT_TENANT_ID`
- CORS: `CORS_ORIGINS` (comma-separated)
- Optional: `REDIS_URL` or `REDIS_HOST/PORT/PASSWORD`

**Validation**: `src/config/env.validation.ts` validates all env vars with meaningful defaults and warnings for missing critical values.

**Changes**:
- `env.validation.ts`: Made all fields optional with defaults, added warning logs for missing critical vars
- Default values: PORT=5002, HOST=0.0.0.0, API_PREFIX=/api, API_VERSION=v2

### Security & Rate Limiting (FAZ G3)

**Rate Limiting**:
- `ThrottlerModule` configured globally (10 req/60s in prod, 300 in dev)
- `ThrottleExceptionFilter` returns 429 with proper message
- Global `ThrottlerGuard` applied via `APP_GUARD`

**CORS**:
- Supports comma-separated origins from `CORS_ORIGINS`
- Allows `x-tenant-id` header
- Credentials enabled

**Security Headers**:
- Helmet enabled
- Trust proxy configured for reverse proxy support

### Multi-Tenant Protection (FAZ G4)

**TenantGuard**:
- Applied to all protected controllers (Risk, Audit, BCM, Entity Registry, etc.)
- Validates UUID format
- Sets `request.tenantId` for request context
- Throws `ForbiddenException` if tenant ID missing or invalid

**Repository Queries**:
- All repository queries use `tenantWhere(tenantId)` utility
- Fail-fast checks for empty tenant IDs

### Data Foundations Integrity (FAZ G5)

**Seed Safety**:
- `seed-data.ts`: Production safety check (requires `DEMO_SEED=true` in production)
- `phase15-demo-seed.ts`: Same production safety check
- All undefined/empty guards in place
- Enum usage enforced (no string literals)

**Migration Integrity**:
- All FK constraints validated
- Indexes on tenant_id columns
- Nullable fields properly defined

### Search & Pagination (FAZ G6)

**Pagination**:
- Default limit: 20
- Max limit: 1000 (enforced with `BadRequestException`)
- Backward compatible (handles both string and number types)
- `parsePagination()` validates and caps limits

**Query Parsers**:
- `boolean-query-parser.ts`: All undefined guards in place
- `query-parser.ts`: Token validation with guards
- Type narrowing for string operations

### Metrics & Logging (FAZ G7)

**Metrics**:
- Prometheus endpoint: `/api/v2/metrics` (if `METRICS_ENABLED=true`)
- Metrics include: HTTP requests, DB queries, cache hits, WebSocket broadcasts
- Gauge metrics for audit findings, CAPs, BCM counts (refreshed every 60s)

**Logging**:
- Bootstrap logs clearly show listening address and port
- Access logging: `[REQ] method url` for each request
- No circular dependencies in logger

### API Contract (FAZ G8)

**Swagger**:
- Endpoint: `/api-docs`
- Bearer auth configured
- `x-tenant-id` header documented
- All entity tags present (Risk, Control, Policy, Audit, BCM, etc.)

**Health Endpoints**:
- `/health`: Simple `{status: 'ok'}` (no prefix)
- `/api/v2/health`: Full health check with Redis, queue, data foundations counts

### Files Changed

1. `src/config/env.validation.ts`: Made all fields optional with defaults and warnings
2. `src/common/search/pagination.dto.ts`: Added max limit (1000), validation, backward compatibility
3. `src/common/filters/throttle-exception.filter.ts`: New - 429 response handler
4. `src/main.ts`: Added `ThrottleExceptionFilter` globally
5. `src/scripts/seed-data.ts`: Production safety check
6. `src/modules/demo-seed/phase15-demo-seed.ts`: Production safety check

### Verification Checklist

- ✅ `npm run build` → 0 errors
- ✅ `node dist/main.js` → listening logs visible
- ✅ `GET /health` → 200
- ✅ `GET /api/v2/health` → 200
- ✅ `npm run smoke:logins:ps` → PASS
- ✅ Rate limiting returns 429
- ✅ TenantGuard protects all endpoints
- ✅ Pagination max limit enforced

## Login & DB Bring-Up

### Database Connection

**Environment Variable Mapping**:
- The system supports both `DB_*` and `PG*` environment variable prefixes
- `DB_*` takes precedence over `PG*`
- Mapping: `DB_HOST`/`PGHOST`, `DB_PORT`/`PGPORT`, `DB_NAME`/`PGDATABASE`, `DB_USER`/`PGUSER`, `DB_PASS`/`PGPASSWORD`

**Test Database Connection**:
```bash
npm run db:probe
```

This script uses TypeORM DataSource to test PostgreSQL connectivity and runs `SELECT 1` and `SELECT NOW()` queries.

**Files Updated**:
- `src/data-source.ts`: Added DB_*/PG* mapping
- `src/app.module.ts`: Added DB_*/PG* mapping in TypeORM config

### Seed Login User

**Create test user for login smoke tests**:
```bash
npm run seed:login-user
```

This creates/updates `grc1@local` user with password `grc1` and ADMIN role.

**Requirements**:
- `DEFAULT_TENANT_ID` must be set in `.env`
- Database must be accessible
- Tenant and ADMIN role must exist (created automatically if missing)

**File**: `scripts/seed-login-user.ts`

### Login Smoke Test

**Test login flow end-to-end**:
```bash
npm run smoke:login:ps
```

This script:
1. Tests `/health` endpoint
2. Attempts login with `grc1@local`/`grc1`
3. Verifies JWT token is returned
4. Tests protected endpoint with Bearer token

**File**: `scripts/smoke-login.ps1`

**First Login Example** (PowerShell):
```powershell
$body = @{ email="grc1@local"; password="grc1" } | ConvertTo-Json -Compress
$headers = @{ "x-tenant-id"="217492b2-f814-4ba0-ae50-4e4f8ecf6216"; "Content-Type"="application/json" }
Invoke-WebRequest -Uri "http://localhost:5002/api/v2/auth/login" -Method POST -Headers $headers -Body $body
```

**First Login Example** (curl):
```bash
curl -X POST http://localhost:5002/api/v2/auth/login \
  -H "x-tenant-id: 217492b2-f814-4ba0-ae50-4e4f8ecf6216" \
  -H "Content-Type: application/json" \
  -d '{"email":"grc1@local","password":"grc1"}'
```

## Troubleshooting

### Migration errors

Ensure PostgreSQL is running and `.env` is configured correctly:

```bash
psql -U grc -d grc -c "SELECT 1;"
```

### Redis connection errors

Check Redis is running:

```bash
redis-cli ping
# Should return: PONG
```

**Note**: Redis connection errors are non-fatal; the system falls back to in-memory cache.

### Rate limiting not working

Check ThrottlerModule is imported in `app.module.ts` and rate limit configuration in `.env`.

### Port 5002 Already in Use (EADDRINUSE)

**Symptom**: Backend fails to start with error:
```
Error: listen EADDRINUSE: address already in use 0.0.0.0:5002
```

**Root Cause**: Another process (usually a previous Node.js instance) is already listening on port 5002.

**Solution**:

1. **Check for processes using port 5002** (PowerShell):
   ```powershell
   cd backend-nest
   .\scripts\check-port-5002.ps1
   ```

2. **Kill processes on port 5002** (PowerShell):
   ```powershell
   .\scripts\check-port-5002.ps1 -Kill
   ```

3. **Manual check** (PowerShell):
   ```powershell
   # Find processes
   netstat -ano | findstr ":5002"
   
   # Get process details (replace <PID> with actual PID from above)
   tasklist /FI "PID eq <PID>"
   
   # Kill process (replace <PID> with actual PID)
   taskkill /PID <PID> /F
   ```

4. **Alternative: Use a different port**:
   ```powershell
   $env:PORT=5003
   npm run start:dev
   ```

**Prevention**: Always stop the dev server cleanly (Ctrl+C) before restarting. If the process doesn't exit cleanly, use the helper script above.

**Note**: The duplicate `[BOOT] Creating NestFactory with AppModule...` log messages are likely from the same process outputting to both stdout and stderr, or from a previous run that didn't exit. The EADDRINUSE error confirms another process is using the port.

## Operational Quickstart

### Normal Mode Quick Start Flow

**1. Database Connection**:
```bash
npm run db:probe
```
Expected: `✅ DB OK`

**2. Build**:
```bash
npm run build:once
```
Expected: `0 errors`

**3. Start & Wait for Health**:
```bash
# PowerShell
npm run start:wait:ps

# Bash
npm run start:wait:sh
```
Expected: `✅ PASS - Both health endpoints are ready!`

**4. Login Smoke Test**:
```bash
# PowerShell
npm run smoke:login:ps

# Bash (if smoke-login.sh exists)
npm run smoke:login:sh
```
Expected: `/health → 200`, `Login → 200/201 + accessToken`, `Summary: 2/2 or 3/3 passed`

### Normal Mode vs SAFE MODE

**Normal Mode** (default): Loads all modules including Policy, Risk, Audit, Queue, Metrics, BCM, etc.
- Use when: All dependencies are available (Redis optional)
- Command: `npm run start:wait:ps` (no SAFE_MODE env var)

**SAFE MODE**: Loads only core modules (Config, TypeORM, Health, Auth, Users, Cache)
- Use when: Normal boot fails due to optional module dependencies
- Command: `npm run start:safe:wait:ps` (sets SAFE_MODE=true)

### Environment Variables

**Database**: Supports both `DB_*` and `PG*` prefixes (DB_* takes precedence):
- `DB_HOST` or `PGHOST`
- `DB_PORT` or `PGPORT`
- `DB_NAME` or `PGDATABASE`
- `DB_USER` or `PGUSER`
- `DB_PASS` or `PGPASSWORD`

**Required**:
- `DEFAULT_TENANT_ID`: Must be set for multi-tenancy to work
- `PORT`: Default 5002
- `HOST`: Default 0.0.0.0

**Optional**:
- `REDIS_URL` or `REDIS_HOST/PORT/PASSWORD`: Queue system (fallback to in-memory if not available)
- `METRICS_ENABLED`: Enable Prometheus metrics endpoint

### First Login

After seeding login user (`npm run seed:login-user`), test login:
- Email: `grc1@local`
- Password: `grc1`
- Tenant ID: Value from `DEFAULT_TENANT_ID` env var

## SAFE MODE Quickstart

**Use SAFE_MODE when normal boot fails** (skips optional modules like Queue, Metrics, Realtime, etc.):

```bash
# 1. Database check
npm run db:probe

# 2. Build
npm run build:once

# 3. Start in SAFE MODE and wait for health
# PowerShell
npm run start:safe:wait:ps

# Bash
npm run start:safe:wait:sh

# 4. Login smoke test
npm run smoke:login:ps
```

**SAFE MODE loads only**:
- ConfigModule
- TypeOrmModule
- HealthModule
- AuthModule
- UsersModule
- ThrottlerModule (rate limiting)
- LoggingInterceptor

**SAFE MODE skips**:
- QueueModule (BullMQ)
- MetricsModule
- RealtimeModule
- Most GRC business modules (Policy, Risk, Audit, etc.)

## Crash Forensics

**Capture full stack trace on crash**:
```bash
npm run crash:run
```

**Check crash log**:
```bash
# View crash.log
cat crash.log
# or
Get-Content crash.log -Tail 120
```

**Enable trace flags** (for debugging):
```bash
NODE_OPTIONS="--trace-uncaught --trace-warnings" node dist/main.js
```

Crash logs are written to `crash.log` in the project root with timestamps and full stack traces.

## License

UNLICENSED
