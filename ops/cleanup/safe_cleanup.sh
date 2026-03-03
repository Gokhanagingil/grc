#!/usr/bin/env bash
# =============================================================================
# ops/cleanup/safe_cleanup.sh - Safe disk cleanup for STAGING host
# =============================================================================
#
# SAFETY: This script MUST NOT touch Docker volumes or Postgres data.
# - NEVER run: docker system prune --volumes, docker volume prune
# - NEVER delete anything under /var/lib/docker/volumes
# - DB safety is critical; volumes hold database data.
#
# What this script DOES (safe cleanup only):
#   - Truncate Docker container JSON logs (frees space, keeps containers)
#   - Prune stopped containers, unused networks, build cache, unused images
#   - OS: /tmp cleanup, apt cache, journald vacuum
#
# Usage: run on the STAGING host (self-hosted runner or via SSH).
# Optional env: AGGRESSIVE=1 to run builder/image prune again at the end.
#
# Sudo: All sudo usage is non-interactive. If sudo is missing or requires
# a password, privileged steps are skipped (script never blocks on input).
#
# =============================================================================
set -euo pipefail

# --- Non-interactive sudo check: avoid any hang on password prompts ---
SUDO_OK=0
if command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
  SUDO_OK=1
fi
if [ "$SUDO_OK" -ne 1 ]; then
  echo "WARNING: sudo not available or requires password; privileged steps will be skipped (no hang)."
fi

echo "=============================================="
echo "SAFE DISK CLEANUP - STAGING MAINTENANCE"
echo "NO VOLUMES ARE TOUCHED - DB DATA IS SAFE"
echo "=============================================="

# --- Before stats ---
echo ""
echo "========== BEFORE CLEANUP =========="
echo "--- df -h ---"
df -h
echo ""
echo "--- docker system df ---"
docker system df 2>/dev/null || true
echo "===================================="
echo ""

# --- 1. Truncate Docker container JSON logs (safe; containers keep running) ---
echo "[1/7] Truncating Docker container JSON logs..."
if [ -d /var/lib/docker/containers ]; then
  if [ "$SUDO_OK" = "1" ]; then
    sudo find /var/lib/docker/containers -name "*-json.log" -exec truncate -s 0 {} \; 2>/dev/null || true
    echo "  Done (truncated container log files)."
  else
    echo "  Skipped (requires sudo)."
  fi
else
  echo "  Skipped (containers dir not found)."
fi

# --- 2. Prune stopped containers ---
echo "[2/7] Pruning stopped containers..."
docker container prune -f

# --- 3. Prune unused networks ---
echo "[3/7] Pruning unused networks..."
docker network prune -f

# --- 4. Prune build cache ---
echo "[4/7] Pruning Docker builder cache..."
docker builder prune -af || true

# --- 5. Prune unused/dangling images ---
echo "[5/7] Pruning unused images..."
docker image prune -af || true

# --- 6. OS cleanup: /tmp (contents only, not /tmp itself) ---
echo "[6/7] Cleaning /tmp (contents only)..."
if [ "$SUDO_OK" = "1" ]; then
  sudo rm -rf /tmp/* 2>/dev/null || true
  echo "  Done."
else
  echo "  Skipped (requires sudo)."
fi

# --- 7. Apt cache and journald ---
echo "[7/7] Apt cache and journald vacuum..."
if [ "$SUDO_OK" = "1" ]; then
  sudo apt-get clean 2>/dev/null || true
  sudo apt-get autoclean 2>/dev/null || true
  sudo apt-get autoremove -y 2>/dev/null || true
  sudo journalctl --vacuum-size=200M 2>/dev/null || true
  echo "  Done."
else
  echo "  Skipped (requires sudo)."
fi

# --- Optional: aggressive = second pass of builder + image prune (still NO volumes) ---
if [ "${AGGRESSIVE:-0}" = "1" ]; then
  echo ""
  echo "[AGGRESSIVE] Second pass: builder + image prune (still NO volumes)..."
  docker builder prune -af || true
  docker image prune -af || true
fi

# --- After stats ---
echo ""
echo "========== AFTER CLEANUP =========="
echo "--- df -h ---"
df -h
echo ""
echo "--- docker system df ---"
docker system df 2>/dev/null || true
echo "===================================="
echo ""
echo "SAFE CLEANUP COMPLETE. Volumes were NOT touched."
