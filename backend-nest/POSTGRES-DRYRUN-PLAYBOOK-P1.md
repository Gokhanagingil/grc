# POSTGRES-DRYRUN-PLAYBOOK-P1: Postgres Setup and Migration Playbook

**Date:** 2025-01-25  
**Phase:** PHASE 3 - Postgres Dry-Run Hazırlık Playbook  
**Purpose:** Document Postgres setup, migration, and validation steps

---

## 1. Prerequisites

### 1.1 Required Software

**PostgreSQL:**
- PostgreSQL 12+ (recommended: 14+)
- `psql` command-line tool
- PostgreSQL extensions: `pgcrypto`, `uuid-ossp`, `citext`, `ltree`

**Node.js:**
- Node.js 18+ (LTS recommended)
- npm or yarn

**Environment:**
- Windows PowerShell (or bash on Linux/Mac)
- Access to PostgreSQL server (local or remote)

### 1.2 PostgreSQL Installation

**Windows:**
```powershell
# Option 1: Download from postgresql.org
# https://www.postgresql.org/download/windows/

# Option 2: Using Chocolatey
choco install postgresql

# Option 3: Using Docker
docker run --name postgres-grc -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=grc -p 5432:5432 -d postgres:14
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**macOS:**
```bash
# Using Homebrew
brew install postgresql@14
brew services start postgresql@14
```

### 1.3 Verify PostgreSQL Installation

```powershell
# Check PostgreSQL version
psql --version

# Connect to PostgreSQL (default user: postgres)
psql -U postgres

# In psql, check version
SELECT version();
```

---

## 2. Environment Variables Setup

### 2.1 Required Environment Variables

**PowerShell (Windows):**
```powershell
# Set database engine
$env:DB_ENGINE = "postgres"

# Option 1: Using DATABASE_URL (recommended)
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/grc?schema=public"

# Option 2: Using individual variables
$env:DB_HOST = "localhost"
$env:DB_PORT = "5432"
$env:DB_USER = "postgres"
$env:DB_PASS = "postgres"
$env:DB_NAME = "grc"
$env:DB_SCHEMA = "public"

# Optional: SSL (if needed)
$env:DB_SSL = "false"

# Other required variables
$env:NODE_ENV = "development"
$env:JWT_SECRET = "your-jwt-secret-key"
$env:PORT = "5002"
```

**Bash (Linux/Mac):**
```bash
# Set database engine
export DB_ENGINE=postgres

# Option 1: Using DATABASE_URL (recommended)
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/grc?schema=public"

# Option 2: Using individual variables
export DB_HOST=localhost
export DB_PORT=5432
export DB_USER=postgres
export DB_PASS=postgres
export DB_NAME=grc
export DB_SCHEMA=public

# Optional: SSL (if needed)
export DB_SSL=false

# Other required variables
export NODE_ENV=development
export JWT_SECRET=your-jwt-secret-key
export PORT=5002
```

### 2.2 .env File Setup

**Create/Update `.env` file in `backend-nest/` directory:**
```env
# Database Configuration
DB_ENGINE=postgres
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/grc?schema=public

# Or use individual variables:
# DB_HOST=localhost
# DB_PORT=5432
# DB_USER=postgres
# DB_PASS=postgres
# DB_NAME=grc
# DB_SCHEMA=public
# DB_SSL=false

# Application
NODE_ENV=development
PORT=5002
JWT_SECRET=your-jwt-secret-key-change-in-production

# Feature Flags (optional, defaults to true)
ENABLE_POLICY=true
ENABLE_GOVERNANCE=true
ENABLE_RISK=true
ENABLE_AUDIT=true
ENABLE_BCM=true
```

---

## 3. PostgreSQL Database Setup

### 3.1 Create Database

**Using psql:**
```powershell
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE grc;

# Create user (if needed)
CREATE USER grc_user WITH PASSWORD 'grc_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE grc TO grc_user;

# Exit psql
\q
```

**Using SQL script:**
```sql
-- Create database
CREATE DATABASE grc;

-- Create user
CREATE USER grc_user WITH PASSWORD 'grc_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE grc TO grc_user;
```

**Using Docker:**
```powershell
# Database is already created in Docker container
# Use: postgres/postgres@localhost:5432/grc
```

### 3.2 Verify Database

```powershell
# Connect to database
psql -U postgres -d grc

# List tables (should be empty initially)
\dt

# List schemas
\dn

# Exit
\q
```

---

## 4. Migration Execution

### 4.1 Pre-Migration Checklist

✅ **Verify Environment Variables:**
```powershell
# Check DB_ENGINE
echo $env:DB_ENGINE  # Should be "postgres"

# Check DATABASE_URL or DB_HOST/DB_NAME
echo $env:DATABASE_URL
# OR
echo $env:DB_HOST
echo $env:DB_NAME
```

✅ **Verify Database Connection:**
```powershell
# Test connection
psql -U postgres -d grc -c "SELECT version();"
```

✅ **Verify Backend Build:**
```powershell
cd backend-nest
npm run build:once
```

### 4.2 Run Migrations

**Option A: Using TypeORM CLI (if available)**
```powershell
cd backend-nest
npm run migration:run
```

**Option B: Using Custom Script (recommended)**
```powershell
cd backend-nest
# Create migration-run script if not exists
npm run migration:run
```

**Option C: Manual Migration (for testing)**
```powershell
cd backend-nest
# Run migrations via TypeORM DataSource
node -e "
const { DataSource } = require('typeorm');
const config = require('./dist/config/database.config').dbConfigFactory();
const ds = new DataSource(config);
ds.initialize().then(() => {
  return ds.runMigrations();
}).then(() => {
  console.log('Migrations completed');
  return ds.destroy();
}).catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
"
```

### 4.3 Verify Migrations

**Check Migration Status:**
```powershell
# Using TypeORM CLI
npm run migration:show

# Or manually check migrations table
psql -U postgres -d grc -c "SELECT * FROM migrations ORDER BY timestamp DESC;"
```

**Verify Tables Created:**
```powershell
# Connect to database
psql -U postgres -d grc

# List all tables
\dt *.*

# List tables in app schema
\dt app.*

# List tables in auth schema
\dt auth.*

# List tables in tenant schema
\dt tenant.*

# Exit
\q
```

**Expected Tables:**
- `tenant.tenants`
- `auth.users`
- `auth.roles`
- `auth.permissions`
- `auth.role_permissions`
- `auth.user_roles`
- `app.policies`
- `app.standard`
- `app.standard_clause`
- `app.risk_category`
- `app.risk_catalog`
- ... (and more)

---

## 5. Seed Data

### 5.1 Run Seed Scripts

**Seed All Data:**
```powershell
cd backend-nest
npm run seed:all
```

**Seed Individual Components:**
```powershell
# Seed admin users
npm run seed:admin

# Seed dev users
npm run seed:dev-users

# Seed dictionaries
npm run seed:dictionaries

# Seed standards
npm run seed:standards

# Seed risk catalog
npm run seed:risk-catalog

# Seed calendar
npm run seed:calendar
```

### 5.2 Verify Seed Data

**Check Tenants:**
```powershell
psql -U postgres -d grc -c "SELECT id, name, slug FROM tenant.tenants;"
```

**Check Users:**
```powershell
psql -U postgres -d grc -c "SELECT id, email, display_name, tenant_id FROM auth.users;"
```

**Check Policies:**
```powershell
psql -U postgres -d grc -c "SELECT id, code, title, status, tenant_id FROM app.policies LIMIT 10;"
```

---

## 6. Backend Startup

### 6.1 Start Backend

**Development Mode:**
```powershell
cd backend-nest
npm run start:dev
```

**Production Mode:**
```powershell
cd backend-nest
npm run build
npm run start:prod
```

### 6.2 Verify Backend

**Health Check:**
```powershell
# Wait for backend to start (10-15 seconds)
Start-Sleep -Seconds 15

# Check health endpoint
curl http://localhost:5002/api/v2/health

# Or using PowerShell
Invoke-WebRequest -Uri http://localhost:5002/api/v2/health -UseBasicParsing
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-25T12:00:00.000Z",
  "database": "postgres"
}
```

---

## 7. Smoke Tests

### 7.1 Run Smoke Tests

**Run All Smoke Tests:**
```powershell
cd backend-nest
npm run smoke:all
```

**Run Individual Smoke Tests:**
```powershell
# Login smoke
npm run smoke:login

# Policies smoke
npm run smoke:policies

# Standards smoke
npm run smoke:standards

# Audit smoke
npm run smoke:audit-flow

# BCM smoke
npm run smoke:bcm-processes

# Calendar smoke
npm run smoke:calendar

# Admin smoke
npm run smoke:admin
```

### 7.2 Expected Results

**All Smoke Tests Should Pass:**
```
=== Smoke Test Summary ===
✅ Login
✅ Policies
✅ Standards
✅ Audit Flow
✅ BCM Processes
✅ Calendar
✅ Admin
✅ Governance

Total: 8, Passed: 8, Failed: 0
```

---

## 8. Troubleshooting

### 8.1 Common Issues

**Issue: Connection Refused**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**
- Verify PostgreSQL is running: `psql -U postgres -c "SELECT version();"`
- Check DB_HOST and DB_PORT environment variables
- Verify firewall settings

**Issue: Authentication Failed**
```
Error: password authentication failed for user "postgres"
```

**Solution:**
- Verify DB_USER and DB_PASS environment variables
- Check PostgreSQL user permissions
- Reset password if needed: `ALTER USER postgres WITH PASSWORD 'newpassword';`

**Issue: Database Does Not Exist**
```
Error: database "grc" does not exist
```

**Solution:**
- Create database: `CREATE DATABASE grc;`
- Verify DB_NAME environment variable

**Issue: Migration Failed**
```
Error: relation "migrations" does not exist
```

**Solution:**
- TypeORM creates migrations table automatically
- If it doesn't exist, create it manually or check TypeORM configuration

**Issue: Schema Does Not Exist**
```
Error: schema "app" does not exist
```

**Solution:**
- Migrations should create schemas automatically
- If not, create manually: `CREATE SCHEMA IF NOT EXISTS app;`

### 8.2 Debug Commands

**Check PostgreSQL Logs:**
```powershell
# Windows (if using default installation)
Get-Content "C:\Program Files\PostgreSQL\14\data\log\postgresql-*.log" -Tail 50

# Linux
sudo tail -f /var/log/postgresql/postgresql-14-main.log

# Docker
docker logs postgres-grc
```

**Check Backend Logs:**
```powershell
# Backend logs should show database connection
npm run start:dev
# Look for: "Using Postgres database"
```

**Test Database Connection:**
```powershell
# Using psql
psql -U postgres -d grc -c "SELECT current_database(), current_user;"

# Using Node.js
node -e "
const { DataSource } = require('typeorm');
const config = require('./dist/config/database.config').dbConfigFactory();
const ds = new DataSource(config);
ds.initialize().then(() => {
  console.log('Connected successfully');
  return ds.destroy();
}).catch(err => {
  console.error('Connection failed:', err);
  process.exit(1);
});
"
```

---

## 9. Rollback Procedures

### 9.1 Rollback Last Migration

**Using TypeORM CLI:**
```powershell
npm run migration:revert
```

**Manual Rollback:**
```powershell
# Connect to database
psql -U postgres -d grc

# Find last migration
SELECT * FROM migrations ORDER BY timestamp DESC LIMIT 1;

# Manually run down() method of last migration
# (or restore from backup)
```

### 9.2 Full Database Reset

**⚠️ WARNING: This will delete all data!**

```powershell
# Drop and recreate database
psql -U postgres -c "DROP DATABASE IF EXISTS grc;"
psql -U postgres -c "CREATE DATABASE grc;"

# Run migrations again
npm run migration:run

# Run seed scripts
npm run seed:all
```

---

## 10. Production Considerations

### 10.1 Security

**Environment Variables:**
- ✅ Never commit `.env` file to version control
- ✅ Use strong passwords for database users
- ✅ Use SSL/TLS for database connections in production
- ✅ Rotate JWT secrets regularly

**Database Users:**
- ✅ Create dedicated user for application (not `postgres` superuser)
- ✅ Grant minimum required privileges
- ✅ Use strong passwords

**Connection Security:**
- ✅ Use SSL connections: `DB_SSL=true`
- ✅ Restrict database access to application servers only
- ✅ Use connection pooling

### 10.2 Backup Strategy

**Before Migrations:**
```powershell
# Backup database
pg_dump -U postgres -d grc -F c -f grc_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').dump

# Restore from backup
pg_restore -U postgres -d grc -c grc_backup_20250125_120000.dump
```

**Automated Backups:**
- Set up cron job (Linux) or scheduled task (Windows)
- Backup before each migration
- Keep multiple backup versions

### 10.3 Monitoring

**Database Monitoring:**
- Monitor connection pool usage
- Monitor query performance
- Monitor disk space
- Monitor replication lag (if using)

**Application Monitoring:**
- Monitor migration execution time
- Monitor seed script execution
- Monitor smoke test results
- Set up alerts for failures

---

## 11. Quick Reference

### 11.1 Command Cheat Sheet

```powershell
# Environment Setup
$env:DB_ENGINE = "postgres"
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/grc"

# Database Setup
psql -U postgres -c "CREATE DATABASE grc;"

# Migrations
cd backend-nest
npm run migration:run
npm run migration:show
npm run migration:revert

# Seed
npm run seed:all

# Backend
npm run start:dev

# Smoke Tests
npm run smoke:all
```

### 11.2 Verification Checklist

✅ PostgreSQL installed and running  
✅ Database `grc` created  
✅ Environment variables set  
✅ Migrations run successfully  
✅ Seed data loaded  
✅ Backend starts without errors  
✅ Health endpoint returns 200  
✅ Smoke tests pass (8/8)  

---

## 12. Next Steps

**After Postgres Setup:**
1. ✅ Verify all migrations run successfully
2. ✅ Verify seed data is loaded
3. ✅ Verify smoke tests pass
4. ✅ Document any issues encountered
5. ✅ Update migration strategy if needed

**Future Improvements:**
- Automated Postgres setup script
- Docker Compose setup for local development
- CI/CD integration for Postgres testing
- Migration testing framework

---

**Playbook Status:** ✅ Complete  
**Changes Made:** None (documentation only)  
**Next Phase:** PHASE 4 - Final Validation and Summary Report

