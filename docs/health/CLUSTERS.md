# Root Cause Clusters

Platform health issues clustered by systemic category. Created 2026-03-02.

---

## C1: List Standardization Gaps

**Definition**: List pages missing `data-testid="list-toolbar"`, missing filter/search controls, or not using the shared `ListPageShell` / `UniversalListPage` components.

**Affected routes**: Various ITSM and GRC list pages (incremental migration ongoing).

**Root cause**: Organic growth of list pages before the shared list shell was established. Newer pages use the shell; older ones have custom implementations.

**Fix strategy**: Out of scope for this fix pack. Tracked in backlog. Incremental migration recommended per-sprint.

---

## C2: Client/API Mismatch

**Definition**: Frontend calling API methods that don't exist, wrong method names, wrong baseURL (`/api` prefix issues), or HTML fallback responses from Cloudflare.

**Affected areas**: `grcClient.ts` API_PATHS, ITSM change affected CIs method, Cloudflare managed challenge returning HTML instead of JSON.

**Root cause**: API surface grows faster than client type definitions. Cloudflare challenge can intercept direct `/grc/itsm/*` calls (must use `/api/grc/itsm/*`).

**Fix strategy**: Out of scope for this fix pack. Runtime guards (`ensureArray`, `unwrapResponse`) already mitigate crashes.

---

## C3: MOCK_UI Coverage Gaps

**Definition**: MSW handlers missing for routes visited by quick checks/crawl, causing unhandled requests and console errors in E2E tests.

**Affected tests**: E2E MOCK_UI Quick Checks, UI Health Crawl.

**Root cause**: New API endpoints added without corresponding MSW handlers.

**Fix strategy**: Out of scope for this fix pack. PRs #533 and #534 are already green/passing.

---

## C4: Console-fail Discipline (Jest Config)

**Definition**: Jest fails tests due to console.error/warn from expected warnings, or fails to parse ESM modules from `node_modules`.

**Affected tests**: `priorityMatrix.test.ts`, `normalizeRcaDecisionsSummary.test.ts`, `grcClient.test.ts`, `ItsmChangeTemplateList.test.tsx` (all 4 suites failing in PR #531).

**Root cause**: `axios@1.x` ships as ESM. Jest's `transformIgnorePatterns` only exempted `react-router` packages, not `axios`. When dependabot bumped axios, Jest could not parse the ESM `import` statement.

**Chosen fix**: **[APPLIED IN THIS FIX PACK]** Add `axios` to the `transformIgnorePatterns` exclusion list in `frontend/package.json`. This is the standard CRA/Jest pattern for handling ESM dependencies.

**Evidence**: Before fix: 4 suites / 67 tests FAIL. After fix: 4 suites / 67 tests PASS. Full suite: 58 suites / 1142 tests PASS.

---

## C5: REAL_STACK Parity (CI Workflow Consistency)

**Definition**: Smoke/health CI workflows use `npm ci` without `--legacy-peer-deps`, causing ERESOLVE failures when peer dependencies conflict.

**Affected workflows**:
- `e2e-smoke-real.yml` (Tier-1 REAL_STACK Smoke)
- `platform-health-smoke.yml` (Tier-1 Smoke Tests)
- `platform-health-nightly.yml` (Full Sweep Smoke)
- `scenario-pack-smoke.yml` (Scenario Pack Smoke)
- `db-bootstrap-preflight.yml` (DB Bootstrap Preflight)

**Root cause**: The main `backend-nest-ci.yml` was already using `--legacy-peer-deps` consistently. However, 5 other workflows that also install backend-nest dependencies were missing this flag. When dependabot bumped `@swc/cli` to `^0.8.0` (outside `@nestjs/cli@11.0.16`'s peer range), these workflows failed.

**Chosen fix**: **[APPLIED IN THIS FIX PACK]** Add `--legacy-peer-deps` to all backend `npm ci` calls in all affected workflows. This is a systemic fix - not a one-off workaround - because the same pattern was already established in `backend-nest-ci.yml` and `frontend-ci.yml`.

**Evidence**: Before fix: PR #535 fails in 3 PR-gate workflows. After fix: `npm ci --legacy-peer-deps` will resolve the ERESOLVE conflict.

---

## C6: CMDB Reference Model Usability Blockers

**Definition**: CI create failing, reference fields incorrectly modeled (string vs reference), topology/relationships not rendering.

**Affected areas**: CMDB CI detail page, class hierarchy, relationship widgets.

**Root cause**: Complex entity modeling with class-based field definitions.

**Fix strategy**: Out of scope for this fix pack. Tracked in backlog.
