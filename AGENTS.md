# AGENTS.md

## Cursor Cloud specific instructions

### Architecture Overview
GRC Platform monorepo with three services: NestJS backend (`backend-nest/`, port 3002), Express backend (`backend/`, port 3001, legacy), and React frontend (`frontend/`, port 3000). The NestJS backend is the primary API; Express backend is optional. See `docs/LOCAL-DEVELOPMENT.md` and root `package.json` (`npm run help`) for full command reference.

### Database
- PostgreSQL 15 is required for the NestJS backend.
- Databases: `grc_platform` (dev), `grc_platform_test` (test).
- **`synchronize` is always `false`** in the NestJS backend — you must run `cd backend-nest && npm run migration:run` before starting the app on a fresh database.
- Seed demo data with `cd backend-nest && npm run seed:grc` (requires `dist/` — run `npm run build` first if not using `start:dev`).

### Frontend API URL
- The committed `frontend/.env.development` points `REACT_APP_API_URL` to the Express backend (`http://localhost:3001/api`). To use the NestJS backend locally, create `frontend/.env.local` with `REACT_APP_API_URL=http://localhost:3002`. `.env.local` has higher precedence than `.env.development` in react-scripts.

### Auth Rate Limiting
- The NestJS backend has strict auth rate limiting: 10 login attempts per minute. Automated tests and repeated login attempts will trigger 429 responses. Restart the NestJS backend process to reset rate limit counters.
- Demo credentials: `admin@grc-platform.local` / `changeme` (set via `DEMO_ADMIN_PASSWORD` in `backend-nest/.env`).

### Running Services (dev mode)
```
# NestJS backend (primary)
cd backend-nest && npm run start:dev

# React frontend
cd frontend && BROWSER=none npm start

# Express backend (optional, legacy)
cd backend && npm run dev
```

### Lint / Test / Build
See root `package.json` scripts. Key commands:
- **Lint:** `npm run nest:lint` (backend-nest), `npm run frontend:lint` (frontend)
- **Unit tests:** `npm run nest:test` (backend-nest, 2401 tests), `npm run backend:test` (Express, 202 tests)
- **Build:** `cd backend-nest && npm run build`
- **E2E tests:** `npm run nest:test:e2e` (requires running PostgreSQL with `grc_platform_test` DB)

### Dependency Installation
- Frontend requires `--legacy-peer-deps` due to `react-scripts` / TypeScript peer dependency conflict.
- From root: `npm install && cd backend-nest && npm install && cd ../backend && npm install && cd ../frontend && npm install --legacy-peer-deps`
