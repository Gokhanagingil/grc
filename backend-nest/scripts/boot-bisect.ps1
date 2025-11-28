# Boot Binary Search Script (PowerShell)
# Finds the failing module by binary search

$ErrorActionPreference = "Stop"

# Fix encoding
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:CHCP_OUT = (chcp 65001 | Out-String)

$diagDir = ".diag"
if (-not (Test-Path $diagDir)) {
  New-Item -ItemType Directory -Path $diagDir | Out-Null
}

$report = @{
  timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
  steps = @()
  failing_module = $null
  fixes_applied = @()
}

function Test-Health {
  param([string]$Url)
  try {
    $response = Invoke-WebRequest -Uri $Url -Method GET -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Start-BackendWithModules {
  param([string[]]$ModuleFlags)
  
  Write-Host "`nTesting modules: $($ModuleFlags -join ', ')" -ForegroundColor Cyan
  
  # Build environment variables
  $envVars = @{
    SAFE_MODE = "false"
  }
  
  # Set all ENABLE_* to false first
  $allModules = @(
    "POLICY", "RISK", "COMPLIANCE", "AUDIT", "ISSUE", "QUEUE", "RULES",
    "DATA_FOUNDATION", "DASHBOARD", "GOVERNANCE", "RISK_INSTANCE",
    "RISK_SCORING", "SEARCH", "ENTITY_REGISTRY", "METRICS", "BCM"
  )
  
  foreach ($mod in $allModules) {
    $envVars["ENABLE_$mod"] = "false"
  }
  
  # Enable requested modules
  foreach ($flag in $ModuleFlags) {
    $envVars["ENABLE_$flag"] = "true"
  }
  
  # Apply environment variables
  foreach ($key in $envVars.Keys) {
    [Environment]::SetEnvironmentVariable($key, $envVars[$key], "Process")
    Set-Item -Path "env:$key" -Value $envVars[$key]
  }
  
  # Kill existing processes
  Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
  
  # Start backend
  $logFile = "$diagDir/bisect-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
  $errFile = "$diagDir/bisect-$(Get-Date -Format 'yyyyMMdd-HHmmss').err"
  
  $process = Start-Process -NoNewWindow -FilePath "node" -ArgumentList "dist/main.js" -RedirectStandardOutput $logFile -RedirectStandardError $errFile -PassThru
  
  if (-not $process) {
    return @{ success = $false; error = "Failed to start process" }
  }
  
  # Wait up to 30 seconds for health
  $maxWait = 30
  $interval = 2
  $elapsed = 0
  $healthOk = $false
  
  while ($elapsed -lt $maxWait) {
    Start-Sleep -Seconds $interval
    $elapsed += $interval
    
    if ($process.HasExited) {
      $exitCode = $process.ExitCode
      $logContent = Get-Content $logFile -Tail 50 -ErrorAction SilentlyContinue
      $errContent = Get-Content $errFile -Tail 50 -ErrorAction SilentlyContinue
      
      # Check crash.log
      $crashInfo = $null
      if (Test-Path "crash.log") {
        $crashContent = Get-Content "crash.log" -Tail 200 -ErrorAction SilentlyContinue
        $crashInfo = $crashContent -join "`n"
      }
      
      return @{
        success = $false
        error = "Process exited with code $exitCode"
        exitCode = $exitCode
        log = $logContent
        err = $errContent
        crash = $crashInfo
      }
    }
    
    if (Test-Health "http://localhost:5002/health") {
      $healthOk = $true
      break
    }
  }
  
  if (-not $healthOk) {
    $process | Stop-Process -Force -ErrorAction SilentlyContinue
    return @{ success = $false; error = "Health check timeout" }
  }
  
  # Test API health
  $apiHealthOk = Test-Health "http://localhost:5002/api/v2/health"
  
  $process | Stop-Process -Force -ErrorAction SilentlyContinue
  
  return @{
    success = $true
    health = $healthOk
    apiHealth = $apiHealthOk
  }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Boot Binary Search (Bisect)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Step 1: Test SAFE mode (only HealthModule)
Write-Host "`nStep 1: Testing SAFE mode (HealthModule only)..." -ForegroundColor Yellow
$env:SAFE_MODE = "true"
$safeResult = Start-BackendWithModules @()

if (-not $safeResult.success) {
  Write-Host "ERROR: SAFE mode failed!" -ForegroundColor Red
  Write-Host "  Error: $($safeResult.error)" -ForegroundColor Red
  if ($safeResult.log) {
    Write-Host "  Log:" -ForegroundColor Yellow
    $safeResult.log | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
  }
  if ($safeResult.crash) {
    Write-Host "  Crash log:" -ForegroundColor Yellow
    $safeResult.crash -split "`n" | Select-Object -First 50 | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
  }
  
  $report.steps += @{
    step = "SAFE_MODE"
    success = $false
    error = $safeResult.error
    crash = $safeResult.crash
  }
  
  $report | ConvertTo-Json -Depth 5 | Out-File -FilePath "$diagDir/bisect-report.json" -Encoding UTF8
  exit 21  # SAFE_FAIL
}

Write-Host "OK: SAFE mode passed" -ForegroundColor Green
$report.steps += @{ step = "SAFE_MODE"; success = $true }

# Step 2: Test module groups sequentially
$moduleGroups = @(
  @{ name = "A"; flags = @("DATA_FOUNDATION", "ENTITY_REGISTRY") },
  @{ name = "B"; flags = @("GOVERNANCE", "DASHBOARD") },
  @{ name = "C"; flags = @("COMPLIANCE") },
  @{ name = "D"; flags = @("RISK", "RISK_INSTANCE", "RISK_SCORING") },
  @{ name = "E"; flags = @("RULES", "SEARCH") },
  @{ name = "F"; flags = @("POLICY") },
  @{ name = "G"; flags = @("AUDIT", "ISSUE") },
  @{ name = "H"; flags = @("METRICS") },
  @{ name = "I"; flags = @("BCM") }
)

$enabledModules = @()

foreach ($group in $moduleGroups) {
  Write-Host "`nStep $($group.name): Testing group $($group.name) ($($group.flags -join ', '))..." -ForegroundColor Yellow
  
  $testFlags = $enabledModules + $group.flags
  $result = Start-BackendWithModules $testFlags
  
  if (-not $result.success) {
    Write-Host "ERROR: Group $($group.name) failed!" -ForegroundColor Red
    Write-Host "  Error: $($result.error)" -ForegroundColor Red
    
    # Binary search within the group
    Write-Host "`n  Binary searching within group $($group.name)..." -ForegroundColor Yellow
    
    $failingModule = $null
    foreach ($flag in $group.flags) {
      Write-Host "    Testing single module: $flag..." -ForegroundColor Gray
      $singleResult = Start-BackendWithModules ($enabledModules + @($flag))
      
      if (-not $singleResult.success) {
        $failingModule = $flag
        Write-Host "    FAILED: $flag" -ForegroundColor Red
        break
      } else {
        Write-Host "    OK: $flag" -ForegroundColor Green
      }
    }
    
    if ($failingModule) {
      $report.failing_module = $failingModule
      $report.steps += @{
        step = "Group_$($group.name)"
        success = $false
        failing_module = $failingModule
        error = $result.error
        crash = $result.crash
      }
      
      # Save diagnostic files
      $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
      if ($result.crash) {
        $result.crash | Out-File -FilePath "$diagDir/bisect-crash-$timestamp.txt" -Encoding UTF8
      }
      if ($result.log) {
        $result.log | Out-File -FilePath "$diagDir/bisect-log-$timestamp.txt" -Encoding UTF8
      }
      
      # Run diagnose-routes
      Write-Host "`n  Running route diagnosis..." -ForegroundColor Yellow
      try {
        & "powershell" -ExecutionPolicy Bypass -File "./scripts/diagnose-routes.ps1" 2>&1 | Out-Null
        if (Test-Path ".diag/routes.json") {
          Copy-Item ".diag/routes.json" "$diagDir/bisect-routes-$timestamp.json" -ErrorAction SilentlyContinue
        }
      } catch {
        Write-Host "    Route diagnosis failed: $_" -ForegroundColor Yellow
      }
      
      $report | ConvertTo-Json -Depth 5 | Out-File -FilePath "$diagDir/bisect-report.json" -Encoding UTF8
      
      Write-Host "`n========================================" -ForegroundColor Red
      Write-Host "FAILING MODULE FOUND: $failingModule" -ForegroundColor Red
      Write-Host "========================================" -ForegroundColor Red
      Write-Host "Report: $diagDir/bisect-report.json" -ForegroundColor Yellow
      Write-Host "Crash log: $diagDir/bisect-crash-$timestamp.txt" -ForegroundColor Yellow
      
      exit 22  # BISECT_FAIL
    }
  } else {
    Write-Host "OK: Group $($group.name) passed" -ForegroundColor Green
    $enabledModules += $group.flags
    $report.steps += @{
      step = "Group_$($group.name)"
      success = $true
      modules = $group.flags
    }
  }
}

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "ALL MODULES PASSED!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

$report | ConvertTo-Json -Depth 5 | Out-File -FilePath "$diagDir/bisect-report.json" -Encoding UTF8
exit 0

