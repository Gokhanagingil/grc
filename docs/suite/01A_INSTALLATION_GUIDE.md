# Installation & Deployment Guide (BT Runbook)

> **Version:** 1.0 | **Last Updated:** 2026-02-26 | **Status:** Outline (Ready for Final Writing)
>
> **Audience:** IT Operations, Data Center Team, DevOps Engineers
>
> **Evidence Map:** [EVIDENCE_MAP_v1.md](../discovery/EVIDENCE_MAP_v1.md) — Section 1

---

## Executive Summary

- **What this guide covers:** Step-by-step installation and deployment of the GRC Platform from bare metal to first admin login.
- **Deployment model:** Docker Compose on a single Linux server (recommended). Kubernetes is deferred (no manifests in repo).
- **Quick Start time:** 30–45 minutes for a single-server deployment with Docker Compose.
- **Production readiness:** Includes security hardening, backup procedures, monitoring recommendations, and Go/No-Go checklist.
- **Prerequisites:** Linux server (Ubuntu 22.04 recommended), Docker Engine 24+, Docker Compose v2, PostgreSQL 15 (via container), minimum 4 CPU / 8 GB RAM / 50 GB SSD.

---

## Table of Contents

1. [Quick Start (30–45 min)](#1-quick-start-3045-min)
2. [Prerequisites](#2-prerequisites)
3. [Deployment Options](#3-deployment-options)
4. [Step-by-Step: System Preparation](#4-step-by-step-system-preparation)
5. [Step-by-Step: Application Deployment](#5-step-by-step-application-deployment)
6. [Step-by-Step: Post-Deploy Validation](#6-step-by-step-post-deploy-validation)
7. [First Admin Login & Tenant Bootstrap](#7-first-admin-login--tenant-bootstrap)
8. [Operations Runbook](#8-operations-runbook)
9. [Security Hardening](#9-security-hardening)
10. [Troubleshooting](#10-troubleshooting)
11. [Go/No-Go Checklist](#11-gono-go-checklist)

---

## 1. Quick Start (30–45 min)

> **Audience:** Experienced Linux admin who wants to get running fast.

### 1.1 TL;DR Steps

```
1. Provision Ubuntu 22.04 server (4 CPU, 8 GB RAM, 50 GB SSD)
2. Install Docker Engine + Docker Compose v2
3. Clone/retrieve repository or deployment artifacts
4. Create external Docker volume for PostgreSQL
5. Configure .env file from template
6. Generate secrets (JWT, encryption keys)
7. docker compose -f docker-compose.staging.yml up -d
8. Run database migrations
9. Run seed scripts
10. Verify health endpoints
11. Create first admin user / verify demo admin login
```

### 1.2 Minimum Viable Commands

```bash
# Prerequisites (Ubuntu 22.04)
sudo apt update && sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER && newgrp docker

# Retrieve artifacts
git clone <repo-url> /opt/grc-platform
cd /opt/grc-platform

# Create external volume (CRITICAL — prevents data loss)
docker volume create grc-platform_grc_staging_postgres_data

# Configure environment
cp backend-nest/.env.production.template backend-nest/.env
# Edit .env — set JWT_SECRET, DB credentials, etc.

# Create upload directory with correct permissions
mkdir -p staging-data/uploads
chown -R 1001:65533 staging-data
chmod -R 775 staging-data

# Deploy
docker compose -f docker-compose.staging.yml up -d --build

# Wait for health checks to pass (60-90s)
sleep 90

# Verify
docker compose -f docker-compose.staging.yml ps
curl -i http://localhost/api/grc/controls  # Expect 401 (not 404)
curl http://localhost:3002/health/ready     # Expect 200

# Run migrations
docker compose -f docker-compose.staging.yml exec backend \
  npx typeorm migration:run -d dist/data-source.js

# Run seeds
docker compose -f docker-compose.staging.yml exec backend \
  node dist/scripts/seed-grc.js
docker compose -f docker-compose.staging.yml exec backend \
  node dist/scripts/seed-standards.js
docker compose -f docker-compose.staging.yml exec backend \
  node dist/scripts/seed-itsm-choices.js
```

---

## 2. Prerequisites

### 2.1 Hardware Requirements

| Requirement | Minimum | Recommended | Notes |
|------------|---------|-------------|-------|
| CPU | 2 cores | 4+ cores | Backend is CPU-bound during AI operations |
| RAM | 4 GB | 8+ GB | PostgreSQL + NestJS + nginx |
| Disk | 20 GB | 50+ GB SSD | DB growth, Docker images, uploads, logs |
| Network | 100 Mbps | 1 Gbps | For file uploads and API traffic |

### 2.2 Software Requirements

| Software | Version | Required | Notes |
|----------|---------|----------|-------|
| OS | Ubuntu 22.04 LTS | Yes | Other Linux distros supported with Docker |
| Docker Engine | 24.0+ | Yes | `docker --version` |
| Docker Compose | v2.20+ | Yes | `docker compose version` |
| Git | 2.30+ | Optional | For source-based deployment |

### 2.3 Network Requirements

| Port | Protocol | Direction | Purpose |
|------|----------|-----------|---------|
| 80 | HTTP | Inbound | Frontend + API (nginx) |
| 443 | HTTPS | Inbound | Frontend + API (TLS) |
| 22 | SSH | Inbound | Server administration |
| 5432 | TCP | Internal only | PostgreSQL (container-to-container) |
| 3002 | TCP | Internal only | Backend API (container-to-container) |

> **SECURITY:** Ports 5432 and 3002 should NOT be exposed to external networks. Only port 80/443 (nginx) should be public-facing.

### 2.4 DNS & SSL

<!-- DNS: A record pointing to server IP -->
<!-- SSL options: Cloudflare (recommended), Let's Encrypt, custom cert -->
<!-- Reference nginx-https.conf for direct TLS termination -->

### 2.5 Firewall Rules

<!-- UFW or iptables configuration -->
<!-- Allow: 80, 443, 22 -->
<!-- Block: 5432, 3002 from external -->

---

## 3. Deployment Options

### 3.1 Docker Compose (Recommended)

| Aspect | Detail |
|--------|--------|
| Compose file | `docker-compose.staging.yml` |
| Services | `db` (PostgreSQL 15), `backend` (NestJS), `frontend` (nginx+React) |
| Volumes | External PostgreSQL volume, named upload volume |
| Network | Bridge network, inter-container DNS |
| Scaling | Vertical only (single server) |

> **EVIDENCE:** `docker-compose.staging.yml` (175 lines)

### 3.2 Kubernetes [PLANNED — Deferred]

> **PLANNED:** No Kubernetes manifests, Helm charts, or operator configs exist in the repository. Docker Compose is the only supported deployment method.
>
> **Notes for future K8s support:**
> - Would need: Deployment + Service + Ingress for backend/frontend
> - Would need: StatefulSet for PostgreSQL (or managed DB)
> - Would need: PersistentVolumeClaim for DB and uploads
> - Would need: ConfigMap/Secret for environment variables
> - Would need: NetworkPolicy for pod isolation

---

## 4. Step-by-Step: System Preparation

### 4.1 OS Setup

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y \
  docker.io \
  docker-compose-v2 \
  git \
  curl \
  openssl

# Enable Docker service
sudo systemctl enable docker
sudo systemctl start docker

# Add deploy user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify Docker
docker --version
docker compose version
```

### 4.2 User & Permissions

<!-- Dedicated deploy user (not root) -->
<!-- Docker group membership -->
<!-- File permission strategy for volumes -->

> **SECURITY:** Do not run production services as root. Use a dedicated deploy user with docker group access.

### 4.3 Disk Preparation

<!-- Partition layout recommendations -->
<!-- Separate mount for /var/lib/docker if possible -->
<!-- Disk monitoring setup -->

### 4.4 Docker Volume Creation

```bash
# CRITICAL: Create external volume BEFORE first deploy
# This prevents docker compose from creating a local volume that could be lost
docker volume create grc-platform_grc_staging_postgres_data

# Verify volume exists
docker volume inspect grc-platform_grc_staging_postgres_data
```

> **RISK:** If this volume is not created before first `docker compose up`, Docker will create a non-external volume. The staging compose file declares this volume as `external: true` and will FAIL if it doesn't exist.

---

## 5. Step-by-Step: Application Deployment

### 5.1 Retrieve Artifacts

```bash
# Option A: Git clone (if server has repo access)
git clone <repo-url> /opt/grc-platform
cd /opt/grc-platform

# Option B: Archive deployment (pre-built images)
# Transfer docker-compose.staging.yml + .env + pre-built images
# docker load < grc-backend.tar
# docker load < grc-frontend.tar
```

### 5.2 Environment Setup

```bash
# Copy production template
cp backend-nest/.env.production.template backend-nest/.env

# Generate required secrets (use sed to replace placeholders, not append)
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|" backend-nest/.env
# REFRESH_TOKEN_SECRET is not in the template — append it
echo "REFRESH_TOKEN_SECRET=$(openssl rand -hex 32)" >> backend-nest/.env
# Append keys not in template
echo "AI_ENCRYPTION_KEY=$(openssl rand -hex 32)" >> backend-nest/.env
```

### 5.3 Required Environment Variables

| Variable | Required | How to Generate | Description |
|----------|----------|----------------|-------------|
| `JWT_SECRET` | Yes | `openssl rand -hex 32` | JWT signing secret (min 32 chars) |
| `REFRESH_TOKEN_SECRET` | Yes | `openssl rand -hex 32` | Refresh token signing secret |
| `REFRESH_TOKEN_EXPIRES_IN` | Yes | e.g., `7d` | Refresh token TTL |
| `DB_HOST` | Yes | `db` (container name) | PostgreSQL host |
| `DB_PORT` | Yes | `5432` | PostgreSQL port |
| `DB_USER` | Yes | — | PostgreSQL user |
| `DB_PASSWORD` | Yes | — | PostgreSQL password |
| `DB_NAME` | Yes | — | PostgreSQL database name |
| `DB_SYNC` | Yes | `false` | **MUST be false** in production |
| `NODE_ENV` | Yes | `production` | Runtime environment |
| `PORT` | Yes | `3002` | Backend listening port |
| `DEMO_ADMIN_EMAIL` | Yes | — | Initial admin email |
| `DEMO_ADMIN_PASSWORD` | Yes | — | Initial admin password |
| `AI_ENCRYPTION_KEY` | Optional | `openssl rand -hex 32` | For AI feature encryption |

> **SECURITY:** Never use default or weak secrets. Generate all keys with `openssl rand -hex 32`. Never commit `.env` files to version control.

> **RISK:** Setting `DB_SYNC=true` in production will cause the application to exit immediately with `process.exit(1)`. This is an intentional safety mechanism.

### 5.4 Upload Directory Setup

```bash
# Create upload directory with correct ownership
mkdir -p staging-data/uploads
chown -R 1001:65533 staging-data
chmod -R 775 staging-data
```

> **EVIDENCE:** `docker-compose.staging.yml` volume mounts for `./staging-data:/app/data`

### 5.5 Docker Compose Up

```bash
# Build and start all services
docker compose -f docker-compose.staging.yml up -d --build

# Monitor startup (wait for all containers to be healthy)
watch -n 5 'docker compose -f docker-compose.staging.yml ps'

# Expected: all 3 services show "healthy"
# Typical startup time: 60-90 seconds
```

### 5.6 Database Migrations

```bash
# Show pending migrations
docker compose -f docker-compose.staging.yml exec backend \
  npx typeorm migration:show -d dist/data-source.js

# Run all pending migrations
docker compose -f docker-compose.staging.yml exec backend \
  npx typeorm migration:run -d dist/data-source.js
```

> **OPS:** Always run `migration:show` before `migration:run` to verify what will be applied.

### 5.7 Seed Data

```bash
# Core GRC seed data (risks, controls, policies)
docker compose -f docker-compose.staging.yml exec backend \
  node dist/scripts/seed-grc.js

# Compliance standards (ISO 27001, NIST, etc.)
docker compose -f docker-compose.staging.yml exec backend \
  node dist/scripts/seed-standards.js

# Compliance frameworks
docker compose -f docker-compose.staging.yml exec backend \
  node dist/scripts/seed-frameworks.js

# ITSM choice lists
docker compose -f docker-compose.staging.yml exec backend \
  node dist/scripts/seed-itsm-choices.js

# ITSM baseline data
docker compose -f docker-compose.staging.yml exec backend \
  node dist/scripts/seed-itsm-baseline.js

# SOA profiles
docker compose -f docker-compose.staging.yml exec backend \
  node dist/scripts/seed-soa.js

# CMDB content pack
docker compose -f docker-compose.staging.yml exec backend \
  node dist/scripts/seed-cmdb-content-pack-v1.js

# Onboarding wizard data
docker compose -f docker-compose.staging.yml exec backend \
  node dist/scripts/seed-onboarding.js
```

> **OPS:** All seed scripts are idempotent — safe to re-run. They will skip existing records.

---

## 6. Step-by-Step: Post-Deploy Validation

### 6.1 Container Health

```bash
# All containers should show "healthy"
docker compose -f docker-compose.staging.yml ps

# Expected output:
# grc-staging-db        running (healthy)
# grc-staging-backend   running (healthy)
# grc-staging-frontend  running (healthy)
```

### 6.2 Health Endpoint Checks

```bash
# Backend liveness (inside container — use wget as curl may not be installed)
docker compose -f docker-compose.staging.yml exec backend \
  wget -q -S -O /dev/null http://localhost:3002/health/live

# Backend readiness
docker compose -f docker-compose.staging.yml exec backend \
  wget -q -S -O /dev/null http://localhost:3002/health/ready

# Backend DB connectivity
docker compose -f docker-compose.staging.yml exec backend \
  wget -q -S -O /dev/null http://localhost:3002/health/db

# Backend auth check
docker compose -f docker-compose.staging.yml exec backend \
  wget -q -S -O /dev/null http://localhost:3002/health/auth

# Frontend health (from host)
curl -s http://localhost/frontend-health
# Expected: "healthy"
```

### 6.3 Routing Validation

```bash
# API routing: should return 401 (not 404)
curl -i http://localhost/api/grc/controls
# Expected: HTTP 401 Unauthorized (JSON response from backend guards)
# If you get 404: nginx routing is broken

# Direct backend access (if port exposed): should return 401
curl -i http://localhost:3002/grc/controls
# Expected: HTTP 401 Unauthorized
```

> **VALIDATION:** If `/api/grc/controls` returns 404 instead of 401, the nginx `proxy_pass` trailing slash is missing. Check `nginx.conf` line: `proxy_pass http://backend/;` (trailing slash critical).

### 6.4 Migration Verification

```bash
# Verify all migrations are applied (no "[X]" markers missing)
docker compose -f docker-compose.staging.yml exec backend \
  npx typeorm migration:show -d dist/data-source.js
```

### 6.5 Platform Validation

```bash
# Run full platform validation suite
docker compose -f docker-compose.staging.yml exec backend \
  node dist/scripts/platform-validate.js
```

---

## 7. First Admin Login & Tenant Bootstrap

### 7.1 Default Demo Tenant

<!-- Default tenant: 00000000-0000-0000-0000-000000000001 -->
<!-- Created by seed scripts -->

### 7.2 First Admin Login

```bash
# Login with demo admin credentials (set in .env)
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "<DEMO_ADMIN_EMAIL>", "password": "<DEMO_ADMIN_PASSWORD>"}'

# Expected: JSON response with accessToken and refreshToken
```

### 7.3 Tenant Bootstrap Steps

<!-- 1. Login as admin -->
<!-- 2. Navigate to Admin → Tenants -->
<!-- 3. Create production tenant (or use default demo tenant) -->
<!-- 4. Configure tenant settings -->
<!-- 5. Create operational users with appropriate roles -->
<!-- 6. Adopt frameworks (Admin → Frameworks) -->

### 7.4 Initial Configuration Checklist

| Step | Action | UI Path |
|------|--------|---------|
| 1 | Verify admin login | `/login` |
| 2 | Configure tenant settings | `/admin/settings` |
| 3 | Adopt compliance frameworks | `/admin/frameworks` |
| 4 | Configure AI providers (optional) | `/admin/ai-control-center` |
| 5 | Register Tool Gateway endpoints (optional) | `/admin/tool-gateway` |
| 6 | Create additional users | `/admin/users` |
| 7 | Assign roles and permissions | `/admin/users/:id/roles` |

---

## 8. Operations Runbook

### 8.1 Start / Stop / Restart

```bash
# Start all services
docker compose -f docker-compose.staging.yml up -d

# Stop all services (preserves data)
docker compose -f docker-compose.staging.yml down

# Restart specific service
docker compose -f docker-compose.staging.yml restart backend

# Rebuild and restart (after code changes)
docker compose -f docker-compose.staging.yml up -d --build backend frontend
```

> **RISK:** Never use `docker compose down -v` in production — this removes volumes and DESTROYS the database.

### 8.2 Viewing Logs

```bash
# All services (last 100 lines)
docker compose -f docker-compose.staging.yml logs --tail=100

# Backend only (follow mode)
docker compose -f docker-compose.staging.yml logs -f --tail=100 backend

# Frontend/nginx logs
docker compose -f docker-compose.staging.yml logs --tail=100 frontend

# Database logs
docker compose -f docker-compose.staging.yml logs --tail=100 db

# Search for errors
docker compose -f docker-compose.staging.yml logs backend 2>&1 | grep -i error
```

### 8.3 Backup & Restore (PostgreSQL)

#### Backup

```bash
# Create timestamped backup
docker compose -f docker-compose.staging.yml exec -T db \
  pg_dump -U <DB_USER> <DB_NAME> \
  > /opt/grc-platform/backups/grc_$(date +%Y%m%d_%H%M%S).sql

# Compressed backup
docker compose -f docker-compose.staging.yml exec -T db \
  pg_dump -U <DB_USER> <DB_NAME> | gzip \
  > /opt/grc-platform/backups/grc_$(date +%Y%m%d_%H%M%S).sql.gz
```

#### Restore

```bash
# Stop backend to prevent writes during restore
docker compose -f docker-compose.staging.yml stop backend

# Restore from backup
docker compose -f docker-compose.staging.yml exec -T db \
  psql -U <DB_USER> <DB_NAME> \
  < /opt/grc-platform/backups/grc_YYYYMMDD_HHMMSS.sql

# Restart backend
docker compose -f docker-compose.staging.yml start backend
```

> **RISK:** No automated backup pipeline exists. Implement cron-based backups:
> ```bash
> # Add to crontab: daily backup at 2 AM
> 0 2 * * * docker compose -f /opt/grc-platform/docker-compose.staging.yml exec -T db pg_dump -U <user> <db> | gzip > /opt/grc-platform/backups/grc_$(date +\%Y\%m\%d).sql.gz
> ```

### 8.4 Upgrade Procedure

```bash
# 1. Backup database (MANDATORY before upgrade)
docker compose -f docker-compose.staging.yml exec -T db \
  pg_dump -U <user> <db> > /opt/grc-platform/backups/pre-upgrade.sql

# 2. Pull latest code
cd /opt/grc-platform
git pull origin main

# 3. Rebuild and restart
docker compose -f docker-compose.staging.yml up -d --build

# 4. Run pending migrations
docker compose -f docker-compose.staging.yml exec backend \
  npx typeorm migration:run -d dist/data-source.js

# 5. Verify health
docker compose -f docker-compose.staging.yml ps
curl http://localhost:3002/health/ready

# 6. Run platform validation
docker compose -f docker-compose.staging.yml exec backend \
  node dist/scripts/platform-validate.js
```

### 8.5 Rollback Procedure

```bash
# 1. Stop services
docker compose -f docker-compose.staging.yml down

# 2. Revert to previous version
git checkout <previous-tag-or-commit>

# 3. Restore database from pre-upgrade backup
docker compose -f docker-compose.staging.yml up -d db
sleep 10
docker compose -f docker-compose.staging.yml exec -T db \
  psql -U <user> <db> < /opt/grc-platform/backups/pre-upgrade.sql

# 4. Rebuild and start with previous version
docker compose -f docker-compose.staging.yml up -d --build

# 5. Verify health
docker compose -f docker-compose.staging.yml ps
```

> **OPS:** Always keep at least the last 3 backups for rollback capability.

### 8.6 Monitoring & Alerting (Recommendations)

> **PLANNED:** No built-in monitoring dashboards exist. The `/metrics` endpoint is available for Prometheus scraping.

**Recommended monitoring stack:**
- **Prometheus** — scrape `/metrics` endpoint
- **Grafana** — dashboards for API latency, error rates, DB connections
- **Alertmanager** — alerts for health endpoint failures, disk usage, backup failures

**Key metrics to monitor:**
| Metric | Threshold | Action |
|--------|-----------|--------|
| Health endpoint down | >30s | Page on-call |
| Disk usage | >80% | Run Docker prune + expand disk |
| DB connections | >80% pool | Investigate connection leaks |
| API error rate (5xx) | >1% | Check backend logs |
| Backup age | >24h | Investigate backup cron |

### 8.7 Disk Cleanup

```bash
# Remove unused Docker images (safe)
docker image prune -f

# Remove unused Docker build cache
docker builder prune -f

# Check disk usage
df -h
docker system df

# CAUTION: Never run "docker volume prune" — it may delete the DB volume
```

> **RISK:** `docker volume prune` can destroy the PostgreSQL data volume. Never run it in production. Use `docker image prune` and `docker builder prune` only.

---

## 9. Security Hardening

### 9.1 Least Privilege

<!-- Dedicated deploy user, not root -->
<!-- Docker group access only -->
<!-- No sudo for application operations -->

### 9.2 Firewall Configuration

```bash
# UFW configuration
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

> **SECURITY:** Ports 5432 (PostgreSQL) and 3002 (backend) must NOT be accessible from external networks.

### 9.3 TLS/SSL Configuration

<!-- Option A: Cloudflare (recommended — free TLS, WAF, DDoS protection) -->
<!-- Option B: Let's Encrypt with certbot -->
<!-- Option C: Custom certificates via nginx-https.conf -->

> **EVIDENCE:** `frontend/nginx-https.conf` for direct TLS termination

### 9.4 Secrets Rotation

<!-- Schedule: rotate JWT_SECRET and REFRESH_TOKEN_SECRET quarterly -->
<!-- Procedure: update .env → restart backend → users re-authenticate -->

> **SECURITY:** Rotate all secrets (JWT, DB password, encryption keys) at least quarterly. After rotation, all users will need to re-authenticate.

### 9.5 SSRF Controls (Tool Gateway)

<!-- Tool Gateway has governance layer -->
<!-- URL allowlisting, private IP blocking -->

### 9.6 Audit Log Monitoring

<!-- AuditLog entity captures all mutations -->
<!-- Regularly review audit logs for suspicious activity -->

### 9.7 Container Hardening

<!-- Read-only filesystem where possible -->
<!-- No privileged containers -->
<!-- Resource limits (CPU, memory) in compose -->

---

## 10. Troubleshooting

### 10.1 Common Installation Errors

| Symptom | Likely Cause | Resolution |
|---------|-------------|------------|
| `external volume not found` | DB volume not pre-created | `docker volume create grc-platform_grc_staging_postgres_data` |
| `DB_SYNC` process exit | `DB_SYNC=true` in production .env | Set `DB_SYNC=false` in `.env` |
| Backend fails to start | Missing required env vars | Check all required vars in `.env` against template |
| Frontend shows blank page | API URL misconfigured | Verify `REACT_APP_API_URL` is empty (same-origin) |
| 404 on `/api/grc/*` | Nginx proxy_pass missing trailing slash | Verify `proxy_pass http://backend/;` in nginx.conf |
| 401 on all endpoints | JWT_SECRET not set or wrong | Check `JWT_SECRET` in `.env`, restart backend |
| 403 HTML response | Cloudflare challenge | Verify DNS and Cloudflare configuration |
| 403 JSON response | PermissionsGuard rejection | Check user permissions for the action |
| Migration error | Out-of-order migrations | Run `migration:show` to identify gaps |
| Seed fails with "duplicate" | Seeds are idempotent — this shouldn't happen | Check seed script output for actual error |
| Upload permission denied | Wrong directory ownership | `chown -R 1001:65533 staging-data && chmod -R 775 staging-data` |
| Container OOM killed | Insufficient RAM | Increase server RAM or set memory limits |

### 10.2 Diagnostic Commands

```bash
# Container status
docker compose -f docker-compose.staging.yml ps

# Backend logs (recent)
docker compose -f docker-compose.staging.yml logs --tail=120 backend

# Database connectivity (inside backend container)
docker compose -f docker-compose.staging.yml exec backend \
  wget -q -S -O /dev/null http://localhost:3002/health/db

# Check nginx config
docker compose -f docker-compose.staging.yml exec frontend \
  nginx -T | head -50

# Check environment variables (safely — no secrets)
docker compose -f docker-compose.staging.yml exec backend \
  sh -c 'echo NODE_ENV=$NODE_ENV PORT=$PORT DB_HOST=$DB_HOST DB_SYNC=$DB_SYNC'

# Database connection test
docker compose -f docker-compose.staging.yml exec db \
  pg_isready -U <username>

# List applied migrations
docker compose -f docker-compose.staging.yml exec backend \
  npx typeorm migration:show -d dist/data-source.js
```

### 10.3 Log Analysis Patterns

```bash
# Find TypeORM errors
docker compose -f docker-compose.staging.yml logs backend 2>&1 | grep -i "typeorm\|migration\|query"

# Find auth failures
docker compose -f docker-compose.staging.yml logs backend 2>&1 | grep -i "401\|unauthorized\|jwt"

# Find permission errors
docker compose -f docker-compose.staging.yml logs backend 2>&1 | grep -i "403\|forbidden\|permission"

# Find unhandled exceptions
docker compose -f docker-compose.staging.yml logs backend 2>&1 | grep -i "unhandled\|uncaught\|fatal"
```

---

## 11. Go/No-Go Checklist

> **Purpose:** Complete this checklist before declaring the environment production-ready.

### 11.1 Infrastructure

| # | Check | Expected | Status |
|---|-------|----------|--------|
| 1 | All 3 containers healthy | `healthy` status | |
| 2 | External DB volume exists | `docker volume inspect` succeeds | |
| 3 | Upload directory writable | Write test passes | |
| 4 | Firewall configured | Only 22/80/443 open | |
| 5 | TLS/SSL active | HTTPS serves valid cert | |
| 6 | DNS resolves correctly | Domain → server IP | |

### 11.2 Application

| # | Check | Expected | Status |
|---|-------|----------|--------|
| 7 | Backend `/health/live` | 200 OK | |
| 8 | Backend `/health/ready` | 200 OK | |
| 9 | Backend `/health/db` | 200 OK | |
| 10 | Backend `/health/auth` | 200 OK with refresh config | |
| 11 | Frontend serves | HTML page loads | |
| 12 | Frontend health | `curl /frontend-health` → "healthy" | |
| 13 | API routing | `/api/grc/controls` → 401 (not 404) | |

### 11.3 Data

| # | Check | Expected | Status |
|---|-------|----------|--------|
| 14 | All migrations applied | `migration:show` — all checked | |
| 15 | GRC seed data present | Risks, Controls, Policies exist | |
| 16 | Standards seeded | ISO 27001, NIST, etc. | |
| 17 | ITSM choices seeded | Picklist values present | |
| 18 | CMDB content pack | CI classes + sample CIs | |

### 11.4 Security

| # | Check | Expected | Status |
|---|-------|----------|--------|
| 19 | `DB_SYNC=false` | Confirmed in .env | |
| 20 | `JWT_SECRET` is strong | ≥32 random hex chars | |
| 21 | `.env` not in git | `.gitignore` excludes it | |
| 22 | No default passwords | All secrets generated | |
| 23 | Rate limiting active | 429 on rapid auth calls | |

### 11.5 Operations

| # | Check | Expected | Status |
|---|-------|----------|--------|
| 24 | Backup procedure tested | Backup + restore cycle verified | |
| 25 | Rollback procedure documented | Team reviewed | |
| 26 | Monitoring configured | Health checks monitored | |
| 27 | Log rotation configured | Logs don't fill disk | |
| 28 | Platform validation green | `platform-validate.js` passes | |
| 29 | Admin login works | Demo admin can authenticate | |
| 30 | First user created | Operational user with correct roles | |

---

## Appendix

### A. Related Documents

- [Infrastructure Guide](./01_INFRASTRUCTURE.md)
- [Technical Architecture](./02_TECHNICAL.md)
- [Evidence Map — Infrastructure](../discovery/EVIDENCE_MAP_v1.md#1-infrastructure)
- [Docker Compose File](../../docker-compose.staging.yml)
- [Env Template](../../backend-nest/.env.production.template)

### B. File Reference

| File | Purpose |
|------|---------|
| `docker-compose.staging.yml` | Production/staging deployment |
| `docker-compose.nest.yml` | Local development |
| `backend-nest/.env.production.template` | Production env template |
| `backend-nest/.env.example` | Development env template |
| `frontend/nginx.conf` | Reverse proxy configuration |
| `frontend/nginx-https.conf` | HTTPS configuration |
| `backend-nest/Dockerfile` | Backend container image |
| `frontend/Dockerfile` | Frontend container image |
| `ops/staging-db-validate.sh` | DB validation script |
| `ops/staging-deploy-validate.sh` | Deploy validation script |

### C. Seed Script Reference

| Script | Purpose | Idempotent |
|--------|---------|-----------|
| `seed-grc.js` | Core GRC data | Yes |
| `seed-standards.js` | Compliance standards | Yes |
| `seed-frameworks.js` | Compliance frameworks | Yes |
| `seed-itsm-choices.js` | ITSM picklist values | Yes |
| `seed-itsm-baseline.js` | ITSM baseline data | Yes |
| `seed-soa.js` | SOA profiles | Yes |
| `seed-cmdb-content-pack-v1.js` | CMDB baseline | Yes |
| `seed-onboarding.js` | Onboarding wizard | Yes |
| `seed-golden-flow.js` | Demo golden path | Yes |
| `seed-demo-story.js` | Demo scenario | Yes |
| `seed-notification-demo.js` | Notification templates | Yes |
| `seed-api-catalog-demo.js` | API catalog entries | Yes |
| `seed-cmdb-mi-demo.js` | CMDB Model Intelligence | Yes |
| `seed-scenario-pack.js` | Full scenario demo | Yes |
