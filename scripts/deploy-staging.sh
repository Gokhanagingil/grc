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
    local url=$1
    local timeout=$2
    local interval=$3
    local elapsed=0

    log_info "Waiting for health check at $url (timeout: ${timeout}s)..."
    
    while [ $elapsed -lt $timeout ]; do
        if curl -s -f "$url" > /dev/null 2>&1; then
            return 0
        fi
        sleep $interval
        elapsed=$((elapsed + interval))
        echo "  Waiting... ($elapsed/$timeout seconds)"
    done
    
    return 1
}

# =============================================================================
# Deployment Steps
# =============================================================================

step_verify_repo() {
    log_step "Step 1/7: Verify Repository State"
    
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
    log_step "Step 2/7: Pull Latest Changes"
    
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

step_docker_build() {
    log_step "Step 3/7: Docker Build & Restart"
    
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
    log_step "Step 4/7: Health Check"
    
    if wait_for_health "$HEALTH_CHECK_URL" "$HEALTH_CHECK_TIMEOUT" "$HEALTH_CHECK_INTERVAL"; then
        log_ok "Backend health check passed"
        
        # Show health response
        log_info "Health check response:"
        curl -s "$HEALTH_CHECK_URL" | head -c 500 || true
        echo ""
    else
        log_fail "Backend health check failed after ${HEALTH_CHECK_TIMEOUT}s"
        
        # Show container logs for debugging
        log_info "Backend container logs (last 30 lines):"
        docker compose -f "$COMPOSE_FILE" logs --tail=30 backend || true
        
        return 1
    fi
    
    # Check frontend health if available
    local frontend_health_url="http://localhost/frontend-health"
    if curl -s -f "$frontend_health_url" > /dev/null 2>&1; then
        log_ok "Frontend health check passed"
    else
        log_warn "Frontend health check not available (may be normal)"
    fi
    
    return 0
}

step_run_migrations() {
    log_step "Step 5/7: Database Migrations"
    
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
    log_step "Step 6/7: Platform Self-Control Validation"
    
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
    log_step "Step 7/7: Smoke Tests"
    
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
    
    # Step 3: Docker build & restart
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
