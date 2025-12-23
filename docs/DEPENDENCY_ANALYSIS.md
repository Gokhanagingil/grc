# Dependency Analysis: bcrypt vs bcryptjs

This document provides evidence-based analysis of the bcrypt/bcryptjs dependency conflict in the GRC Platform.

## Current State

### backend-nest Package Dependencies

```json
{
  "dependencies": {
    "bcrypt": "^6.0.0",
    "bcryptjs": "^3.0.3"
  },
  "devDependencies": {
    "@types/bcrypt": "^6.0.0",
    "@types/bcryptjs": "^2.4.6"
  }
}
```

### Actual Usage in Code

| File | Package Used | Purpose |
|------|--------------|---------|
| `users.service.ts` | bcrypt (native) | Password hashing for user creation |
| `users.service.spec.ts` | bcrypt (native) | Test mocking |
| `seed-grc.ts` | bcrypt (native) | Demo user seeding |
| `auth.service.ts` | bcryptjs (pure JS) | Password verification during login |
| `auth.service.spec.ts` | bcryptjs (pure JS) | Test mocking |
| `mfa.service.ts` | bcryptjs (pure JS) | MFA backup code hashing |

### backend (Legacy) Usage

| File | Package Used | Purpose |
|------|--------------|---------|
| `routes/auth.js` | bcryptjs | Password verification |
| `routes/users.js` | bcryptjs | Password hashing |
| `scripts/seed-demo-admin.js` | bcryptjs | Demo user seeding |

## Analysis

### Compatibility

Both packages produce compatible bcrypt hashes. A hash created by `bcrypt` can be verified by `bcryptjs` and vice versa. This is because they both implement the same bcrypt algorithm and use the same hash format.

**Evidence**: The current system works correctly with mixed usage, indicating hash compatibility.

### Performance Comparison

| Metric | bcrypt (native) | bcryptjs (pure JS) |
|--------|-----------------|-------------------|
| Hash Speed | ~3-5x faster | Baseline |
| Verify Speed | ~3-5x faster | Baseline |
| Memory Usage | Lower | Higher |
| CPU Usage | Uses native code | Pure JavaScript |

### Portability Comparison

| Metric | bcrypt (native) | bcryptjs (pure JS) |
|--------|-----------------|-------------------|
| Installation | Requires build tools | No compilation |
| Docker | May need build deps | Works everywhere |
| Windows | Can be problematic | Works everywhere |
| Alpine Linux | Needs extra packages | Works out of box |

### Current Risk Assessment

**Risk Level**: LOW

The current mixed usage works correctly because:
1. Hash formats are compatible
2. No cross-module password operations
3. Each service consistently uses one package

**Potential Issues**:
1. Confusion for developers
2. Unnecessary duplicate dependencies
3. Inconsistent performance characteristics

## Recommendation

### Short-Term (FAZ 4): Document Only

**Decision**: Keep both packages for now.

**Rationale**:
- System works correctly
- Changing could introduce bugs
- Low risk of issues
- Focus on higher-priority items

### Medium-Term (FAZ 5-6): Standardize on bcryptjs

**Recommendation**: Migrate all code to use `bcryptjs`.

**Rationale**:
1. **Portability**: No native compilation required
2. **Consistency**: Legacy backend already uses bcryptjs
3. **Docker**: Simpler Dockerfile without build dependencies
4. **CI/CD**: Faster builds without native compilation
5. **Performance**: Acceptable for authentication workloads

**Migration Steps**:
1. Update imports in users.service.ts
2. Update imports in seed-grc.ts
3. Update test files
4. Remove bcrypt and @types/bcrypt from package.json
5. Run full test suite
6. Verify in staging

### Alternative: Standardize on bcrypt (native)

**When to consider**:
- High-volume authentication (>1000 logins/minute)
- Performance-critical password operations
- Team comfortable with native dependencies

**Migration Steps**:
1. Update imports in auth.service.ts
2. Update imports in mfa.service.ts
3. Update test files
4. Remove bcryptjs and @types/bcryptjs from package.json
5. Update Dockerfile if needed
6. Run full test suite
7. Verify in staging

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2024-12-23 | Keep both (FAZ 4) | Low risk, working system, focus on operability |
| TBD | Standardize (FAZ 5-6) | Reduce complexity, improve consistency |

## References

- [bcrypt npm](https://www.npmjs.com/package/bcrypt)
- [bcryptjs npm](https://www.npmjs.com/package/bcryptjs)
- [bcrypt algorithm](https://en.wikipedia.org/wiki/Bcrypt)
