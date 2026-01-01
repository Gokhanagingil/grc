#!/bin/bash
#
# GRC Platform - Staging Verification Script
#
# Single command to deploy and verify staging environment.
# Designed for deterministic, verifiable deployments with clear PASS/FAIL output.
#
# Usage:
#   ./scripts/staging-verify.sh [--skip-build] [--skip-seed]
#
# Options:
#   --skip-build   Skip docker build (use existing containers)
#   --skip-seed    Skip seed script execution
#
# Prerequisites:
#   - Must be executed on the staging server at /opt/grc-platform
#   - Docker and Docker Compose must be installed
#   - .env file must exist with required variables
#
# Exit codes:
#   0 - ALL CHECKS PASSED
#   1 - Git verification failed
#   2 - Docker build failed
#   3 - Container startup failed
#   4 - Health check failed
#   5 - Migration verification failed
#   6 - Seed script failed
#   7 - Smoke test failed
#
# Required environment variables (in .env or docker-compose):
#   - JWT_SECRET
#   - DEMO_ADMIN_EMAIL
#   - DEMO_ADMIN_PASSWORD
#   - DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
#

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

COMPOSE_FILE="docker-compose.staging.yml"
BACKEND_URL="http://localhost:3002"
HEALTH_CHECK_TIMEOUT=120
HEALTH_CHECK_INTERVAL=5
CONTAINER_STABILIZE_WAIT=15

# Parse arguments
SKIP_BUILD=false
SKIP_SEED=false
for arg in "$@"; do
    case $arg in
        --skip-build)
            SKIP_BUILD=true
            ;;
        --skip-seed)
            SKIP_SEED=true
            ;;
    esac
done

# =============================================================================
# Colors and Formatting
# =============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

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
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
}

print_header() {
    echo ""
    echo -e "${BOLD}============================================${NC}"
    echo -e "${BOLD}GRC Platform - Staging Verification${NC}"
    echo -e "${BOLD}============================================${NC}"
    echo "Started at: $(date '+%Y-%m-%d %H:%M:%S %Z')"
    echo "Working directory: $(pwd)"
    echo "Compose file: $COMPOSE_FILE"
    echo ""
}

print_summary() {
    local exit_code=$1
    local message=$2
    echo ""
    echo -e "${BOLD}============================================${NC}"
    if [ "$exit_code" -eq 0 ]; then
        echo -e "${GREEN}${BOLD}ALL CHECKS PASSED${NC}"
    else
        echo -e "${RED}${BOLD}VERIFICATION FAILED${NC}"
    fi
    echo -e "${BOLD}============================================${NC}"
    echo "Completed at: $(date '+%Y-%m-%d %H:%M:%S %Z')"
    echo "Exit code: $exit_code"
    echo "Result: $message"
    echo ""
}

wait_for_health() {
    local url=$1
    local timeout=$2
    local interval=$3
    local elapsed=0

    log_info "Waiting for health check at $url (timeout: ${timeout}s)..."
    
    while [ $elapsed -lt $timeout ]; do
        local response
        response=$(curl -s -w "\n%{http_code}" "$url" 2>/dev/null || echo -e "\n000")
        local http_code
        http_code=$(echo "$response" | tail -n1)
        
        if [ "$http_code" = "200" ]; then
            return 0
        fi
        sleep $interval
        elapsed=$((elapsed + interval))
        echo "  Waiting... ($elapsed/$timeout seconds) - HTTP $http_code"
    done
    
    return 1
}

# Execute command in backend container with proper error handling
exec_backend() {
    docker compose -f "$COMPOSE_FILE" exec -T backend sh -lc "$1"
}

# =============================================================================
# Step 1: Verify Repository State
# =============================================================================

step_verify_repo() {
    log_step "Step 1/8: Verify Repository State"
    
    if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
        log_fail "Not inside a git repository"
        return 1
    fi
    log_ok "Inside git repository"
    
    local current_branch
    current_branch=$(git branch --show-current)
    if [ "$current_branch" != "main" ]; then
        log_fail "Not on main branch (current: $current_branch)"
        log_info "Run: git checkout main"
        return 1
    fi
    log_ok "On main branch"
    
    if ! git diff --quiet || ! git diff --cached --quiet; then
        log_warn "Uncommitted changes detected - staging should match repo exactly"
        git status --short
    else
        log_ok "No uncommitted changes"
    fi
    
    local commit_hash
    commit_hash=$(git rev-parse --short HEAD)
    log_info "Current commit: $commit_hash"
    
    return 0
}

# =============================================================================
# Step 2: Pull Latest Changes
# =============================================================================

step_pull_latest() {
    log_step "Step 2/8: Pull Latest Changes"
    
    log_info "Fetching from origin..."
    git fetch origin main
    
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

# =============================================================================
# Step 3: Docker Build & Start
# =============================================================================

step_docker_build() {
    log_step "Step 3/8: Docker Build & Start"
    
    if [ ! -f "$COMPOSE_FILE" ]; then
        log_fail "Docker compose file not found: $COMPOSE_FILE"
        return 1
    fi
    log_ok "Found $COMPOSE_FILE"
    
    log_info "Current container status:"
    docker compose -f "$COMPOSE_FILE" ps || true
    echo ""
    
    if [ "$SKIP_BUILD" = true ]; then
        log_info "Skipping build (--skip-build flag)"
        log_info "Starting containers..."
        if ! docker compose -f "$COMPOSE_FILE" up -d; then
            log_fail "Container startup failed"
            return 1
        fi
    else
        log_info "Building and starting backend..."
        if ! docker compose -f "$COMPOSE_FILE" up -d --build backend; then
            log_fail "Backend build/start failed"
            return 1
        fi
        log_ok "Backend container rebuilt and started"
        
        log_info "Building and starting frontend..."
        if ! docker compose -f "$COMPOSE_FILE" up -d --build frontend; then
            log_warn "Frontend build/start failed (may not be critical)"
        else
            log_ok "Frontend container rebuilt and started"
        fi
    fi
    
    log_info "Waiting ${CONTAINER_STABILIZE_WAIT}s for containers to stabilize..."
    sleep $CONTAINER_STABILIZE_WAIT
    
    log_info "Updated container status:"
    docker compose -f "$COMPOSE_FILE" ps
    
    return 0
}

# =============================================================================
# Step 4: Health Check
# =============================================================================

step_health_check() {
    log_step "Step 4/8: Health Check"
    
    local ready_url="$BACKEND_URL/health/ready"
    if wait_for_health "$ready_url" "$HEALTH_CHECK_TIMEOUT" "$HEALTH_CHECK_INTERVAL"; then
        log_ok "Backend readiness check passed"
    else
        log_fail "Backend health check failed after ${HEALTH_CHECK_TIMEOUT}s"
        log_info "Backend container logs (last 30 lines):"
        docker compose -f "$COMPOSE_FILE" logs --tail=30 backend || true
        return 1
    fi
    
    # Verify health response content
    log_info "Health check response:"
    local health_response
    health_response=$(curl -s "$ready_url")
    echo "$health_response" | head -c 500
    echo ""
    
    # Check database connectivity from health response
    if echo "$health_response" | grep -q '"connected":true'; then
        log_ok "Database connectivity confirmed"
    else
        log_warn "Database connectivity not confirmed in health response"
    fi
    
    # Check frontend health
    local frontend_health_url="http://localhost/frontend-health"
    if curl -s -f "$frontend_health_url" > /dev/null 2>&1; then
        log_ok "Frontend health check passed"
    else
        log_warn "Frontend health check not available"
    fi
    
    return 0
}

# =============================================================================
# Step 5: Migration Verification (FAIL LOUDLY)
# =============================================================================

step_migrations() {
    log_step "Step 5/8: Migration Verification"
    
    # First, verify data-source.js exists and exports AppDataSource
    log_info "Verifying data-source configuration..."
    local ds_check
    ds_check=$(exec_backend "node -e \"const ds=require('./dist/data-source.js'); console.log('AppDataSource:', !!ds.AppDataSource)\"" 2>&1) || {
        log_fail "Data source verification failed"
        echo "$ds_check"
        return 1
    }
    
    if echo "$ds_check" | grep -q "AppDataSource: true"; then
        log_ok "Data source exports AppDataSource correctly"
    else
        log_fail "Data source does not export AppDataSource"
        echo "$ds_check"
        return 1
    fi
    
    # Check for duplicate migration issue (index.js should NOT exist)
    log_info "Checking for duplicate migration files..."
    local index_check
    index_check=$(exec_backend "test -f /app/dist/migrations/index.js && echo 'EXISTS' || echo 'NOT_EXISTS'" 2>&1) || true
    
    if echo "$index_check" | grep -q "EXISTS"; then
        log_fail "dist/migrations/index.js exists - this will cause duplicate migrations!"
        log_info "Remove src/migrations/index.ts and rebuild"
        return 1
    else
        log_ok "No duplicate migration index file"
    fi
    
    # Show migration status - MUST produce output
    log_info "Checking migration status..."
    local migration_status
    migration_status=$(exec_backend "npx typeorm migration:show -d dist/data-source.js" 2>&1) || {
        log_fail "Migration status check failed"
        echo "$migration_status"
        return 1
    }
    
    # Verify we got actual migration output (not empty or error)
    if [ -z "$migration_status" ]; then
        log_fail "Migration status returned empty output - configuration error"
        return 1
    fi
    
    if echo "$migration_status" | grep -qE "^\[.\]"; then
        log_ok "Migration status retrieved successfully"
        echo "$migration_status" | head -20
    else
        log_fail "Migration status output format unexpected"
        echo "$migration_status"
        return 1
    fi
    
    # Count pending migrations
    local pending_count
    pending_count=$(echo "$migration_status" | grep -c "^\[ \]" || echo "0")
    local executed_count
    executed_count=$(echo "$migration_status" | grep -c "^\[X\]" || echo "0")
    
    log_info "Migrations: $executed_count executed, $pending_count pending"
    
    # Run pending migrations if any
    if [ "$pending_count" -gt 0 ]; then
        log_info "Running $pending_count pending migration(s)..."
        local migration_run
        migration_run=$(exec_backend "npx typeorm migration:run -d dist/data-source.js" 2>&1) || {
            log_fail "Migration run failed"
            echo "$migration_run"
            return 1
        }
        echo "$migration_run"
        log_ok "Migrations executed successfully"
        
        # Verify no pending migrations remain
        log_info "Verifying all migrations applied..."
        local post_status
        post_status=$(exec_backend "npx typeorm migration:show -d dist/data-source.js" 2>&1)
        local remaining_pending
        remaining_pending=$(echo "$post_status" | grep -c "^\[ \]" || echo "0")
        
        if [ "$remaining_pending" -gt 0 ]; then
            log_fail "Still have $remaining_pending pending migrations after run"
            return 1
        fi
        log_ok "All migrations applied successfully"
    else
        log_ok "No pending migrations"
    fi
    
    return 0
}

# =============================================================================
# Step 6: Seed Scripts
# =============================================================================

step_seed() {
    log_step "Step 6/8: Seed Scripts"
    
    if [ "$SKIP_SEED" = true ]; then
        log_info "Skipping seed scripts (--skip-seed flag)"
        return 0
    fi
    
    log_info "Running standards seed script..."
    local seed_output
    seed_output=$(exec_backend "npm run seed:standards:prod" 2>&1) || {
        log_warn "Standards seed script had issues (may be expected if already seeded)"
        echo "$seed_output" | tail -10
    }
    
    if echo "$seed_output" | grep -qiE "(seeded|already|success|complete)"; then
        log_ok "Standards seed completed"
    else
        log_warn "Standards seed output unclear"
        echo "$seed_output" | tail -5
    fi
    
    return 0
}

# =============================================================================
# Step 7: Platform Validation
# =============================================================================

step_platform_validate() {
    log_step "Step 7/8: Platform Validation"
    
    log_info "Running platform:validate..."
    local validate_output
    validate_output=$(exec_backend "npm run platform:validate" 2>&1) || {
        log_fail "Platform validation failed"
        echo "$validate_output"
        return 1
    }
    
    echo "$validate_output" | tail -30
    log_ok "Platform validation passed"
    
    return 0
}

# =============================================================================
# Step 8: Smoke Tests (Authenticated API Calls)
# =============================================================================

step_smoke_tests() {
    log_step "Step 8/8: Smoke Tests"
    
    # Test 1: Health endpoints
    log_info "Testing health endpoints..."
    
    local live_status
    live_status=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health/live" 2>/dev/null || echo "000")
    if [ "$live_status" = "200" ]; then
        log_ok "Liveness endpoint: HTTP $live_status"
    else
        log_fail "Liveness endpoint: HTTP $live_status"
        return 1
    fi
    
    local db_status
    db_status=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health/db" 2>/dev/null || echo "000")
    if [ "$db_status" = "200" ]; then
        log_ok "Database health endpoint: HTTP $db_status"
    else
        log_fail "Database health endpoint: HTTP $db_status"
        return 1
    fi
    
    local auth_status
    auth_status=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health/auth" 2>/dev/null || echo "000")
    if [ "$auth_status" = "200" ]; then
        log_ok "Auth health endpoint: HTTP $auth_status"
    else
        log_warn "Auth health endpoint: HTTP $auth_status"
    fi
    
    # Test 2: Auth endpoint responds (should return 400/401 for invalid credentials)
    log_info "Testing auth endpoint..."
    local auth_response
    auth_response=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d '{"email":"invalid@test.com","password":"invalid"}' \
        "$BACKEND_URL/auth/login" 2>/dev/null || echo "000")
    
    if [ "$auth_response" = "400" ] || [ "$auth_response" = "401" ]; then
        log_ok "Auth endpoint responding: HTTP $auth_response (expected for invalid credentials)"
    elif [ "$auth_response" = "200" ] || [ "$auth_response" = "201" ]; then
        log_ok "Auth endpoint responding: HTTP $auth_response"
    else
        log_fail "Auth endpoint unexpected response: HTTP $auth_response"
        return 1
    fi
    
    # Test 3: GRC endpoint (should return 401 without auth)
    log_info "Testing GRC endpoint..."
    local grc_status
    grc_status=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/grc/risks" 2>/dev/null || echo "000")
    if [ "$grc_status" = "401" ] || [ "$grc_status" = "403" ]; then
        log_ok "GRC endpoint responding: HTTP $grc_status (expected without auth)"
    elif [ "$grc_status" = "200" ]; then
        log_ok "GRC endpoint responding: HTTP $grc_status"
    else
        log_fail "GRC endpoint unexpected response: HTTP $grc_status"
        return 1
    fi
    
    # Test 4: Onboarding endpoint (should return 401 without auth)
    log_info "Testing onboarding endpoint..."
    local onboarding_status
    onboarding_status=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/onboarding/context" 2>/dev/null || echo "000")
    if [ "$onboarding_status" = "401" ] || [ "$onboarding_status" = "403" ]; then
        log_ok "Onboarding endpoint responding: HTTP $onboarding_status (expected without auth)"
    elif [ "$onboarding_status" = "200" ]; then
        log_ok "Onboarding endpoint responding: HTTP $onboarding_status"
    else
        log_fail "Onboarding endpoint unexpected response: HTTP $onboarding_status"
        return 1
    fi
    
    # Test 5: Authenticated smoke test (if credentials available)
    log_info "Testing authenticated API call..."
    
    # Try to get credentials from environment
    local admin_email="${DEMO_ADMIN_EMAIL:-}"
    local admin_password="${DEMO_ADMIN_PASSWORD:-}"
    
    if [ -n "$admin_email" ] && [ -n "$admin_password" ]; then
        log_info "Attempting login with demo admin credentials..."
        
        local login_response
        login_response=$(curl -s -X POST \
            -H "Content-Type: application/json" \
            -d "{\"email\":\"$admin_email\",\"password\":\"$admin_password\"}" \
            "$BACKEND_URL/auth/login" 2>/dev/null)
        
        local access_token
        access_token=$(echo "$login_response" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4 || echo "")
        
        if [ -z "$access_token" ]; then
            # Try alternate response format
            access_token=$(echo "$login_response" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4 || echo "")
        fi
        
        if [ -n "$access_token" ]; then
            log_ok "Login successful, got access token"
            
            # Test authenticated endpoint
            local me_response
            me_response=$(curl -s -o /dev/null -w "%{http_code}" \
                -H "Authorization: Bearer $access_token" \
                "$BACKEND_URL/users/me" 2>/dev/null || echo "000")
            
            if [ "$me_response" = "200" ]; then
                log_ok "Authenticated /users/me: HTTP $me_response"
            else
                # Try onboarding context instead
                local context_response
                context_response=$(curl -s -o /dev/null -w "%{http_code}" \
                    -H "Authorization: Bearer $access_token" \
                    "$BACKEND_URL/onboarding/context" 2>/dev/null || echo "000")
                
                if [ "$context_response" = "200" ]; then
                    log_ok "Authenticated /onboarding/context: HTTP $context_response"
                else
                    log_warn "Authenticated endpoint test: /users/me=$me_response, /onboarding/context=$context_response"
                fi
            fi
        else
            log_warn "Login did not return access token (credentials may be incorrect)"
            echo "Response: $(echo "$login_response" | head -c 200)"
        fi
    else
        log_warn "DEMO_ADMIN_EMAIL/PASSWORD not set - skipping authenticated smoke test"
    fi
    
    return 0
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    print_header
    
    local failed_step=""
    local exit_code=0
    
    # Step 1: Verify repo state
    if ! step_verify_repo; then
        print_summary 1 "Git repository verification failed"
        exit 1
    fi
    
    # Step 2: Pull latest
    if ! step_pull_latest; then
        print_summary 1 "Git pull failed"
        exit 1
    fi
    
    # Step 3: Docker build & start
    if ! step_docker_build; then
        print_summary 2 "Docker build failed"
        exit 2
    fi
    
    # Step 4: Health check
    if ! step_health_check; then
        print_summary 4 "Health check failed"
        exit 4
    fi
    
    # Step 5: Migrations
    if ! step_migrations; then
        print_summary 5 "Migration verification failed"
        exit 5
    fi
    
    # Step 6: Seed scripts
    if ! step_seed; then
        print_summary 6 "Seed script failed"
        exit 6
    fi
    
    # Step 7: Platform validation
    if ! step_platform_validate; then
        print_summary 5 "Platform validation failed"
        exit 5
    fi
    
    # Step 8: Smoke tests
    if ! step_smoke_tests; then
        print_summary 7 "Smoke tests failed"
        exit 7
    fi
    
    # Success!
    print_summary 0 "All verification steps passed"
    echo "Staging environment is ready for use."
    echo ""
    echo "Access URLs:"
    echo "  - Frontend: http://46.224.99.150"
    echo "  - Backend API: http://46.224.99.150:3002"
    echo "  - Health: http://46.224.99.150:3002/health"
    echo ""
    exit 0
}

# Run main function
main "$@"
