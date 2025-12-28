# PR Information for fix/ops-smoke-guard-retry-policy

## PR Link
**Create PR here:** https://github.com/Gokhanagingil/grc/pull/new/fix/ops-smoke-guard-retry-policy

## PR Title
```
fix(ops): harden smoke tests (credential guard + retry policy + safe diagnostics)
```

## PR Description
```markdown
## Summary
This PR hardens the staging deployment validation script with security improvements and deterministic retry policies.

## Changes

### A) Credential Guard
- Validates password length (minimum 8 characters)
- Rejects placeholder passwords (***, ********)
- Validates email format (contains @ and .)
- Exits with code 7 if credentials fail validation

### B) Retry Policy (Deterministic)
- **No retry on client errors:** 400, 401, 403, 404 → immediate failure
- **Retry on retryable errors:** 429 (rate limit), 408 (timeout), 5xx (server errors), 000 (network errors)
- Exponential backoff: 2s, 4s, 8s

### C) Safe Diagnostics
- Response bodies are sanitized before logging (JWT/Bearer/accessToken masked)
- Token values never appear in logs (stored in container temp files)
- Sanitization function masks:
  - JWT tokens (eyJ...)
  - Bearer tokens
  - accessToken fields
  - token fields

### D) Evidence Integrity Check
- Scans raw.log for token patterns after evidence generation
- Exits with code 8 if any token patterns detected
- Ensures tokens never leak into evidence files

## Files Changed
- `ops/staging-deploy-validate.sh` - Main validation script with all security improvements
- `docs/STAGING-MAINTENANCE-RUNBOOK.md` - Updated runbook documentation

## Testing
- ✅ Bash syntax check passed (`bash -n`)
- ✅ Credential guard validates password length and placeholders
- ✅ Retry policy correctly distinguishes 4xx (no-retry) vs 5xx/429/408/000 (retry)
- ✅ Response body sanitization masks all token patterns
- ✅ Evidence integrity check prevents token leaks

## Security Notes
- **No credentials logged:** Passwords and tokens never appear in logs
- **Sanitized output:** All response bodies sanitized before logging
- **Evidence protection:** Post-generation integrity check prevents token leaks

## Post-Merge Instructions
After merge, run on staging server via tmux:
```bash
ssh root@46.224.99.150
tmux new -s deploy
cd /opt/grc-platform
git checkout main
git pull --ff-only
export STAGING_ADMIN_EMAIL="admin@grc-platform.local"
export STAGING_ADMIN_PASSWORD="GERCEK_SIFREYI_YAZ"  # Use real password, not ***
bash ops/staging-deploy-validate.sh

# After completion, check evidence:
bash ops/staging-validate-and-check-evidence.sh
```
```

## Diff Summary
```
docs/STAGING-MAINTENANCE-RUNBOOK.md | 168 +++++++++++++++++++++++
ops/staging-deploy-validate.sh      | 256 +++++++++++++++++++++++++++++++++---
2 files changed, 403 insertions(+), 21 deletions(-)
```

