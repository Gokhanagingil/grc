# GRC Platform - Deployment & Environment Guide

This document describes how to deploy and run the NestJS backend for the GRC Platform. It covers Docker deployment, environment configuration, CI/CD, and local development setup.

## Quick Start

The fastest way to get a demo environment running:

```bash
# One-command demo setup
./scripts/demo-nest-bootstrap.sh

# With demo data seeding
./scripts/demo-nest-bootstrap.sh --seed
```

After starting, access the API at `http://localhost:3002` with demo credentials `admin@grc-platform.local` / `TestPassword123!`.

## Deployment Options

### Option 1: Docker Compose (Recommended for Development/Demo)

Docker Compose provides a complete environment with PostgreSQL and the NestJS backend.

```bash
# Start the environment
docker compose -f docker-compose.nest.yml up -d

# View logs
docker compose -f docker-compose.nest.yml logs -f backend-nest

# Seed demo data
docker compose -f docker-compose.nest.yml exec backend-nest npm run seed:grc

# Stop the environment
docker compose -f docker-compose.nest.yml down

# Stop and remove volumes (clean slate)
docker compose -f docker-compose.nest.yml down -v
```

The compose file creates two services: `db` (PostgreSQL 15) and `backend-nest` (NestJS API). Data is persisted in a named volume `grc_postgres_data`.

### Option 2: Docker Image Only

Build and run the Docker image manually when you have an external PostgreSQL database.

```bash
# Build the image
cd backend-nest
docker build -t grc-backend-nest .

# Run with environment variables
docker run -d \
  --name grc-backend \
  -p 3002:3002 \
  -e JWT_SECRET="your-production-secret-key-minimum-32-chars" \
  -e DB_HOST="your-postgres-host" \
  -e DB_PORT="5432" \
  -e DB_USER="postgres" \
  -e DB_PASSWORD="your-password" \
  -e DB_NAME="grc_platform" \
  -e DB_SYNC="false" \
  grc-backend-nest

# Check health
curl http://localhost:3002/health/live
curl http://localhost:3002/health/ready
```

### Option 3: Local Development (Without Docker)

Run directly with Node.js for development with hot-reload.

```bash
cd backend-nest

# Copy environment file
cp .env.development .env

# Install dependencies
npm install

# Start PostgreSQL (if not running)
# Option A: Use Docker for just the database
docker run -d --name grc-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=grc_platform \
  -p 5432:5432 \
  postgres:15-alpine

# Start the application
npm run start:dev

# Seed demo data (in another terminal)
npm run seed:grc
```

## Environment Configuration

### Environment Profiles

The application supports three environment profiles:

| Profile | File | Use Case |
|---------|------|----------|
| Development | `.env.development` | Local development with hot-reload |
| Test | `.env.test` | CI/CD pipelines and local test runs |
| Production | `.env.production.template` | Production deployment (template only) |

Copy the appropriate file to `.env` for your use case:

```bash
# For local development
cp .env.development .env

# For running tests
cp .env.test .env

# For production (fill in real values!)
cp .env.production.template .env.production
```

### Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Environment: development, test, production |
| `PORT` | No | `3002` | Application port |
| `JWT_SECRET` | **Yes** | - | Secret for JWT signing (min 32 chars) |
| `JWT_EXPIRES_IN` | No | `24h` | JWT token expiration |
| `DB_HOST` | No | `localhost` | PostgreSQL host |
| `DB_PORT` | No | `5432` | PostgreSQL port |
| `DB_USER` | No | `postgres` | PostgreSQL username |
| `DB_PASSWORD` | No | `postgres` | PostgreSQL password |
| `DB_NAME` | No | `grc_platform` | PostgreSQL database name |
| `DB_SYNC` | No | `false` | Auto-sync schema (dev only!) |
| `CORS_ORIGINS` | No | `localhost:*` | Allowed CORS origins |
| `DEMO_ADMIN_EMAIL` | No | `admin@grc-platform.local` | Demo admin email |
| `DEMO_ADMIN_PASSWORD` | No | `changeme` | Demo admin password |
| `NEST_AUDIT_LOG_ENABLED` | No | `true` | Enable audit logging |

### Docker Compose Variables

Additional variables for `docker-compose.nest.yml`:

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_PORT` | `3002` | Host port mapping for the API |
| `DB_EXTERNAL_PORT` | `5432` | Host port mapping for PostgreSQL |

## CI/CD Pipeline

The NestJS backend has a dedicated CI workflow at `.github/workflows/backend-nest-ci.yml`.

### Triggers

The CI pipeline runs on:
- Push to `main` branch affecting `backend-nest/**`
- Push to `devin/**` branches affecting `backend-nest/**`
- Pull requests to `main` affecting `backend-nest/**`

### Jobs

| Job | Description | Dependencies |
|-----|-------------|--------------|
| `lint` | ESLint code quality checks | - |
| `build` | TypeScript compilation | lint |
| `unit-tests` | Jest unit tests with coverage | build |
| `e2e-tests` | End-to-end tests with PostgreSQL | build |
| `docker-build` | Verify Dockerfile builds | build |

### Running CI Locally

You can simulate the CI environment locally:

```bash
cd backend-nest

# Lint
npm run lint

# Build
npm run build

# Unit tests
npm run test -- --coverage

# E2E tests (requires PostgreSQL)
npm run test:e2e
```

## Health Checks

The application exposes two health endpoints:

| Endpoint | Purpose | Checks |
|----------|---------|--------|
| `/health/live` | Liveness probe | Application is running |
| `/health/ready` | Readiness probe | Application + database ready |

Use these for container orchestration (Kubernetes, ECS, etc.):

```yaml
# Kubernetes example
livenessProbe:
  httpGet:
    path: /health/live
    port: 3002
  initialDelaySeconds: 5
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3002
  initialDelaySeconds: 10
  periodSeconds: 5
```

## Production Deployment Checklist

Before deploying to production:

- [ ] Generate a strong `JWT_SECRET` (minimum 64 characters): `openssl rand -base64 64`
- [ ] Set `DB_SYNC=false` (use migrations instead)
- [ ] Configure `CORS_ORIGINS` with only production domains
- [ ] Change or disable demo credentials
- [ ] Use a managed PostgreSQL service (AWS RDS, Azure Database, etc.)
- [ ] Configure SSL/TLS for database connections
- [ ] Place the application behind a reverse proxy (nginx, Traefik, etc.)
- [ ] Set up health check monitoring
- [ ] Configure centralized logging (ELK, CloudWatch, etc.)
- [ ] Set up alerting for errors and performance issues

## Troubleshooting

### Container won't start

Check logs for startup errors:
```bash
docker compose -f docker-compose.nest.yml logs backend-nest
```

Common issues:
- Missing `JWT_SECRET` environment variable
- Database connection refused (check `DB_HOST`, `DB_PORT`)
- Port already in use (change `APP_PORT`)

### Database connection errors

Verify PostgreSQL is running and accessible:
```bash
# Check if PostgreSQL container is healthy
docker compose -f docker-compose.nest.yml ps

# Test connection
docker compose -f docker-compose.nest.yml exec db psql -U postgres -d grc_platform -c "SELECT 1"
```

### Health check failing

Check the ready endpoint for details:
```bash
curl -v http://localhost:3002/health/ready
```

If database is not ready, wait for PostgreSQL to initialize or check connection settings.

## File Structure

```
grc/
├── backend-nest/
│   ├── Dockerfile              # Multi-stage production build
│   ├── .dockerignore           # Docker build exclusions
│   ├── .env.example            # Environment template
│   ├── .env.development        # Development defaults
│   ├── .env.test               # Test defaults
│   ├── .env.production.template # Production template
│   └── src/
│       └── config/
│           ├── configuration.ts # Config mapping
│           └── validation.ts    # Env validation
├── docker-compose.nest.yml     # Full stack compose
├── scripts/
│   └── demo-nest-bootstrap.sh  # One-command demo setup
└── .github/
    └── workflows/
        └── backend-nest-ci.yml # CI pipeline
```

## Related Documentation

- [GRC Analytics and Reporting](./GRC-ANALYTICS-AND-REPORTING.md) - API filtering and pagination
- [GRC Security and Access Control](./GRC-SECURITY-AND-ACCESS-CONTROL.md) - RBAC and permissions
- [GRC Observability and Telemetry](./GRC-OBSERVABILITY-AND-TELEMETRY.md) - Logging and metrics
