# live-backend-supervisor.ps1 — keep the KobeOS live backend running forever.
#
# run-live-backend.ps1 launches `node server\dist\main.js` in the foreground and
# returns when node exits (crash, OOM, or a clean stop). On the production origin
# that meant a single crash — or a reboot — left api.kobeapptz.com serving
# Cloudflare 530 with nobody restarting it. This supervisor wraps the launcher in
# a restart loop with backoff, so the API comes back on its own within seconds.
#
# It is what the boot Scheduled Task (install-live-backend-service.ps1) runs.
# Nothing here is KobeOS-specific beyond the launcher path, and it prints no
# secrets. Stop it by stopping the "KobeOS Live Backend" scheduled task.

$ErrorActionPreference = 'Continue'

$scriptDir = $PSScriptRoot
$launcher  = Join-Path $scriptDir 'run-live-backend.ps1'
$repoRoot  = Split-Path -Parent $scriptDir
$logDir    = Join-Path $repoRoot 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$superLog  = Join-Path $logDir 'kobe-backend-supervisor.log'

function Write-Sup([string]$msg) {
  $line = "{0} supervisor: {1}" -f (Get-Date -Format 's'), $msg
  Write-Host $line
  Add-Content -LiteralPath $superLog -Value $line
}

if (-not (Test-Path -LiteralPath $launcher)) {
  Write-Sup "launcher not found at $launcher — cannot start the backend"; exit 1
}

$backoff = 3
$maxBackoff = 60
while ($true) {
  Write-Sup "starting backend (run-live-backend.ps1)"
  $start = Get-Date
  try {
    & 'powershell.exe' -ExecutionPolicy Bypass -NoProfile -File $launcher
    $code = $LASTEXITCODE
  } catch {
    $code = 1
    Write-Sup "launcher threw: $($_.Exception.Message)"
  }
  $ranSeconds = [int]((Get-Date) - $start).TotalSeconds
  Write-Sup "backend exited (code=$code) after ${ranSeconds}s — restarting"

  # A backend that stayed up a while is a normal crash: reset backoff. A backend
  # that dies instantly (bad config, DB on :5433 down) is throttled so we don't
  # hot-loop while the operator fixes the underlying cause.
  if ($ranSeconds -ge 30) { $backoff = 3 } else { $backoff = [Math]::Min($backoff * 2, $maxBackoff) }
  Write-Sup "waiting ${backoff}s before restart"
  Start-Sleep -Seconds $backoff
}
