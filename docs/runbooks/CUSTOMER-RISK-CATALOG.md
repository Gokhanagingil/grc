# Customer Risk Catalog Foundation

## Overview

The Customer Risk Catalog provides a tenant-scoped library of reusable risk signals/rules that can be linked to CMDB CIs, CI classes, services, and offerings. These signals are evaluated during change risk scoring to enrich ITSM decisions with GRC intelligence.

## Data Model

### Tables

| Table | Purpose |
|-------|---------|
| `customer_risk_catalog` | Stores reusable risk signal definitions (e.g., "OS End-of-Support", "Critical Patch Overdue") |
| `customer_risk_binding` | Links catalog risks to targets (CI, CI_CLASS, CMDB_SERVICE, CMDB_OFFERING, ITSM_SERVICE) |
| `customer_risk_observation` | Tracks concrete signal observations with evidence, scoring, and waiver support |

### Key Fields

- **category**: OS_LIFECYCLE, PATCHING, BACKUP, AVAILABILITY, SECURITY_HARDENING, OPERATIONS_HYGIENE, MONITORING, CERTIFICATE_MANAGEMENT, DATABASE_LIFECYCLE, VULNERABILITY_MANAGEMENT, GOVERNANCE, SERVICE_MAPPING, CHANGE_MANAGEMENT, SLA_COMPLIANCE
- **signalType**: STATIC_FLAG, CMDB_HEALTH_RULE, ATTRIBUTE_MATCH, AGE_THRESHOLD, EXTERNAL_FEED_FLAG
- **severity**: LOW, MEDIUM, HIGH, CRITICAL
- **scoreContributionModel**: FLAT_POINTS, WEIGHTED_FACTOR, MULTIPLIER

## API Endpoints

All endpoints require JWT authentication, tenant header (`x-tenant-id`), and appropriate permissions.

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/grc/customer-risks` | GRC_CUSTOMER_RISK_READ | List with pagination, search, filters, sort |
| POST | `/api/grc/customer-risks` | GRC_CUSTOMER_RISK_WRITE | Create new catalog risk |
| GET | `/api/grc/customer-risks/:id` | GRC_CUSTOMER_RISK_READ | Get single risk detail |
| PATCH | `/api/grc/customer-risks/:id` | GRC_CUSTOMER_RISK_WRITE | Update risk |
| DELETE | `/api/grc/customer-risks/:id` | GRC_CUSTOMER_RISK_WRITE | Soft delete risk |
| POST | `/api/grc/customer-risks/:id/bindings` | GRC_CUSTOMER_RISK_BIND_WRITE | Create binding |
| GET | `/api/grc/customer-risks/:id/bindings` | GRC_CUSTOMER_RISK_BIND_READ | List bindings for risk |
| DELETE | `/api/grc/customer-risks/:id/bindings/:bindingId` | GRC_CUSTOMER_RISK_BIND_WRITE | Delete binding |
| GET | `/api/grc/customer-risk-observations/list` | GRC_CUSTOMER_RISK_OBSERVATION_READ | List observations |

## Permissions

| Permission | ADMIN | MANAGER | USER |
|------------|-------|---------|------|
| GRC_CUSTOMER_RISK_READ | Yes | Yes | Yes |
| GRC_CUSTOMER_RISK_WRITE | Yes | Yes | No |
| GRC_CUSTOMER_RISK_BIND_READ | Yes | Yes | Yes |
| GRC_CUSTOMER_RISK_BIND_WRITE | Yes | Yes | No |
| GRC_CUSTOMER_RISK_OBSERVATION_READ | Yes | Yes | Yes |
| GRC_CUSTOMER_RISK_OBSERVATION_WRITE | Yes | Yes | No |

## Seed Data

The starter catalog includes 30 professional risk signals covering:

- OS end-of-support, critical patch overdue, endpoint agent missing
- Backup failures, monitoring gaps, certificate expiry
- Single point of dependency, capacity thresholds
- Vulnerability findings, compliance attestation gaps
- Configuration drift, shared credentials, password policy
- CMDB governance (owner missing, orphan CIs, stale data)
- Change collision zones, SLA breach trends

Run seed: `npx ts-node src/scripts/seed-customer-risk-catalog.ts` (dev) or `node dist/scripts/seed-customer-risk-catalog.js` (prod)

## Verification Checklist

- [ ] Migration creates all three tables with correct indexes
- [ ] CRUD operations work for catalog risks
- [ ] Binding creation enforces uniqueness (tenant + risk + target type + target ID)
- [ ] Soft delete works (isDeleted flag)
- [ ] Tenant isolation enforced on all endpoints
- [ ] Permission guards active (USER cannot write)
- [ ] Seed script is idempotent (safe to re-run)
- [ ] All 30 starter catalog items seeded correctly
- [ ] sys_choice values seeded for all choice fields
- [ ] List endpoint returns LIST-CONTRACT format (items, total, page, pageSize, totalPages)
