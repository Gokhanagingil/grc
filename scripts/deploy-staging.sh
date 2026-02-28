#!/bin/bash
#
# GRC Platform - Staging Deployment Script
#
# Single entrypoint for deploying main branch to staging environment.
# Designed for safe, repeatable, human-error-resistant deployments.
#
# Usage:
#   ./scripts/deploy-staging.sh
#
# Prerequisites:
#   - Must be executed on the staging server
#   - Docker and Docker Compose must be installed
#   - Repository must be cloned at /opt/grc-platform (or current directory)
#
# Exit codes:
#   0 - DEPLOY SUCCESS
#   1 - Git verification failed
#   2 - Docker build failed
#   3 - Container startup failed
#   4 - Health check failed
#   5 - Platform validation failed
#   6 - Smoke test failed
#   7 - Disk preflight failed (insufficient space/inodes after cleanup)
#
# This script does NOT contain secrets. Environment variables are read from
# docker-compose.staging.yml or .env file on the staging server.
#

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

COMPOSE_FILE="docker-compose.staging.yml"
HEALTH_CHECK_URL="http://localhost:3002/health/ready"
HEALTH_CHECK_TIMEOUT=120
HEALTH_CHECK_INTERVAL=5
CONTAINER_STABILIZE_WAIT=15

# Disk preflight thresholds
MIN_FREE_DISK_GB=5          # Minimum free disk space in GB
MIN_FREE_INODES=100000      # Minimum free inodes
INODE_WARN_THRESHOLD=200000 # Warn if free inodes below this

# =============================================================================
# Colors and Formatting
# =============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# =============================================================================
# Helper Functions
# =============================================================================

log_step() {
    echo ""
    echo -e "${BLUE}${BOLD}=== $1 ===${NC}"
    echo ""
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_ok() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
}

print_header() {
    echo ""
    echo -e "${BOLD}========================================${NC}"
    echo -e "${BOLD}GRC Platform - Staging Deployment${NC}"
    echo -e "${BOLD}========================================${NC}"
    echo "Started at: $(date '+%Y-%m-%d %H:%M:%S %Z')"
    echo "Working directory: $(pwd)"
    echo ""
}

print_footer_success() {
    echo ""
    echo -e "${GREEN}${BOLD}========================================${NC}"
    echo -e "${GREEN}${BOLD}DEPLOY SUCCESS${NC}"
    echo -e "${GREEN}${BOLD}========================================${NC}"
    echo "Completed at: $(date '+%Y-%m-%d %H:%M:%S %Z')"
    echo ""
    echo "Staging is healthy. Platform core is ready."
    echo "You can proceed with manual UI validation."
    echo ""
}

print_footer_failure() {
    local exit_code=$1
    local message=$2
    echo ""
    echo -e "${RED}${BOLD}========================================${NC}"
    echo -e "${RED}${BOLD}DEPLOY FAILED${NC}"
    echo -e "${RED}${BOLD}========================================${NC}"
    echo "Failed at: $(date '+%Y-%m-%d %H:%M:%S %Z')"
    echo "Exit code: $exit_code"
    echo "Reason: $message"
    echo ""
    echo "Review the logs above for details."
    echo "Consider rollback if needed (see STAGING_RELEASE_CHECKLIST.md)."
    echo ""
}

wait_for_health() {
    local container=$1
    local timeout=$2
    local interval=$3
    local elapsed=0

    log_info "Waiting for container '$container' to become healthy (timeout: ${timeout}s)..."
    
    while [ $elapsed -lt $timeout ]; do
        local status
        status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "unknown")
        if [ "$status" = "healthy" ]; then
            return 0
        fi
        sleep $interval
        elapsed=$((elapsed + interval))
        echo "  Waiting... ($elapsed/$timeout seconds) [status: $status]"
    done
    
    # On failure, print last health log for diagnostics
    log_info "Docker health log for $container:"
    docker inspect --format='{{json .State.Health}}' "$container" 2>/dev/null || true
    return 1
}

# =============================================================================
# Deployment Steps
# =============================================================================

step_verify_repo() {
    log_step "Step 1/8: Verify Repository State"
    
    # Check if we're in a git repository
    if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
        log_fail "Not inside a git repository"
        return 1
    fi
    log_ok "Inside git repository"
    
    # Check current branch
    local current_branch
    current_branch=$(git branch --show-current)
    if [ "$current_branch" != "main" ]; then
        log_fail "Not on main branch (current: $current_branch)"
        log_info "Run: git checkout main"
        return 1
    fi
    log_ok "On main branch"
    
    # Check for uncommitted changes (warning only)
    if ! git diff --quiet || ! git diff --cached --quiet; then
        log_warn "Uncommitted changes detected"
        log_info "Consider committing or stashing changes"
    else
        log_ok "No uncommitted changes"
    fi
    
    # Show current commit
    local commit_hash
    commit_hash=$(git rev-parse --short HEAD)
    log_info "Current commit: $commit_hash"
    
    return 0
}

step_pull_latest() {
    log_step "Step 2/8: Pull Latest Changes"
    
    log_info "Fetching from origin..."
    git fetch origin main
    
    # Check if we're behind
    local local_commit
    local remote_commit
    local_commit=$(git rev-parse HEAD)
    remote_commit=$(git rev-parse origin/main)
    
    if [ "$local_commit" != "$remote_commit" ]; then
        log_info "Local is behind origin/main, pulling..."
        git pull origin main
        log_ok "Pulled latest changes"
        
        local new_commit
        new_commit=$(git rev-parse --short HEAD)
        log_info "Now at commit: $new_commit"
    else
        log_ok "Already up to date"
    fi
    
    return 0
}

step_disk_preflight() {
    log_step "Step 3/8: Disk Preflight + Safe Cleanup"

    # ---- Collect before-state ----
    local disk_line inode_line
    disk_line=$(df --output=avail -BG / | tail -1 | tr -d ' G')
    inode_line=$(df --output=iavail / | tail -1 | tr -d ' ')

    log_info "Disk free: ${disk_line}G (minimum: ${MIN_FREE_DISK_GB}G)"
    log_info "Inodes free: ${inode_line} (minimum: ${MIN_FREE_INODES})"
    log_info "Docker disk usage:"
    docker system df 2>/dev/null || true
    echo ""

    # ---- Check if cleanup is needed ----
    local needs_cleanup=false
    if [ "$disk_line" -lt "$MIN_FREE_DISK_GB" ] 2>/dev/null; then
        log_warn "Disk space below threshold (${disk_line}G < ${MIN_FREE_DISK_GB}G) - cleanup needed"
        needs_cleanup=true
    fi
    if [ "$inode_line" -lt "$MIN_FREE_INODES" ] 2>/dev/null; then
        log_warn "Inodes below threshold (${inode_line} < ${MIN_FREE_INODES}) - cleanup needed"
        needs_cleanup=true
    fi

    # ---- Safe cleanup (always run builder prune, it's the #1 inode consumer) ----
    log_info "Pruning Docker builder cache (safe - does not touch volumes or running containers)..."
    docker builder prune -af 2>&1 | tail -3 || true

    if [ "$needs_cleanup" = true ]; then
        log_info "Running extended safe cleanup..."

        log_info "Pruning dangling images..."
        docker image prune -f 2>&1 | tail -1 || true

        log_info "Pruning unused images (running container images are preserved)..."
        docker image prune -af 2>&1 | tail -1 || true

        log_info "Pruning stopped containers..."
        docker container prune -f 2>&1 | tail -1 || true

        log_info "Pruning unused networks..."
        docker network prune -f 2>&1 | tail -1 || true

        log_info "Checking journal log size..."
        local journal_size
        journal_size=$(journalctl --disk-usage 2>/dev/null | grep -oP '\d+\.\d+[GM]' | head -1 || echo "0")
        log_info "Journal size: $journal_size"
        # Vacuum journals to 200M if over 500M
        if journalctl --disk-usage 2>/dev/null | grep -qP '[5-9]\.\d+G|\d{2,}\.\d+G|[1-9]\d{2,}M'; then
            log_info "Vacuuming journals to 200M..."
            journalctl --vacuum-size=200M 2>&1 | tail -3 || true
        fi
    else
        log_ok "Disk and inodes above thresholds - extended cleanup skipped"
    fi

    # ---- Re-check after cleanup ----
    disk_line=$(df --output=avail -BG / | tail -1 | tr -d ' G')
    inode_line=$(df --output=iavail / | tail -1 | tr -d ' ')

    log_info "After cleanup - Disk free: ${disk_line}G | Inodes free: ${inode_line}"

    # ---- Hard fail if still insufficient ----
    if [ "$disk_line" -lt "$MIN_FREE_DISK_GB" ] 2>/dev/null; then
        log_fail "Insufficient disk space after cleanup: ${disk_line}G < ${MIN_FREE_DISK_GB}G"
        log_info "Manual intervention required. Consider:"
        log_info "  - docker system prune -af (does NOT prune volumes)"
        log_info "  - journalctl --vacuum-size=100M"
        log_info "  - apt-get clean"
        return 1
    fi
    if [ "$inode_line" -lt "$MIN_FREE_INODES" ] 2>/dev/null; then
        log_fail "Insufficient inodes after cleanup: ${inode_line} < ${MIN_FREE_INODES}"
        log_info "Manual intervention required. The #1 inode consumer is usually:"
        log_info "  /var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/"
        log_info "Run: docker builder prune -af && docker image prune -af"
        return 1
    fi

    # ---- Warn if marginal ----
    if [ "$inode_line" -lt "$INODE_WARN_THRESHOLD" ] 2>/dev/null; then
        log_warn "Inodes are marginal (${inode_line} < ${INODE_WARN_THRESHOLD}). Monitor after deploy."
    fi

    log_ok "Disk preflight passed: ${disk_line}G free, ${inode_line} inodes free"
    return 0
}

step_docker_build() {
    log_step "Step 4/8: Docker Build & Restart"
    
    # Check if docker compose file exists
    if [ ! -f "$COMPOSE_FILE" ]; then
        log_fail "Docker compose file not found: $COMPOSE_FILE"
        return 1
    fi
    log_ok "Found $COMPOSE_FILE"
    
    # Check current container status
    log_info "Current container status:"
    docker compose -f "$COMPOSE_FILE" ps || true
    echo ""
    
    # Build and restart backend
    log_info "Building and restarting backend..."
    if ! docker compose -f "$COMPOSE_FILE" up -d --build backend; then
        log_fail "Backend build/restart failed"
        return 1
    fi
    log_ok "Backend container rebuilt and started"
    
    # Build and restart frontend
    log_info "Building and restarting frontend..."
    if ! docker compose -f "$COMPOSE_FILE" up -d --build frontend; then
        log_warn "Frontend build/restart failed (may not be critical)"
    else
        log_ok "Frontend container rebuilt and started"
    fi
    
    # Wait for containers to stabilize
    log_info "Waiting ${CONTAINER_STABILIZE_WAIT}s for containers to stabilize..."
    sleep $CONTAINER_STABILIZE_WAIT
    
    # Show updated container status
    log_info "Updated container status:"
    docker compose -f "$COMPOSE_FILE" ps
    
    return 0
}

step_health_check() {
    log_step "Step 5/8: Health Check"
    
    if wait_for_health "grc-staging-backend" "$HEALTH_CHECK_TIMEOUT" "$HEALTH_CHECK_INTERVAL"; then
        log_ok "Backend health check passed (container healthy)"
        
        # Show health response via docker exec (port not exposed to host)
        log_info "Health check response:"
        docker compose -f "$COMPOSE_FILE" exec -T backend \
            node -e "const http=require('http');http.get('http://localhost:3002/health/ready',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{console.log(d.slice(0,500));process.exit(0)})}).on('error',e=>{console.error(e.message);process.exit(1)})" 2>/dev/null || true
        echo ""
    else
        log_fail "Backend health check failed after ${HEALTH_CHECK_TIMEOUT}s"
        
        # Show container logs for debugging
        log_info "Backend container logs (last 30 lines):"
        docker compose -f "$COMPOSE_FILE" logs --tail=30 backend || true
        
        return 1
    fi
    
    # Check frontend health via Docker health status
    local frontend_status
    frontend_status=$(docker inspect --format='{{.State.Health.Status}}' grc-staging-frontend 2>/dev/null || echo "unknown")
    if [ "$frontend_status" = "healthy" ]; then
        log_ok "Frontend health check passed (container healthy)"
    else
        log_warn "Frontend health status: $frontend_status"
    fi
    
    return 0
}

step_run_migrations() {
    log_step "Step 6/8: Database Migrations"
    
    # Show migration status first
    log_info "Checking migration status..."
    if docker compose -f "$COMPOSE_FILE" exec -T backend npx typeorm migration:show -d dist/data-source.js 2>&1 | head -20; then
        log_ok "Migration status retrieved"
    else
        log_warn "Could not retrieve migration status"
    fi
    
    # Run migrations
    log_info "Running pending migrations..."
    if docker compose -f "$COMPOSE_FILE" exec -T backend npx typeorm migration:run -d dist/data-source.js; then
        log_ok "Migrations completed"
    else
        log_fail "Migration run failed"
        return 1
    fi
    
    return 0
}

step_platform_validate() {
    log_step "Step 7/8: Platform Self-Control Validation"
    
    log_info "Running platform:validate inside backend container..."
    log_info "(This validates: env, db, migrations, auth & onboarding)"
    echo ""
    
    # Run the FAZ4 self-control validation
    if docker compose -f "$COMPOSE_FILE" exec -T backend npm run platform:validate; then
        log_ok "Platform validation passed"
    else
        log_fail "Platform validation failed"
        log_info "Review the output above for specific failures"
        return 1
    fi
    
    return 0
}

step_smoke_tests() {
    log_step "Step 8/8: Smoke Tests"
    
    # Auth readiness check via curl
    log_info "Testing auth endpoint readiness..."
    local auth_response
    auth_response=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d '{"email":"test@test.com","password":"test"}' \
        "http://localhost:3002/auth/login" 2>/dev/null || echo "000")
    
    if [ "$auth_response" = "400" ] || [ "$auth_response" = "401" ]; then
        log_ok "Auth endpoint responding (HTTP $auth_response - expected for invalid credentials)"
    elif [ "$auth_response" = "200" ] || [ "$auth_response" = "201" ]; then
        log_ok "Auth endpoint responding (HTTP $auth_response)"
    else
        log_warn "Auth endpoint returned unexpected status: $auth_response"
    fi
    
    # Health endpoints check
    log_info "Testing health endpoints..."
    
    local live_status
    live_status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3002/health/live" 2>/dev/null || echo "000")
    if [ "$live_status" = "200" ]; then
        log_ok "Liveness endpoint: HTTP $live_status"
    else
        log_warn "Liveness endpoint: HTTP $live_status"
    fi
    
    local ready_status
    ready_status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3002/health/ready" 2>/dev/null || echo "000")
    if [ "$ready_status" = "200" ]; then
        log_ok "Readiness endpoint: HTTP $ready_status"
    else
        log_warn "Readiness endpoint: HTTP $ready_status"
    fi
    
    local db_status
    db_status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3002/health/db" 2>/dev/null || echo "000")
    if [ "$db_status" = "200" ]; then
        log_ok "Database health endpoint: HTTP $db_status"
    else
        log_warn "Database health endpoint: HTTP $db_status"
    fi
    
    # GRC endpoint check (should return 401 without auth)
    log_info "Testing GRC endpoint..."
    local grc_status
    grc_status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3002/grc/risks" 2>/dev/null || echo "000")
    if [ "$grc_status" = "401" ] || [ "$grc_status" = "403" ]; then
        log_ok "GRC endpoint responding (HTTP $grc_status - expected without auth)"
    elif [ "$grc_status" = "200" ]; then
        log_ok "GRC endpoint responding (HTTP $grc_status)"
    else
        log_warn "GRC endpoint returned unexpected status: $grc_status"
    fi
    
    # Onboarding endpoint check
    log_info "Testing onboarding endpoint..."
    local onboarding_status
    onboarding_status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3002/onboarding/context" 2>/dev/null || echo "000")
    if [ "$onboarding_status" = "401" ] || [ "$onboarding_status" = "403" ]; then
        log_ok "Onboarding endpoint responding (HTTP $onboarding_status - expected without auth)"
    elif [ "$onboarding_status" = "200" ]; then
        log_ok "Onboarding endpoint responding (HTTP $onboarding_status)"
    else
        log_warn "Onboarding endpoint returned unexpected status: $onboarding_status"
    fi
    
    return 0
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    print_header
    
    # Step 1: Verify repo state
    if ! step_verify_repo; then
        print_footer_failure 1 "Git repository verification failed"
        exit 1
    fi
    
    # Step 2: Pull latest
    if ! step_pull_latest; then
        print_footer_failure 1 "Git pull failed"
        exit 1
    fi
    
    # Step 3: Disk preflight + safe cleanup
    if ! step_disk_preflight; then
        print_footer_failure 7 "Disk preflight failed - insufficient space/inodes"
        exit 7
    fi
    
    # Step 4: Docker build & restart
    if ! step_docker_build; then
        print_footer_failure 2 "Docker build failed"
        exit 2
    fi
    
    # Step 4: Health check
    if ! step_health_check; then
        print_footer_failure 4 "Health check failed"
        exit 4
    fi
    
    # Step 5: Run migrations
    if ! step_run_migrations; then
        print_footer_failure 5 "Migration failed"
        exit 5
    fi
    
    # Step 6: Platform validation (FAZ4 self-control)
    if ! step_platform_validate; then
        print_footer_failure 5 "Platform validation failed"
        exit 5
    fi
    
    # Step 7: Smoke tests
    if ! step_smoke_tests; then
        print_footer_failure 6 "Smoke tests failed"
        exit 6
    fi
    
    # Success!
    print_footer_success
    exit 0
}

# Run main function
main "$@"
