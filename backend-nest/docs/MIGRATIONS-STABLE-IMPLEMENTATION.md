# TypeORM Migrations - Current Implementation

## 📋 Executive Summary

**Current Approach**: TypeORM migrations are loaded using glob patterns directly from migration files.

**Migration Loading Strategy**:
- **Dev Environment**: `src/migrations/*.ts` (excludes `index.ts` via pattern)
- **Dist/Staging Environment**: `dist/migrations/*.js` (excludes `index.js` via pattern)
- **IMPORTANT**: We must NOT have `dist/migrations/index.js` to avoid duplicate migrations

**Status**: ✅ **STABLE** - Using glob patterns, no index barrel file

---

## 🔍 Root Cause of Duplicate Migrations Issue

### The Problem

When using both:
1. A barrel export file (`dist/migrations/index.js`) that re-exports migrations
2. A glob pattern (`dist/migrations/*.js`) that matches all `.js` files

TypeORM would load migrations **twice**:
- Once from the individual migration files matched by the glob
- Once from the index file that re-exports them

This caused the error: `"Duplicate migrations: CreateAuditPhase2Tables..., CreateOnboardingTables..."`

### The Solution

**Removed the barrel export file** (`src/migrations/index.ts`) and use **glob patterns only**:

```typescript
// src/data-source.ts
migrations: isDist ? ['dist/migrations/*.js'] : ['src/migrations/*.ts']
```

This ensures each migration is loaded exactly once.

---

## ✅ Current Implementation

### Architecture

**Direct File Loading**: TypeORM loads migration files directly using glob patterns.

```typescript
// src/data-source.ts
const AppDataSource = new DataSource({
  // ... other config
  migrations: isDist ? ['dist/migrations/*.js'] : ['src/migrations/*.ts'],
  // ... other config
});
```

### How It Works

#### Development Environment
- TypeScript source files: `src/migrations/*.ts`
- Glob pattern: `['src/migrations/*.ts']`
- TypeORM loads migration classes directly from files

#### Production/Staging Environment
- Compiled JavaScript files: `dist/migrations/*.js`
- Glob pattern: `['dist/migrations/*.js']`
- TypeORM loads migration classes directly from files
- **Critical**: `dist/migrations/index.js` must NOT exist

### Why This Is Stable

1. **Simple**: Direct file loading, no intermediate barrel exports
2. **No Duplicates**: Each migration file is loaded exactly once
3. **No Index Confusion**: No index file means no risk of duplicates
4. **TypeORM Native**: Uses TypeORM's standard glob pattern approach

---

## 📁 File Structure

### Migration Files

```
backend-nest/src/migrations/
├── 1734112800000-CreateOnboardingTables.ts
├── 1735000000000-CreateAuditPhase2Tables.ts
└── (no index.ts)
```

### Data Source Configuration

```typescript
// backend-nest/src/data-source.ts
const AppDataSource = new DataSource({
  type: 'postgres',
  // ... database config
  entities: isDist ? ['dist/**/*.entity.js'] : ['src/**/*.entity.ts'],
  migrations: isDist ? ['dist/migrations/*.js'] : ['src/migrations/*.ts'],
  synchronize: false,
});
```

---

## 🚀 Usage

### Development

```bash
# Show migration status
npm run migration:show

# Run pending migrations
npm run migration:run

# Revert last migration
npm run migration:revert
```

### Staging/Production

```bash
# Show migration status
npx typeorm migration:show -d dist/data-source.js

# Run pending migrations
npx typeorm migration:run -d dist/data-source.js

# Revert last migration
npx typeorm migration:revert -d dist/data-source.js
```

**Note**: `dist/data-source.js` exports `AppDataSource` (CommonJS), which TypeORM CLI can use directly.

---

## ⚠️ Important Notes

### Critical: No Index File

- **DO NOT** create `src/migrations/index.ts`
- **DO NOT** create `dist/migrations/index.js`
- If an index file exists, it will cause duplicate migration errors

### Verification

After building, verify that `dist/migrations/index.js` does NOT exist:

```bash
cd backend-nest
npm ci
npm run build
test -f dist/migrations/index.js && echo "ERROR: index.js exists!" || echo "OK: index.js does not exist"
```

### Migration File Naming

Migration files should follow TypeORM conventions:
- Format: `<timestamp>-<MigrationName>.ts`
- Example: `1734112800000-CreateOnboardingTables.ts`

The glob pattern `*.ts` or `*.js` will match all migration files automatically.

---

## 🧪 Validation & Testing

### Local Validation

```bash
# 1. Build
cd backend-nest
npm ci
npm run build

# 2. Verify dist/migrations/index.js does NOT exist
test -f dist/migrations/index.js && echo "ERROR" || echo "OK"

# 3. Test data source load
node -e "const ds=require('./dist/data-source.js'); console.log('Data source loaded:', !!ds.AppDataSource);"

# 4. Check migration status (requires DB connection)
npx typeorm migration:show -d dist/data-source.js
```

### Expected Results

- ✅ `dist/migrations/index.js` does NOT exist
- ✅ `dist/data-source.js` loads successfully
- ✅ Migration show/run commands work without errors
- ✅ No duplicate migration warnings

---

## 🚀 Staging Deployment

### Quick Command Chain

```bash
# 1. Pull code
git pull origin <branch-name>

# 2. Rebuild backend
docker compose -f docker-compose.staging.yml up -d --build --force-recreate backend

# 3. Check migration status
docker compose -f docker-compose.staging.yml exec backend sh -c "npx typeorm migration:show -d dist/data-source.js"

# 4. Run migrations
docker compose -f docker-compose.staging.yml exec backend sh -c "npx typeorm migration:run -d dist/data-source.js"

# 5. Verify
docker compose -f docker-compose.staging.yml exec backend sh -c "npx typeorm migration:show -d dist/data-source.js"
```

**Full documentation**: See `docs/MIGRATIONS-STAGING-RUNBOOK.md`

---

## ⚠️ Troubleshooting

### Issue: "Duplicate migrations" error

**Symptoms**: TypeORM reports duplicate migration classes

**Root Cause**: `dist/migrations/index.js` exists and glob pattern matches both index and individual files

**Solution**:
1. Verify `dist/migrations/index.js` does NOT exist
2. If it exists, check build process - ensure `src/migrations/index.ts` is deleted
3. Rebuild: `npm run build`
4. Verify: `test -f dist/migrations/index.js && echo "ERROR" || echo "OK"`

### Issue: "No migrations found"

**Symptoms**: Migration show/run reports no migrations found

**Possible Causes**:
1. Migration files don't exist in `dist/migrations/`
2. Build failed
3. Glob pattern incorrect

**Solution**:
```bash
# Check if migration files exist
ls -la dist/migrations/*.js

# Rebuild if needed
npm run build
```

---

## 📝 Adding New Migrations

When adding a new migration:

1. **Generate migration**:
   ```bash
   npm run migration:generate src/migrations/YourMigrationName
   ```

2. **Verify migration file created**:
   ```bash
   ls -la src/migrations/
   ```

3. **Test locally**:
   ```bash
   npm run migration:show
   npm run migration:run
   ```

4. **Commit and deploy** following the staging runbook.

**Note**: No need to update any index file - migrations are loaded automatically via glob pattern.

---

## 📊 Comparison: Index Barrel vs Glob Pattern

| Aspect | Index Barrel (Old) | Glob Pattern (Current) |
|--------|-------------------|----------------------|
| **Complexity** | ⚠️ Requires index file | ✅ Direct file loading |
| **Duplicate Risk** | ❌ High (if both exist) | ✅ None |
| **Maintenance** | ⚠️ Must update index | ✅ Automatic |
| **Build Output** | ⚠️ Creates index.js | ✅ No index.js |
| **TypeORM Native** | ⚠️ Custom approach | ✅ Standard approach |

---

## ✅ Acceptance Criteria (Met)

- [x] Migrations load without duplicate errors
- [x] No index file required
- [x] Works in both dev (TS) and dist (JS) environments
- [x] Simple, maintainable approach
- [x] TypeORM standard glob pattern usage
- [x] Clear documentation

---

## 📚 References

- **TypeORM Migrations**: https://typeorm.io/migrations
- **Staging Runbook**: `docs/MIGRATIONS-STAGING-RUNBOOK.md`
- **Data Source**: `src/data-source.ts`

---

## ✨ Summary

The current implementation uses **glob patterns** to load migrations directly from files:

1. ✅ Simple and maintainable
2. ✅ No duplicate migration errors
3. ✅ No index file required
4. ✅ TypeORM standard approach
5. ✅ Works reliably in staging/production

**Status**: Stable and production-ready.
