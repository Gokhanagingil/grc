# Flake Policy

> Phase 0 — Stabilization Gate runbook entry.
> Last updated: 2026-02-22

## What Qualifies as a Flake?

A test is **flaky** when it passes and fails non-deterministically on the same
code without any source change. Common root causes in this repo:

| Category | Example | Typical Fix |
|----------|---------|-------------|
| **Wall-clock timing** | `Date.now()` or `process.hrtime` assertions with tight thresholds | Replace with correctness-based assertions (bounded output, termination) |
| **Async logging** | "Cannot log after tests are done" | Mock/silence logger in test; close async transports in `afterAll` |
| **Open handles** | Jest "did not exit 1 s after run" | Proper `afterAll` teardown: `app.close()`, destroy DB connections, clear timers |
| **CI resource contention** | Timing-based test passes locally but fails on shared CI runner | Remove timing dependency entirely; use property-based checks |
| **Network / port collisions** | Random port in use | Use `getPort()` or dynamic port assignment |

## How We Classify

1. **Deterministic failure** — The test always fails. This is a **bug**, not a flake. Fix immediately.
2. **Intermittent failure** — Fails <30% of runs. This is a **flake**. Apply one of the three approaches below.
3. **Environment-only failure** — Fails only on CI (not locally). Likely resource contention. Still a flake.

## Three Approved Approaches

### A. Make Test Deterministic (Preferred)

Remove the non-deterministic element entirely:

- Replace timing assertions with correctness assertions
- Use fixed inputs instead of random/generated data
- Mock external dependencies (network, filesystem, clock)
- Example: ReDoS test rewritten to check "function terminates and output is bounded" instead of "runs in < 500ms"

### B. Quarantine

When a deterministic fix is not immediately feasible:

1. Add `@quarantined` tag to the test description
2. Add a comment block with:
   - Exact failure log link or CI job ID
   - Rationale for quarantine
   - Date quarantined
   - Owner responsible for un-quarantining
3. Move the test to a nightly-only suite (NOT in PR gate)
4. Create a tracking issue

```typescript
// @quarantined — CI job #64464665081, 2026-02-22
// Reason: Timing-based assertion fails on shared CI runners due to CPU contention.
// Owner: @Gokhanagingil
// Re-enable when: Rewritten to use correctness-based assertion.
it.skip('should complete in < 500ms', () => { ... });
```

### C. Replace

Rewrite the test to verify the same security/correctness property without flakiness:

- Use property-based testing (e.g., fast-check)
- Use bounded-output assertions instead of timing
- Jest's default 5s timeout serves as backstop for true hangs

## How We Re-enable Quarantined Tests

1. Fix the root cause (approach A or C)
2. Run the fixed test 3x locally to confirm stability
3. Run CI 3x (or use retry strategy) to confirm no flake
4. Remove `@quarantined` tag and `.skip`
5. Move test back to PR gate suite

## CI Evidence Requirements

When fixing a flake, the PR must include:

- **Before**: Link to the failing CI job (e.g., job ID)
- **After**: Evidence of 3 consecutive green runs (CI re-runs or local runs)
- **Root cause**: Brief explanation of why the test was flaky

## References

- CI job #64464665081: Original log-sanitizer.spec.ts ReDoS timing flake
- PR #451: Fix applied — rewrote timing tests to correctness-based assertions
