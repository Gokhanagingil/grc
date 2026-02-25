# CMDB Class Hierarchy Visibility Pack — Runbook

## Overview

This runbook documents the CMDB Class Hierarchy Activation & Visibility Pack (P0).
The goal is to make the default/system CI class hierarchy visible and understandable in the UI,
with clear content pack status, actionable empty states, and enhanced UX.

## Root Cause Table

| Possible Cause | Status | Evidence |
|---|---|---|
| Content pack not applied (seed missing) | Possible | Backend has `applyBaselineContentPack`. If not seeded, tree is empty. |
| Content pack applied but filtered out | Ruled out | Backend queries use `isDeleted: false` — no isSystem/isActive filter on tree. |
| Frontend route/nav discoverability | Confirmed partial | Routes exist but Class Tree button needed more prominence. |
| Response envelope parsing mismatch | Confirmed | CMDB pages had manual `data.data` parsing instead of shared helpers. |
| Permissions (403 vs nginx vs Cloudflare) | Partially handled | `classifyApiError` exists but was not used consistently on CMDB pages. |
| List/tree endpoint shape mismatch | Confirmed | Tree endpoint returns array in envelope; frontend tried ad-hoc parsing. |
| Tenant mismatch (x-tenant-id) | N/A | API client sends x-tenant-id via interceptor automatically. |
| Empty-state messaging insufficient | Confirmed | Tree empty state lacked content pack status info and diagnostics. |

## What Changed

### Frontend

1. **CmdbCiClassList** — Refactored to use `unwrapPaginatedResponse`, `classifyApiError`. Added content pack status chip in summary banner + "not applied" alert.
2. **CmdbCiClassTree** — Refactored to use `unwrapArrayResponse`, `classifyApiError`. Added:
   - Content Pack Status Card (applied/not applied, version, system/custom counts)
   - Collapsible Diagnostics Panel (endpoint response counts, content pack version, tenant hint, last fetch time)
   - Quick Filters (All / System / Custom / Abstract + search by name/label)
   - Classified error messages (forbidden, network, auth, server)
   - Enhanced empty state with content pack confirmation
3. **CmdbCiClassDetail** — Refactored to use `unwrapResponse`, `unwrapArrayResponse`. Added:
   - Class Inheritance Breadcrumb (WOW UX): Shows full ancestry chain as clickable breadcrumb
   - Field Origin Summary (WOW UX): Shows total/inherited/local field counts
4. **EffectiveSchemaPanel** — Refactored to use `unwrapResponse`, `classifyApiError`.

### Tests

- Updated `CmdbCiClassTree.test.tsx` — Added tests for content pack status card, quick filters, diagnostics toggle, abstract count
- Updated `CmdbCiClassVisibilityHardening.test.tsx` — Updated mocks for shared helpers

### Docs

- This runbook

## Staging Verification Checklist

```
[ ] CMDB -> Classes list opens without errors
[ ] Summary banner shows total/system/custom/abstract counts
[ ] Content Pack chip shows "Content Pack: v1.0.0" or "Not Applied"
[ ] "Class Tree" page is reachable from obvious "Class Tree" button
[ ] Tree renders system classes (not empty) OR shows actionable diagnostic empty-state
[ ] Content Pack Status Card is visible on tree page
[ ] Quick filters (System/Custom/Abstract/Search) work on tree page
[ ] Diagnostics panel expands/collapses on tree page
[ ] Class detail shows inheritance breadcrumb (e.g., cmdb_ci -> hardware -> server)
[ ] Class detail shows field origin summary (Total: X / Inherited: Y / Local: Z)
[ ] Effective Schema tab renders with local/inherited field counts
[ ] No generic "Validation failed" / parsing errors on touched CMDB pages
[ ] Content pack not-applied alert shown when content pack is missing
[ ] Error states show classified messages (permission/network/auth)
```

## Deferred Items

- Full CMDB redesign
- Discovery mappings / CSDM mega rollout
- Changing routing conventions
- New packages / dependencies
- E2E Playwright smoke test (can be added in follow-up)
