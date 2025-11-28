Param()

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootScript = Join-Path $scriptPath "..\orchestrate.ps1"

if (-not (Test-Path $rootScript)) {
    Write-Host "ERROR: Root orchestrate.ps1 not found at $rootScript" -ForegroundColor Red
    exit 1
}

$quotedRoot = '"' + $rootScript + '"'
$arguments = @("-ExecutionPolicy", "Bypass", "-File", $quotedRoot) + $args
$proc = Start-Process -FilePath "powershell" -ArgumentList $arguments -NoNewWindow -PassThru -Wait

exit $proc.ExitCode