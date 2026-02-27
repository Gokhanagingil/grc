# DC Migration Pack — On-Premises Data Center Cutover

> **Version**: 1.0  
> **Target domain**: `niles-grc.com`  
> **Architecture**: Docker Compose on single app host (v1)  
> **TLS termination**: Corporate LB/ADC (nginx TLS fallback acceptable)  
> **Database**: Dedicated host on private network

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Pre-Cutover Preparation](#2-pre-cutover-preparation)
3. [Step-by-Step Cutover Plan](#3-step-by-step-cutover-plan)
4. [Go-Live PASS / FAIL Checklist](#4-go-live-pass--fail-checklist)
5. [Post-Cutover Verification](#5-post-cutover-verification)
6. [Rollback Plan](#6-rollback-plan)
7. [Seed Guidance](#7-seed-guidance)

---

## 1. Prerequisites

All items below must be completed **before** scheduling the cutover window.

### Infrastructure

| Item | Owner | Status |
|---|---|---|
| App host provisioned (Docker + Compose installed) | Infra | ☐ |
| Dedicated DB host provisioned (PostgreSQL 15+) | DBA | ☐ |
| Private network between app host ↔ DB host (port 5432 allowlisted) | Network | ☐ |
| Corporate LB/ADC configured for `niles-grc.com` | Network | ☐ |
| TLS certificate issued for `niles-grc.com` | Security | ☐ |
| DNS `niles-grc.com` A-record ready (low TTL, point to old/holding page) | DNS | ☐ |
| Docker images built and pushed to internal registry | CI/CD | ☐ |
| `.env` file prepared from `.env.production.template` | DevOps | ☐ |

### Database

| Item | Owner | Status |
|---|---|---|
| PostgreSQL 15+ installed on DB host | DBA | ☐ |
| Database `grc_platform` created | DBA | ☐ |
| App user `grc_app_user` created with appropriate grants | DBA | ☐ |
| Network connectivity verified: `pg_isready -h <DB_HOST> -p 5432 -U grc_app_user` | DevOps | ☐ |
| Backup strategy configured (pg_dump schedule, WAL archiving, or managed backup) | DBA | ☐ |

### Application

| Item | Owner | Status |
|---|---|---|
| `.env` reviewed — all `<PLACEHOLDER>` values replaced | DevOps | ☐ |
| `DB_SYNC=false` confirmed | DevOps | ☐ |
| `ENABLE_DEMO_BOOTSTRAP=false` confirmed (or `true` for initial setup only) | DevOps | ☐ |
| `JWT_SECRET` and `REFRESH_TOKEN_SECRET` generated (`openssl rand -base64 64`) | Security | ☐ |
| `CORS_ORIGINS=https://niles-grc.com` set | DevOps | ☐ |

---

## 2. Pre-Cutover Preparation

### 2.1 Transfer Code to App Host

```bash
# On the app host
git clone <internal-repo-url> /opt/grc-platform
cd /opt/grc-platform
git checkout <release-tag>
```

### 2.2 Place Environment File

```bash
# Copy the prepared .env to the backend directory
cp /secure/path/.env /opt/grc-platform/backend-nest/.env
chmod 600 /opt/grc-platform/backend-nest/.env
```

### 2.3 Build & Pull Images

```bash
cd /opt/grc-platform
docker compose -f docker-compose.staging.yml build
# OR pull from internal registry:
# docker compose -f docker-compose.staging.yml pull
```

### 2.4 Run Preflight Check (Dry Run)

```bash
# Start DB only first
docker compose -f docker-compose.staging.yml up -d db
# Wait for DB healthy
docker compose -f docker-compose.staging.yml exec db pg_isready -U grc_app_user

# Start backend
docker compose -f docker-compose.staging.yml up -d backend
# Wait for backend healthy, then:
bash ops/preflight-go-live.sh
```

The preflight script must show **VERDICT: GO** before proceeding.

---

## 3. Step-by-Step Cutover Plan

> **Estimated downtime**: 10–30 minutes (depending on migration count)

### Phase A: Freeze & Backup (T-30 min)

1. **Announce maintenance window** to users
2. **If migrating from existing environment**: take a final database backup
   ```bash
   pg_dump -h <old-db-host> -U grc_app_user grc_platform > /backup/grc_pre_cutover_$(date +%Y%m%d%H%M).sql
   ```
3. **If migrating data**: restore backup to new DB host
   ```bash
   psql -h <new-db-host> -U grc_app_user grc_platform < /backup/grc_pre_cutover_*.sql
   ```

### Phase B: Deploy Application (T-15 min)

4. **Start all services** on the new app host:
   ```bash
   cd /opt/grc-platform
   docker compose -f docker-compose.staging.yml up -d
   ```

5. **Run migrations** (if not already applied):
   ```bash
   docker compose -f docker-compose.staging.yml exec backend \
     npx typeorm migration:run -d dist/data-source.js
   ```

6. **Run required production seeds** (standards data):
   ```bash
   docker compose -f docker-compose.staging.yml exec backend \
     npm run seed:standards:prod
   ```

7. **Run preflight check**:
   ```bash
   bash ops/preflight-go-live.sh
   ```
   Must show **VERDICT: GO**.

### Phase C: DNS / LB Cutover (T-0)

8. **Configure LB/ADC** to point to the new app host (port 80)
   - Health check: `GET /health/live` → expect 200
   - TLS termination at LB for `niles-grc.com`

9. **Update DNS** `niles-grc.com` A-record to point to LB VIP
   ```bash
   # Verify DNS propagation
   dig niles-grc.com +short
   ```

10. **Verify routing end-to-end**:
    ```bash
    curl -I https://niles-grc.com/health/live
    # Expect: 200 OK

    curl -I https://niles-grc.com/api/grc/controls
    # Expect: 401 Unauthorized (not 404!)

    # Or use the routing regression test:
    bash ops/tests/test-nginx-api-routing.sh https://niles-grc.com
    ```

### Phase D: Smoke Test (T+5 min)

11. **Login** via browser at `https://niles-grc.com`
12. **Verify** key pages load (dashboard, controls, risks)
13. **Verify** API calls work (network tab shows 200s, not 404/502)
14. **Check logs** for errors:
    ```bash
    docker compose -f docker-compose.staging.yml logs --tail=50 backend
    ```

---

## 4. Go-Live PASS / FAIL Checklist

Run this checklist immediately after cutover. **ALL items must PASS.**

| # | Check | Command / Method | PASS/FAIL |
|---|---|---|---|
| 1 | Preflight script passes | `bash ops/preflight-go-live.sh` | ☐ |
| 2 | DB_SYNC=false | Preflight output | ☐ |
| 3 | No pending migrations | Preflight output | ☐ |
| 4 | `/health/live` returns 200 | `curl https://niles-grc.com/health/live` | ☐ |
| 5 | `/health/db` returns 200 | `curl https://niles-grc.com/health/db` | ☐ |
| 6 | `/api/grc/controls` returns 401 | `curl -I https://niles-grc.com/api/grc/controls` | ☐ |
| 7 | Frontend loads in browser | Navigate to `https://niles-grc.com` | ☐ |
| 8 | Login works | Login with admin credentials | ☐ |
| 9 | TLS valid | Browser shows padlock, no cert warnings | ☐ |
| 10 | No errors in backend logs | `docker compose logs --tail=100 backend \| grep -i error` | ☐ |
| 11 | ENABLE_DEMO_BOOTSTRAP=false | Verify in `.env` | ☐ |
| 12 | Backup verified | Confirm backup file exists and is non-zero | ☐ |

**Verdict**:
- All 12 PASS → **GO-LIVE APPROVED**
- Any FAIL → Execute [Rollback Plan](#6-rollback-plan)

---

## 5. Post-Cutover Verification

Perform within **24 hours** of cutover:

- [ ] Monitor backend logs for recurring errors
- [ ] Verify audit logging is capturing events
- [ ] Run support bundle and archive: `bash ops/support-bundle.sh`
- [ ] Confirm DNS TTL can be raised back to normal (e.g., 3600s)
- [ ] Disable `ENABLE_DEMO_BOOTSTRAP` if it was temporarily enabled
- [ ] Rotate demo admin password if bootstrap was used
- [ ] Verify backup schedule is running on DB host
- [ ] Confirm monitoring/alerting is receiving data

---

## 6. Rollback Plan

> **Trigger**: Any FAIL in the Go-Live checklist, or critical issue within the first 24 hours.

### Immediate Rollback (< 5 min)

1. **Switch DNS / LB** back to the previous environment (or holding page)
   ```bash
   # Update DNS A-record back to old IP
   # OR update LB backend pool to old app host
   ```

2. **Stop services** on the new app host:
   ```bash
   cd /opt/grc-platform
   docker compose -f docker-compose.staging.yml down
   ```

3. **Verify old environment is serving traffic**:
   ```bash
   curl -I https://niles-grc.com/health/live
   ```

### Data Rollback (if DB was modified)

4. **If the new environment wrote data** that must be reverted:
   ```bash
   # Restore from pre-cutover backup on the OLD DB host
   psql -h <old-db-host> -U grc_app_user grc_platform < /backup/grc_pre_cutover_*.sql
   ```

### Post-Rollback

5. **Investigate** the root cause of the failure
6. **Collect support bundle** from the failed environment:
   ```bash
   bash ops/support-bundle.sh
   ```
7. **Schedule** a new cutover window after fixes are applied

---

## 7. Seed Guidance

### Required for Production (REQUIRED_PROD)

These seeds provide baseline standards data that the application needs to function:

```bash
docker compose -f docker-compose.staging.yml exec backend \
  npm run seed:standards:prod
```

This includes:
- GRC framework standards (ISO 27001, NIST, SOC2, etc.)
- Default risk categories and scoring matrices
- Compliance control mappings

### Optional for Demo / Testing (OPTIONAL_DEMO)

These seeds create sample data for demos. **Do NOT run in production** unless explicitly needed for UAT:

- Demo admin user (controlled by `ENABLE_DEMO_BOOTSTRAP` flag)
- Sample tenant with demo data
- Example risks, controls, and assessments

To enable demo bootstrap for **initial setup only**:
1. Set `ENABLE_DEMO_BOOTSTRAP=true` in `.env`
2. Restart backend
3. Login triggers demo admin creation
4. **Immediately** set `ENABLE_DEMO_BOOTSTRAP=false` and restart
5. Change the demo admin password via the UI

---

*Last updated: 2025-02-27*  
*Maintainer: Platform Engineering*
