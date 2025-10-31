#!/usr/bin/env bash
set -euo pipefail

DB_NAME="${DB_NAME:-grc}"
DB_USER="${DB_USER:-grc}"
NEW_PASSWORD="${NEW_PASSWORD:-}"
HOST="${HOST:-localhost}"
PORT="${PORT:-5432}"
PG_SUPERUSER="${PG_SUPERUSER:-postgres}"
PSQL_PATH="${PSQL_PATH:-psql}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$(cd "$SCRIPT_DIR/.." && pwd)/.env"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC2046
  export $(grep -E '^(DB_NAME|DB_USER|DB_PASS)=' "$ENV_FILE" | xargs -d '\n')
fi

DB_NAME="${DB_NAME:-${DB_NAME}}"
DB_USER="${DB_USER:-${DB_USER}}"

if [[ -z "${NEW_PASSWORD}" ]]; then
  if [[ -n "${DB_PASS:-}" ]]; then
    NEW_PASSWORD="${DB_PASS}"
  else
    NEW_PASSWORD="123456"
    echo "INFO: defaulting password to 123456"
  fi
fi

SQL=$(cat <<'SQLEND'
ALTER ROLE DBUSER_TOK WITH LOGIN PASSWORD $$NEWPASS_TOK$$;
ALTER DATABASE DBNAME_TOK OWNER TO DBUSER_TOK;
ALTER SCHEMA public OWNER TO DBUSER_TOK;
GRANT ALL PRIVILEGES ON DATABASE DBNAME_TOK TO DBUSER_TOK;
SQLEND
)

SQL="${SQL/DBUSER_TOK/${DB_USER}}"
SQL="${SQL/DBNAME_TOK/${DB_NAME}}"
SQL="${SQL/NEWPASS_TOK/${NEW_PASSWORD}}"

"${PSQL_PATH}" -U "${PG_SUPERUSER}" -h "${HOST}" -p "${PORT}" -W -v ON_ERROR_STOP=1 -c "${SQL}"

echo "Verifying connectivity with new credentials..."
"${PSQL_PATH}" -U "${DB_USER}" -h "${HOST}" -p "${PORT}" -W -d "${DB_NAME}" -c "select current_user, current_database();"

# sync .env
if [[ -f "$ENV_FILE" ]]; then
  if grep -q '^DB_PASS=' "$ENV_FILE"; then
    sed -i.bak -E "s#^DB_PASS=.*#DB_PASS=${NEW_PASSWORD}#g" "$ENV_FILE"
  else
    printf "\n# added by reset script\nDB_PASS=%s\n" "${NEW_PASSWORD}" >> "$ENV_FILE"
  fi
  echo ".env updated."
fi

echo "Done."

