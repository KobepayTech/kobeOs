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

if ($isAdministrator) {
  $supervisorRoot = Join-Path $env:ProgramData 'KobeOS'
} else {
  # A non-administrative Actions runner cannot register a SYSTEM task or write
  # beneath ProgramData. Keep the supervisor in the stable production tree;
  # unlike GITHUB_WORKSPACE this directory survives checkout cleanup.
  $supervisorRoot = Join-Path $resolvedRoot 'logs'
}

$supervisorPath = Join-Path $supervisorRoot 'run-live-backend-supervisor.ps1'
$supervisorLog = Join-Path $supervisorRoot 'live-backend-supervisor.log'
New-Item -ItemType Directory -Force -Path $supervisorRoot | Out-Null

# Keep supervision outside the ephemeral Actions checkout so job cleanup cannot
# remove it. The launcher remains in the stable production tree and is the
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

$healthyBeforeStart = Test-LocalApi

if ($isAdministrator) {
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

  $taskState = (Get-ScheduledTask -TaskName $TaskName).State
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
} elseif (-not $healthyBeforeStart) {
  # GitHub Actions normally kills child processes after each job by finding the
  # RUNNER_TRACKING_ID marker in their environment. Remove only that marker for
  # this explicit origin supervisor so it survives job cleanup. The scheduled
  # self-heal starts it again after a reboot, and this loop restarts Node after
  # any application exit.
  $existingSupervisor = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine.Contains($supervisorPath) })

  if ($existingSupervisor.Count -eq 0) {
    $hadTrackingId = Test-Path Env:\RUNNER_TRACKING_ID
    $savedTrackingId = $env:RUNNER_TRACKING_ID
    Remove-Item Env:\RUNNER_TRACKING_ID -ErrorAction SilentlyContinue
    try {
      $process = Start-Process `
        -FilePath $powerShell `
        -ArgumentList $taskArguments `
        -WorkingDirectory $resolvedRoot `
        -WindowStyle Hidden `
        -PassThru
      Write-Host "Started runner-managed KobeOS supervisor pid=$($process.Id)."
    } finally {
      if ($hadTrackingId) {
        $env:RUNNER_TRACKING_ID = $savedTrackingId
      } else {
        Remove-Item Env:\RUNNER_TRACKING_ID -ErrorAction SilentlyContinue
      }
    }
  } else {
    Write-Host "A runner-managed KobeOS supervisor is already active (pid=$($existingSupervisor[0].ProcessId))."
  }
} else {
  Write-Host 'The local API is healthy; the scheduled self-heal will restart it automatically if it stops.'
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

$backendErrorLog = Join-Path $resolvedRoot 'logs\kobe-backend-live.err.log'
$backendOutputLog = Join-Path $resolvedRoot 'logs\kobe-backend-live.out.log'

# Classify failures locally without publishing production logs or command lines
# to GitHub. The logs can contain configuration values or application data, so
# only a fixed non-sensitive reason code leaves the origin.
$diagnosticText = ''
foreach ($diagnosticLog in @($supervisorLog, $backendErrorLog, $backendOutputLog)) {
  if (Test-Path -LiteralPath $diagnosticLog) {
    $fileInfo = Get-Item -LiteralPath $diagnosticLog
    Write-Host "diagnostic_file=$($fileInfo.Name) bytes=$($fileInfo.Length)"
    $diagnosticText += [Environment]::NewLine + (Get-Content -Raw -LiteralPath $diagnosticLog -ErrorAction SilentlyContinue)
  }
}

$failureReason = 'unclassified'
if ($diagnosticText -match 'ECONNREFUSED|connection refused|could not connect') {
  $failureReason = 'database_connection_refused'
} elseif ($diagnosticText -match 'password authentication failed|authentication failed for user') {
  $failureReason = 'database_authentication_failed'
} elseif ($diagnosticText -match 'EADDRINUSE|address already in use') {
  $failureReason = 'api_port_in_use'
} elseif ($diagnosticText -match 'MODULE_NOT_FOUND|Cannot find module') {
  $failureReason = 'missing_node_module'
} elseif ($diagnosticText -match 'ENOENT|cannot find the path|not recognized as the name') {
  $failureReason = 'missing_runtime_file'
} elseif ($diagnosticText -match 'migration') {
  $failureReason = 'database_migration_failed'
}
Write-Host "origin_startup_failure=$failureReason"

Write-Host '--- origin dependency state ---'
foreach ($port in 3000, 5433) {
  $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
  Write-Host "port_${port}_listener_count=$($listeners.Count)"
  $listeners | ForEach-Object { Write-Host "port_${port}_pid=$($_.OwningProcess)" }
}
Get-Service -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -match 'postgres' -or $_.DisplayName -match 'postgres' } |
  ForEach-Object { Write-Host "postgres_service=$($_.Name) status=$($_.Status) startType=$($_.StartType)" }
$originProcesses = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object {
    $_.Name -in @('node.exe', 'powershell.exe') -and
    $_.CommandLine -and
    ($_.CommandLine -match 'KobeOS|kobeos|server\\dist\\main|live-backend-supervisor')
  })
Write-Host "origin_process_count=$($originProcesses.Count)"
Write-Host "origin_node_count=$(@($originProcesses | Where-Object { $_.Name -eq 'node.exe' }).Count)"
Write-Host "origin_supervisor_count=$(@($originProcesses | Where-Object { $_.Name -eq 'powershell.exe' }).Count)"

if ($isAdministrator) {
  throw "KobeOS startup task '$TaskName' was installed, but the local API did not become healthy within $HealthTimeoutSeconds seconds."
}
throw "The runner-managed KobeOS supervisor started, but the local API did not become healthy within $HealthTimeoutSeconds seconds."

