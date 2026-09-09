# =============================================================================
# backend/opensearch/setup-indexes.ps1
#
# PowerShell wrapper — creates the OpenSearch indexes.
#
# USAGE (from repo root in PowerShell):
#   .\backend\opensearch\setup-indexes.ps1
#   .\backend\opensearch\setup-indexes.ps1 --force
# =============================================================================

param(
    [switch]$Force
)

$scriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$bashScript = Join-Path $scriptDir "setup-indexes.sh"

if (-not (Test-Path $bashScript)) {
    Write-Error "Cannot find $bashScript"
    exit 1
}

$bash = $null
foreach ($candidate in @("bash", "C:\Program Files\Git\bin\bash.exe", "C:\Program Files\Git\usr\bin\bash.exe")) {
    if (Get-Command $candidate -ErrorAction SilentlyContinue) {
        $bash = $candidate
        break
    }
}

if (-not $bash) {
    Write-Error "bash not found. Install Git for Windows and ensure it is on PATH."
    exit 1
}

$unixScript = $bashScript -replace '\\', '/' -replace '^([A-Za-z]):', { "/$($_.Groups[1].Value.ToLower())" }

$args = @()
if ($Force) { $args += "--force" }

& $bash $unixScript @args
exit $LASTEXITCODE
