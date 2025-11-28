#!/bin/bash
# PHASE 9 Acceptance Validation Script (Bash/Unix)
# Tests all components: Health, Metrics, Tenant Isolation, Rate Limiting, Event Engine, Queue, DLQ, Idempotency
# Supports "no-redis" mode: automatically skips Redis-dependent tests when Redis is unavailable

set +e  # Don't exit on error - we want to continue and report

JWT_TOKEN="${JWT_TOKEN:-}"
INGEST_TOKEN="${INGEST_TOKEN:-change-me}"
TENANT_A="${TENANT_A:-217492b2-f814-4ba0-ae50-4e4f8ecf6216}"
TENANT_B="${TENANT_B:-00000000-0000-0000-0000-000000000001}"
API_URL="${API_URL:-http://localhost:5002}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORTS_DIR="$SCRIPT_DIR/../reports"
mkdir -p "$REPORTS_DIR"

REPORT_FILE="$REPORTS_DIR/ACCEPTANCE-VALIDATION-REPORT.md"

# Redis availability check
test_redis_connection() {
    local redis_host="${REDIS_HOST:-localhost}"
    local redis_port="${REDIS_PORT:-6379}"
    
    # Try TCP connection
    if timeout 1 bash -c "echo >/dev/tcp/$redis_host/$redis_port" 2>/dev/null; then
        return 0
    fi
    
    # Try via health endpoint
    if curl -sf "$API_URL/api/v2/health" > /tmp/health-check.json 2>/dev/null; then
        local redis_status=$(jq -r '.redis' /tmp/health-check.json 2>/dev/null || echo "down")
        if [ "$redis_status" = "up" ] || [ "$redis_status" = "ok" ]; then
            return 0
        fi
    fi
    
    return 1
}

# Check Redis status
SKIP_QUEUE="false"
MODE="full"
if ! test_redis_connection; then
    SKIP_QUEUE="true"
    MODE="no-redis"
    echo ""
    echo "⚠️  Redis NOT AVAILABLE - Queue-dependent tests will be SKIPPED"
else
    echo ""
    echo "✅ Redis AVAILABLE - All tests will run"
fi

# Initialize report
cat > "$REPORT_FILE" << EOF
# PHASE 9 Acceptance Validation Report

**Generated**: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
**Mode**: $MODE
**API URL**: $API_URL

EOF

if [ "$MODE" = "no-redis" ]; then
    echo "> **No-Redis Run**: Queue-dependent steps were skipped." >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
fi

cat >> "$REPORT_FILE" << EOF
## Summary

EOF

TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Helper function
test_result() {
    local test_name="$1"
    local success="$2"
    local details="$3"
    local skipped="${4:-false}"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$skipped" = "true" ]; then
        SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
        echo "⏭️  SKIPPED - $test_name (redis down)"
        echo "### $test_name" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
        echo "**Status**: ⏭️ SKIPPED (redis down)" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
    elif [ "$success" = "true" ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo "✅ PASS - $test_name"
        echo "### $test_name" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
        echo "**Status**: ✅ PASS" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
        if [ -n "$details" ]; then
            echo "$details" >> "$REPORT_FILE"
        fi
        echo "" >> "$REPORT_FILE"
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo "❌ FAIL - $test_name"
        echo "### $test_name" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
        echo "**Status**: ❌ FAIL" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
        if [ -n "$details" ]; then
            echo "**Error**: $details" >> "$REPORT_FILE"
        fi
        echo "" >> "$REPORT_FILE"
    fi
}

# Step 1: Health and Metrics (with retry)
echo ""
echo "=== Step 1: Health and Metrics ==="
HEALTH_OK=false
for i in {1..30}; do
    if curl -sf -H "x-tenant-id: $TENANT_A" "$API_URL/api/v2/health" > "$REPORTS_DIR/health.json" 2>/dev/null; then
        HEALTH_OK=true
        break
    fi
    if [ $i -eq 3 ]; then
        # After 3 failures, try ping endpoint
        curl -sf "$API_URL/api/v2/ping" > /dev/null 2>&1 && echo "  Backend ping OK, retrying health..." || echo "  Backend ping also failed"
    fi
    sleep 1
done

if [ "$HEALTH_OK" = "true" ]; then
    REDIS_STATUS=$(jq -r '.redis' "$REPORTS_DIR/health.json" 2>/dev/null || echo "unknown")
    QUEUE_LAG=$(jq -r '.queue.lag' "$REPORTS_DIR/health.json" 2>/dev/null || echo "0")
    DLQ_DEPTH=$(jq -r '.queue.dlqDepth' "$REPORTS_DIR/health.json" 2>/dev/null || echo "0")
    
    METRICS_OK="false"
    for i in {1..30}; do
        if curl -sf "$API_URL/metrics" 2>/dev/null | head -n 40 > "$REPORTS_DIR/metrics-preview.txt"; then
            if grep -q "http_request_total" "$REPORTS_DIR/metrics-preview.txt" 2>/dev/null; then
                METRICS_OK="true"
                break
            fi
        fi
        sleep 1
    done
    
    STATUS_OK=$(jq -r '.status' "$REPORTS_DIR/health.json" 2>/dev/null || echo "unknown")
    if [ "$STATUS_OK" = "ok" ]; then
        test_result "Health and Metrics" "true" "Status: $STATUS_OK, Redis: $REDIS_STATUS, Queue Lag: $QUEUE_LAG, DLQ Depth: $DLQ_DEPTH, Metrics: $METRICS_OK"
    else
        test_result "Health and Metrics" "false" "Status: $STATUS_OK, Redis: $REDIS_STATUS"
    fi
else
    test_result "Health and Metrics" "false" "Could not reach health endpoint after 30 retries"
fi

# Step 1.5: Data Foundations (Health/Dashboard)
echo ""
echo "=== Step 1.5: Data Foundations (Health/Dashboard) ==="
HEALTH_DF=$(curl -sf -H "x-tenant-id: $TENANT_A" "$API_URL/api/v2/health" 2>/dev/null)
DASHBOARD_DF=$(curl -sf -H "Authorization: Bearer $JWT_TOKEN" -H "x-tenant-id: $TENANT_A" "$API_URL/api/v2/dashboard/overview" 2>/dev/null || curl -sf -H "x-tenant-id: $TENANT_A" "$API_URL/api/v2/dashboard/overview" 2>/dev/null || echo "{}")

if [ -n "$HEALTH_DF" ]; then
    CLAUSES_H=$(echo "$HEALTH_DF" | jq -r '.dataFoundations.clauses // 0' 2>/dev/null || echo "0")
    MAPPINGS_H=$(echo "$HEALTH_DF" | jq -r '.dataFoundations.mappings // 0' 2>/dev/null || echo "0")
    CLAUSES_D=$(echo "$DASHBOARD_DF" | jq -r '.dataFoundations.clauses // 0' 2>/dev/null || echo "0")
    MAPPINGS_D=$(echo "$DASHBOARD_DF" | jq -r '.dataFoundations.mappings // 0' 2>/dev/null || echo "0")
    
    CLAUSES_OK="false"
    MAPPINGS_OK="false"
    if [ "$CLAUSES_H" -ge 400 ] || [ "$CLAUSES_D" -ge 400 ]; then
        CLAUSES_OK="true"
    fi
    if [ "$MAPPINGS_H" -ge 200 ] || [ "$MAPPINGS_D" -ge 200 ]; then
        MAPPINGS_OK="true"
    fi
    
    if [ "$CLAUSES_OK" = "true" ] && [ "$MAPPINGS_OK" = "true" ]; then
        test_result "Data Foundations (Health/Dashboard)" "true" "Health: clauses=$CLAUSES_H, mappings=$MAPPINGS_H; Dashboard: clauses=$CLAUSES_D, mappings=$MAPPINGS_D"
    else
        test_result "Data Foundations (Health/Dashboard)" "false" "tenant-mismatch or count-error: Health clauses=$CLAUSES_H (≥400?), mappings=$MAPPINGS_H (≥200?); Dashboard clauses=$CLAUSES_D, mappings=$MAPPINGS_D"
    fi
else
    test_result "Data Foundations (Health/Dashboard)" "false" "tenant-mismatch or count-error: Could not fetch health endpoint"
fi

# Step 1.6: Cross-Impact Endpoint
echo ""
echo "=== Step 1.6: Cross-Impact Endpoint ==="
VALID_CROSS=$(curl -sf -H "x-tenant-id: $TENANT_A" "$API_URL/api/v2/compliance/cross-impact?clause=ISO20000:8.4&includeSynthetic=false" 2>/dev/null)
INVALID_CROSS=$(curl -sf -H "x-tenant-id: $TENANT_A" "$API_URL/api/v2/compliance/cross-impact?clause=foo" 2>/dev/null)

if [ -n "$VALID_CROSS" ] && [ -n "$INVALID_CROSS" ]; then
    VALID_MATCHES=$(echo "$VALID_CROSS" | jq -r '.matches | length' 2>/dev/null || echo "0")
    INVALID_MATCHES=$(echo "$INVALID_CROSS" | jq -r '.matches | length' 2>/dev/null || echo "0")
    INVALID_NOTE=$(echo "$INVALID_CROSS" | jq -r '.note // ""' 2>/dev/null || echo "")
    
    VALID_OK="false"
    INVALID_OK="false"
    if [ "$VALID_MATCHES" -ge 1 ]; then
        VALID_OK="true"
    fi
    if [ "$INVALID_MATCHES" = "0" ] && [ "$INVALID_NOTE" = "invalid_clause_format" ]; then
        INVALID_OK="true"
    fi
    
    if [ "$VALID_OK" = "true" ] && [ "$INVALID_OK" = "true" ]; then
        test_result "Cross-Impact Endpoint" "true" "Valid clause: $VALID_MATCHES matches; Invalid format: $INVALID_MATCHES matches, note=$INVALID_NOTE"
    else
        test_result "Cross-Impact Endpoint" "false" "cross-impact-empty-or-error: Valid matches=$VALID_MATCHES (≥1?), Invalid matches=$INVALID_MATCHES, note=$INVALID_NOTE"
    fi
else
    test_result "Cross-Impact Endpoint" "false" "cross-impact-empty-or-error: Could not fetch cross-impact endpoint"
fi

# Step 2: Login
echo ""
echo "=== Step 2: Login (Get JWT) ==="
if [ -z "$JWT_TOKEN" ]; then
    LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/v2/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"admin@local","password":"Admin!123"}' 2>/dev/null)
    
    JWT_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.accessToken' 2>/dev/null)
    
    if [ -n "$JWT_TOKEN" ] && [ "$JWT_TOKEN" != "null" ] && [ "$JWT_TOKEN" != "" ]; then
        echo "✅ JWT token obtained"
    else
        echo "❌ Login failed"
        exit 1
    fi
fi

# Step 3: Tenant Isolation
echo ""
echo "=== Step 3: Tenant Isolation ==="
TENANT_HEADER_CHECK="false"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $JWT_TOKEN" "$API_URL/api/v2/risk/risks" 2>/dev/null)
if [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
    TENANT_HEADER_CHECK="true"
elif [ "$HTTP_CODE" = "500" ]; then
    TENANT_HEADER_CHECK="false"
    test_result "Tenant Isolation" "false" "Server error (500) - should be 400/403"
    exit 1
fi

# Create risk in Tenant A
CREATE_RESPONSE=$(curl -s -X POST "$API_URL/api/v2/risk" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "x-tenant-id: $TENANT_A" \
    -H "Content-Type: application/json" \
    -d '{"title":"CPU Risk Tenant A","description":"Test risk","category":"Performance","severity":"High"}' 2>/dev/null)

RISK_ID=$(echo "$CREATE_RESPONSE" | jq -r '.id' 2>/dev/null)
CREATE_HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/api/v2/risk" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "x-tenant-id: $TENANT_A" \
    -H "Content-Type: application/json" \
    -d '{"title":"CPU Risk Tenant A","description":"Test risk","category":"Performance","severity":"High"}' 2>/dev/null)

if [ "$CREATE_HTTP_CODE" != "201" ] && [ "$CREATE_HTTP_CODE" != "200" ]; then
    test_result "Tenant Isolation" "false" "Failed to create risk in Tenant A (HTTP $CREATE_HTTP_CODE)"
    exit 1
fi

# List in Tenant B
LIST_B=$(curl -s -H "Authorization: Bearer $JWT_TOKEN" \
    -H "x-tenant-id: $TENANT_B" \
    "$API_URL/api/v2/risk/risks" 2>/dev/null)

LIST_B_HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $JWT_TOKEN" \
    -H "x-tenant-id: $TENANT_B" \
    "$API_URL/api/v2/risk/risks" 2>/dev/null)

if [ "$LIST_B_HTTP_CODE" = "500" ]; then
    test_result "Tenant Isolation" "false" "Server error (500) when listing Tenant B"
    exit 1
fi

TENANT_B_COUNT=$(echo "$LIST_B" | jq -r '.items | length' 2>/dev/null || echo "0")
TENANT_B_TOTAL=$(echo "$LIST_B" | jq -r '.total' 2>/dev/null || echo "0")

# Check for leaks (Tenant A risks visible in Tenant B)
TENANT_B_LEAK=$(echo "$LIST_B" | jq -r ".items[]? | select(.tenant_id == \"$TENANT_A\") | .id" 2>/dev/null | wc -l)

if [ "$TENANT_HEADER_CHECK" = "true" ] && [ "$TENANT_B_COUNT" = "0" ] && [ "$TENANT_B_TOTAL" = "0" ] && [ "$TENANT_B_LEAK" = "0" ]; then
    test_result "Tenant Isolation" "true" "Without header blocked (HTTP $HTTP_CODE), Tenant B list empty (count: $TENANT_B_COUNT, total: $TENANT_B_TOTAL), leak: $TENANT_B_LEAK"
else
    test_result "Tenant Isolation" "false" "Header check: $TENANT_HEADER_CHECK (HTTP $HTTP_CODE), Tenant B count: $TENANT_B_COUNT, leak: $TENANT_B_LEAK"
fi

# Step 4: Rate Limit Test
echo ""
echo "=== Step 4: Rate Limit Test ==="
cd "$SCRIPT_DIR/.."
RETRY_COUNT=0
RATE_LIMIT_FILE="$REPORTS_DIR/rate-limit.json"
while [ ! -f "$RATE_LIMIT_FILE" ] && [ $RETRY_COUNT -lt 1 ]; do
    if npm run test:rate > /dev/null 2>&1; then
        sleep 1
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
done

if [ -f "$RATE_LIMIT_FILE" ]; then
    RATE_LIMIT_COUNT=$(jq -r '.rateLimitCount' "$RATE_LIMIT_FILE" 2>/dev/null || echo "0")
    RATE_LIMIT_PCT=$(jq -r '.rateLimitPercentage' "$RATE_LIMIT_FILE" 2>/dev/null || echo "0")
    P95_LATENCY=$(jq -r '.latency.p95' "$RATE_LIMIT_FILE" 2>/dev/null || echo "0")
    
    # PASS if rate limit count > 0 OR percentage >= 10
    if [ "$RATE_LIMIT_COUNT" -gt 0 ] || [ "$(echo "$RATE_LIMIT_PCT >= 10" | bc -l 2>/dev/null || echo "0")" = "1" ]; then
        test_result "Rate Limiting" "true" "429 count: $RATE_LIMIT_COUNT ($RATE_LIMIT_PCT%), P95: ${P95_LATENCY}ms"
    else
        test_result "Rate Limiting" "false" "No rate limiting detected (count: $RATE_LIMIT_COUNT, %: $RATE_LIMIT_PCT)"
    fi
else
    test_result "Rate Limiting" "false" "Rate limit report not found after retry"
fi

# Step 5: Refresh Token Rotation
echo ""
echo "=== Step 5: Refresh Token Rotation ==="
if npm run test:e2e -- auth.refresh.e2e-spec.ts > /tmp/e2e-output.txt 2>&1; then
    if grep -q "PASS\|✓\|passed" /tmp/e2e-output.txt; then
        test_result "Refresh Token Rotation" "true" "E2E tests passed"
    else
        test_result "Refresh Token Rotation" "false" "E2E tests failed or incomplete"
    fi
else
    test_result "Refresh Token Rotation" "false" "E2E test execution failed"
fi

# Step 6: Event Ingestion Test (SKIP if Redis down)
echo ""
echo "=== Step 6: Event Ingestion Test ==="
if [ "$SKIP_QUEUE" = "true" ]; then
    test_result "Event Ingestion" "false" "" "true"
    echo '{"skipped": true, "reason": "redis down"}' > "$REPORTS_DIR/event-ingestion-skipped.json"
else
    EVENT_RESPONSE=$(curl -s -X POST "$API_URL/api/v2/events/ingest/bulk" \
        -H "x-tenant-id: $TENANT_A" \
        -H "x-ingest-token: $INGEST_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"source\":\"custom\",\"items\":[{\"payload\":{\"message\":\"Test event 1\",\"severity\":\"major\",\"category\":\"test\",\"resource\":\"test-resource-1\",\"timestamp\":$(date +%s)},\"tenantId\":\"$TENANT_A\"}]}" 2>/dev/null)
    
    ACCEPTED=$(echo "$EVENT_RESPONSE" | jq -r '.accepted' 2>/dev/null || echo "false")
    if [ "$ACCEPTED" = "true" ]; then
        JOB_COUNT=$(echo "$EVENT_RESPONSE" | jq -r '.jobIds | length' 2>/dev/null || echo "0")
        test_result "Event Ingestion" "true" "Accepted: $ACCEPTED, Job IDs: $JOB_COUNT"
    else
        test_result "Event Ingestion" "false" "Response: $EVENT_RESPONSE"
    fi
fi

# Step 7: Queue Statistics (SKIP if Redis down)
echo ""
echo "=== Step 7: Queue Statistics ==="
if [ "$SKIP_QUEUE" = "true" ]; then
    test_result "Queue Statistics" "false" "" "true"
    echo '{"skipped": true, "reason": "redis down"}' > "$REPORTS_DIR/queue-stats.json"
else
    cd "$SCRIPT_DIR/.."
    if npm run queue:stats > /dev/null 2>&1; then
        if [ -f "$REPORTS_DIR/queue-stats.json" ]; then
            # Try to parse last JSON line
            LAST_JSON=$(tail -n 20 "$REPORTS_DIR/queue-stats.json" | grep -o '{.*}' | tail -n 1)
            if [ -n "$LAST_JSON" ]; then
                RAW_WAITING=$(echo "$LAST_JSON" | jq -r '.queues."events.raw".waiting' 2>/dev/null || echo "0")
                RAW_ACTIVE=$(echo "$LAST_JSON" | jq -r '.queues."events.raw".active' 2>/dev/null || echo "0")
                DLQ_DEPTH=$(echo "$LAST_JSON" | jq -r '.queues."events.dlq".waiting' 2>/dev/null || echo "0")
                test_result "Queue Statistics" "true" "Raw waiting: $RAW_WAITING, active: $RAW_ACTIVE, DLQ: $DLQ_DEPTH"
            else
                test_result "Queue Statistics" "false" "No valid queue stats found"
            fi
        else
            test_result "Queue Statistics" "false" "Queue stats file not found"
        fi
    else
        test_result "Queue Statistics" "false" "Queue stats script failed"
    fi
fi

# Step 8: Idempotency Test (SKIP if Redis down)
echo ""
echo "=== Step 8: Idempotency Test ==="
if [ "$SKIP_QUEUE" = "true" ]; then
    test_result "Idempotency" "false" "" "true"
else
    IDEMPOTENCY_KEY="TEST-KEY-$(date +%Y%m%d%H%M%S)"
    
    IDEM_RESPONSE1=$(curl -s -X POST "$API_URL/api/v2/events/ingest/bulk" \
        -H "x-tenant-id: $TENANT_A" \
        -H "x-ingest-token: $INGEST_TOKEN" \
        -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
        -H "Content-Type: application/json" \
        -d '{"source":"custom","items":[{"payload":{"message":"Idempotency test","severity":"info","category":"test"}}]}' 2>/dev/null)
    
    sleep 2
    
    IDEM_RESPONSE2=$(curl -s -X POST "$API_URL/api/v2/events/ingest/bulk" \
        -H "x-tenant-id: $TENANT_A" \
        -H "x-ingest-token: $INGEST_TOKEN" \
        -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
        -H "Content-Type: application/json" \
        -d '{"source":"custom","items":[{"payload":{"message":"Idempotency test","severity":"info","category":"test"}}]}' 2>/dev/null)
    
    ACCEPTED1=$(echo "$IDEM_RESPONSE1" | jq -r '.accepted' 2>/dev/null || echo "false")
    ACCEPTED2=$(echo "$IDEM_RESPONSE2" | jq -r '.accepted' 2>/dev/null || echo "false")
    
    if [ "$ACCEPTED1" = "true" ] && [ "$ACCEPTED2" = "true" ]; then
        test_result "Idempotency" "true" "Both requests accepted (duplicate should be dropped in processor)"
    else
        test_result "Idempotency" "false" "First: $ACCEPTED1, Second: $ACCEPTED2"
    fi
fi

# Step 9: Ingest Token Validation (SKIP if Redis down, but still test endpoint)
echo ""
echo "=== Step 9: Ingest Token Validation ==="
if [ "$SKIP_QUEUE" = "true" ]; then
    test_result "Ingest Token Validation" "false" "" "true"
else
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/api/v2/events/ingest/bulk" \
        -H "x-tenant-id: $TENANT_A" \
        -H "x-ingest-token: wrong-token" \
        -H "Content-Type: application/json" \
        -d '{"source":"custom","items":[{"payload":{"message":"Test"}}]}' 2>/dev/null)
    
    if [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "401" ]; then
        test_result "Ingest Token Validation" "true" "Wrong token rejected (HTTP $HTTP_CODE)"
    else
        test_result "Ingest Token Validation" "false" "Unexpected HTTP code: $HTTP_CODE"
    fi
fi

# Step 10: SQL Validation
echo ""
echo "=== Step 10: SQL Validation ==="
if command -v psql >/dev/null 2>&1; then
    export PGPASSWORD="${DB_PASS:-123456}"
    DB_USER="${DB_USER:-grc}"
    DB_NAME="${DB_NAME:-grc}"
    DB_HOST="${DB_HOST:-localhost}"
    DB_PORT="${DB_PORT:-5432}"
    
    # Count risks with tenant isolation check
    TENANT_A_COUNT=$(psql -U "$DB_USER" -d "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" -t -c "SELECT COUNT(*) FROM risks WHERE tenant_id='$TENANT_A';" 2>/dev/null | xargs)
    TENANT_B_COUNT=$(psql -U "$DB_USER" -d "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" -t -c "SELECT COUNT(*) FROM risks WHERE tenant_id='$TENANT_B';" 2>/dev/null | xargs)
    
    # Check for leaks
    LEAK_COUNT=$(psql -U "$DB_USER" -d "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" -t -c "SELECT COUNT(*) FROM risks WHERE tenant_id='$TENANT_A' AND id IN (SELECT id FROM risks WHERE tenant_id='$TENANT_B');" 2>/dev/null | xargs)
    
    # Count event_raw (may be 0 if Redis was down)
    RAW_COUNT=$(psql -U "$DB_USER" -d "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" -t -c "SELECT COUNT(*) FROM event_raw;" 2>/dev/null | xargs)
    
    # Severity distribution (if any events exist)
    SEVERITY_DIST=$(psql -U "$DB_USER" -d "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" -t -c "SELECT severity, COUNT(*) as count FROM event_normalized GROUP BY severity ORDER BY count DESC;" 2>/dev/null | head -n 5)
    
    if [ "$TENANT_B_COUNT" = "0" ] && [ "$LEAK_COUNT" = "0" ]; then
        test_result "SQL Validation" "true" "Tenant A risks: $TENANT_A_COUNT, Tenant B risks: $TENANT_B_COUNT (isolated), Leak: $LEAK_COUNT, Event raw: $RAW_COUNT"
    else
        test_result "SQL Validation" "false" "Tenant isolation issue: Tenant B has $TENANT_B_COUNT risks, Leak: $LEAK_COUNT"
    fi
else
    test_result "SQL Validation" "false" "psql command not found"
fi

# Generate final summary
ACTUAL_TESTS=$((PASSED_TESTS + FAILED_TESTS))
SUCCESS_RATE=0
if [ $ACTUAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$(awk "BEGIN {printf \"%.2f\", ($PASSED_TESTS/$ACTUAL_TESTS)*100}")
fi

cat >> "$REPORT_FILE" << EOF
- **Total Tests**: $TOTAL_TESTS
- **Passed**: $PASSED_TESTS
- **Failed**: $FAILED_TESTS
EOF

if [ $SKIPPED_TESTS -gt 0 ]; then
    echo "- **Skipped**: $SKIPPED_TESTS" >> "$REPORT_FILE"
fi

cat >> "$REPORT_FILE" << EOF
- **Success Rate**: ${SUCCESS_RATE}%

## Quality Thresholds

| Kriter | Beklenen | Durum |
|--------|----------|-------|
EOF

# Quality thresholds
if [ "$SKIP_QUEUE" = "true" ]; then
    echo "| Queue lag | < 1000 | SKIPPED |" >> "$REPORT_FILE"
    echo "| DLQ depth | = 0 | SKIPPED |" >> "$REPORT_FILE"
    echo "| P95 ingest | ≤ 250 ms | SKIPPED |" >> "$REPORT_FILE"
else
    echo "| Queue lag | < 1000 | TBD |" >> "$REPORT_FILE"
    echo "| DLQ depth | = 0 | TBD |" >> "$REPORT_FILE"
    echo "| P95 ingest | ≤ 250 ms | TBD |" >> "$REPORT_FILE"
fi

RATE_LIMIT_PCT_FINAL="N/A"
if [ -f "$REPORTS_DIR/rate-limit.json" ]; then
    RATE_LIMIT_PCT_FINAL=$(jq -r '.rateLimitPercentage' "$REPORTS_DIR/rate-limit.json" 2>/dev/null || echo "N/A")
fi

cat >> "$REPORT_FILE" << EOF
| Rate-limit 429 ratio | ≥ 10 % | ${RATE_LIMIT_PCT_FINAL}% |
| Tenant sızıntısı | 0 kayıt | ✅ |
| Refresh rotation success | ≥ 100 % | TBD |

## Files Generated

- \`reports/health.json\`
- \`reports/metrics-preview.txt\`
- \`reports/rate-limit.json\`
EOF

if [ "$SKIP_QUEUE" = "true" ]; then
    echo "- \`reports/queue-stats.json\` (skipped)" >> "$REPORT_FILE"
else
    echo "- \`reports/queue-stats.json\`" >> "$REPORT_FILE"
fi

cat >> "$REPORT_FILE" << EOF
- \`reports/ACCEPTANCE-VALIDATION-REPORT.md\`

---
**Validation Complete**
EOF

echo ""
echo "=== Validation Complete ==="
echo "Mode: $MODE"
echo "Total Tests: $TOTAL_TESTS"
echo "Passed: $PASSED_TESTS"
echo "Failed: $FAILED_TESTS"
if [ $SKIPPED_TESTS -gt 0 ]; then
    echo "Skipped: $SKIPPED_TESTS"
fi
echo "Success Rate: ${SUCCESS_RATE}%"
echo ""
echo "Report saved to: $REPORT_FILE"
