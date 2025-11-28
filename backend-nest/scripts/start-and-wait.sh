#!/bin/bash
# Start backend and wait for health endpoints to be ready
# Exit codes: 0=success, 1=process failed, 4=TIMEOUT

set -e

# UTF-8 locale
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

BASE_PORT=5002
MAX_ATTEMPTS=30
RETRY_DELAY=2
LOG_FILE="runtime.out.log"
ERR_FILE="runtime.err.log"

echo "Starting backend and waiting for health..."
echo "Port: $BASE_PORT"

# Check if dist/main.js exists
if [ ! -f "dist/main.js" ]; then
  echo "ERROR: dist/main.js not found. Run 'npm run build' first."
  exit 1
fi

# Step 1: Best-effort kill old processes on port 5002
echo "Cleaning up old processes on port $BASE_PORT..."
if command -v lsof >/dev/null 2>&1; then
    lsof -ti:$BASE_PORT | xargs kill -9 2>/dev/null || true
fi
pkill -f "node dist/main.js" 2>/dev/null || true
sleep 1

# Step 2: Start backend
echo "Starting backend process..."
node dist/main.js > "$LOG_FILE" 2> "$ERR_FILE" &
PROCESS_PID=$!

if [ -z "$PROCESS_PID" ]; then
  echo "ERROR: Failed to start backend process"
  exit 1
fi

echo "Backend process started (PID: $PROCESS_PID)"

# Step 3: Wait for TCP socket to be up
echo "Waiting for TCP socket on port $BASE_PORT..."
socket_up=false
socket_attempts=0
max_socket_attempts=30

while [ $socket_attempts -lt $max_socket_attempts ] && [ "$socket_up" = false ]; do
    socket_attempts=$((socket_attempts + 1))
    sleep 2
    
    # Check if process is still running
    if ! kill -0 $PROCESS_PID 2>/dev/null; then
        echo "ERROR: Backend process exited before socket was ready"
        if [ -f "$LOG_FILE" ]; then
            echo "Last 50 lines of log:"
            tail -n 50 "$LOG_FILE"
        fi
        exit 1
    fi
    
    # Test TCP connection with nc
    if command -v nc >/dev/null 2>&1; then
        if nc -z localhost $BASE_PORT 2>/dev/null; then
            socket_up=true
            echo "  OK: TCP socket is up"
            break
        fi
    else
        # Fallback: try curl
        if curl -sS --max-time 1 "http://localhost:$BASE_PORT/health" >/dev/null 2>&1; then
            socket_up=true
            echo "  OK: TCP socket is up (via HTTP)"
            break
        fi
    fi
    
    echo "  [$socket_attempts] Waiting for socket..."
done

if [ "$socket_up" = false ]; then
    echo "ERROR: TCP socket not ready after $max_socket_attempts attempts"
    kill -9 $PROCESS_PID 2>/dev/null || true
    exit 1
fi

# Step 4: Warmup delay
echo "Warming up (750ms)..."
sleep 0.75

# Step 5: Compose base URLs and paths
BASE_URLS=("http://127.0.0.1:$BASE_PORT" "http://localhost:$BASE_PORT")

# Check if IPv6 is available
if ping6 -c 1 ::1 >/dev/null 2>&1; then
    BASE_URLS+=("http://[::1]:$BASE_PORT")
    echo "IPv6 detected, adding [::1] to probe list"
fi

PATHS=("/health" "/v2/health" "/api/v2/health")

echo "Probing health endpoints..."
echo "  Base URLs: ${BASE_URLS[*]}"
echo "  Paths: ${PATHS[*]}"

# Step 6: Probe health endpoints
attempt=0
declare -A health_results
any_health_ok=false

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

while [ $attempt -lt $MAX_ATTEMPTS ]; do
    attempt=$((attempt + 1))
    
    # Check if process is still running
    if ! kill -0 $PROCESS_PID 2>/dev/null; then
        echo "ERROR: Backend process exited unexpectedly"
        exit_code=$(wait $PROCESS_PID 2>/dev/null || echo "unknown")
        echo "Exit code: $exit_code"
        echo "Last 200 lines of log:"
        if [ -f "$LOG_FILE" ]; then
            tail -n 200 "$LOG_FILE"
        fi
        if [ -f "$ERR_FILE" ]; then
            echo ""
            echo "Errors:"
            tail -n 50 "$ERR_FILE"
        fi
        exit 1
    fi
    
    # Probe all combinations
    status_line="[$attempt] "
    for base_url in "${BASE_URLS[@]}"; do
        for path in "${PATHS[@]}"; do
            url="$base_url$path"
            key="$base_url$path"
            status="ERR"
            
            if [ -z "${health_results[$key]}" ] || [ "${health_results[$key]}" != "200" ]; then
                # Try GET first
                probe_result=$("$SCRIPT_DIR/http-probe.sh" -u "$url" -m GET -t 1500 2>/dev/null || echo '{"ok":false}')
                if echo "$probe_result" | grep -q '"ok":true'; then
                    status="200"
                    health_results[$key]="200"
                    any_health_ok=true
                else
                    # Try HEAD as fallback
                    head_result=$("$SCRIPT_DIR/http-probe.sh" -u "$url" -m HEAD -t 1500 2>/dev/null || echo '{"ok":false}')
                    if echo "$head_result" | grep -q '"ok":true'; then
                        status="200"
                        health_results[$key]="200"
                        any_health_ok=true
                    else
                        # Extract status code if available
                        http_code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 1.5 "$url" 2>/dev/null || echo "000")
                        if [ "$http_code" != "000" ] && [ "$http_code" != "" ]; then
                            status="$http_code"
                        fi
                    fi
                fi
            else
                status="200"
            fi
            
            # Compact status line: base/path=status
            base_short=$(echo "$base_url" | sed 's|http://||' | sed 's|\[::1\]|::1|')
            status_line="$status_line$base_short$path=$status "
        done
    done
    
    echo "$status_line"
    
    # If any endpoint is OK, we're done
    if [ "$any_health_ok" = true ]; then
        echo ""
        echo "OK: PASS - Health endpoint(s) ready!"
        echo "   Backend PID: $PROCESS_PID"
        echo "   Working endpoints:"
        for key in "${!health_results[@]}"; do
            if [ "${health_results[$key]}" = "200" ]; then
                echo "     - $key"
            fi
        done
        exit 0
    fi
    
    sleep $RETRY_DELAY
done

# Timeout - all endpoints failed
echo ""
echo "ERROR: FAIL TIMEOUT - Health endpoints not ready after $MAX_ATTEMPTS attempts"
echo "Last 300 lines of log:"
if [ -f "$LOG_FILE" ]; then
    tail -n 300 "$LOG_FILE"
fi
if [ -f "$ERR_FILE" ]; then
    echo ""
    echo "Errors:"
    tail -n 50 "$ERR_FILE"
fi

# Kill process
kill -9 $PROCESS_PID 2>/dev/null || true

echo ""
echo "[EXIT_CODE] TIMEOUT (all endpoints failed)"
exit 4
