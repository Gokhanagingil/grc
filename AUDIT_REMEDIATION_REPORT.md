# NPM Audit Remediation Report (Non-Breaking)

**Branch:** `cursor/hardening-npm-audit-v1`  
**Scope:** backend-nest, frontend — HIGH severity reduction only, no major upgrades.

---

## Before (Baseline)

### backend-nest

- **Total vulnerabilities:** 47 (5 moderate, 42 high)
- **Top packages causing HIGH (direct + transitive):**
  1. **minimatch** (10.0.0–10.2.2) — ReDoS (matchOne combinatorial backtracking; nested extglobs). Via: eslint, @eslint/config-array, @eslint/eslintrc, @swc/cli, typescript-eslint, glob, test-exclude, jest, typeorm. **Dev-only** (lint/build/test).
  2. **multer** (≤2.0.2) — DoS (incomplete cleanup, resource exhaustion). Via: @nestjs/platform-express → @nestjs/core. **Runtime**.
  3. **serialize-javascript** (≤7.0.2) — RCE (RegExp.flags, Date.prototype.toISOString). Via: terser-webpack-plugin → webpack → ts-loader. **Dev-only** (build).
- **Moderate:** ajv (<8.18.0) — ReDoS ($data). Via: @nestjs/schematics / @angular-devkit. **Dev-only**.

### frontend

- **Total vulnerabilities:** 31 (1 low, 3 moderate, 27 high)
- **Top packages causing HIGH:**
  1. **jsonpath** — Prototype pollution; arbitrary code injection. **Direct/transitive.**
  2. **minimatch** (≤3.1.3, 5.0.0–5.1.7) — ReDoS. Via: filelist, etc.
  3. **nth-check** (<2.0.1) — Inefficient regex (svgo → css-select). **Dev/build.**
  4. **rollup** (<2.80.0) — Arbitrary file write (path traversal).
  5. **serialize-javascript** (≤7.0.2) — RCE. Via: css-minimizer-webpack-plugin, rollup-plugin-terser, terser-webpack-plugin → webpack → react-scripts.
- **Moderate:** lodash 4.0.0–4.17.21 (prototype pollution); postcss <8.4.31 (line return parsing). **qs** 6.7.0–6.14.1 (arrayLimit DoS) — fixable with audit fix.
- **Note:** Frontend uses `overrides.react-scripts.terser-webpack-plugin.schema-utils.ajv` (ajv ^8.12.0); kept intact.

---

## After (Backend)

- **Total vulnerabilities:** 18 (5 moderate, 13 high)
- **Change:** 47 → 18 (−29); HIGH 42 → 13 (−29).
- **What changed:** `npm audit fix` (no `--force`) + override `minimatch` 10.2.1 → 10.2.3 (ReDoS fixes). All minimatch/glob/test-exclude/eslint/typescript-eslint HIGHs resolved.

---

## After (Frontend)

- **Total vulnerabilities:** 22 (2 moderate, 20 high)
- **Change:** 31 → 22 (−9); HIGH 27 → 20 (−7).
- **What changed:** `npm audit fix --legacy-peer-deps` (lodash, minimatch, qs, etc.) + overrides: `nth-check` 2.1.1, `rollup` 2.80.0. Existing `react-scripts` → `terser-webpack-plugin` → `schema-utils` → `ajv` ^8.12.0 left intact.

---

## Dependency Changes (Summary)

| Area | Change | Why safe |
|------|--------|----------|
| **backend-nest** | `minimatch` override 10.2.1 → 10.2.3 | Patched ReDoS; same major, dev-only (glob/jest/eslint). |
| **backend-nest** | `npm audit fix` | Bumped eslint, typescript-eslint, @eslint/*, ajv (6.12.6→6.14.0 in one branch); no majors. |
| **frontend** | `npm audit fix --legacy-peer-deps` | Lodash, minimatch, qs, etc.; no majors. |
| **frontend** | Overrides `nth-check` 2.1.1, `rollup` 2.80.0 | nth-check: ReDoS fix; rollup: path traversal fix (2.x patch). Build verified. |
| **frontend** | ajv override | Unchanged; kept as-is to avoid breaking build. |

---

## Rationale (Why Safe)

- **No major upgrades:** No Nest, React, or webpack major version changes.
- **Targeted bumps and overrides only:** Minimatch 10.2.3; nth-check 2.1.1; rollup 2.80.0; npm audit fix without `--force`.
- **Dev vs runtime:** Most fixed HIGHs are in dev/build (eslint, jest, rollup, nth-check). Remaining backend HIGHs (multer, serialize-javascript) are runtime/build and would require Nest/webpack major; not changed here.

---

## Verification Commands

- **Backend:** `cd backend-nest && npm ci && npm test -- --passWithNoTests && npx eslint "src/**/*.ts" --fix && npm audit --audit-level=high`
- **Frontend:** `cd frontend && npm ci --legacy-peer-deps && npm run build && npm audit --audit-level=high` (tests: `npm test -- --watchAll=false` best-effort; repo may use different test setup)

---

## Remaining HIGH (Not Fixed) and Follow-up

### Backend (13 high)

- **multer** (≤2.0.2): DoS (incomplete cleanup, resource exhaustion). Via `@nestjs/platform-express` → `@nestjs/core`. **Requires Nest major** (downgrade to Nest 7 proposed by audit); not done in this PR.
- **serialize-javascript** (≤7.0.2): RCE. Via `terser-webpack-plugin` → webpack (build only). **Requires @nestjs/cli / webpack major**; not done.

**Follow-up:** Phased Nest major upgrade or upstream multer/serialize-javascript fixes in current majors.

### Frontend (20 high)

- **jsonpath**: Prototype pollution + code injection. Transitive (e.g. recharts). No non-breaking patched version in chain; **would need dependency replacement or react-scripts upgrade.**
- **serialize-javascript** (≤7.0.2): RCE. Via `css-minimizer-webpack-plugin`, `terser-webpack-plugin`, `rollup-plugin-terser` → webpack/react-scripts. **Requires react-scripts major or eject;** not done.

**Follow-up:** Migrate off react-scripts (e.g. Vite) or wait for react-scripts 6.x with updated webpack; replace or patch jsonpath consumer.
