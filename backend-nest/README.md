# GRC Backend (NestJS 11 + TypeORM 0.3 + Postgres)

## Quickstart

Prereqs:
- Node.js 18+
- Docker Desktop (optional but recommended)

### Env
Create `.env` in `backend-nest/`:

```
PORT=5002
API_PREFIX=api
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gokhan
DB_USER=grc
DB_PASS=123456
NODE_ENV=development
```

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

- Swagger: http://localhost:5002/api-docs
- Health:  http://localhost:5002/api/health

## Notes
- synchronize is disabled; use migrations to evolve schema
- API versioning is via URI; core policies under `/api/v2/policies`, stub modules under `/api/v1/*`
 - Default API version is v1, so `/api/governance/...` works without explicit version
 - Server-side pagination: list endpoints return `{ items, total, page, limit }` with default limit=20
