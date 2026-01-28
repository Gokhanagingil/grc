#!/bin/bash
# =============================================================================
# GRC Platform - Staging Database Validation Script
# =============================================================================
# Validates that the staging backend is connected to the correct database
# volume and that core tables exist. Run this after deployment to verify
# the database is properly configured.
#
# Usage:
#   bash ops/staging-db-validate.sh
#
# This script:
#   1. Checks that required containers are running
#   2. Verifies the database volume mount
#   3. Confirms database connectivity and correct database name
#   4. Validates that core tables exist (nest_system_settings, nest_users, etc.)
#
# Exit Codes:
#   0 - All validations passed
#   1 - Container check failed
#   2 - Volume validation failed
#   3 - Database connectivity failed
#   4 - Core table validation failed
#
# =============================================================================

set -euo pipefail

# Configuration
COMPOSE_FILE="docker-compose.staging.yml"
DB_CONTAINER="grc-staging-db"
BACKEND_CONTAINER="grc-staging-backend"
EXPECTED_VOLUME="grc-platform_grc_staging_postgres_data"

# Core tables that must exist for the application to function
CORE_TABLES=(
  "nest_system_settings"
  "nest_users"
  "nest_tenants"
  "grc_risks"
  "grc_policies"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${BLUE}[INFO]${NC} $*"
}

log_ok() {
  echo -e "${GREEN}[PASS]${NC} $*"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $*"
}

log_fail() {
  echo -e "${RED}[FAIL]${NC} $*"
}

print_header() {
  echo ""
  echo -e "${BLUE}============================================${NC}"
  echo -e "${BLUE}GRC Platform - Staging DB Validation${NC}"
  echo -e "${BLUE}============================================${NC}"
  echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo ""
}

print_summary() {
  local exit_code=$1
  echo ""
  echo -e "${BLUE}============================================${NC}"
  if [ "$exit_code" -eq 0 ]; then
    echo -e "${GREEN}ALL VALIDATIONS PASSED${NC}"
  else
    echo -e "${RED}VALIDATION FAILED (exit code: $exit_code)${NC}"
  fi
  echo -e "${BLUE}============================================${NC}"
  echo ""
}

# =============================================================================
# Step 1: Check Containers
# =============================================================================
check_containers() {
  log_info "Step 1/4: Checking container status..."

  # Check if docker is available
  if ! command -v docker &> /dev/null; then
    log_fail "Docker command not found"
    return 1
  fi

  # Check DB container
  local db_status
  db_status=$(docker inspect -f '{{.State.Status}}' "$DB_CONTAINER" 2>/dev/null || echo "not_found")
  if [ "$db_status" = "running" ]; then
    log_ok "Database container ($DB_CONTAINER) is running"
  else
    log_fail "Database container ($DB_CONTAINER) is not running (status: $db_status)"
    return 1
  fi

  # Check Backend container
  local backend_status
  backend_status=$(docker inspect -f '{{.State.Status}}' "$BACKEND_CONTAINER" 2>/dev/null || echo "not_found")
  if [ "$backend_status" = "running" ]; then
    log_ok "Backend container ($BACKEND_CONTAINER) is running"
  else
    log_fail "Backend container ($BACKEND_CONTAINER) is not running (status: $backend_status)"
    return 1
  fi

  return 0
}

# =============================================================================
# Step 2: Validate Volume Mount
# =============================================================================
validate_volume() {
  log_info "Step 2/4: Validating database volume mount..."

  # Get the volume mounted to the DB container's data directory
  local mounted_volume
  mounted_volume=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}' "$DB_CONTAINER" 2>/dev/null || echo "")

  if [ -z "$mounted_volume" ]; then
    log_fail "Could not determine mounted volume for $DB_CONTAINER"
    log_info "Hint: Check docker inspect output for mount configuration"
    return 2
  fi

  log_info "Mounted volume: $mounted_volume"
  log_info "Expected volume: $EXPECTED_VOLUME"

  if [ "$mounted_volume" = "$EXPECTED_VOLUME" ]; then
    log_ok "Correct volume is mounted: $mounted_volume"
  else
    log_fail "WRONG VOLUME MOUNTED!"
    log_fail "  Expected: $EXPECTED_VOLUME"
    log_fail "  Actual:   $mounted_volume"
    log_info ""
    log_info "This is the root cause of 'relation does not exist' errors."
    log_info "The backend is connected to a different database volume than expected."
    log_info ""
    log_info "To fix this issue:"
    log_info "  1. Stop the stack: docker compose -f $COMPOSE_FILE down"
    log_info "  2. Verify the correct volume exists: docker volume ls | grep grc"
    log_info "  3. Restart with the correct compose file: docker compose -f $COMPOSE_FILE up -d"
    return 2
  fi

  # Show volume details
  log_info "Volume details:"
  docker volume inspect "$mounted_volume" 2>/dev/null | head -20 || true

  return 0
}

# =============================================================================
# Step 3: Validate Database Connectivity
# =============================================================================
validate_db_connectivity() {
  log_info "Step 3/4: Validating database connectivity..."

  # Run a query from the backend container to check database name
  local db_name
  db_name=$(docker exec "$BACKEND_CONTAINER" node -e "
    const { Client } = require('pg');
    const client = new Client({
      host: process.env.DB_HOST || 'db',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'grc_platform'
    });
    client.connect()
      .then(() => client.query('SELECT current_database()'))
      .then(res => {
        console.log(res.rows[0].current_database);
        client.end();
      })
      .catch(err => {
        console.error('CONNECTION_ERROR');
        process.exit(1);
      });
  " 2>&1) || {
    log_fail "Failed to connect to database from backend container"
    log_info "Backend container logs (last 20 lines):"
    docker logs "$BACKEND_CONTAINER" --tail 20 2>&1 || true
    return 3
  }

  if [ "$db_name" = "CONNECTION_ERROR" ] || [ -z "$db_name" ]; then
    log_fail "Database connection failed"
    return 3
  fi

  log_ok "Connected to database: $db_name"
  return 0
}

# =============================================================================
# Step 4: Validate Core Tables Exist
# =============================================================================
validate_core_tables() {
  log_info "Step 4/4: Validating core tables exist..."

  local all_tables_exist=true
  local missing_tables=()

  for table in "${CORE_TABLES[@]}"; do
    local table_exists
    table_exists=$(docker exec "$BACKEND_CONTAINER" node -e "
      const { Client } = require('pg');
      const client = new Client({
        host: process.env.DB_HOST || 'db',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'grc_platform'
      });
      client.connect()
        .then(() => client.query(\"SELECT to_regclass('public.$table')\"))
        .then(res => {
          const exists = res.rows[0].to_regclass !== null;
          console.log(exists ? 'EXISTS' : 'MISSING');
          client.end();
        })
        .catch(err => {
          console.log('ERROR');
          process.exit(1);
        });
    " 2>&1) || {
      log_fail "Failed to check table: $table"
      all_tables_exist=false
      missing_tables+=("$table")
      continue
    }

    if [ "$table_exists" = "EXISTS" ]; then
      log_ok "Table exists: $table"
    else
      log_fail "Table MISSING: $table"
      all_tables_exist=false
      missing_tables+=("$table")
    fi
  done

  if [ "$all_tables_exist" = "false" ]; then
    log_fail ""
    log_fail "Missing tables detected! This indicates one of:"
    log_fail "  1. Wrong database volume is mounted (most likely)"
    log_fail "  2. Migrations have not been run"
    log_fail "  3. Database was reset without re-running migrations"
    log_fail ""
    log_fail "Missing tables: ${missing_tables[*]}"
    log_fail ""
    log_info "To diagnose:"
    log_info "  1. Run: bash ops/staging-db-validate.sh"
    log_info "  2. Check volume: docker volume ls | grep grc"
    log_info "  3. Check migrations: docker exec $BACKEND_CONTAINER npx typeorm migration:show -d dist/data-source.js"
    return 4
  fi

  log_ok "All core tables exist"
  return 0
}

# =============================================================================
# Main
# =============================================================================
main() {
  print_header

  local exit_code=0

  # Step 1: Check containers
  if ! check_containers; then
    exit_code=1
    print_summary $exit_code
    exit $exit_code
  fi

  # Step 2: Validate volume
  if ! validate_volume; then
    exit_code=2
    print_summary $exit_code
    exit $exit_code
  fi

  # Step 3: Validate DB connectivity
  if ! validate_db_connectivity; then
    exit_code=3
    print_summary $exit_code
    exit $exit_code
  fi

  # Step 4: Validate core tables
  if ! validate_core_tables; then
    exit_code=4
    print_summary $exit_code
    exit $exit_code
  fi

  print_summary 0
  exit 0
}

main "$@"
