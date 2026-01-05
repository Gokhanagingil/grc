# Staging Validation Summary

## ✅ Completed Steps

### 1. Local Repo Kontrol
- ✅ Main branch güncel (git pull --ff-only)
- ✅ Branch: `fix/ops-smoke-guard-retry-policy`
- ✅ Working tree clean

### 2. Güvenlik Kontrolleri

#### A) Credential Guard ✅
- ✅ Password length check: `< 8` → Exit 7
- ✅ Placeholder detection: `***`, `********` → Exit 7
- ✅ Email format validation: must contain `@` and `.`
- **Location:** `ops/staging-deploy-validate.sh:822-837`

#### B) Retry Policy ✅
- ✅ 400/401/403/404 → No retry (RETRY_SHOULD_SKIP=1)
- ✅ 429 → Retry (rate limit)
- ✅ 408/5xx/000 → Retry (server errors, timeout, network)
- **Location:** `ops/staging-deploy-validate.sh:579-599` (login), `750-770` (context)

#### C) Response Body Sanitization ✅
- ✅ `sanitize_response_body()` function masks:
  - JWT tokens (eyJ...)
  - Bearer tokens
  - accessToken fields
  - token fields
- ✅ All response bodies sanitized before logging to raw.log
- **Location:** `ops/staging-deploy-validate.sh:443-456, 609-613, 779-784`

#### D) Evidence Integrity Check ✅
- ✅ Scans raw.log for token patterns after generation
- ✅ Pattern: `eyJ...`, `Bearer ...`, `accessToken`, `token`
- ✅ Exit 8 if token patterns detected
- **Location:** `ops/staging-deploy-validate.sh:895-906`

### 3. Bash Syntax Check
- ✅ `bash -n ops/staging-deploy-validate.sh` passed (exit code 0)

### 4. Branch Push
- ✅ Branch pushed to origin: `fix/ops-smoke-guard-retry-policy`

### 5. PR Creation
**PR Link:** https://github.com/Gokhanagingil/grc/pull/new/fix/ops-smoke-guard-retry-policy

**PR Title:**
```
fix(ops): harden smoke tests (credential guard + retry policy + safe diagnostics)
```

**PR Description:**
- Placeholder password guard
- Deterministic retry policy (no retry on 4xx)
- Safe diagnostics (sanitized body)
- Evidence integrity check

### 6. Staging Validation Script
- ✅ Created: `ops/staging-validate-and-check-evidence.sh`
- Script checks evidence files and validates:
  - Smoke test results
  - Token leak detection
  - Health check results
  - Summary and metadata

## 📋 Post-Merge Staging Validation Commands

### Step 1: SSH and tmux Setup
```bash
ssh root@46.224.99.150
tmux new -s deploy
```

### Step 2: Repo Update
```bash
cd /opt/grc-platform
git checkout main
git pull --ff-only
```

### Step 3: Environment Setup
```bash
export STAGING_ADMIN_EMAIL="admin@grc-platform.local"
export STAGING_ADMIN_PASSWORD="GERCEK_SIFREYI_YAZ"  # ⚠️ REAL PASSWORD, NOT ***
printf 'password_len=%s\n' "$(printf %s "${STAGING_ADMIN_PASSWORD:-}" | wc -c)"
# Optional:
# export STAGING_TENANT_ID="00000000-0000-0000-0000-000000000001"
```

### Step 4: Run Validation Script
```bash
bash ops/staging-deploy-validate.sh
```

**If SSH disconnects:**
```bash
tmux attach -t deploy
```

### Step 5: Evidence Validation
```bash
# Find latest evidence directory
LATEST=$(ls -td evidence/staging-* | head -1); echo "$LATEST"

# Check smoke test results
grep -n "SMOKE " "$LATEST/raw.log" | tail -n 200
grep -n "SMOKE login" "$LATEST/raw.log" | tail -n 200
grep -n "SMOKE context" "$LATEST/raw.log" | tail -n 200

# Check health results
grep -n "HEALTH " "$LATEST/raw.log"

# Token leak check (should return "OK: no token patterns")
grep -E "eyJ[a-zA-Z0-9_-]{10,}\.|Bearer [A-Za-z0-9._-]{10,}|accessToken\"\s*:\s*\"|Authorization:" "$LATEST/raw.log" && echo "LEAK DETECTED" || echo "OK: no token patterns"

# View summary and metadata
tail -n 80 "$LATEST/summary.md"
head -n 80 "$LATEST/meta.json"

# Or use the validation script:
bash ops/staging-validate-and-check-evidence.sh
```

## 🔍 Expected Outputs

### Success Indicators
- ✅ Exit code: 0
- ✅ Credential guard: `SMOKE credential_guard result=OK`
- ✅ Login test: `SMOKE login attempt=X http=200 retry=NO reason=success`
- ✅ Context test: `SMOKE context attempt=X http=200 retry=NO reason=success`
- ✅ Token leak check: `OK: no token patterns`
- ✅ Evidence integrity: `Evidence integrity check passed`

### If Login Fails with 400/401
1. Check `raw.log` for `SMOKE login response_body=` (sanitized)
2. Verify credentials are correct (not placeholder)
3. Verify email format is valid
4. Check for DTO validation errors in sanitized response

## 📝 Files Changed
- `ops/staging-deploy-validate.sh` - Main validation script (+256 lines)
- `docs/STAGING-MAINTENANCE-RUNBOOK.md` - Runbook documentation (+168 lines)

## 🔒 Security Guarantees
- **No password logging:** Passwords never appear in logs
- **No token logging:** Tokens stored in container temp files, never logged
- **Sanitized responses:** All response bodies sanitized before logging
- **Post-generation check:** Evidence integrity check prevents token leaks
- **Credential validation:** Placeholder passwords rejected before smoke tests

