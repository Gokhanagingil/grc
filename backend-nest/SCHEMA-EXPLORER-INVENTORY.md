# Schema Explorer - Inventory & Constraints Report

## PHASE 0 - Analysis Summary

### TypeORM Setup Analysis

**DataSource Initialization:**
- TypeORM is configured via `TypeOrmModule.forRootAsync` in `app.module.ts`
- Uses `dbConfigFactory()` from `config/database.config.ts`
- `autoLoadEntities: true` is enabled, meaning all entities are automatically discovered
- Entities path: `src/**/*.entity.ts` (dev) or `dist/**/*.entity.js` (prod)

**Entity Discovery:**
- Entities are located in:
  - `src/entities/app/` - Application entities (policies, risks, standards, etc.)
  - `src/entities/auth/` - Auth entities (users, roles, permissions)
  - `src/entities/tenant/` - Tenant entities
  - `src/entities/audit/` - Audit entities
  - `src/entities/queue/` - Queue entities

**Accessing TypeORM Metadata:**
- DataSource can be injected via dependency injection: `@InjectDataSource()`
- Or via `app.get(DataSource)` in main.ts
- Metadata available via: `dataSource.entityMetadatas`
- Each EntityMetadata contains:
  - `name` - Entity class name
  - `tableName` - Database table name
  - `columns` - Column metadata
  - `relations` - Relation metadata

### Admin Module Analysis

**Backend Structure:**
- `AdminController` at `modules/admin/admin.controller.ts`
- Uses `@UseGuards(JwtAuthGuard, AdminGuard)` for protection
- Controller path: `/api/v2/admin`
- All endpoints require admin role

**Frontend Structure:**
- Admin pages in `frontend/src/pages/admin/`
- Routes defined in `App.tsx` under `/admin/*`
- Navigation menu in `Layout.tsx` with admin submenu
- Admin menu items: Users, Roles, Tenants, Dictionaries, System Tools

**RBAC/Guards:**
- `JwtAuthGuard` - Requires valid JWT token
- `AdminGuard` - Requires admin role
- Both guards applied at controller level

### Implementation Plan

**Backend Hook Point:**
- Add new endpoint in `AdminController`: `GET /admin/schema/graph`
- Inject `DataSource` into `AdminService` or create new method
- Use `dataSource.entityMetadatas` to get all entity metadata
- Transform metadata to SchemaGraph JSON format

**Frontend Hook Point:**
- Create new page: `frontend/src/pages/admin/AdminSchemaExplorerPage.tsx`
- Add route in `App.tsx`: `/admin/schema-explorer`
- Add menu item in `Layout.tsx`: "Schema Explorer"
- Use existing admin API client pattern

**Technical Constraints:**
- TypeORM version: Need to check package.json
- No existing graph library in frontend - will need to add lightweight option
- Must work with both SQLite and PostgreSQL
- Must handle large schemas gracefully

**Module Inference Strategy:**
- Infer module from entity file path:
  - `entities/app/` → "GRC" or "Core"
  - `entities/auth/` → "Auth"
  - `entities/tenant/` → "Tenant"
  - `entities/audit/` → "Audit"
  - `entities/queue/` → "Queue"
- Or from entity name patterns:
  - Contains "Policy", "Standard", "Risk" → "GRC"
  - Contains "Audit" → "Audit"
  - Contains "BCP", "BIA" → "BCM"

### Next Steps

1. **PHASE 1:** Create backend endpoint `/admin/schema/graph`
2. **PHASE 2:** Create frontend Schema Explorer UI
3. **PHASE 3:** Test dynamic behavior
4. **PHASE 4:** Ensure security/RBAC
5. **PHASE 5:** Tests and cleanup
6. **PHASE 6:** Demo ready verification

