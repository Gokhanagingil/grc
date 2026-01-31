# GRC Platform Release Notes

## v0.9.0-rc1 (Release Candidate 1)

**Release Date:** January 31, 2026  
**Status:** Release Candidate

This release marks the first Release Candidate (RC1) for the GRC Platform, transitioning from MVP+ to a production-ready state. The focus is on stability, automated verification, and operational readiness.

### What's Included

**Core GRC Modules**

The platform includes fully functional modules for enterprise Governance, Risk, and Compliance management:

- **Controls Library**: Create, manage, and track preventive, detective, and corrective controls with full lifecycle management including testing schedules and evidence linking.
- **Risk Management**: Comprehensive risk register with severity/likelihood assessment, risk-control linking, and mitigation tracking.
- **Policy Management**: Policy creation, versioning, and compliance tracking with requirement mapping.
- **Audit Management**: Internal and external audit planning, execution, and findings management with SOA (Statement of Applicability) support.
- **Evidence Management**: Evidence collection, linking to controls and test results, with attachment support.
- **Issues & CAPAs**: Issue tracking from test failures and audit findings, with Corrective and Preventive Action (CAPA) workflow.

**Business Continuity Management (BCM)**

- **BCM Services**: Define and manage critical business services with criticality tiers.
- **Business Impact Analysis (BIA)**: Assess financial, operational, and reputational impacts.
- **Recovery Plans**: BCP and DRP plan management linked to services.
- **Exercises**: Schedule and track tabletop, failover, restore, and communications exercises.

**Platform Features**

- **Multi-tenant Architecture**: Complete tenant isolation with x-tenant-id header enforcement.
- **Calendar Integration**: Unified calendar view for audits, exercises, and compliance deadlines.
- **Platform Builder**: Dynamic table management for custom entity types.
- **Standards Library**: ISO 27001, SOC 2, and other framework clause management.

**Automated Verification**

- **Golden Demo Flow**: Documented end-to-end demo scenario with automated API verification script (`ops/rc1-golden-flow-verify.sh`).
- **Playwright Smoke Suite**: UI smoke tests for login, Controls, and Risks pages.
- **CI/CD Integration**: GitHub Actions workflow for staging smoke tests (`staging-smoke.yml`).

**List Page Standardization**

All list pages follow a consistent pattern with:
- Debounced search input
- Advanced filter builder with AND/OR conditions
- URL-synced pagination and sorting
- Proper empty state messages (no data vs. filter no match)
- LIST-CONTRACT API response format

### Verification

To verify the RC1 release, run the following commands:

**API Verification (Golden Flow)**
```bash
# From repository root
bash ops/rc1-golden-flow-verify.sh

# With custom staging URL
STAGING_URL=http://46.224.99.150 bash ops/rc1-golden-flow-verify.sh
```

**Playwright Smoke Tests**
```bash
cd frontend
npm ci --legacy-peer-deps
npx playwright install --with-deps chromium
npx playwright test e2e/smoke/ --project=staging
```

**Manual Verification Checklist**
1. Login with demo credentials (admin@grc-platform.local / TestPassword123!)
2. Navigate to Controls list - verify search and filters work
3. Navigate to Risks list - create a new risk
4. Link a control to the risk
5. Navigate to BCM Services - create a service
6. Create a BIA, Plan, and Exercise for the service
7. Check Calendar for scheduled events
8. Access Platform Builder tables

### Known Limitations

**Coming Soon Pages**

The following features are planned but not yet implemented:
- Vendor Management module
- Third-Party Risk Assessment
- Compliance Dashboard widgets
- Automated control testing integration
- Email notification system

**Upload Persistence**

- File uploads are stored in the container filesystem
- Uploads do not persist across container restarts in the current staging configuration
- Production deployment should use external storage (S3, Azure Blob, etc.)

**Authentication**

- Password reset flow is not yet implemented
- SSO/SAML integration is planned for future releases
- Session timeout is fixed at token expiry (configurable via REFRESH_TOKEN_EXPIRES_IN)

**Performance**

- Large list pages (>1000 items) may experience slower load times
- Calendar view performance degrades with many concurrent events
- Advanced filter queries with many conditions may timeout

**Browser Support**

- Tested primarily on Chrome/Chromium
- Firefox and Safari support is functional but less tested
- Mobile responsive design is partial

### Upgrade Notes

**From v0.8.x**

1. Run database migrations: `npx typeorm migration:run -d dist/data-source.js`
2. Clear browser localStorage to reset any cached UI state
3. Re-seed standards if using custom frameworks: `npm run seed:standards:prod`

**Environment Variables**

Ensure the following environment variables are configured:
- `JWT_SECRET` - JWT signing secret
- `REFRESH_TOKEN_SECRET` - Refresh token signing secret
- `REFRESH_TOKEN_EXPIRES_IN` - Token expiry (e.g., "7d")
- `DATABASE_URL` - PostgreSQL connection string
- `DEMO_ADMIN_EMAIL` - Demo admin email
- `DEMO_ADMIN_PASSWORD` - Demo admin password

### Related Documentation

- [RC1 Golden Demo Flow](./RC1-GOLDEN-DEMO-FLOW.md) - Detailed demo scenario
- [Staging Maintenance Runbook](./STAGING-MAINTENANCE-RUNBOOK.md) - Operational procedures
- [LIST-CONTRACT](./LIST-CONTRACT.md) - API response format specification
- [Evidence Golden Flow Runbook](./EVIDENCE-GOLDEN-FLOW-RUNBOOK.md) - Evidence lifecycle

### Contributors

This release was prepared by the GRC Platform team with contributions from:
- Platform development team
- QA automation team
- DevOps team

### Feedback

For issues or feedback regarding this release candidate, please:
1. Create a GitHub issue with the `rc1` label
2. Include steps to reproduce any bugs
3. Attach relevant logs or screenshots

---

## Previous Releases

### v0.8.x (MVP+)

Initial MVP+ release with core GRC functionality. See git history for detailed changes.
