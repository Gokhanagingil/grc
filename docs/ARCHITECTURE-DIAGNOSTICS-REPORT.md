# GRC Platform - Architectural Diagnostics Report

**Generated:** December 4, 2025  
**Platform:** GRC + ITSM Platform  
**Tech Stack:** Node.js/Express.js (Backend) + React/TypeScript (Frontend) + SQLite3 (Database)

---

## 1. Repository Overview & Modules

### 1.1 Repository Structure

The GRC Platform is organized as a monorepo with two main applications:

```
grc/
├── backend/                    # Node.js/Express API server
│   ├── database/
│   │   └── connection.js       # SQLite initialization and schema
│   ├── middleware/
│   │   └── auth.js             # Authentication middleware
│   ├── routes/
│   │   ├── auth.js             # Authentication routes
│   │   ├── users.js            # User management routes
│   │   ├── governance.js       # Policy/organization routes
│   │   ├── risk.js             # Risk management routes
│   │   ├── compliance.js       # Compliance routes
│   │   └── dashboard.js        # Dashboard/analytics routes
│   ├── server.js               # Main application entry point
│   ├── test-server.js          # Minimal health check server
│   ├── package.json
│   └── .env
├── frontend/                   # React SPA
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.tsx      # Main layout with navigation
│   │   │   └── ProtectedRoute.tsx
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx # Global auth state
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Governance.tsx
│   │   │   ├── RiskManagement.tsx
│   │   │   ├── Compliance.tsx
│   │   │   └── UserManagement.tsx
│   │   ├── services/
│   │   │   └── api.ts          # Axios HTTP client
│   │   ├── App.tsx             # Root component with routing
│   │   └── index.tsx           # React entry point
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
├── README.md
├── start-backend.ps1           # Windows PowerShell scripts
└── start-frontend.ps1
```

### 1.2 Missing Infrastructure

The following expected directories/files are **NOT present**:

| Expected | Status | Impact |
|----------|--------|--------|
| `.github/workflows/` | Missing | No CI/CD pipeline |
| `docs/` | Created for this report | No documentation structure |
| `scripts/` | Missing | No automation scripts |
| `backend-nest/` | Not applicable | Current stack is Express.js, not NestJS |
| Database migrations | Missing | Schema managed inline in connection.js |
| Test files | Missing | No unit/integration tests |

---

## 2. Backend Module Inventory

### 2.1 Route Modules

| Module | Path | Controllers/Routes | Guards | Dependencies |
|--------|------|-------------------|--------|--------------|
| **Auth** | `routes/auth.js` | POST /register, POST /login, GET /me, POST /logout | authenticateToken (partial) | bcryptjs, jsonwebtoken, database |
| **Users** | `routes/users.js` | GET /, GET /:id, PUT /:id, PUT /:id/role, PUT /:id/password, PUT /:id/deactivate, PUT /:id/activate, GET /statistics/overview, GET /departments/list | authenticateToken, requireRole | bcryptjs, database, auth middleware |
| **Governance** | `routes/governance.js` | GET /policies, GET /policies/:id, POST /policies, PUT /policies/:id, DELETE /policies/:id, GET /policies/categories, GET /organizations, POST /organizations | authenticateToken, requireRole | database, auth middleware |
| **Risk** | `routes/risk.js` | GET /risks, GET /risks/:id, POST /risks, PUT /risks/:id, DELETE /risks/:id, GET /risks/categories, GET /risks/statistics, POST /risks/:id/assessments | authenticateToken, requireRole | database, auth middleware |
| **Compliance** | `routes/compliance.js` | GET /requirements, GET /requirements/:id, POST /requirements, PUT /requirements/:id, DELETE /requirements/:id, GET /requirements/categories, GET /requirements/regulations, GET /requirements/statistics, GET /audit-logs | authenticateToken, requireRole | database, auth middleware |
| **Dashboard** | `routes/dashboard.js` | GET /overview, GET /activities, GET /risk-trends, GET /compliance-by-regulation, GET /risk-categories, GET /upcoming-deadlines, GET /policy-status, GET /user-activity | authenticateToken | database, auth middleware |

### 2.2 Middleware Components

| Middleware | File | Purpose | Usage |
|------------|------|---------|-------|
| `authenticateToken` | `middleware/auth.js` | JWT verification | All protected routes |
| `requireRole` | `middleware/auth.js` | Role-based access control | Admin/manager restricted routes |
| `logActivity` | `middleware/auth.js` | Audit logging | CUD operations |

### 2.3 Database Entities (Tables)

| Entity | Table Name | Key Fields | Foreign Keys |
|--------|------------|------------|--------------|
| User | `users` | id, username, email, password, role, first_name, last_name, department, is_active | None |
| Policy | `policies` | id, title, description, category, version, status, effective_date, review_date, content | owner_id -> users |
| Risk | `risks` | id, title, description, category, severity, likelihood, impact, risk_score, status, mitigation_plan, due_date | owner_id -> users, assigned_to -> users |
| Compliance Requirement | `compliance_requirements` | id, title, description, regulation, category, status, due_date, evidence | owner_id -> users, assigned_to -> users |
| Audit Log | `audit_logs` | id, user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent | user_id -> users |
| Organization | `organizations` | id, name, description, type, parent_id | parent_id -> organizations (self-ref) |
| Risk Assessment | `risk_assessments` | id, risk_id, assessor_id, assessment_date, likelihood_score, impact_score, overall_score, notes | risk_id -> risks, assessor_id -> users |

---

## 3. Frontend Module Inventory

### 3.1 Entry Points

| File | Purpose |
|------|---------|
| `src/index.tsx` | React DOM render entry point |
| `src/App.tsx` | Root component with ThemeProvider, AuthProvider, Router |
| `public/index.html` | HTML shell |

### 3.2 Router Configuration

| Route | Component | Protected | Description |
|-------|-----------|-----------|-------------|
| `/login` | `Login` | No | Authentication page |
| `/` | `Layout` (redirect to /dashboard) | Yes | Root redirect |
| `/dashboard` | `Dashboard` | Yes | Overview statistics and charts |
| `/governance` | `Governance` | Yes | Policy management |
| `/risk` | `RiskManagement` | Yes | Risk management |
| `/compliance` | `Compliance` | Yes | Compliance requirements |
| `/users` | `UserManagement` | Yes | User administration |

### 3.3 Pages and Features

| Page | File | Features | API Endpoints Used |
|------|------|----------|-------------------|
| **Login** | `pages/Login.tsx` | Login form, Registration form, Tab switching | POST /auth/login, POST /auth/register |
| **Dashboard** | `pages/Dashboard.tsx` | Stat cards, Line charts, Pie charts, Bar charts | GET /dashboard/overview, /risk-trends, /compliance-by-regulation |
| **Governance** | `pages/Governance.tsx` | Policy table, CRUD dialogs, Date pickers | GET/POST/PUT/DELETE /governance/policies |
| **RiskManagement** | `pages/RiskManagement.tsx` | Risk table, Risk score visualization, CRUD dialogs | GET/POST/PUT/DELETE /risk/risks |
| **Compliance** | `pages/Compliance.tsx` | Requirements table, Overdue indicators, CRUD dialogs | GET/POST/PUT/DELETE /compliance/requirements |
| **UserManagement** | `pages/UserManagement.tsx` | User table, Role management, Status toggle | GET/POST/PUT/DELETE /users |

### 3.4 Shared Components

| Component | File | Purpose |
|-----------|------|---------|
| `Layout` | `components/Layout.tsx` | App shell with sidebar navigation, header, user menu |
| `ProtectedRoute` | `components/ProtectedRoute.tsx` | Auth gate wrapper for protected pages |

### 3.5 Services

| Service | File | Purpose |
|---------|------|---------|
| `api` | `services/api.ts` | Axios instance with base URL, auth interceptors |

### 3.6 Context Providers

| Context | File | State Managed |
|---------|------|---------------|
| `AuthContext` | `contexts/AuthContext.tsx` | user, token, loading, login(), register(), logout() |

---

## 4. Dependency Graph & Architectural Shape

### 4.1 Backend Module Dependencies

```
server.js
    ├── database/connection.js (db.init, getDb)
    ├── routes/auth.js
    │       └── middleware/auth.js (authenticateToken)
    │       └── database/connection.js (getDb)
    ├── routes/users.js
    │       └── middleware/auth.js (authenticateToken, requireRole, logActivity)
    │       └── database/connection.js (getDb)
    ├── routes/governance.js
    │       └── middleware/auth.js (authenticateToken, requireRole, logActivity)
    │       └── database/connection.js (getDb)
    ├── routes/risk.js
    │       └── middleware/auth.js (authenticateToken, requireRole, logActivity)
    │       └── database/connection.js (getDb)
    ├── routes/compliance.js
    │       └── middleware/auth.js (authenticateToken, requireRole, logActivity)
    │       └── database/connection.js (getDb)
    └── routes/dashboard.js
            └── middleware/auth.js (authenticateToken)
            └── database/connection.js (getDb)
```

### 4.2 Frontend Component Dependencies

```
App.tsx
    ├── AuthProvider (contexts/AuthContext.tsx)
    │       └── api (services/api.ts)
    ├── Layout (components/Layout.tsx)
    │       └── useAuth (contexts/AuthContext.tsx)
    ├── ProtectedRoute (components/ProtectedRoute.tsx)
    │       └── useAuth (contexts/AuthContext.tsx)
    └── Pages
            ├── Login.tsx → useAuth
            ├── Dashboard.tsx → api
            ├── Governance.tsx → api
            ├── RiskManagement.tsx → api
            ├── Compliance.tsx → api
            └── UserManagement.tsx → api
```

### 4.3 Architectural Observations

**Positive Patterns:**
- Clean separation between routes (controllers) and database layer
- Centralized authentication middleware
- Single API service for frontend HTTP calls
- Context-based state management for auth

**Architectural Concerns:**

| Issue | Severity | Description |
|-------|----------|-------------|
| No service layer | Medium | Business logic embedded directly in route handlers |
| No repository pattern | Medium | Database queries inline in routes |
| No DTO/validation layer | Medium | Request body used directly without validation schemas |
| Circular dependency risk | Low | Currently none detected, but flat structure could lead to issues |
| No module boundaries | Medium | All routes share same middleware and database connection pattern |

---

## 5. Backend Boot & Lifecycle Analysis

### 5.1 Bootstrap Flow (`server.js`)

```javascript
// 1. Load dependencies
require('dotenv').config();
const express = require('express');
// ... other imports

// 2. Create Express app
const app = express();

// 3. Apply global middleware (synchronous)
app.use(helmet());           // Security headers
app.use(cors());             // CORS - no configuration
app.use(morgan('combined')); // Request logging
app.use(express.json());     // JSON body parser
app.use(express.urlencoded({ extended: true }));

// 4. Mount routes
app.use('/api/auth', authRoutes);
// ... other routes

// 5. Error handlers
app.use((err, req, res, next) => { ... });
app.use((req, res) => { ... }); // 404

// 6. Initialize database and start server
db.init().then(() => {
    app.listen(PORT, () => { ... });
}).catch(err => {
    process.exit(1);
});
```

### 5.2 Potential Failure Points

| Stage | Risk | Severity | Description |
|-------|------|----------|-------------|
| Environment Loading | Medium | `dotenv.config()` runs synchronously; missing .env file won't crash but JWT_SECRET will be undefined |
| Database Init | High | `db.init()` creates tables synchronously in `db.serialize()`; any SQL error will reject promise and exit |
| CORS Configuration | Medium | `cors()` with no options allows all origins - security risk in production |
| JWT_SECRET | Critical | Hardcoded fallback in .env file; if missing, authentication will use undefined secret |
| Port Binding | Low | Default port 5000 in code, but .env sets 3001; potential confusion |
| No Graceful Shutdown | Medium | No SIGTERM/SIGINT handlers; connections may not close cleanly |

### 5.3 Database Initialization (`database/connection.js`)

```javascript
// Synchronous file system check
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Database connection created immediately on module load
const db = new sqlite3.Database(dbPath);

// init() creates tables in serialize block
const init = () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS users (...)`);
            // ... 6 more CREATE TABLE statements
            resolve();
        });
    });
};
```

**Issues:**
- Database connection created on module import (not lazy)
- No error handling for individual CREATE TABLE statements
- No migration system - schema changes require manual intervention
- `db.serialize()` doesn't propagate errors to the Promise

---

## 6. Environment & Configuration Dependencies

### 6.1 Backend Environment Variables

| Variable | File | Default | Required | Risk Level | Notes |
|----------|------|---------|----------|------------|-------|
| `NODE_ENV` | `.env` | undefined | No | Low | Used for error message verbosity |
| `PORT` | `.env`, `server.js` | 5000 (code), 3001 (.env) | No | Low | Mismatch between code default and .env |
| `JWT_SECRET` | `.env` | None | **Yes** | **Critical** | Hardcoded insecure value in .env |
| `DB_PATH` | `.env`, `connection.js` | `./database/grc.db` | No | Low | Relative path works for development |

### 6.2 Frontend Environment Variables

| Variable | File | Default | Required | Risk Level | Notes |
|----------|------|---------|----------|------------|-------|
| `REACT_APP_API_URL` | `.env`, `api.ts` | `http://localhost:3001/api` | No | Low | Hardcoded fallback in code |

### 6.3 Environment Configuration Risks

| Risk | Severity | Description |
|------|----------|-------------|
| Insecure JWT_SECRET | Critical | `.env` contains `your-super-secret-jwt-key-change-this-in-production` |
| No production config | High | No separate production environment configuration |
| Secrets in repository | Critical | `.env` files appear to be committed (not in .gitignore for backend) |
| No validation | Medium | No schema validation for environment variables |

---

## 7. Security, Auth & Multi-Tenancy Overview

### 7.1 Authentication Mechanism

| Aspect | Implementation | Status |
|--------|----------------|--------|
| Token Type | JWT (jsonwebtoken) | Implemented |
| Token Expiration | 24 hours | Implemented |
| Password Hashing | bcryptjs (10 rounds) | Implemented |
| Token Storage | localStorage (frontend) | Implemented |
| Refresh Tokens | Not implemented | Missing |
| Token Rotation | Not implemented | Missing |
| Token Blacklisting | Not implemented | Missing |

### 7.2 JWT Payload Structure

```javascript
{
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role
}
```

### 7.3 Guards and Access Control

| Guard | Location | Usage |
|-------|----------|-------|
| `authenticateToken` | `middleware/auth.js` | All protected routes |
| `requireRole(['admin'])` | Route-level | User role changes, deletions, activate/deactivate |
| `requireRole(['admin', 'manager'])` | Route-level | User listing, policy/compliance CRUD |

### 7.4 Routes Without Guards (Unprotected)

| Route | Method | Risk |
|-------|--------|------|
| `/api/auth/register` | POST | Intentional - public registration |
| `/api/auth/login` | POST | Intentional - public login |
| `/api/health` | GET | Intentional - health check |

### 7.5 Security Vulnerabilities

| Vulnerability | Severity | Description |
|---------------|----------|-------------|
| No rate limiting | High | Login endpoint vulnerable to brute force |
| CORS wide open | High | `cors()` with no configuration allows all origins |
| JWT secret in code | Critical | Insecure default secret in .env |
| No HTTPS enforcement | Medium | No redirect to HTTPS in production |
| No input sanitization | Medium | SQL injection mitigated by parameterized queries, but no XSS protection |
| No CSRF protection | Medium | JWT in localStorage, but no CSRF tokens |
| Audit log bypass | Low | `logActivity` only logs on successful responses |

### 7.6 Multi-Tenancy Status

**Current State: NOT IMPLEMENTED**

| Aspect | Status | Notes |
|--------|--------|-------|
| Tenant ID in JWT | Missing | No tenant context in token |
| Tenant isolation | Missing | No tenant_id column in any table |
| TenantGuard | Missing | No middleware for tenant enforcement |
| Cross-tenant access | N/A | Single-tenant architecture |

---

## 8. Testing & Tooling Status

### 8.1 Backend Scripts (`backend/package.json`)

| Script | Command | Status | Notes |
|--------|---------|--------|-------|
| `start` | `node server.js` | Working | Production start |
| `dev` | `nodemon server.js` | Working | Development with auto-restart |
| `test` | `echo "Error: no test specified" && exit 1` | **Broken** | No tests implemented |

### 8.2 Frontend Scripts (`frontend/package.json`)

| Script | Command | Status | Notes |
|--------|---------|--------|-------|
| `start` | `react-scripts start` | Working | Development server |
| `build` | `react-scripts build` | Working | Production build |
| `test` | `react-scripts test` | Partial | Only default CRA test file |
| `eject` | `react-scripts eject` | Available | Not recommended |

### 8.3 Test Coverage Analysis

| Area | Unit Tests | Integration Tests | E2E Tests |
|------|------------|-------------------|-----------|
| Backend Routes | None | None | None |
| Backend Middleware | None | None | None |
| Database Operations | None | None | None |
| Frontend Components | 1 (App.test.tsx) | None | None |
| Frontend Pages | None | None | None |
| API Integration | None | None | None |

### 8.4 Missing Tooling

| Tool | Purpose | Status |
|------|---------|--------|
| ESLint (Backend) | Code linting | Not configured |
| Prettier | Code formatting | Not configured |
| Jest (Backend) | Unit testing | Not configured |
| Supertest | API testing | Not installed |
| Cypress/Playwright | E2E testing | Not installed |
| Husky | Git hooks | Not configured |
| lint-staged | Pre-commit linting | Not configured |
| TypeScript (Backend) | Type safety | Not used (plain JS) |

### 8.5 CI/CD Status

**Current State: NOT IMPLEMENTED**

- No `.github/workflows/` directory
- No CI configuration files
- No automated testing pipeline
- No deployment automation

---

## 9. Performance & Scalability Risks

### 9.1 Database Performance Risks

| Risk | Severity | Description | Recommendation |
|------|----------|-------------|----------------|
| SQLite limitations | High | SQLite not suitable for production multi-user workloads | Migrate to PostgreSQL |
| No connection pooling | Medium | Single database connection shared across requests | Implement connection pool |
| No indexes | High | No explicit indexes defined; queries will slow with data growth | Add indexes on foreign keys and frequently queried columns |
| Synchronous queries | Medium | Callback-based queries block event loop | Use async/await with promisified methods |

### 9.2 API Performance Risks

| Risk | Severity | Description | Recommendation |
|------|----------|-------------|----------------|
| No pagination limits | Medium | Default limit of 10, but no max limit enforced | Enforce maximum page size |
| N+1 query patterns | Low | JOINs used appropriately in most queries | Monitor query performance |
| No caching | Medium | Every request hits database | Implement Redis caching for dashboard data |
| No compression | Low | Response compression not enabled | Add compression middleware |
| Dashboard queries | Medium | Multiple sequential queries in `/dashboard/overview` | Optimize with single aggregated query |

### 9.3 Scalability Concerns

| Concern | Severity | Current State | Future Impact |
|---------|----------|---------------|---------------|
| Single-threaded | High | Node.js single process | Cannot utilize multiple CPU cores |
| No horizontal scaling | High | Single server architecture | Cannot scale out |
| No message queue | Medium | Synchronous processing | Cannot handle async workloads |
| No background jobs | Medium | All processing in request cycle | Long operations block responses |
| File storage | Medium | Not implemented | Will need object storage for attachments |
| Event ingestion | High | Not implemented | Future ITSM event management will need dedicated pipeline |

### 9.4 Memory and Resource Risks

| Risk | Severity | Description |
|------|----------|-------------|
| No memory limits | Medium | Node.js default heap size may be insufficient |
| No request size limits | Medium | `express.json()` with no limit option |
| Audit log growth | Medium | No log rotation or archival strategy |
| Database file growth | High | SQLite file will grow unbounded |

---

## 10. Prioritized Recommendations & Next Steps

### 10.1 Critical (Immediate Action Required)

| Priority | Issue | Action | Effort |
|----------|-------|--------|--------|
| P0 | Insecure JWT_SECRET | Generate cryptographically secure secret, use environment variable | 1 hour |
| P0 | CORS configuration | Configure allowed origins for production | 1 hour |
| P0 | No rate limiting | Add express-rate-limit to auth endpoints | 2 hours |
| P0 | Secrets in repository | Add .env to .gitignore, use secrets management | 1 hour |

### 10.2 High Priority (This Sprint)

| Priority | Issue | Action | Effort |
|----------|-------|--------|--------|
| P1 | SQLite in production | Plan PostgreSQL migration | 1-2 weeks |
| P1 | No tests | Set up Jest, write critical path tests | 1 week |
| P1 | No CI/CD | Create GitHub Actions workflow | 1 day |
| P1 | No input validation | Add Joi/Zod validation schemas | 3 days |
| P1 | Backend TypeScript | Migrate backend to TypeScript | 1 week |

### 10.3 Medium Priority (Next Sprint)

| Priority | Issue | Action | Effort |
|----------|-------|--------|--------|
| P2 | No service layer | Extract business logic from routes | 1 week |
| P2 | No refresh tokens | Implement token refresh mechanism | 2 days |
| P2 | No caching | Add Redis for session/cache | 3 days |
| P2 | No database migrations | Implement migration system (TypeORM/Knex) | 3 days |
| P2 | No graceful shutdown | Add shutdown handlers | 2 hours |

### 10.4 Lower Priority (Backlog)

| Priority | Issue | Action | Effort |
|----------|-------|--------|--------|
| P3 | No multi-tenancy | Design tenant isolation architecture | 2 weeks |
| P3 | No background jobs | Add Bull/Agenda for async processing | 1 week |
| P3 | No API documentation | Add Swagger/OpenAPI | 2 days |
| P3 | No monitoring | Add health checks, metrics, logging | 1 week |
| P3 | No Docker | Create Dockerfile and docker-compose | 2 days |

---

## Summary of Key Findings

1. **Architecture is monolithic Express.js + React** - not NestJS as mentioned in the request. The codebase uses plain JavaScript on the backend, not TypeScript.

2. **Security vulnerabilities are critical** - insecure JWT secret, no rate limiting, wide-open CORS, and potential secrets committed to repository require immediate attention.

3. **No testing infrastructure exists** - zero unit tests, integration tests, or E2E tests. The backend test script explicitly fails.

4. **SQLite is unsuitable for production** - single-file database with no connection pooling, no migrations, and limited concurrent access support.

5. **No CI/CD pipeline** - no GitHub Actions workflows, no automated testing or deployment.

6. **Multi-tenancy is not implemented** - the architecture is single-tenant with no tenant isolation mechanisms.

7. **No service/repository layer** - business logic is embedded directly in route handlers, making testing and maintenance difficult.

8. **Authentication is basic** - JWT with 24-hour expiration, no refresh tokens, no token rotation, no blacklisting.

9. **Performance risks exist** - no caching, no compression, dashboard makes multiple sequential database queries.

10. **Missing enterprise features** - no audit log archival, no file storage, no background job processing, no event ingestion pipeline for future ITSM needs.

11. **Frontend is well-structured** - React with TypeScript, Material-UI, proper routing, and context-based state management.

12. **Database schema is reasonable** - proper foreign key relationships, audit logging table exists, but no indexes defined.

13. **Code quality is inconsistent** - frontend uses TypeScript with proper typing, backend uses plain JavaScript with no type safety.

14. **Documentation exists** - README.md provides good overview, but no API documentation or architecture decision records.

15. **Windows-specific scripts present** - PowerShell scripts for starting services suggest Windows development environment.

---

**Report Generated By:** Architectural Diagnostics Scan  
**File Location:** `docs/ARCHITECTURE-DIAGNOSTICS-REPORT.md`
