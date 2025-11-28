#!/bin/bash
# Watchdog script - monitors backend health and auto-restarts with fallback strategies

set -e

BASE_URL="${API_URL:-http://localhost:5002}"
LOG_FILE="watchdog.log"
MAX_RETRIES=3

write_log() {
  local message="$1"
  local level="${2:-INFO}"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  local log_entry="[$timestamp] [$level] $message"
  echo "$log_entry" >> "$LOG_FILE"
  if [ "$level" = "ERROR" ]; then
    echo -e "\033[31m$log_entry\033[0m"
  elif [ "$level" = "WARN" ]; then
    echo -e "\033[33m$log_entry\033[0m"
  else
    echo "$log_entry"
  fi
}

test_port() {
  local port="$1"
  if command -v nc &> /dev/null; then
    nc -z localhost "$port" 2>/dev/null
  elif command -v timeout &> /dev/null; then
    timeout 1 bash -c "echo > /dev/tcp/localhost/$port" 2>/dev/null
  else
    return 1
  fi
}

test_health() {
  local url="$1"
  curl -sS -f -m 2 "$url" > /dev/null 2>&1
}

start_backend() {
  local mode="${1:-normal}"
  
  write_log "Starting backend in $mode mode..."
  
  # Kill existing processes
  pkill -f "node dist/main.js" || true
  sleep 1
  
  # Determine environment variables based on mode
  if [ "$mode" = "safe" ]; then
    export SAFE_MODE=true
  elif [ "$mode" = "minimal" ]; then
    export ENABLE_POLICY=false
    export ENABLE_RISK=false
    export ENABLE_COMPLIANCE=false
    export ENABLE_AUDIT=false
    export ENABLE_ISSUE=false
    export ENABLE_QUEUE=false
    export ENABLE_RULES=false
    export ENABLE_DATA_FOUNDATION=false
    export ENABLE_DASHBOARD=false
    export ENABLE_GOVERNANCE=false
    export ENABLE_RISK_INSTANCE=false
    export ENABLE_RISK_SCORING=false
    export ENABLE_SEARCH=false
    export ENABLE_ENTITY_REGISTRY=false
    export ENABLE_METRICS=false
    export ENABLE_BCM=false
  fi
  
  # Start process
  node dist/main.js > /dev/null 2>&1 &
  local process_pid=$!
  
  if [ -z "$process_pid" ]; then
    write_log "Failed to start backend process" "ERROR"
    return 1
  fi
  
  write_log "Backend process started (PID: $process_pid)"
  
  # Wait for health
  local health_ok=false
  local api_health_ok=false
  local attempt=0
  local max_attempts=30
  
  while [ $attempt -lt $max_attempts ]; do
    attempt=$((attempt + 1))
    sleep 2
    
    if ! kill -0 $process_pid 2>/dev/null; then
      write_log "Backend process exited unexpectedly" "ERROR"
      return 1
    fi
    
    if [ "$health_ok" = false ]; then
      if test_health "$BASE_URL/health"; then
        health_ok=true
        write_log "/health endpoint is ready"
      fi
    fi
    
    if [ "$api_health_ok" = false ]; then
      if test_health "$BASE_URL/api/v2/health"; then
        api_health_ok=true
        write_log "/api/v2/health endpoint is ready"
      fi
    fi
    
    if [ "$health_ok" = true ] && [ "$api_health_ok" = true ]; then
      write_log "Backend is healthy"
      return 0
    fi
  done
  
  write_log "Backend health check timeout" "WARN"
  return 1
}

# Main watchdog logic
write_log "Watchdog started"

# Check if backend is running
port_up=false
if test_port 5002; then
  port_up=true
fi

health_ok=false
api_health_ok=false

if [ "$port_up" = true ]; then
  write_log "Backend port is up, checking health..."
  if test_health "$BASE_URL/health"; then
    health_ok=true
  fi
  if test_health "$BASE_URL/api/v2/health"; then
    api_health_ok=true
  fi
  
  if [ "$health_ok" = true ] && [ "$api_health_ok" = true ]; then
    write_log "Backend is healthy, exiting"
    exit 0
  else
    write_log "Backend port is up but health check failed" "WARN"
  fi
else
  write_log "Backend port is down"
fi

# Try to start/restart backend
retry_count=0
success=false

while [ $retry_count -lt $MAX_RETRIES ] && [ "$success" = false ]; do
  retry_count=$((retry_count + 1))
  
  if [ $retry_count -eq 1 ]; then
    write_log "Attempt $retry_count: Starting in normal mode"
    if start_backend "normal"; then
      success=true
    fi
  elif [ $retry_count -eq 2 ]; then
    write_log "Attempt $retry_count: Starting in SAFE_MODE"
    if start_backend "safe"; then
      success=true
    fi
  else
    write_log "Attempt $retry_count: Starting in minimal mode (all features off)"
    if start_backend "minimal"; then
      success=true
    fi
  fi
  
  if [ "$success" = true ]; then
    write_log "Backend started successfully" "INFO"
    exit 0
  else
    write_log "Backend start failed, waiting before retry..." "WARN"
    sleep 5
  fi
done

write_log "Failed to start backend after $MAX_RETRIES attempts" "ERROR"
exit 1

