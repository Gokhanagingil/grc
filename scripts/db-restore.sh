#!/bin/bash

# GRC Platform Database Restore Script
# This script restores a PostgreSQL database from a backup
# Usage: ./db-restore.sh <backup_file>

set -e

# Configuration
DB_NAME="${DB_NAME:-grc_platform}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
BACKUP_FILE="$1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}GRC Platform Database Restore${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if backup file is provided
if [ -z "$BACKUP_FILE" ]; then
    echo -e "${RED}Error: No backup file specified.${NC}"
    echo ""
    echo "Usage: $0 <backup_file>"
    echo ""
    echo "Examples:"
    echo "  $0 ./backups/grc_backup_20240101_120000.sql.gz"
    echo "  $0 ./backups/latest.sql.gz"
    exit 1
fi

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}Error: Backup file not found: ${BACKUP_FILE}${NC}"
    exit 1
fi

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo -e "${RED}Error: psql command not found. Please install PostgreSQL client tools.${NC}"
    exit 1
fi

echo "Database: ${DB_NAME}"
echo "Host: ${DB_HOST}:${DB_PORT}"
echo "User: ${DB_USER}"
echo "Backup file: ${BACKUP_FILE}"
echo ""

# Confirm restore
echo -e "${YELLOW}WARNING: This will overwrite the existing database!${NC}"
echo -e "${YELLOW}All current data will be lost.${NC}"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

echo ""
echo -e "${YELLOW}Starting restore...${NC}"

# Determine if file is compressed
if [[ "$BACKUP_FILE" == *.gz ]]; then
    echo "Decompressing backup file..."
    TEMP_FILE=$(mktemp)
    gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"
    SQL_FILE="$TEMP_FILE"
    CLEANUP_TEMP=true
else
    SQL_FILE="$BACKUP_FILE"
    CLEANUP_TEMP=false
fi

# Terminate existing connections to the database
echo "Terminating existing connections..."
PGPASSWORD="${DB_PASSWORD}" psql \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="postgres" \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" \
    > /dev/null 2>&1 || true

# Drop and recreate the database
echo "Recreating database..."
PGPASSWORD="${DB_PASSWORD}" psql \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="postgres" \
    -c "DROP DATABASE IF EXISTS ${DB_NAME};" \
    -c "CREATE DATABASE ${DB_NAME};"

# Restore the backup
echo "Restoring data..."
PGPASSWORD="${DB_PASSWORD}" psql \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --quiet \
    < "$SQL_FILE"

# Cleanup temporary file if created
if [ "$CLEANUP_TEMP" = true ]; then
    rm -f "$TEMP_FILE"
fi

# Check if restore was successful
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}Restore completed successfully!${NC}"
    
    # Show table counts
    echo ""
    echo "Table row counts:"
    PGPASSWORD="${DB_PASSWORD}" psql \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USER" \
        --dbname="$DB_NAME" \
        -c "SELECT schemaname, relname as table_name, n_live_tup as row_count 
            FROM pg_stat_user_tables 
            ORDER BY n_live_tup DESC 
            LIMIT 10;"
else
    echo -e "${RED}Restore failed!${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Restore process completed${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Note: You may need to run migrations to ensure schema is up to date.${NC}"
echo "Run: npm run migration:run"
