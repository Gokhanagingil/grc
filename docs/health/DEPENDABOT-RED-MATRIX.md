# Dependabot RED Matrix

CI Failure Matrix for dependabot PRs as of 2026-03-02.

| PR | Workflow | Job | First Error Line | Root Cause Cluster | Fix |
|----|----------|-----|-------------------|-------------------|-----|
| #535 (backend-nest deps: @swc/cli ^0.8.0) | E2E Smoke: REAL_STACK (PR Gate) | Tier-1 REAL_STACK Smoke | `npm error ERESOLVE could not resolve` - `@swc/cli@0.8.0` conflicts with `@nestjs/cli@11.0.16` peerOptional `@swc/cli@^0.7.0` | C5 - REAL_STACK parity | F2: Add `--legacy-peer-deps` to all backend `npm ci` calls |
| #535 | Platform Health Smoke (PR Gate) | Tier-1 Smoke Tests | Same ERESOLVE error at `npm ci` step | C5 | F2 |
| #535 | Scenario Pack Smoke (Reliability Gate) | Scenario Pack Smoke | Same ERESOLVE error at `npm ci` step | C5 | F2 |
| #531 (frontend: axios ^1.13.5 -> ^1.13.6) | Frontend CI | Test | `SyntaxError: Cannot use import statement outside a module` - Jest cannot parse ESM `axios` | C4 - Console-fail discipline / Jest config | F1: Add `axios` to `transformIgnorePatterns` |
| #533 (@types/node bump) | E2E Tests | E2E MOCK_UI Quick Checks | All checks passing or canceled | N/A | No fix needed |
| #534 (actions/upload-artifact v6->v7) | E2E Tests | E2E MOCK_UI Quick Checks | All checks passing or canceled | N/A | No fix needed |

## Root Cause Analysis

### PR #535 - Backend peer dependency conflict
**Symptom**: `npm ci` fails with `ERESOLVE could not resolve` in 3 smoke/health workflows.

**Root cause**: Dependabot bumped `@swc/cli` from `^0.7.10` to `^0.8.0`. The `@nestjs/cli@11.0.16` declares `@swc/cli` as a `peerOptional` with range `^0.1.62 || ^0.3.0 || ^0.4.0 || ^0.5.0 || ^0.6.0 || ^0.7.0`. Version `0.8.0` is outside this range.

**Why it only fails in some workflows**: The main `backend-nest-ci.yml` already uses `--legacy-peer-deps` for all its `npm ci` calls. However, 5 other workflows (`e2e-smoke-real.yml`, `platform-health-smoke.yml`, `platform-health-nightly.yml`, `scenario-pack-smoke.yml`, `db-bootstrap-preflight.yml`) were missing this flag.

**Fix**: Add `--legacy-peer-deps` to all backend `npm ci` calls across all workflows. This is a systemic fix that prevents future peer dependency conflicts from breaking CI.

### PR #531 - Axios ESM migration
**Symptom**: 4 frontend test suites fail with `SyntaxError: Cannot use import statement outside a module`.

**Root cause**: `axios@1.x` ships as ESM (`import axios from './lib/axios.js'`). Jest's default `transformIgnorePatterns` excludes `node_modules/` from Babel transformation. The frontend's `package.json` only exempted `react-router` and `react-router-dom`.

**Fix**: Add `axios` to the `transformIgnorePatterns` exclusion list so Jest transforms it before running tests.

### PRs #533, #534 - No fix needed
These PRs are either already green or only have canceled checks (due to concurrency groups). No systemic fix needed.
