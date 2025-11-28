#!/bin/bash
# Bash script for Data Foundations verification
# Usage: ./scripts/psql-verify.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORTS_DIR="$SCRIPT_DIR/../reports"

mkdir -p "$REPORTS_DIR"

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-grc}"
DB_USER="${DB_USER:-grc}"

export PGPASSWORD="${DB_PASS:-grc123}"

echo "=== Data Foundations Verification ==="
echo ""

SQL_FILE="$SCRIPT_DIR/verify-data-foundations.sql"

if [ ! -f "$SQL_FILE" ]; then
    echo "❌ SQL file not found: $SQL_FILE"
    exit 1
fi

OUTPUT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SQL_FILE" 2>&1)

if [ $? -eq 0 ]; then
    echo "$OUTPUT"
    echo ""
    echo "✅ Verification completed"
    
    REPORT_PATH="$REPORTS_DIR/PSQL-VERIFY-OUTPUT.txt"
    echo "$OUTPUT" > "$REPORT_PATH"
    echo "Report saved: $REPORT_PATH"
else
    echo "❌ Verification failed"
    echo "$OUTPUT"
    exit 1
fi

