# Check and optionally kill processes using port 5002
# Usage:
#   .\check-port-5002.ps1              # Just check
#   .\check-port-5002.ps1 -Kill         # Check and kill if found
#   .\check-port-5002.ps1 -Port 5002    # Check different port

param(
    [int]$Port = 5002,
    [switch]$Kill
)

Write-Host "🔍 Checking for processes using port $Port..." -ForegroundColor Cyan

# Find processes using the port
$connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue

if (-not $connections) {
    Write-Host "✅ No processes found using port $Port" -ForegroundColor Green
    exit 0
}

# Get unique PIDs
$pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique

Write-Host "⚠️  Found $($pids.Count) process(es) using port $Port:" -ForegroundColor Yellow

foreach ($pid in $pids) {
    try {
        $process = Get-Process -Id $pid -ErrorAction Stop
        Write-Host "   PID: $pid - $($process.ProcessName) - $($process.Path)" -ForegroundColor Yellow
        
        if ($Kill) {
            Write-Host "   🗑️  Killing process $pid..." -ForegroundColor Red
            Stop-Process -Id $pid -Force -ErrorAction Stop
            Write-Host "   ✅ Process $pid terminated" -ForegroundColor Green
        }
    } catch {
        Write-Host "   ⚠️  Could not get info for PID $pid: $_" -ForegroundColor Yellow
    }
}

if ($Kill) {
    Write-Host "✅ All processes on port $Port have been terminated" -ForegroundColor Green
    exit 0
} else {
    Write-Host "" -ForegroundColor Yellow
    Write-Host "💡 To kill these processes, run:" -ForegroundColor Cyan
    Write-Host "   .\check-port-5002.ps1 -Kill" -ForegroundColor White
    exit 1
}

