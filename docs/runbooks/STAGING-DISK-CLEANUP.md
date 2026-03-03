# Staging Disk Cleanup - Maintenance Runbook

This runbook describes the **manual-only** GitHub Actions workflow that frees disk space on the STAGING host without touching Docker volumes (DB safety is critical).

## When to run

- **Only when:** You see disk pressure on the STAGING host, or deploy failures due to "no space left on device".
- **Do not run** as a routine schedule; run only when needed.

## What the workflow does (safe cleanup)

- Prints **before** and **after** disk stats: `df -h`, `docker system df`.
- Truncates Docker container JSON logs (frees space; containers keep running).
- Prunes: stopped containers, unused networks, builder cache, unused images.
- OS cleanup: `/tmp` contents, apt cache (clean/autoclean/autoremove), journald vacuum to 200M.

## What it will NOT do (safety)

- **NO** `docker system prune --volumes` or `docker volume prune`.
- **NO** deletion under `/var/lib/docker/volumes` or Postgres data directories.
- Database volumes and data are **never** touched.

## Workflow options

| Option | Workflow file | How it runs |
|--------|----------------|-------------|
| **A (preferred)** | `maintenance-disk-cleanup.yml` | Runs on a **self-hosted runner** on the STAGING machine with labels `[self-hosted, linux, x64, staging]`. |
| **B (fallback)** | `maintenance-disk-cleanup-ssh.yml` | Uses **SSH** to the STAGING host. Supports the secret name variants below. |

## SSH workflow – supported secret names (Option B)

The SSH workflow accepts **either** naming variant so it works with existing "Deploy to Staging" secrets or generic names:

| Purpose | Primary (matches Deploy to Staging) | Alternative |
|--------|--------------------------------------|-------------|
| **Host** | `STAGING_SSH_HOST` | `STAGING_HOST` |
| **User** | `STAGING_SSH_USER` | `STAGING_USER` |
| **Key** | `STAGING_SSH_KEY_B64` (preferred, base64-encoded) | `STAGING_SSH_KEY` (plain text) |

- For **host** and **user**, if both variants are set, the primary (`STAGING_SSH_*`) is used.
- You must set **at least one** host secret and **at least one** user secret; for the key you must set **at least one** of `STAGING_SSH_KEY_B64` or `STAGING_SSH_KEY`.

## Self-hosted runner (Option A)

To use the preferred workflow, register a self-hosted runner on the STAGING host with these labels:

- `self-hosted`
- `linux`
- `x64`
- `staging`

Example (on the STAGING machine):

1. Repo → **Settings** → **Actions** → **Runners** → **New self-hosted runner**.
2. Follow GitHub's instructions for Linux; when configuring the runner, add the label `staging` (and ensure `self-hosted`, `linux`, `x64` are present as appropriate for the OS/arch).
3. The workflow `Maintenance - Disk Cleanup (Safe) [STAGING]` will use this runner.

## GitHub Environment protection (required)

The job **must** use the `staging` environment so it is gated by approval.

1. Go to **Repo** → **Settings** → **Environments**.
2. Select (or create) the **staging** environment.
3. Enable **Required reviewers** and add the approvers.
4. Save.

Until the environment is approved, the cleanup job will not run. Both workflows (self-hosted and SSH) set `environment: staging`.

## How to run from GitHub Actions UI

1. Open the repo on GitHub → **Actions**.
2. In the left sidebar, choose:
   - **Maintenance - Disk Cleanup (Safe) [STAGING]** (self-hosted), or  
   - **Maintenance - Disk Cleanup (Safe) [STAGING] (SSH)** (SSH fallback).
3. Click **Run workflow**.
4. In **confirm**, type exactly: `I_UNDERSTAND_NO_VOLUMES` (required safety gate).
5. Choose branch (e.g. `main`).
6. Optionally set **aggressive** to `true` for an extra builder/image prune pass (still no volumes).
7. Click **Run workflow**.
8. If required reviewers are set for `staging`, approve the environment when prompted; the job will then run.

## Script location

The cleanup logic lives in:

- **ops/cleanup/safe_cleanup.sh**

It can be run manually on the STAGING host if needed (e.g. via SSH). Set `AGGRESSIVE=1` to run a second builder/image prune pass. The script never touches volumes. All `sudo` usage is non-interactive; if `sudo` is unavailable or requires a password, privileged steps are skipped so the script never hangs on input.
