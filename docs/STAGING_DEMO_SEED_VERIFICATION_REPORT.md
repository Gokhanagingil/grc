# Staging Demo Seed Verification — Report & Checklist

Use this after running verification (on the staging host or via GitHub Actions) to record evidence and conclude why demo data was or wasn’t visible in the UI.

---

## Running from GitHub Actions (no SSH to staging)

When you cannot run commands on the staging host directly, use the maintenance workflow:

1. **Go to:** Actions → **"Maintenance - Staging Demo Seed Verify/Run [STAGING]"** → Run workflow.
2. **Staging approval:** The workflow uses the **staging** environment. If your repo has required reviewers for that environment (Settings → Environments → staging), a reviewer must approve the run before the job starts.
3. **Inputs:**
   - **confirm:** Type exactly `I_UNDERSTAND_NO_DESTRUCTIVE_ACTIONS` (safety gate).
   - **mode:** `verify_only` (check only; no seeds) or `verify_and_seed` (run seeds if needed).
   - **backend_container / postgres_container:** Defaults `grc-staging-backend`, `grc-staging-db`; override if your containers use other names.
   - **Use SSH fallback?** Leave **false** to run on the self-hosted runner on staging (preferred). Set **true** to run on a GitHub-hosted runner and execute the script via SSH (requires `STAGING_SSH_HOST`, `STAGING_SSH_USER`, `STAGING_SSH_KEY_B64` or `STAGING_SSH_KEY` in the staging environment).
4. **Artifact:** After the run, download **staging-demo-seed-verification** from the job summary. It contains the full log (Phase 0–4), DB counts, and the scenario checklist excerpt when seeds ran.
5. **Summary in logs:** The job prints a short summary: whether demo seed markers were found, DB counts for the demo tenant, and the scenario checklist excerpt. If the workflow reports **NO DATA SEEDED**, either mode was `verify_only` or the demo pack did not insert (e.g. prerequisites missing — run with `verify_and_seed` after ensuring `seed:grc` has run, or re-run the workflow).

**Safety:** The workflow does not run any destructive commands (no DB reset, no volume prune). Seeds are idempotent.

---

## 1. Conclusion (fill after verification)

**What happened?**

- **(a) Seed never ran** — No demo pack markers in backend logs; seeds were run by the script and DB counts increased.
- **(b) Ran but exited 0 due to missing prerequisites** — Logs show `[SEED-DEMO-PACK] Prerequisites not met (no GRC controls for demo tenant). Run seed:grc first. Exiting successfully.` Then seed:grc (and optionally standards/core-companies) was run, then seed:demo:pack was re-run and succeeded.
- **(c) Ran and inserted but UI tenant/view mismatch** — DB counts show data for demo tenant; user is on a different tenant or role, or looking in the wrong place.

**Conclusion:** _[Pick one of (a)–(c) and add one line of detail]_

---

## 2. Exact commands run (copy-paste friendly)

Run these **on the staging host** from the repo root (e.g. `/opt/grc-platform`).

```bash
# Phase 0 — Containers and env
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
df -h
docker system df

# Phase 1 — Log evidence (demo markers)
docker logs --tail 500 grc-staging-backend 2>&1 | grep -i -E "seed:demo|demo pack|scenario checklist|DEMO-SC|SEED-DEMO-PACK" || true

# Phase 2 — Inside backend: workspace and scripts
docker exec grc-staging-backend sh -c 'cd /app && pwd && npm run 2>/dev/null | grep -E "seed:(grc|standards|demo)"'

# Phase 3 — Run seeds (order matters)
docker exec grc-staging-backend sh -c 'cd /app && npm run seed:grc'
docker exec grc-staging-backend sh -c 'cd /app && npm run seed:standards'
# Optional: node dist/scripts/seed-core-companies.js if file exists
docker exec grc-staging-backend sh -c 'cd /app && npm run seed:demo:pack'

# Phase 4 — DB counts (read-only)
docker exec grc-staging-db psql -U postgres -d grc_platform -c "\dt" | head
docker exec grc-staging-db psql -U postgres -d grc_platform -t -c "
SELECT 'grc_risks', COUNT(*) FROM grc_risks WHERE \"tenantId\" = '00000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'itsm_changes', COUNT(*) FROM itsm_changes WHERE \"tenantId\" = '00000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'itsm_incidents', COUNT(*) FROM itsm_incidents WHERE \"tenantId\" = '00000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'itsm_problems', COUNT(*) FROM itsm_problems WHERE \"tenantId\" = '00000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'itsm_known_errors', COUNT(*) FROM itsm_known_errors WHERE \"tenantId\" = '00000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'itsm_major_incidents', COUNT(*) FROM itsm_major_incidents WHERE \"tenantId\" = '00000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'grc_audits', COUNT(*) FROM grc_audits WHERE \"tenantId\" = '00000000-0000-0000-0000-000000000001';
"
```

**One-liner (full verification script):**

```bash
./scripts/staging-demo-seed-verify.sh
```

---

## 3. Evidence to capture

- **Log grep (Phase 1):** Paste the output of the `docker logs ... | grep ...` command. If empty, that supports “seed never ran.”
- **Scenario checklist (Phase 3):** From the end of `npm run seed:demo:pack` output, paste the “--- SCENARIO CHECKLIST ---” block (no secrets).
- **DB counts (Phase 4):** Paste the result of the `SELECT ... UNION ALL ...` count query for the demo tenant.

---

## 4. UI checklist (why user “can’t see” data)

- [ ] **Tenant** — The UI is using the **same tenant** as the seeded demo tenant: `00000000-0000-0000-0000-000000000001`. If the app has a tenant switcher or login scopes to another tenant, switch to the demo tenant or log in as the demo admin (`admin@grc-platform.local` from seed:grc).
- [ ] **Role** — Technician vs end-user can change visible views (e.g. Changes, Incidents, Problems). Log in as a user that has access to the seeded records (e.g. demo admin or a seeded technician).
- [ ] **Where to look first** — Use the scenario codes from the seed output:
  - **Change:** DEMO-SC1-CHG-001, DEMO-SC2-CHG-001  
  - **Incident:** DEMO-SC1-INC-001, DEMO-SC1-INC-002, DEMO-SC1-INC-003, DEMO-SC2-INC-001  
  - **Risk:** DEMO-SC1-RISK-001, DEMO-SC2-RISK-001  
  - **Problem:** DEMO-SC1-PRB-001  
  - **Major Incident:** DEMO-SC1-MI-001  
  - **Audit:** DEMO-SC2-AUD-001  
  Open one of these by number/code in the relevant list or search to confirm data is visible.

---

## 5. Expected demo tenant counts (after successful seed)

Rough expectations for tenant `00000000-0000-0000-0000-000000000001` after `seed:demo:pack`:

| Table                 | Expected (approx) |
|-----------------------|-------------------|
| grc_risks             | ≥ 2 (DEMO-SC1-RISK-001, DEMO-SC2-RISK-001) |
| itsm_changes          | ≥ 2 (DEMO-SC1-CHG-001, DEMO-SC2-CHG-001)   |
| itsm_incidents        | ≥ 4 (SC1 x3 + SC2 x1)                       |
| itsm_problems         | ≥ 1 (DEMO-SC1-PRB-001)                      |
| itsm_known_errors     | ≥ 1                                              |
| itsm_major_incidents  | ≥ 1 (DEMO-SC1-MI-001)                        |
| grc_audits            | ≥ 1 (DEMO-SC2-AUD-001)                       |

If these counts are 0, the demo pack did not insert (e.g. prerequisites missing or script exited early). If counts are non-zero but the UI shows nothing, use the UI checklist above.
