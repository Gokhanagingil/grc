# Dependency Management Policy

This document outlines the GRC Platform's approach to dependency management, including what updates are auto-merged, what requires manual review, and how we handle high-risk upgrades.

## Overview

We use Dependabot for automated dependency updates with a weekly schedule (Mondays at 09:00 Europe/Istanbul). Updates are grouped by category to reduce PR noise and ensure related packages are upgraded together.

## What We Auto-Merge

Minor and patch updates for the following categories are grouped and can typically be merged after CI passes:

**Backend-Nest:**
- NestJS ecosystem (`@nestjs/*`) - minor/patch only
- TypeORM and related packages - minor/patch only
- Testing utilities (jest, ts-jest, supertest) - minor/patch only
- TypeScript and type definitions - minor/patch only

**Frontend:**
- React core (react, react-dom) - minor/patch only
- Material-UI ecosystem (`@mui/*`, `@emotion/*`) - minor/patch only
- Testing libraries (`@testing-library/*`) - minor/patch only
- Frontend modernization group (react-router-dom, typescript, web-vitals, recharts, date-fns) - minor/patch only

**General:**
- GitHub Actions - minor/patch only
- Development tooling - minor/patch only

## What Requires Manual Review

All major version upgrades require manual review and should be part of a planned modernization sprint:

**Always Review:**
- Any major version bump (semver-major)
- Framework upgrades (React, NestJS, TypeORM)
- TypeScript major versions
- Test framework major versions (Jest)
- Routing library major versions (react-router-dom)

**Review Process:**
1. Check the changelog for breaking changes
2. Run full test suite locally
3. Verify build passes
4. Test affected features manually
5. Consider coordinating with related upgrades (e.g., Jest + @types/jest)

## High-Risk Majors (Currently Blocked)

The following major upgrades are explicitly ignored in Dependabot configuration due to known compatibility issues:

| Package | Blocked Versions | Reason | Revisit Condition |
|---------|-----------------|--------|-------------------|
| `date-fns` | >= 4.0.0 | Incompatible with @mui/x-date-pickers v7 | When @mui/x-date-pickers v8+ is adopted |
| `@types/node` | >= 23.0.0 | CI uses Node.js 20.x; types must match runtime | When Node runtime is upgraded to 22.x+ |
| `@types/jest` (frontend) | >= 30.0.0 | react-scripts bundles Jest 27.x | When Jest is intentionally upgraded |

**Backend-Nest Additional Blocks:**
- `@nestjs/*` major versions - requires migration planning
- `typeorm` major versions - requires migration planning
- `typescript` major versions - requires codebase-wide review

**Frontend Additional Blocks:**
- `react` / `react-dom` major versions - requires migration planning
- `@mui/*` major versions - requires migration planning

## How We Handle Node/Types Alignment

Type definitions for Node.js (`@types/node`) must align with the actual Node.js runtime version used in CI and production:

**Current State:**
- CI Runtime: Node.js 20.x (see `.github/workflows/backend-nest-ci.yml`)
- Recommended Types: `@types/node@20.x`
- Blocked Types: `@types/node@23.x`, `@types/node@24.x`, `@types/node@25.x`

**Why This Matters:**
- Type definitions describe the APIs available at runtime
- Using types for a newer Node version than the runtime can cause:
  - False type safety (code compiles but fails at runtime)
  - Missing errors for APIs that don't exist in the actual runtime
  - Incorrect type signatures for changed APIs

**Upgrade Path:**
1. First upgrade Node.js runtime in CI (`.github/workflows/*.yml`)
2. Update Docker images to use new Node version
3. Update production deployment environments
4. Then upgrade `@types/node` to match

## Dependabot Groups

Updates are grouped to land as single PRs when safe:

**Backend-Nest Groups:**
- `nestjs`: All @nestjs/* packages
- `typeorm`: typeorm + @nestjs/typeorm
- `testing`: jest, @types/jest, ts-jest, supertest
- `typescript`: typescript, typescript-eslint, @types/* (excluding @types/node, @types/jest)

**Frontend Groups:**
- `react`: react, react-dom, @types/react, @types/react-dom
- `mui`: @mui/*, @emotion/*
- `testing`: @testing-library/*
- `frontend-modernization`: react-router-dom, typescript, web-vitals, recharts, date-fns, @types/* (excluding react/node/jest types)

## Triage Process

When reviewing Dependabot PRs:

1. **Check CI Status**: Only merge if all checks pass
2. **Review Changelog**: Look for breaking changes or deprecations
3. **Assess Risk Level**:
   - Low: Patch updates, documentation changes
   - Medium: Minor updates with new features
   - High: Major updates, security fixes with breaking changes
4. **Test Locally**: For medium/high risk, run tests locally before merging
5. **Coordinate Related Updates**: Some packages should be upgraded together (e.g., jest + @types/jest)

## Related Documentation

- [DEPENDENCY_ANALYSIS.md](./DEPENDENCY_ANALYSIS.md) - Detailed dependency analysis
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Development setup and contribution guidelines
- [.github/dependabot.yml](../.github/dependabot.yml) - Dependabot configuration
