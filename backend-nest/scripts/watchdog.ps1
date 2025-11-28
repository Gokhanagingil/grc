#!/usr/bin/env pwsh
# Watchdog script - monitors backend health and auto-restarts with fallback strategies

$ErrorActionPreference = "Stop"

$BASE_URL = if ($env:API_URL) { $env:API_URL } else { "http://localhost:5002" }
$LOG_FILE = "watchdog.log"
$MAX_RETRIES = 3

function Write-Log {
  param([string]$Message, [string]$Level = "INFO")
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  $logEntry = "[$timestamp] [$Level] $Message"
  Add-Content -Path $LOG_FILE -Value $logEntry
  Write-Host $logEntry -ForegroundColor $(if ($Level -eq "ERROR") { "Red" } elseif ($Level -eq "WARN") { "Yellow" } else { "Gray" })
}

function Test-Port {
  param([int]$Port)
  try {
    $connection = Test-NetConnection -ComputerName "localhost" -Port $Port -WarningAction SilentlyContinue -InformationLevel Quiet
    return $connection
  } catch {
    return $false
  }
}

function Test-Health {
  param([string]$Url)
  try {
    $response = Invoke-WebRequest -Uri $Url -Method GET -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Start-Backend {
  param([string]$Mode = "normal")
  
  Write-Log "Starting backend in $Mode mode..."
  
  # Kill existing processes
  Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
  
  # Determine command based on mode
  $envVars = @{}
  if ($Mode -eq "safe") {
    $envVars["SAFE_MODE"] = "true"
  } elseif ($Mode -eq "minimal") {
    $envVars["ENABLE_POLICY"] = "false"
    $envVars["ENABLE_RISK"] = "false"
    $envVars["ENABLE_COMPLIANCE"] = "false"
    $envVars["ENABLE_AUDIT"] = "false"
    $envVars["ENABLE_ISSUE"] = "false"
    $envVars["ENABLE_QUEUE"] = "false"
    $envVars["ENABLE_RULES"] = "false"
    $envVars["ENABLE_DATA_FOUNDATION"] = "false"
    $envVars["ENABLE_DASHBOARD"] = "false"
    $envVars["ENABLE_GOVERNANCE"] = "false"
    $envVars["ENABLE_RISK_INSTANCE"] = "false"
    $envVars["ENABLE_RISK_SCORING"] = "false"
    $envVars["ENABLE_SEARCH"] = "false"
    $envVars["ENABLE_ENTITY_REGISTRY"] = "false"
    $envVars["ENABLE_METRICS"] = "false"
    $envVars["ENABLE_BCM"] = "false"
  }
  
  # Set environment variables
  foreach ($key in $envVars.Keys) {
    [Environment]::SetEnvironmentVariable($key, $envVars[$key], "Process")
  }
  
  # Start process
  $process = Start-Process -NoNewWindow -FilePath "node" -ArgumentList "dist/main.js" -PassThru
  
  if (-not $process) {
    Write-Log "Failed to start backend process" "ERROR"
    return $false
  }
  
  Write-Log "Backend process started (PID: $($process.Id))"
  
  # Wait for health
  $healthOk = $false
  $apiHealthOk = $false
  $attempt = 0
  $maxAttempts = 30
  
  while ($attempt -lt $maxAttempts) {
    $attempt++
    Start-Sleep -Seconds 2
    
    if ($process.HasExited) {
      Write-Log "Backend process exited unexpectedly" "ERROR"
      return $false
    }
    
    if (-not $healthOk) {
      $healthOk = Test-Health "$BASE_URL/health"
      if ($healthOk) {
        Write-Log "/health endpoint is ready"
      }
    }
    
    if (-not $apiHealthOk) {
      $apiHealthOk = Test-Health "$BASE_URL/api/v2/health"
      if ($apiHealthOk) {
        Write-Log "/api/v2/health endpoint is ready"
      }
    }
    
    if ($healthOk -and $apiHealthOk) {
      Write-Log "Backend is healthy"
      return $true
    }
  }
  
  Write-Log "Backend health check timeout" "WARN"
  return $false
}

# Main watchdog logic
Write-Log "Watchdog started"

# Check if backend is running
$portUp = Test-Port 5002
$healthOk = $false
$apiHealthOk = $false

if ($portUp) {
  Write-Log "Backend port is up, checking health..."
  $healthOk = Test-Health "$BASE_URL/health"
  $apiHealthOk = Test-Health "$BASE_URL/api/v2/health"
  
  if ($healthOk -and $apiHealthOk) {
    Write-Log "Backend is healthy, exiting"
    exit 0
  } else {
    Write-Log "Backend port is up but health check failed" "WARN"
  }
} else {
  Write-Log "Backend port is down"
}

# Try to start/restart backend
$retryCount = 0
$success = $false

while ($retryCount -lt $MAX_RETRIES -and -not $success) {
  $retryCount++
  
  if ($retryCount -eq 1) {
    Write-Log "Attempt $retryCount: Starting in normal mode"
    $success = Start-Backend "normal"
  } elseif ($retryCount -eq 2) {
    Write-Log "Attempt $retryCount: Starting in SAFE_MODE"
    $success = Start-Backend "safe"
  } else {
    Write-Log "Attempt $retryCount: Starting in minimal mode (all features off)"
    $success = Start-Backend "minimal"
  }
  
  if ($success) {
    Write-Log "Backend started successfully" "INFO"
    exit 0
  } else {
    Write-Log "Backend start failed, waiting before retry..." "WARN"
    Start-Sleep -Seconds 5
  }
}

Write-Log "Failed to start backend after $MAX_RETRIES attempts" "ERROR"
exit 1

