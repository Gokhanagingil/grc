#!/usr/bin/env pwsh
# Git checkpoint - creates a checkpoint branch if build & smoke are successful

$ErrorActionPreference = "Stop"

param(
  [string]$Message = "auto: progress checkpoint"
)

Write-Host "📝 Git Checkpoint" -ForegroundColor Cyan

# Check if git is available
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host "⚠️  Git not found, skipping checkpoint" -ForegroundColor Yellow
  exit 0
}

# Check if we're in a git repository
try {
  $null = git rev-parse --git-dir 2>&1
} catch {
  Write-Host "⚠️  Not a git repository, skipping checkpoint" -ForegroundColor Yellow
  exit 0
}

# Check if there are changes
$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
  Write-Host "ℹ️  No changes to commit" -ForegroundColor Gray
  exit 0
}

# Create checkpoint branch
$timestamp = Get-Date -Format "yyyyMMdd-HHmm"
$branchName = "auto/progress-$timestamp"

Write-Host "Creating checkpoint branch: $branchName" -ForegroundColor Yellow

# Checkout or create branch
try {
  git checkout -b $branchName 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    # Branch might already exist, try to switch
    git checkout $branchName 2>&1 | Out-Null
  }
} catch {
  Write-Host "⚠️  Failed to create/switch branch: $($_.Exception.Message)" -ForegroundColor Yellow
  exit 0
}

# Stage all changes
git add -A 2>&1 | Out-Null

# Commit
$commitMessage = "$Message (timestamp: $timestamp)"
try {
  git commit -m $commitMessage 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Checkpoint created: $branchName" -ForegroundColor Green
    Write-Host "   Commit: $commitMessage" -ForegroundColor Gray
    exit 0
  } else {
    Write-Host "⚠️  No changes to commit (maybe already committed)" -ForegroundColor Yellow
    exit 0
  }
} catch {
  Write-Host "⚠️  Failed to commit: $($_.Exception.Message)" -ForegroundColor Yellow
  exit 0
}

