[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$RepoRoot,

  [string]$TaskName = 'KobeOS-Live-Backend',

  [int]$HealthTimeoutSeconds = 90,

  [switch]$SkipHealthCheck
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($env:OS -ne 'Windows_NT') {
  throw 'KobeOS live-backend autostart is only supported on Windows.'
}

$resolvedRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$launcher = Join-Path $resolvedRoot 'scripts\run-live-backend.ps1'
$serverBundle = Join-Path $resolvedRoot 'server\dist\main.js'
$environmentFile = Join-Path $resolvedRoot 'server\.env.production'
$node = Join-Path $env:ProgramFiles 'nodejs\node.exe'

foreach ($requiredPath in @($launcher, $serverBundle, $environmentFile, $node)) {
  if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
    throw "Required KobeOS origin file is missing: $requiredPath"
  }
}

$currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
$isAdministrator = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdministrator) {
  throw 'Administrator privileges are required to install the SYSTEM startup task. Run this script from an elevated PowerShell window or an elevated self-hosted runner service.'
}

$programDataRoot = Join-Path $env:ProgramData 'KobeOS'
$supervisorPath = Join-Path $programDataRoot 'run-live-backend-supervisor.ps1'
$supervisorLog = Join-Path $programDataRoot 'live-backend-supervisor.log'
New-Item -ItemType Directory -Force -Path $programDataRoot | Out-Null

# Keep supervision outside the repository so a checkout cleanup or update cannot
# terminate it. The launcher remains in the stable production tree and is the
# single source of truth for environment loading and API startup.
$supervisorSource = @'
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Launcher,

  [Parameter(Mandatory = $true)]
  [string]$SupervisorLog
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'

while ($true) {
  $startedAt = Get-Date
  $exitCode = 1
  try {
    & $Launcher
    if ($null -ne $LASTEXITCODE) {
      $exitCode = $LASTEXITCODE
    }
  } catch {
    $message = $_.Exception.Message -replace "[\r\n]+", ' '
    Add-Content -LiteralPath $SupervisorLog -Value ("{0:o} launcher_error={1}" -f (Get-Date), $message)
  }

  Add-Content -LiteralPath $SupervisorLog -Value ("{0:o} launcher_exit={1} runtime_seconds={2}" -f (Get-Date), $exitCode, [int]((Get-Date) - $startedAt).TotalSeconds)
  Start-Sleep -Seconds 5
}
'@

Set-Content -LiteralPath $supervisorPath -Value $supervisorSource -Encoding UTF8

function Quote-TaskArgument {
  param([Parameter(Mandatory = $true)][string]$Value)
  return '"' + $Value.Replace('"', '""') + '"'
}

$powerShell = Join-Path $PSHOME 'powershell.exe'
$taskArguments = @(
  '-NoLogo',
  '-NoProfile',
  '-NonInteractive',
  '-ExecutionPolicy', 'Bypass',
  '-File', (Quote-TaskArgument $supervisorPath),
  '-Launcher', (Quote-TaskArgument $launcher),
  '-SupervisorLog', (Quote-TaskArgument $supervisorLog)
) -join ' '

$action = New-ScheduledTaskAction `
  -Execute $powerShell `
  -Argument $taskArguments `
  -WorkingDirectory $resolvedRoot
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal `
  -UserId 'SYSTEM' `
  -LogonType ServiceAccount `
  -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -RestartCount 999 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero)

$task = New-ScheduledTask `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Description 'Keeps the KobeOS production API running on the Windows origin.'

Register-ScheduledTask -TaskName $TaskName -InputObject $task -Force | Out-Null
Write-Host "Installed automatic startup task '$TaskName' for $resolvedRoot."

function Test-LocalApi {
  try {
    $response = Invoke-WebRequest `
      -UseBasicParsing `
      -Uri 'http://127.0.0.1:3000/api/health' `
      -TimeoutSec 5
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

$taskState = (Get-ScheduledTask -TaskName $TaskName).State
$healthyBeforeStart = Test-LocalApi
if (-not $healthyBeforeStart) {
  if ($taskState -eq 'Running') {
    Stop-ScheduledTask -TaskName $TaskName
    Start-Sleep -Seconds 2
  }
  Start-ScheduledTask -TaskName $TaskName
  Write-Host "Started '$TaskName'; waiting for the local API."
} elseif ($taskState -ne 'Running') {
  Write-Host 'The API is already healthy under another process. The startup task is installed and will take ownership after the next reboot.'
} else {
  Write-Host 'The startup task is already running and the local API is healthy.'
}

if ($SkipHealthCheck) {
  exit 0
}

$deadline = (Get-Date).AddSeconds($HealthTimeoutSeconds)
do {
  if (Test-LocalApi) {
    Write-Host 'KobeOS local API is healthy on http://127.0.0.1:3000/api/health.'
    exit 0
  }
  Start-Sleep -Seconds 3
} while ((Get-Date) -lt $deadline)

Write-Host '--- supervisor log tail ---'
if (Test-Path -LiteralPath $supervisorLog) {
  Get-Content -LiteralPath $supervisorLog -Tail 30
}

$backendErrorLog = Join-Path $resolvedRoot 'logs\kobe-backend-live.err.log'
Write-Host '--- backend error log tail ---'
if (Test-Path -LiteralPath $backendErrorLog) {
  Get-Content -LiteralPath $backendErrorLog -Tail 50
}

throw "KobeOS startup task '$TaskName' was installed, but the local API did not become healthy within $HealthTimeoutSeconds seconds."

