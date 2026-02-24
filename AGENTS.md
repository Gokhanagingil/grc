# AGENTS.md

## Cursor Cloud specific instructions

### Services overview

| Service | Directory | Port | Tech |
|---|---|---|---|
| NestJS Backend (primary) | `backend-nest/` | 3002 | NestJS + TypeORM + PostgreSQL |
| React Frontend | `frontend/` | 3000 | React 18 + CRA + MUI |
| Express Backend (legacy) | `backend/` | 3001 | Express + SQLite (optional) |

### Prerequisites

- **PostgreSQL 16** must be running on `localhost:5432`. Start with `sudo service postgresql start`.
- Databases `grc_platform` and `grc_platform_test` must exist (user `postgres`, password `postgres`).

### Running services

Standard commands are in `docs/LOCAL-DEVELOPMENT.md` and root `package.json` scripts. Key non-obvious notes:

- **Migrations must run before first NestJS start**: `cd backend-nest && npm run migration:run`. Without this, TypeORM tables are missing (`synchronize` is always `false`).
- **Frontend `.env` and browser caching**: CRA bakes `REACT_APP_*` vars at compile time. If you change `.env`, you must clear the webpack cache (`rm -rf frontend/node_modules/.cache`) and hard-refresh the browser (Ctrl+Shift+R). Alternatively, pass the var inline: `REACT_APP_API_URL=http://localhost:3002 npm start`.
- **Frontend install requires `--legacy-peer-deps`**: `cd frontend && npm ci --legacy-peer-deps` (peer dependency conflicts between react-scripts and newer deps).
- **Demo login**: email `admin@grc-platform.local`, password `changeme`. The NestJS auth module auto-creates this user on first login attempt.

### Lint / Test / Build quick reference

| Task | Command |
|---|---|
| Backend lint | `cd backend-nest && npm run lint` |
| Backend unit tests | `cd backend-nest && npm run test -- --forceExit` |
| Backend E2E tests | `cd backend-nest && npm run test:e2e` (needs PostgreSQL `grc_platform_test` DB) |
| Frontend lint | `cd frontend && npx eslint src/ --ext .ts,.tsx` |
| Frontend unit tests | `cd frontend && npm test -- --watchAll=false` |
| Backend build | `cd backend-nest && npm run build` |
| Frontend build | `cd frontend && npm run build` |
| Install all deps | `npm run install:all` (from root) |
