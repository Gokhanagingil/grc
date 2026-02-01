#!/usr/bin/env bash
# ops/lib/common.sh - Shared helper library for GRC operations scripts
#
# This library provides common functions for:
# - Environment variable validation
# - URL normalization
# - API authentication
# - Secure curl wrappers with redaction
#
# Usage:
#   source "$(dirname "$0")/lib/common.sh"
#   # or
#   source /path/to/ops/lib/common.sh
#
# Required environment variables (set before sourcing or calling functions):
#   STAGING_BASE_URL - Base URL for staging (e.g., https://niles-grc.com)
#
# Optional environment variables:
#   API_BASE_URL       - Explicit API base URL (if different from STAGING_BASE_URL/api)
#   DEMO_TENANT_ID     - Tenant ID for demo/smoke tests
#   DEMO_ADMIN_EMAIL   - Admin email for authentication
#   DEMO_ADMIN_PASSWORD - Admin password for authentication
#
# Example:
#   export STAGING_BASE_URL="https://niles-grc.com"
#   export DEMO_TENANT_ID="your-tenant-uuid"
#   export DEMO_ADMIN_EMAIL="admin@example.com"
#   export DEMO_ADMIN_PASSWORD="your-secure-password"
#   source ops/lib/common.sh
#   login_and_get_token

set -euo pipefail

# Color codes for output (disabled if not a terminal)
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[0;33m'
    BLUE='\033[0;34m'
    NC='\033[0m' # No Color
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    NC=''
fi

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*" >&2
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*" >&2
}

# require_env VAR_NAME [DESCRIPTION]
# Validates that an environment variable is set and non-empty.
# Exits with error code 1 if the variable is not set.
#
# Arguments:
#   VAR_NAME    - Name of the environment variable to check
#   DESCRIPTION - Optional description for error message
#
# Example:
#   require_env STAGING_BASE_URL "Base URL for staging environment"
require_env() {
    local var_name="$1"
    local description="${2:-}"
    
    if [ -z "${!var_name:-}" ]; then
        if [ -n "$description" ]; then
            log_error "Required environment variable '$var_name' is not set."
            log_error "Description: $description"
        else
            log_error "Required environment variable '$var_name' is not set."
        fi
        log_error "Please set it before running this script:"
        log_error "  export $var_name=\"your-value\""
        exit 1
    fi
}

# normalize_base_url URL
# Strips trailing slash from a URL.
#
# Arguments:
#   URL - The URL to normalize
#
# Output:
#   Normalized URL without trailing slash
#
# Example:
#   BASE=$(normalize_base_url "https://example.com/")
#   # Result: https://example.com
normalize_base_url() {
    local url="$1"
    # Remove trailing slash(es)
    echo "${url%/}"
}

# resolve_api_base
# Resolves the API base URL using the following priority:
# 1. API_BASE_URL if explicitly set
# 2. STAGING_BASE_URL/api (same-origin proxy pattern)
#
# Requires:
#   STAGING_BASE_URL must be set
#
# Output:
#   The resolved API base URL
#
# Example:
#   API_BASE=$(resolve_api_base)
resolve_api_base() {
    if [ -n "${API_BASE_URL:-}" ]; then
        normalize_base_url "$API_BASE_URL"
    else
        require_env STAGING_BASE_URL "Base URL for staging environment"
        echo "$(normalize_base_url "$STAGING_BASE_URL")/api"
    fi
}

# redact_sensitive VALUE
# Redacts sensitive values for safe logging.
# Shows first 4 chars and last 4 chars with asterisks in between.
#
# Arguments:
#   VALUE - The sensitive value to redact
#
# Output:
#   Redacted string (e.g., "eyJh****xyz")
redact_sensitive() {
    local value="$1"
    local len=${#value}
    
    if [ "$len" -le 8 ]; then
        echo "****"
    else
        echo "${value:0:4}****${value: -4}"
    fi
}

# redact_json_field JSON FIELD_NAME
# Redacts a specific field in JSON output for safe logging.
#
# Arguments:
#   JSON       - JSON string
#   FIELD_NAME - Name of field to redact
#
# Output:
#   JSON with field value redacted
redact_json_field() {
    local json="$1"
    local field="$2"
    
    # Use sed to redact the field value
    echo "$json" | sed -E "s/(\"$field\"[[:space:]]*:[[:space:]]*\")[^\"]+\"/\1****\"/g"
}

# curl_json METHOD URL [DATA]
# Wrapper around curl for JSON API calls with proper headers and error handling.
# Automatically redacts sensitive fields in debug output.
#
# Arguments:
#   METHOD - HTTP method (GET, POST, PUT, DELETE, PATCH)
#   URL    - Full URL to call
#   DATA   - Optional JSON body for POST/PUT/PATCH
#
# Environment:
#   AUTH_TOKEN  - If set, adds Authorization header
#   TENANT_ID   - If set, adds x-tenant-id header
#   DEBUG       - If set to "1", prints debug info (with redaction)
#
# Output:
#   Response body on stdout
#   HTTP status code is stored in LAST_HTTP_STATUS
#
# Returns:
#   0 on success (2xx status)
#   1 on client error (4xx status)
#   2 on server error (5xx status)
#   3 on network/other error
#
# Example:
#   AUTH_TOKEN="xxx" TENANT_ID="yyy" curl_json GET "https://api.example.com/users"
curl_json() {
    local method="$1"
    local url="$2"
    local data="${3:-}"
    
    local curl_args=(
        -s
        -w "\n%{http_code}"
        -X "$method"
        -H "Content-Type: application/json"
        -H "Accept: application/json"
    )
    
    # Add auth header if token is set
    if [ -n "${AUTH_TOKEN:-}" ]; then
        curl_args+=(-H "Authorization: Bearer $AUTH_TOKEN")
    fi
    
    # Add tenant header if set
    if [ -n "${TENANT_ID:-}" ]; then
        curl_args+=(-H "x-tenant-id: $TENANT_ID")
    fi
    
    # Add data for POST/PUT/PATCH
    if [ -n "$data" ] && [[ "$method" =~ ^(POST|PUT|PATCH)$ ]]; then
        curl_args+=(-d "$data")
    fi
    
    # Debug output (with redaction)
    if [ "${DEBUG:-}" = "1" ]; then
        local safe_url="$url"
        log_info "curl -X $method $safe_url"
        if [ -n "$data" ]; then
            local safe_data
            safe_data=$(redact_json_field "$data" "password")
            safe_data=$(redact_json_field "$safe_data" "token")
            safe_data=$(redact_json_field "$safe_data" "accessToken")
            log_info "  Data: $safe_data"
        fi
    fi
    
    # Make the request
    local response
    local http_code
    
    if ! response=$(curl "${curl_args[@]}" "$url" 2>/dev/null); then
        log_error "Network error calling $url"
        LAST_HTTP_STATUS="000"
        return 3
    fi
    
    # Extract HTTP status code (last line)
    http_code=$(echo "$response" | tail -n1)
    LAST_HTTP_STATUS="$http_code"
    
    # Extract body (all but last line)
    local body
    body=$(echo "$response" | sed '$d')
    
    # Debug output for response
    if [ "${DEBUG:-}" = "1" ]; then
        local safe_body
        safe_body=$(redact_json_field "$body" "accessToken")
        safe_body=$(redact_json_field "$safe_body" "token")
        safe_body=$(redact_json_field "$safe_body" "refreshToken")
        log_info "  Status: $http_code"
        log_info "  Response: ${safe_body:0:500}..."
    fi
    
    # Output body
    echo "$body"
    
    # Return based on status code
    case "$http_code" in
        2*) return 0 ;;
        4*) return 1 ;;
        5*) return 2 ;;
        *)  return 3 ;;
    esac
}

# login_and_get_token
# Authenticates with the API and stores the access token.
# Uses DEMO_ADMIN_EMAIL and DEMO_ADMIN_PASSWORD for credentials.
#
# Requires:
#   DEMO_ADMIN_EMAIL    - Admin email
#   DEMO_ADMIN_PASSWORD - Admin password
#   STAGING_BASE_URL or API_BASE_URL must be set
#
# Sets:
#   AUTH_TOKEN - The access token for subsequent API calls
#   TENANT_ID  - The tenant ID from the login response
#
# Returns:
#   0 on success
#   1 on authentication failure
#
# Example:
#   export DEMO_ADMIN_EMAIL="admin@example.com"
#   export DEMO_ADMIN_PASSWORD="secure-password"
#   export STAGING_BASE_URL="https://niles-grc.com"
#   if login_and_get_token; then
#       echo "Logged in successfully"
#   fi
login_and_get_token() {
    require_env DEMO_ADMIN_EMAIL "Admin email for authentication"
    require_env DEMO_ADMIN_PASSWORD "Admin password for authentication"
    
    local api_base
    api_base=$(resolve_api_base)
    
    local login_url="$api_base/auth/login"
    local login_data
    login_data=$(printf '{"email":"%s","password":"%s"}' "$DEMO_ADMIN_EMAIL" "$DEMO_ADMIN_PASSWORD")
    
    log_info "Authenticating as $(redact_sensitive "$DEMO_ADMIN_EMAIL")..."
    
    local response
    if ! response=$(curl_json POST "$login_url" "$login_data"); then
        log_error "Authentication failed (HTTP $LAST_HTTP_STATUS)"
        return 1
    fi
    
    # Try to extract token from various response shapes
    # Shape 1: { "data": { "accessToken": "..." } }
    # Shape 2: { "accessToken": "..." }
    # Shape 3: { "data": { "token": "..." } }
    local token
    token=$(echo "$response" | grep -oP '"accessToken"\s*:\s*"\K[^"]+' | head -1 || true)
    
    if [ -z "$token" ]; then
        token=$(echo "$response" | grep -oP '"token"\s*:\s*"\K[^"]+' | head -1 || true)
    fi
    
    if [ -z "$token" ]; then
        log_error "Could not extract access token from response"
        log_error "Response: $(redact_json_field "$response" "password" | head -c 500)"
        return 1
    fi
    
    # Extract tenant ID
    local tenant_id
    tenant_id=$(echo "$response" | grep -oP '"tenantId"\s*:\s*"\K[^"]+' | head -1 || true)
    
    # Export for use in subsequent calls
    export AUTH_TOKEN="$token"
    if [ -n "$tenant_id" ]; then
        export TENANT_ID="$tenant_id"
        log_success "Authenticated successfully (tenant: $(redact_sensitive "$tenant_id"))"
    else
        # Use DEMO_TENANT_ID if available
        if [ -n "${DEMO_TENANT_ID:-}" ]; then
            export TENANT_ID="$DEMO_TENANT_ID"
            log_success "Authenticated successfully (using DEMO_TENANT_ID)"
        else
            log_warn "No tenant ID in response and DEMO_TENANT_ID not set"
            log_success "Authenticated successfully"
        fi
    fi
    
    return 0
}

# check_health [ENDPOINT]
# Checks a health endpoint and reports status.
#
# Arguments:
#   ENDPOINT - Health endpoint path (default: /health/live)
#
# Returns:
#   0 if healthy
#   1 if unhealthy
#
# Example:
#   if check_health /health/ready; then
#       echo "Service is ready"
#   fi
check_health() {
    local endpoint="${1:-/health/live}"
    local api_base
    api_base=$(resolve_api_base)
    
    # Remove /api suffix for health checks (they're usually at root)
    local base_url
    base_url=$(normalize_base_url "${STAGING_BASE_URL:-$api_base}")
    
    local health_url="$base_url$endpoint"
    
    log_info "Checking health: $health_url"
    
    local response
    if response=$(curl_json GET "$health_url"); then
        log_success "Health check passed ($endpoint)"
        echo "$response"
        return 0
    else
        log_error "Health check failed ($endpoint) - HTTP $LAST_HTTP_STATUS"
        return 1
    fi
}

# wait_for_health [ENDPOINT] [MAX_ATTEMPTS] [DELAY_SECONDS]
# Waits for a health endpoint to become healthy.
#
# Arguments:
#   ENDPOINT     - Health endpoint path (default: /health/live)
#   MAX_ATTEMPTS - Maximum number of attempts (default: 30)
#   DELAY_SECONDS - Delay between attempts (default: 2)
#
# Returns:
#   0 when healthy
#   1 if max attempts exceeded
#
# Example:
#   wait_for_health /health/ready 60 1
wait_for_health() {
    local endpoint="${1:-/health/live}"
    local max_attempts="${2:-30}"
    local delay="${3:-2}"
    
    local attempt=1
    
    log_info "Waiting for $endpoint to become healthy (max ${max_attempts} attempts)..."
    
    while [ "$attempt" -le "$max_attempts" ]; do
        if check_health "$endpoint" > /dev/null 2>&1; then
            log_success "Service is healthy after $attempt attempt(s)"
            return 0
        fi
        
        log_info "Attempt $attempt/$max_attempts failed, retrying in ${delay}s..."
        sleep "$delay"
        ((attempt++))
    done
    
    log_error "Service did not become healthy after $max_attempts attempts"
    return 1
}

# validate_uuid UUID
# Validates that a string is a valid UUID format.
#
# Arguments:
#   UUID - String to validate
#
# Returns:
#   0 if valid UUID
#   1 if invalid
validate_uuid() {
    local uuid="$1"
    local uuid_regex='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    
    if [[ "$uuid" =~ $uuid_regex ]]; then
        return 0
    else
        return 1
    fi
}

# print_env_summary
# Prints a summary of the current environment configuration.
# Sensitive values are redacted.
print_env_summary() {
    echo ""
    echo "=== Environment Configuration ==="
    echo "STAGING_BASE_URL: ${STAGING_BASE_URL:-<not set>}"
    echo "API_BASE_URL:     ${API_BASE_URL:-<not set, will use STAGING_BASE_URL/api>}"
    echo "DEMO_TENANT_ID:   ${DEMO_TENANT_ID:-<not set>}"
    echo "DEMO_ADMIN_EMAIL: ${DEMO_ADMIN_EMAIL:+$(redact_sensitive "$DEMO_ADMIN_EMAIL")}"
    echo "DEMO_ADMIN_PASSWORD: ${DEMO_ADMIN_PASSWORD:+****}"
    echo "================================="
    echo ""
}

# Export functions for use in subshells
export -f log_info log_success log_warn log_error
export -f require_env normalize_base_url resolve_api_base
export -f redact_sensitive redact_json_field
export -f curl_json login_and_get_token
export -f check_health wait_for_health
export -f validate_uuid print_env_summary
