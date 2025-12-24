# Staging Operations Runbook

This document is the single source of truth for staging environment operations. All deployment, restart, and maintenance procedures are documented here.

## Environment Information

| Property | Value |
|----------|-------|
| Server IP | 46.224.99.150 |
| SSH User | root |
| Deployment Path | /opt/grc-platform |
| Backend API URL | http://46.224.99.150:3002 |
| Frontend URL | http://46.224.99.150:3000 |
| PostgreSQL Port | 5432 |
| Node.js Version | 20.x |
| PostgreSQL Version | 15 |

## Pre-Deployment Checklist

Before deploying to staging, verify:

- [ ] All CI checks pass on the branch
- [ ] No pending migrations that could break existing data
- [ ] Environment variables are up to date
- [ ] Database backup is recent (< 24 hours)
- [ ] Team is notified of deployment window

## Standard Deployment Procedure

### Step 1: Connect to Staging Server

```bash
ssh root@46.224.99.150
cd /opt/grc-platform
```

### Step 2: Create Database Backup

```bash
# Create timestamped backup
docker compose exec postgres pg_dump -U postgres grc_platform > \
  /opt/backups/grc_platform_$(date +%Y%m%d_%H%M%S).sql

# Verify backup was created
ls -la /opt/backups/ | head -5
```

### Step 3: Pull Latest Code

```bash
# Fetch and pull latest changes
git fetch origin
git pull origin main

# Or for specific branch
git checkout feature-branch
git pull origin feature-branch
```

### Step 4: Build and Deploy

```bash
# Stop existing containers
docker compose down

# Build and start with fresh images
docker compose up --build -d

# Wait for containers to be healthy
docker compose ps
```

### Step 5: Run Migrations (if needed)

```bash
# Check migration status
docker compose exec backend npm run migration:show

# Run pending migrations
docker compose exec backend npm run migration:run
```

### Step 6: Post-Deployment Validation

```bash
# Run platform validation
docker compose exec backend npm run platform:validate

# Or run individual checks
docker compose exec backend npm run validate:env
docker compose exec backend npm run validate:db
docker compose exec backend npm run validate:migrations
docker compose exec backend npm run smoke:auth-onboarding
```

### Step 7: Verify Health Endpoints

```bash
# Liveness check
curl -s http://localhost:3002/health/live | jq .

# Readiness check
curl -s http://localhost:3002/health/ready | jq .

# Full health check
curl -s http://localhost:3002/health | jq .
```

## Quick Restart Procedure

For simple restarts without code changes:

```bash
# SSH to server
ssh root@46.224.99.150
cd /opt/grc-platform

# Restart containers
docker compose restart

# Wait for health checks
sleep 10

# Verify health
curl -s http://localhost:3002/health/live | jq .
```

Or use the restart script:

```bash
./scripts/restart-staging.sh
```

## Database Backup and Restore

### Creating Backups

```bash
# Manual backup
docker compose exec postgres pg_dump -U postgres grc_platform > \
  /opt/backups/grc_platform_$(date +%Y%m%d_%H%M%S).sql

# Compressed backup
docker compose exec postgres pg_dump -U postgres grc_platform | \
  gzip > /opt/backups/grc_platform_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Restoring from Backup

```bash
# Stop application (keep database running)
docker compose stop backend frontend

# Restore from backup
docker compose exec -T postgres psql -U postgres grc_platform < \
  /opt/backups/grc_platform_YYYYMMDD_HHMMSS.sql

# Restart application
docker compose start backend frontend

# Verify restoration
docker compose exec backend npm run platform:validate
```

### Backup Retention Policy

- Keep daily backups for 7 days
- Keep weekly backups for 4 weeks
- Keep monthly backups for 3 months

Clean old backups:
```bash
# Remove backups older than 7 days
find /opt/backups -name "*.sql" -mtime +7 -delete
find /opt/backups -name "*.sql.gz" -mtime +7 -delete
```

## Rollback Procedures

### Rollback to Previous Code Version

```bash
# SSH to server
ssh root@46.224.99.150
cd /opt/grc-platform

# Find previous commit
git log --oneline -10

# Revert to specific commit
git checkout <commit-hash>

# Rebuild and restart
docker compose down
docker compose up --build -d

# Verify
docker compose exec backend npm run platform:validate
```

### Rollback Migration

```bash
# Revert last migration
docker compose exec backend npm run migration:revert

# Verify migration status
docker compose exec backend npm run migration:show
```

### Emergency Rollback (Full)

If deployment causes critical issues:

```bash
# 1. Stop all containers
docker compose down

# 2. Restore database from backup
docker compose up -d postgres
sleep 5
docker compose exec -T postgres psql -U postgres grc_platform < \
  /opt/backups/grc_platform_LAST_KNOWN_GOOD.sql

# 3. Checkout last known good commit
git checkout <last-known-good-commit>

# 4. Rebuild and start
docker compose up --build -d

# 5. Verify
docker compose exec backend npm run platform:validate
```

## Container Management

### View Container Status

```bash
docker compose ps
```

### View Container Logs

```bash
# All containers
docker compose logs -f

# Specific container
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres

# Last N lines
docker compose logs --tail=100 backend
```

### Restart Individual Containers

```bash
# Restart backend only
docker compose restart backend

# Restart frontend only
docker compose restart frontend

# Restart database (use with caution)
docker compose restart postgres
```

### Shell Access to Containers

```bash
# Backend container
docker compose exec backend sh

# Database container
docker compose exec postgres psql -U postgres grc_platform
```

## Environment Variables

### Required Variables

```bash
# Database
DB_HOST=postgres
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=<secure-password>
DB_NAME=grc_platform

# Authentication
JWT_SECRET=<min-32-char-secret>
JWT_EXPIRES_IN=24h
REFRESH_TOKEN_SECRET=<min-32-char-secret>
REFRESH_TOKEN_EXPIRES_IN=7d

# Application
NODE_ENV=staging
PORT=3002
```

### Updating Environment Variables

```bash
# Edit .env file
nano /opt/grc-platform/.env

# Restart containers to apply
docker compose down
docker compose up -d
```

## Monitoring and Alerts

### Health Check Endpoints

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `/health/live` | Liveness probe | `{ status: 'ok' }` |
| `/health/ready` | Readiness probe | `{ status: 'ok', database: 'connected' }` |
| `/health` | Full health | All subsystems status |
| `/health/db` | Database health | Connection status |
| `/health/auth` | Auth health | JWT configuration status |

### Manual Health Check Script

```bash
#!/bin/bash
# health-check.sh

echo "Checking liveness..."
curl -s http://localhost:3002/health/live | jq .

echo "Checking readiness..."
curl -s http://localhost:3002/health/ready | jq .

echo "Checking database..."
curl -s http://localhost:3002/health/db | jq .
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs for errors
docker compose logs backend --tail=50

# Check if port is in use
netstat -tlnp | grep 3002

# Check disk space
df -h

# Check memory
free -m
```

### Database Connection Issues

```bash
# Test database connectivity
docker compose exec postgres pg_isready -U postgres

# Check database logs
docker compose logs postgres --tail=50

# Verify database exists
docker compose exec postgres psql -U postgres -c "\l"
```

### Migration Failures

```bash
# Check migration status
docker compose exec backend npm run migration:show

# Check for pending migrations
docker compose exec backend npm run validate:migrations

# View migration table
docker compose exec postgres psql -U postgres grc_platform \
  -c "SELECT * FROM migrations ORDER BY timestamp DESC LIMIT 5"
```

### High Memory Usage

```bash
# Check container resource usage
docker stats

# Restart containers to free memory
docker compose restart

# Check for memory leaks in logs
docker compose logs backend | grep -i "memory\|heap"
```

## Security Considerations

### SSH Access

- Use SSH keys only (password authentication disabled)
- Limit SSH access to authorized IPs
- Use non-root user for routine operations

### Secrets Management

- Never commit secrets to git
- Use environment variables for all secrets
- Rotate secrets quarterly
- Use strong passwords (min 32 characters for JWT secrets)

### Network Security

- Firewall allows only ports 22, 80, 443, 3000, 3002
- Database port (5432) not exposed externally
- Use HTTPS in production (staging may use HTTP)

## Contact Information

For staging environment issues:

- Primary: Platform Team
- Escalation: DevOps Team
- Emergency: On-call Engineer

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2024-12-23 | Initial runbook creation | FAZ 4 |
