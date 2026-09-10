# =============================================================================
# backend/opensearch/start.ps1
#
# PowerShell wrapper for Windows users who prefer not to use Git Bash.
#
# USAGE (from repo root in PowerShell):
#   .\backend\opensearch\start.ps1 start
#   .\backend\opensearch\start.ps1 stop
#   .\backend\opensearch\start.ps1 restart
#   .\backend\opensearch\start.ps1 status
#   .\backend\opensearch\start.ps1 health
#   .\backend\opensearch\start.ps1 logs
#   .\backend\opensearch\start.ps1 reset
#
# Requires: bash (Git Bash, WSL, or MSYS2) on PATH, plus Podman Desktop.
# =============================================================================

param(
    [Parameter(Position=0)]
    [ValidateSet("start","stop","restart","status","health","logs","reset","")]
    [string]$Command = "start"
)

$scriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$bashScript = Join-Path $scriptDir "start.sh"

if (-not (Test-Path $bashScript)) {
    Write-Error "Cannot find $bashScript"
    exit 1
}

# Resolve bash — prefer Git Bash, fall back to WSL
$bash = $null
foreach ($candidate in @("bash", "C:\Program Files\Git\bin\bash.exe", "C:\Program Files\Git\usr\bin\bash.exe")) {
    if (Get-Command $candidate -ErrorAction SilentlyContinue) {
        $bash = $candidate
        break
    }
}

if (-not $bash) {
    Write-Error "bash not found. Install Git for Windows (https://git-scm.com) and ensure it is on PATH."
    exit 1
}

# Convert Windows path to Unix-style for bash
$unixScript = $bashScript -replace '\\', '/' -replace '^([A-Za-z]):', { "/$($_.Groups[1].Value.ToLower())" }

& $bash $unixScript $Command
exit $LASTEXITCODE
