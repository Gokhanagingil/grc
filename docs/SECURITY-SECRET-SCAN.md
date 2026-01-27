# Secret Scanning Configuration and Maintenance

This document explains the TruffleHog secret scanning workflow, what it detects, how to handle false positives, and how to maintain the configuration.

## Overview

The GRC Platform uses TruffleHog for automated secret detection in CI/CD. The workflow is configured to scan for verified (active) secrets only, minimizing false positives while maintaining strong security coverage.

**Workflow File:** `.github/workflows/secret-scanning.yml`
**Risk Level:** P0 (Critical) - Leaked secrets can lead to immediate compromise

## How It Works

### Event-Based Scanning

The workflow handles different GitHub events with appropriate scanning strategies:

| Event | Scan Strategy | Description |
|-------|---------------|-------------|
| `pull_request` | PR diff | Scans changes between PR branch and base branch |
| `push` to main | Incremental | Scans commits since the previous HEAD (`github.event.before`) |
| `push` to devin/* | Incremental | Scans commits since the previous HEAD |
| `schedule` (daily) | Last 50 commits | Daily audit of recent history |

### Why This Design?

**Root Cause (Fixed Jan 2026):** The original workflow failed on push events to main with the error "BASE and HEAD commits are the same." This occurred because after a merge, both the base (main) and HEAD pointed to the same commit, leaving nothing to scan.

**Solution:** The workflow now uses `github.event.before` for push events, which contains the SHA of the commit that HEAD pointed to before the push. This ensures we scan the actual new commits being pushed.

## What Gets Flagged

TruffleHog detects various secret types including:

- API keys (AWS, GCP, Azure, Stripe, etc.)
- OAuth tokens and refresh tokens
- JWT secrets
- Database connection strings with credentials
- Private keys (RSA, SSH, etc.)
- Webhook secrets
- Service account credentials

The `--only-verified` flag means TruffleHog will only fail the build for secrets that have been verified as active (e.g., an AWS key that successfully authenticates).

## Handling False Positives

### Step 1: Verify It's Actually a False Positive

Before adding an ignore rule, confirm:

1. The flagged string is NOT an active secret
2. It cannot be used to access any system
3. It's a test fixture, example, or documentation value

### Step 2: Add to .trufflehogignore

Create or edit `.trufflehogignore` in the repository root:

```
# .trufflehogignore
# Format: One path or pattern per line
# Comments start with #

# Example: Ignore a specific test fixture file
backend-nest/test/fixtures/mock-jwt-tokens.ts

# Example: Ignore a specific line in a file (use with caution)
# path/to/file.ts:42
```

### Step 3: Document the Ignore

Every ignore entry MUST be documented with:

1. **What:** The file/pattern being ignored
2. **Why:** Why this is safe to ignore
3. **CI Run:** Link to the CI run that flagged it
4. **Date:** When the ignore was added
5. **Reviewer:** Who approved the ignore

Add this documentation to the table below.

## Documented Ignores

| File/Pattern | Reason | CI Run | Date | Reviewer |
|--------------|--------|--------|------|----------|
| *(none currently)* | - | - | - | - |

## Adding New Ignores

### Acceptable Ignores

- Test fixture files containing fake/example credentials
- Documentation files with example API keys (clearly marked as examples)
- Snapshot files containing mock data
- Specific lines with hardcoded test values

### Unacceptable Ignores

- Entire directories (e.g., `tests/`, `docs/`)
- All files of a type (e.g., `*.json`, `*.env`)
- Production configuration files
- Any file that might contain real secrets

### Process

1. Create a PR with the ignore entry
2. Include justification in PR description
3. Link to the CI run that flagged the false positive
4. Get approval from a security-aware reviewer
5. Update the "Documented Ignores" table above

## Local Testing

### Install TruffleHog

```bash
# macOS
brew install trufflehog

# Linux/Windows (via pip)
pip install trufflehog

# Docker
docker pull trufflesecurity/trufflehog:latest
```

### Run Local Scan

```bash
# Scan entire repository (verified secrets only)
trufflehog filesystem . --only-verified

# Scan specific directory
trufflehog filesystem ./backend-nest --only-verified

# Scan git history (last 50 commits)
trufflehog git file://. --since-commit HEAD~50 --only-verified

# Scan with all detectors (more false positives)
trufflehog filesystem .
```

### Validate GitHub Actions Locally

```bash
# Using act (GitHub Actions local runner)
act push -j trufflehog --secret-file .secrets
```

## CI Validation

### Verify Workflow Passes

After making changes, verify the workflow passes:

1. Push your branch
2. Check the "Secret Scanning" workflow in GitHub Actions
3. Review the "Scan Summary" step output

### Expected Output

```
=== Secret Scanning Summary ===
Scan type: push
Base ref: abc123...
Note: Only verified (active) secrets will cause build failure.
```

## Troubleshooting

### "BASE and HEAD commits are the same"

This error should no longer occur with the updated workflow. If you see it:

1. Check that the workflow file has the "Determine scan range" step
2. Verify `github.event.before` is being used for push events
3. Check the "scan_type" output in the workflow logs

### Workflow Fails on Initial Commit

For repositories with no history, the workflow uses a full repository scan without base/head comparison. This is handled automatically.

### False Positive on Test File

1. Verify the file is actually a test fixture
2. Add the specific file path to `.trufflehogignore`
3. Document in the table above
4. Do NOT ignore entire test directories

### Real Secret Detected

If a real secret is detected:

1. **DO NOT** add it to ignore files
2. Immediately rotate the secret
3. Remove the secret from the repository
4. Use `git filter-branch` or BFG Repo-Cleaner to remove from history
5. Force push (with team coordination)
6. Audit access logs for the compromised credential

## Related Documentation

- [Quality and Security Gates](./QUALITY-SECURITY-GATES.md)
- [Security and Secrets Guide](./SECURITY-AND-SECRETS-GUIDE.md)
- [Staging Maintenance Runbook](./STAGING-MAINTENANCE-RUNBOOK.md)

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-01-27 | Fixed "BASE and HEAD same" error on push to main | Devin AI |
| 2026-01-27 | Added event-based scan range detection | Devin AI |
| 2026-01-27 | Created this documentation | Devin AI |
