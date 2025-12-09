# Local Development Guide

This guide explains how to set up and run the GRC Platform locally, including database configuration and testing.

## Repository Structure

The GRC Platform is a monorepo with three main projects:

```
grc/
├── backend-nest/     # NestJS backend (port 3002) - PostgreSQL
├── backend/          # Express backend (port 3001) - SQLite
├── frontend/         # React frontend (port 3000)
├── docs/             # Documentation
├── scripts/          # Utility scripts
└── package.json      # Root-level helper scripts
```

## Quick Start

From the repository root, you can use the helper scripts:

```bash
# Install all dependencies
npm run install:all

# Or install individually
npm run nest:install
npm run backend:install
npm run frontend:install

# View all available commands
npm run help
```

## NestJS Backend (backend-nest/)

The NestJS backend uses PostgreSQL and runs on port 3002.

### Prerequisites

1. PostgreSQL 15+ installed and running
2. Node.js 20+

### Database Setup

Create a PostgreSQL database for development:

```sql
-- Connect to PostgreSQL as superuser
psql -U postgres

-- Create the database
CREATE DATABASE grc_platform;

-- For testing (separate database)
CREATE DATABASE grc_platform_test;
```

### Environment Configuration

The NestJS backend uses different `.env` files for different environments:

| File | Purpose | Committed |
|------|---------|-----------|
| `.env.example` | Template with all variables | Yes |
| `.env` | Local development config | No (gitignored) |
| `.env.test` | Test environment defaults | Yes |
| `.env.test.local` | Local test overrides | No (gitignored) |
| `.env.development` | Development defaults | Yes |

For local development, copy `.env.example` to `.env` and update the values:

```bash
cd backend-nest
cp .env.example .env
# Edit .env with your local PostgreSQL credentials
```

### Running the Backend

```bash
cd backend-nest

# Development mode (with hot reload)
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

### Running Tests

#### Unit Tests

```bash
cd backend-nest
npm run test
```

#### E2E Tests

E2E tests require a PostgreSQL database. The test setup automatically loads `.env.test` for database credentials.

**Default test database configuration (in `.env.test`):**
- Host: `localhost`
- Port: `5432`
- User: `postgres`
- Password: `123456`
- Database: `grc_platform_test`

**If your local PostgreSQL has different credentials:**

Option 1: Update `.env.test` (not recommended for shared repos)

Option 2: Create `.env.test.local` with your local overrides (recommended):

```bash
# Create local override file (gitignored)
cat > backend-nest/.env.test.local << EOF
DB_PASSWORD=your_local_password
DB_USER=your_local_user
EOF
```

**Run E2E tests:**

```bash
cd backend-nest
npm run test:e2e
```

Or from the repository root:

```bash
npm run nest:test:e2e
```

### Seeding and Smoke Tests

```bash
cd backend-nest

# Seed the database with sample data
npm run seed:grc

# Run smoke tests against a running server
npm run smoke:grc
```

## Express Backend (backend/)

The Express backend uses SQLite and runs on port 3001.

```bash
cd backend

# Development mode
npm run dev

# Run tests
npm run test:ci
```

## Frontend (frontend/)

The React frontend runs on port 3000.

```bash
cd frontend

# Development mode
npm start

# Build for production
npm run build

# Run linter
npx eslint src/ --ext .ts,.tsx
```

## Root-Level Commands

The root `package.json` provides convenience scripts that delegate to sub-projects:

| Command | Description |
|---------|-------------|
| `npm run help` | Show all available commands |
| `npm run install:all` | Install dependencies for all projects |
| `npm run nest:start:dev` | Start NestJS backend in dev mode |
| `npm run nest:test:e2e` | Run NestJS E2E tests |
| `npm run backend:dev` | Start Express backend in dev mode |
| `npm run frontend:start` | Start React frontend |

## Troubleshooting

### E2E Tests: "password authentication failed for user postgres"

This error occurs when the test database credentials don't match your local PostgreSQL setup.

**Solution:**

1. Check your local PostgreSQL credentials
2. Create a `.env.test.local` file in `backend-nest/` with your credentials:

```bash
echo "DB_PASSWORD=your_password" > backend-nest/.env.test.local
```

3. Ensure the test database exists:

```sql
CREATE DATABASE grc_platform_test;
```

### "npm ERR! enoent Could not read package.json" at repo root

This error occurred before the root `package.json` was added. If you see this on an older branch, pull the latest changes from main.

### Port Already in Use

If a port is already in use, either stop the conflicting process or change the port in the respective `.env` file:

- NestJS: `PORT=3002` in `backend-nest/.env`
- Express: `PORT=3001` in `backend/.env`
- Frontend: Set `PORT=3000` environment variable

## CI/CD

The CI pipeline runs automatically on:
- Push to `main` branch
- Push to `devin/**` branches
- Pull requests to `main`

CI uses its own environment variables and a fresh PostgreSQL container, so local configuration doesn't affect CI runs.

See `.github/workflows/backend-nest-ci.yml` for the full CI configuration.
