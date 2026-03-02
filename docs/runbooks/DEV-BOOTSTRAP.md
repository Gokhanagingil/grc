# Dev Bootstrap (Monorepo)

This repository is a monorepo. The **application dependencies** must be installed in the subprojects (not at repo root).

> Note: the repo root `package.json` is for shared tooling (e.g. Playwright). It is **not** the place to install/run the frontend or backend application dependencies.

## Node.js version

- There is no `.nvmrc` or `package.json#engines` pinned in this repo.
- CI uses **Node 20.x** (see `.github/workflows/frontend-ci.yml` and `.github/workflows/backend-nest-ci.yml`).

Recommended:

```bash
nvm install 20
nvm use 20
```

## Install dependencies

Run these from the repo root:

```bash
# Frontend (React)
cd frontend
npm ci --legacy-peer-deps

# Backend (NestJS)
cd ../backend-nest
npm ci --legacy-peer-deps
```

### Why `--legacy-peer-deps`?

Both subprojects currently have peer-dependency conflicts under npm v7+:

- **frontend/**: `react-scripts@5.0.1` expects TypeScript `^3 || ^4` but the repo uses TypeScript `^5`.
- **backend-nest/**: `@nestjs/cli@11` peer-constraints conflict with the repo’s `@swc/cli@0.8.x`.

CI installs dependencies with `npm ci --legacy-peer-deps` for both projects.

## Optional: legacy backend

There is a legacy Express backend in `backend/`.

Only bootstrap it if you are working on it or a workflow explicitly requires it:

```bash
cd backend
npm ci
```
