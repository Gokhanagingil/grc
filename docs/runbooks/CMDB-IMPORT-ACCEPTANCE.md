# CMDB Import & Reconciliation — Acceptance Checklist

## Data Model & API (Phase 1)

- [ ] 1. Migration creates all 5 import tables (`cmdb_import_source`, `cmdb_import_job`, `cmdb_import_row`, `cmdb_reconcile_rule`, `cmdb_reconcile_result`)
- [ ] 2. Migration is idempotent (2nd run does not fail or duplicate)
- [ ] 3. All tables have `tenant_id` column with index
- [ ] 4. Enum columns use UPPERCASE labels (PENDING, PARSING, RECONCILING, COMPLETED, FAILED, APPLIED)
- [ ] 5. Import source CRUD works (POST/GET/PATCH/DELETE)
- [ ] 6. Import job creation accepts JSON rows in request body
- [ ] 7. Import job list endpoint returns paginated results with status
- [ ] 8. Import job detail endpoint returns summary counts (created/updated/conflict/error)
- [ ] 9. Import job rows endpoint returns paginated rows
- [ ] 10. Reconcile rules CRUD works with strategy builder fields

## Reconciliation Engine (Phase 1)

- [ ] 11. Single CI match returns UPDATE with field-level diff
- [ ] 12. Multiple CI matches for same rule returns CONFLICT
- [ ] 13. No CI match returns CREATE
- [ ] 14. Identical match (no diffs) returns SKIP
- [ ] 15. Key field change (name, serialNumber, ipAddress, dnsName) classified as `conflict`
- [ ] 16. Non-key field change (description, environment) classified as `safe_update`
- [ ] 17. Rule precedence ordering is respected (lower precedence number = higher priority)
- [ ] 18. Disabled rules are skipped
- [ ] 19. Exact strategy requires 100% field match
- [ ] 20. Composite strategy uses weighted confidence >= 0.8 threshold

## Security & Tenant Isolation

- [ ] 21. All API calls require `x-tenant-id` header (400 without it)
- [ ] 22. Cross-tenant access blocked (tenant A cannot see tenant B data)
- [ ] 23. Admin-only endpoints (import source CRUD, reconcile rule CRUD, apply) return 403 for non-admin
- [ ] 24. Unauthenticated requests return 401
- [ ] 25. Apply endpoint only works on dry-run jobs (rejects already-applied jobs)

## Frontend UI (Phase 2)

- [ ] 26. Import Jobs list page loads with status chips and summary counts
- [ ] 27. Import Jobs list has search and pagination
- [ ] 28. Import Job detail page shows summary cards (wouldCreate/wouldUpdate/conflicts/errors)
- [ ] 29. Import Job detail has tabs: Rows, Results, Conflicts
- [ ] 30. Dry-run banner shown with Apply button (admin only)
- [ ] 31. Apply button shows confirmation modal before executing
- [ ] 32. Explain drawer shows match rule, fields used, and confidence score
- [ ] 33. Reconcile Rules page has CRUD with ordered precedence
- [ ] 34. Strategy builder allows selecting fields, weights, and uniqueRequired toggle
- [ ] 35. No infinite spinners — loading states resolve or show error

## UX & Error States

- [ ] 36. 401 (unauthenticated) shows login redirect or clear message
- [ ] 37. 403 (forbidden) shows "Access Denied" message, not blank page
- [ ] 38. Empty import jobs list shows helpful empty state message
- [ ] 39. Empty reconcile rules list shows helpful empty state message
- [ ] 40. Network error shows error banner with retry option
- [ ] 41. CMDB Import sidebar navigation items are visible and routable

## Seed & Demo Data

- [ ] 42. Seed script is idempotent (2nd run skips existing data)
- [ ] 43. Demo produces deterministic counts: ~5 create, ~4 update, ~3 conflict, ~2 skip, ~1 error
- [ ] 44. Seed script works in production container (`node dist/scripts/seed-cmdb-import-demo.js`)

## Tests

- [ ] 45. Unit tests for reconciliation engine pass (27 tests)
- [ ] 46. All CI checks green
- [ ] 47. No flaky tests introduced
