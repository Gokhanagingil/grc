# Staging GRC Health Report

**Date:** December 8, 2025  
**Environment:** http://46.224.99.150 (Frontend) / http://46.224.99.150:3002 (Backend)  
**Tested By:** Devin AI  

## Executive Summary

The staging environment smoke tests revealed that the deployed frontend and backend are running older code versions. The main branch contains all necessary fixes (API path alignment and Dashboard API layer), but the staging environment needs to be redeployed to pick up these changes.

## Smoke Test Results

### Authentication
| Endpoint | Status | Notes |
|----------|--------|-------|
| POST /auth/login | WORKING | Login successful with demo.admin@grc.local |
| GET /users/me | WORKING | User profile retrieved correctly |

### Dashboard
| Endpoint | Status | Notes |
|----------|--------|-------|
| GET /dashboard/overview | 404 NOT FOUND | Dashboard module not deployed on staging |
| GET /dashboard/risk-trends | 404 NOT FOUND | Dashboard module not deployed on staging |
| GET /dashboard/compliance-by-regulation | 404 NOT FOUND | Dashboard module not deployed on staging |

**Root Cause:** The Dashboard module was added in PR #40 (commit ea07544), which was just merged to main. The staging backend needs to be redeployed to include this module.

### Governance (Policies)
| Endpoint | Status | Notes |
|----------|--------|-------|
| GET /grc/policies | 401 UNAUTHORIZED | Endpoint exists, requires auth |
| Frontend Request | FAILING | Staging frontend calls /governance/policies (old path) |

**Root Cause:** The staging frontend is running code from before commit 478bc82 which aligned API paths. The frontend should call `/grc/policies` but the deployed version calls `/governance/policies`.

### Compliance (Requirements)
| Endpoint | Status | Notes |
|----------|--------|-------|
| GET /grc/requirements | 401 UNAUTHORIZED | Endpoint exists, requires auth |
| Frontend Request | FAILING | Staging frontend calls /compliance/requirements (old path) |

**Root Cause:** Same as Governance - the staging frontend is running old code that uses `/compliance/requirements` instead of `/grc/requirements`.

### Risk Management
| Endpoint | Status | Notes |
|----------|--------|-------|
| GET /grc/risks | WORKING | Page loads correctly, shows "No risks found" |

### Incidents (ITSM)
| Endpoint | Status | Notes |
|----------|--------|-------|
| GET /itsm/incidents | WORKING | Page loads correctly, shows 2 incidents |

## Codebase Verification

The current codebase on main branch has been verified:

### Frontend Lint Check
```
0 errors, 4 warnings (all non-critical)
```

### Backend Lint Check
```
0 errors, 2 warnings (all non-critical)
```

## Required Actions

### Immediate (Staging Redeploy)

1. **Redeploy Backend Container**
   ```bash
   docker compose -f docker-compose.staging.yml up -d --build backend
   ```
   This will deploy the NestJS backend with the Dashboard module.

2. **Redeploy Frontend Container**
   ```bash
   docker compose -f docker-compose.staging.yml up -d --build frontend
   ```
   This will deploy the frontend with corrected API paths.

### Post-Deployment Verification

After redeployment, verify the following:

1. **Dashboard Page**
   - Should load without errors
   - Should display KPI cards (Risks, Compliance, Policies, Incidents)
   - Should display Risk Trends chart
   - Should display Compliance by Regulation chart

2. **Governance (Policies) Page**
   - Should load without "Failed to fetch" error
   - Should show empty state or policy list

3. **Compliance (Requirements) Page**
   - Should load without "Failed to fetch" error
   - Should show empty state or requirements list

4. **Risk Management Page**
   - Should continue working (already functional)

5. **Incidents Page**
   - Should continue working (already functional)

## API Path Reference

| Module | Frontend Path | Backend Path | Status |
|--------|--------------|--------------|--------|
| Policies | /grc/policies | /grc/policies | Aligned |
| Requirements | /grc/requirements | /grc/requirements | Aligned |
| Risks | /grc/risks | /grc/risks | Aligned |
| Incidents | /itsm/incidents | /itsm/incidents | Aligned |
| Dashboard Overview | /dashboard/overview | /dashboard/overview | Aligned |
| Dashboard Risk Trends | /dashboard/risk-trends | /dashboard/risk-trends | Aligned |
| Dashboard Compliance | /dashboard/compliance-by-regulation | /dashboard/compliance-by-regulation | Aligned |
| User Profile | /users/me | /users/me | Aligned |

## Commits Included in Fix

1. **478bc82** - feat: Align frontend API paths with NestJS backend
   - Created centralized API client layer (grcClient.ts)
   - Updated all frontend pages to use correct NestJS paths

2. **ea07544** - feat: Add Dashboard API layer in NestJS backend
   - Added DashboardModule with aggregated KPI endpoints
   - Added /dashboard/overview, /dashboard/risk-trends, /dashboard/compliance-by-regulation

## Screenshots

Screenshots from smoke testing are available at:
- Login Page: /home/ubuntu/screenshots/46_224_99_150_login_130706.png
- Dashboard (Error): /home/ubuntu/screenshots/46_224_99_150_130754.png
- Governance (Error): /home/ubuntu/screenshots/46_224_99_150_130817.png
- Compliance (Error): /home/ubuntu/screenshots/46_224_99_150_130837.png
- Risk Management (Working): /home/ubuntu/screenshots/46_224_99_150_risk_130857.png
- Incidents (Working): /home/ubuntu/screenshots/46_224_99_150_130918.png

## Conclusion

The codebase on main branch is correct and contains all necessary fixes. The staging environment failures are due to running older code versions. A full redeploy of both frontend and backend containers will resolve all identified issues.

No code changes are required - only a staging environment redeploy.
