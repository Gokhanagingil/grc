#!/bin/bash
#
# Staging Restart Script
#
# This script restarts the GRC Platform containers on the staging server,
# waits for health checks to pass, and runs smoke validation.
#
# Usage:
#   ./scripts/restart-staging.sh [--skip-validation]
#
# Options:
#   --skip-validation  Skip post-restart validation (faster, less safe)
#
# Exit codes:
#   0 - Success
#   1 - Restart failed
#   2 - Health check failed
#   3 - Validation failed
#

set -e

# Configuration
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
HEALTH_CHECK_URL="${HEALTH_CHECK_URL:-http://localhost:3002/health/live}"
HEALTH_CHECK_TIMEOUT="${HEALTH_CHECK_TIMEOUT:-60}"
HEALTH_CHECK_INTERVAL="${HEALTH_CHECK_INTERVAL:-5}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
SKIP_VALIDATION=false
for arg in "$@"; do
    case $arg in
        --skip-validation)
            SKIP_VALIDATION=true
            shift
            ;;
    esac
done

echo "========================================"
echo "GRC Platform Staging Restart"
echo "========================================"
echo "Started at: $(date)"
echo ""

# Function to print status
print_status() {
    local status=$1
    local message=$2
    if [ "$status" = "ok" ]; then
        echo -e "${GREEN}[OK]${NC} $message"
    elif [ "$status" = "warn" ]; then
        echo -e "${YELLOW}[WARN]${NC} $message"
    else
        echo -e "${RED}[FAIL]${NC} $message"
    fi
}

# Function to wait for health check
wait_for_health() {
    local url=$1
    local timeout=$2
    local interval=$3
    local elapsed=0

    echo "Waiting for health check at $url..."
    
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

# Step 1: Check current container status
echo "--- Step 1: Checking current status ---"
if docker compose -f "$COMPOSE_FILE" ps > /dev/null 2>&1; then
    print_status "ok" "Docker Compose is available"
    docker compose -f "$COMPOSE_FILE" ps
else
    print_status "fail" "Docker Compose not available or not in correct directory"
    exit 1
fi
echo ""

# Step 2: Restart containers
echo "--- Step 2: Restarting containers ---"
echo "Restarting backend..."
if docker compose -f "$COMPOSE_FILE" restart backend; then
    print_status "ok" "Backend container restarted"
else
    print_status "fail" "Failed to restart backend container"
    exit 1
fi

echo "Restarting frontend..."
if docker compose -f "$COMPOSE_FILE" restart frontend; then
    print_status "ok" "Frontend container restarted"
else
    print_status "warn" "Failed to restart frontend container (may not exist)"
fi
echo ""

# Step 3: Wait for health check
echo "--- Step 3: Waiting for health check ---"
if wait_for_health "$HEALTH_CHECK_URL" "$HEALTH_CHECK_TIMEOUT" "$HEALTH_CHECK_INTERVAL"; then
    print_status "ok" "Health check passed"
else
    print_status "fail" "Health check failed after ${HEALTH_CHECK_TIMEOUT}s"
    echo ""
    echo "Container logs (last 20 lines):"
    docker compose -f "$COMPOSE_FILE" logs --tail=20 backend
    exit 2
fi
echo ""

# Step 4: Run validation (optional)
if [ "$SKIP_VALIDATION" = false ]; then
    echo "--- Step 4: Running platform validation ---"
    if docker compose -f "$COMPOSE_FILE" exec -T backend npm run platform:validate -- --skip-smoke; then
        print_status "ok" "Platform validation passed"
    else
        print_status "warn" "Platform validation had warnings or failures"
        # Don't exit with error - validation warnings are informational
    fi
    echo ""
    
    echo "--- Step 5: Running smoke tests ---"
    if docker compose -f "$COMPOSE_FILE" exec -T backend npm run smoke:auth-onboarding; then
        print_status "ok" "Smoke tests passed"
    else
        print_status "fail" "Smoke tests failed"
        exit 3
    fi
else
    echo "--- Step 4: Skipping validation (--skip-validation flag) ---"
    print_status "warn" "Validation skipped"
fi
echo ""

# Summary
echo "========================================"
echo "Restart Complete"
echo "========================================"
echo "Finished at: $(date)"
echo ""

# Show final container status
echo "Container Status:"
docker compose -f "$COMPOSE_FILE" ps
echo ""

# Show health check response
echo "Health Check Response:"
curl -s "$HEALTH_CHECK_URL" | jq . 2>/dev/null || curl -s "$HEALTH_CHECK_URL"
echo ""

print_status "ok" "Staging restart completed successfully"
exit 0
