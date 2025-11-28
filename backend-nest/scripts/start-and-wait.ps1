#!/usr/bin/env pwsh
# Start backend and wait for health endpoints to be ready
# Exit codes: 0=success, 1=process failed, 4=TIMEOUT, 21=SAFE_FAIL, 22=BISECT_FAIL, 23=APP_INIT_ERROR

# Fix encoding for proper log output (UTF-8 without BOM)
$OutputEncoding = [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$env:CHCP_OUT = (chcp 65001 | Out-String)

$ErrorActionPreference = "Stop"

$BASE_PORT = 5002
$MAX_ATTEMPTS = 30
$RETRY_DELAY = 2
$LOG_FILE = "runtime.out.log"
$ERR_FILE = "runtime.err.log"

Write-Host "Starting backend and waiting for health..." -ForegroundColor Cyan
Write-Host "Port: $BASE_PORT" -ForegroundColor Gray

# Check if dist/main.js exists
if (-not (Test-Path "dist/main.js")) {
  Write-Host "ERROR: dist/main.js not found. Run 'npm run build' first." -ForegroundColor Red
  exit 1
}

# Step 1: Best-effort kill old Node processes on port 5002
Write-Host "Cleaning up old processes on port $BASE_PORT..." -ForegroundColor Yellow
try {
    $connections = Get-NetTCPConnection -LocalPort $BASE_PORT -ErrorAction SilentlyContinue
    foreach ($conn in $connections) {
        if ($conn.OwningProcess) {
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
            Write-Host "  Killed process $($conn.OwningProcess) on port $BASE_PORT" -ForegroundColor Gray
        }
    }
    Start-Sleep -Seconds 1
} catch {
    # Ignore errors
}

# Also kill any node processes
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# Step 2: Start backend
Write-Host "Starting backend process..." -ForegroundColor Yellow
$process = Start-Process -NoNewWindow -FilePath "node" -ArgumentList "dist/main.js" -RedirectStandardOutput $LOG_FILE -RedirectStandardError $ERR_FILE -PassThru

if (-not $process) {
  Write-Host "ERROR: Failed to start backend process" -ForegroundColor Red
  exit 1
}

Write-Host "Backend process started (PID: $($process.Id))" -ForegroundColor Green

# Step 3: Wait for TCP socket to be up
Write-Host "Waiting for TCP socket on port $BASE_PORT..." -ForegroundColor Yellow
$socketUp = $false
$socketAttempts = 0
$maxSocketAttempts = 30

while ($socketAttempts -lt $maxSocketAttempts -and -not $socketUp) {
    $socketAttempts++
    Start-Sleep -Seconds 2
    
    # Check if process is still running
    if ($process.HasExited) {
        Write-Host "ERROR: Backend process exited before socket was ready" -ForegroundColor Red
        if (Test-Path $LOG_FILE) {
            Write-Host "Last 50 lines of log:" -ForegroundColor Yellow
            Get-Content $LOG_FILE -Tail 50
        }
        exit 1
    }
    
    # Test TCP connection
    try {
        $tcpTest = Test-NetConnection -ComputerName 127.0.0.1 -Port $BASE_PORT -WarningAction SilentlyContinue -ErrorAction SilentlyContinue
        if ($tcpTest.TcpTestSucceeded) {
            $socketUp = $true
            Write-Host "  OK: TCP socket is up" -ForegroundColor Green
            break
        }
    } catch {
        # Continue waiting
    }
    
    Write-Host "  [$socketAttempts] Waiting for socket..." -ForegroundColor Gray
}

if (-not $socketUp) {
    Write-Host "ERROR: TCP socket not ready after $maxSocketAttempts attempts" -ForegroundColor Red
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    exit 1
}

# Step 4: Warmup delay
Write-Host "Warming up (750ms)..." -ForegroundColor Yellow
Start-Sleep -Milliseconds 750

# Step 5: Compose base URLs and paths
$baseUrls = @("http://127.0.0.1:$BASE_PORT", "http://localhost:$BASE_PORT")

# Check if IPv6 is available
try {
    $ipv6Test = Test-Connection -Count 1 ::1 -Quiet -ErrorAction SilentlyContinue
    if ($ipv6Test) {
        $baseUrls += "http://[::1]:$BASE_PORT"
        Write-Host "IPv6 detected, adding [::1] to probe list" -ForegroundColor Gray
    }
} catch {
    # IPv6 not available, skip
}

$paths = @("/health", "/v2/health", "/api/v2/health")

Write-Host "Probing health endpoints..." -ForegroundColor Cyan
Write-Host "  Base URLs: $($baseUrls -join ', ')" -ForegroundColor Gray
Write-Host "  Paths: $($paths -join ', ')" -ForegroundColor Gray

# Step 6: Probe health endpoints
$attempt = 0
$healthResults = @{}
$anyHealthOk = $false

while ($attempt -lt $MAX_ATTEMPTS) {
    $attempt++
    
    # Check crash.log for APP_INIT_ERROR
    if (Test-Path "crash.log") {
        $crashContent = Get-Content "crash.log" -Tail 50 -ErrorAction SilentlyContinue
        if ($crashContent -match "APP_INIT_ERROR") {
            Write-Host "ERROR: APP_INIT_ERROR detected in crash.log" -ForegroundColor Red
            Write-Host "Last 50 lines of crash.log:" -ForegroundColor Yellow
            $crashContent | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
            $diagDir = ".diag"
            if (-not (Test-Path $diagDir)) { New-Item -ItemType Directory -Path $diagDir | Out-Null }
            $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
            Copy-Item "crash.log" "$diagDir/crash-$timestamp.log" -ErrorAction SilentlyContinue
            exit 23
        }
    }
    
    # Check if process is still running
    if ($process.HasExited) {
        Write-Host "ERROR: Backend process exited unexpectedly (exit code: $($process.ExitCode))" -ForegroundColor Red
        Write-Host "Last 200 lines of log:" -ForegroundColor Yellow
        if (Test-Path $LOG_FILE) {
            Get-Content $LOG_FILE -Tail 200
        }
        if (Test-Path $ERR_FILE) {
            Write-Host "`nErrors:" -ForegroundColor Yellow
            Get-Content $ERR_FILE -Tail 50
        }
        exit 1
    }
    
    # Probe all combinations
    $statusLine = "[$attempt] "
    foreach ($baseUrl in $baseUrls) {
        foreach ($path in $paths) {
            $url = "$baseUrl$path"
            $key = "$baseUrl$path"
            $status = "ERR"
            
            if (-not $healthResults.ContainsKey($key) -or $healthResults[$key] -ne "200") {
                # Try GET first
                try {
                    $probeResult = & "$PSScriptRoot/http-probe.ps1" -Urls @($url) -Method GET -TimeoutMs 1500
                    if ($probeResult.ok) {
                        $status = "200"
                        $healthResults[$key] = "200"
                        $anyHealthOk = $true
                    } else {
                        # Try HEAD as fallback
                        try {
                            $headResult = & "$PSScriptRoot/http-probe.ps1" -Urls @($url) -Method HEAD -TimeoutMs 1500
                            if ($headResult.ok) {
                                $status = "200"
                                $healthResults[$key] = "200"
                                $anyHealthOk = $true
                            } else {
                                $status = if ($headResult.statusCode) { "$($headResult.statusCode)" } else { "ERR" }
                            }
                        } catch {
                            $status = "ERR"
                        }
                    }
                } catch {
                    $status = "ERR"
                }
            } else {
                $status = "200"
            }
            
            # Compact status line: base/path=status
            $baseShort = $baseUrl -replace "http://", "" -replace "\[::1\]", "::1"
            $statusLine += "$baseShort$path=$status "
        }
    }
    
    Write-Host $statusLine -ForegroundColor $(if ($anyHealthOk) { "Green" } else { "Yellow" })
    
    # If any endpoint is OK, we're done
    if ($anyHealthOk) {
        Write-Host "`nOK: PASS - Health endpoint(s) ready!" -ForegroundColor Green
        Write-Host "   Backend PID: $($process.Id)" -ForegroundColor Gray
        Write-Host "   Working endpoints:" -ForegroundColor Gray
        foreach ($key in $healthResults.Keys) {
            if ($healthResults[$key] -eq "200") {
                Write-Host "     - $key" -ForegroundColor Green
            }
        }
        exit 0
    }
    
    Start-Sleep -Seconds $RETRY_DELAY
}

# Timeout - all endpoints failed
Write-Host "`nERROR: FAIL TIMEOUT - Health endpoints not ready after $MAX_ATTEMPTS attempts" -ForegroundColor Red
Write-Host "Last 300 lines of log:" -ForegroundColor Yellow
if (Test-Path $LOG_FILE) {
    Get-Content $LOG_FILE -Tail 300
}
if (Test-Path $ERR_FILE) {
    Write-Host "`nErrors:" -ForegroundColor Yellow
    Get-Content $ERR_FILE -Tail 50
}

# Kill process
if (-not $process.HasExited) {
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
}

Write-Host "`n[EXIT_CODE] TIMEOUT (all endpoints failed)" -ForegroundColor Red
exit 4
