#!/bin/bash

# GRC Platform Database Backup Script
# This script creates a backup of the PostgreSQL database
# Usage: ./db-backup.sh [backup_dir]

set -e

# Configuration
DB_NAME="${DB_NAME:-grc_platform}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/grc_backup_${TIMESTAMP}.sql"
BACKUP_FILE_GZ="${BACKUP_FILE}.gz"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}GRC Platform Database Backup${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Create backup directory if it doesn't exist
if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${YELLOW}Creating backup directory: ${BACKUP_DIR}${NC}"
    mkdir -p "$BACKUP_DIR"
fi

# Check if pg_dump is available
if ! command -v pg_dump &> /dev/null; then
    echo -e "${RED}Error: pg_dump command not found. Please install PostgreSQL client tools.${NC}"
    exit 1
fi

echo "Database: ${DB_NAME}"
echo "Host: ${DB_HOST}:${DB_PORT}"
echo "User: ${DB_USER}"
echo "Backup file: ${BACKUP_FILE_GZ}"
echo ""

# Perform the backup
echo -e "${YELLOW}Starting backup...${NC}"

# Use pg_dump to create a backup
# --format=plain: SQL script format
# --no-owner: Don't output commands to set ownership
# --no-privileges: Don't output commands to set privileges
# --clean: Include DROP statements before CREATE
# --if-exists: Use IF EXISTS when dropping objects
PGPASSWORD="${DB_PASSWORD}" pg_dump \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --format=plain \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    > "$BACKUP_FILE"

# Check if backup was successful
if [ $? -eq 0 ] && [ -f "$BACKUP_FILE" ]; then
    # Compress the backup
    echo -e "${YELLOW}Compressing backup...${NC}"
    gzip "$BACKUP_FILE"
    
    # Get file size
    BACKUP_SIZE=$(du -h "$BACKUP_FILE_GZ" | cut -f1)
    
    echo ""
    echo -e "${GREEN}Backup completed successfully!${NC}"
    echo "File: ${BACKUP_FILE_GZ}"
    echo "Size: ${BACKUP_SIZE}"
    
    # Create a latest symlink
    LATEST_LINK="${BACKUP_DIR}/latest.sql.gz"
    rm -f "$LATEST_LINK"
    ln -s "$(basename "$BACKUP_FILE_GZ")" "$LATEST_LINK"
    echo "Latest link: ${LATEST_LINK}"
    
    # Cleanup old backups (keep last 30 days)
    echo ""
    echo -e "${YELLOW}Cleaning up old backups (keeping last 30 days)...${NC}"
    find "$BACKUP_DIR" -name "grc_backup_*.sql.gz" -type f -mtime +30 -delete
    
    # List recent backups
    echo ""
    echo "Recent backups:"
    ls -lh "$BACKUP_DIR"/grc_backup_*.sql.gz 2>/dev/null | tail -5
else
    echo -e "${RED}Backup failed!${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Backup process completed${NC}"
echo -e "${GREEN}========================================${NC}"
