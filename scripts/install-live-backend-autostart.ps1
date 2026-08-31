[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$RepoRoot,

  [string]$TaskName = 'KobeOS-Live-Backend',

  [int]$HealthTimeoutSeconds = 210,

  [switch]$SkipHealthCheck
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($env:OS -ne 'Windows_NT') {
  throw 'KobeOS live-origin autostart is only supported on Windows.'
}

$resolvedRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$helperSource = Join-Path $PSScriptRoot 'run-live-origin-supervisor.cjs'
$serverBundle = Join-Path $resolvedRoot 'server\dist\main.js'
$environmentFile = Join-Path $resolvedRoot 'server\.env.production'
$node = Join-Path $env:ProgramFiles 'nodejs\node.exe'

foreach ($requiredPath in @($helperSource, $serverBundle, $environmentFile, $node)) {
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
  # The non-administrative Actions runner cannot register a SYSTEM task or
  # write under ProgramData. This stable directory survives checkout cleanup.
  $supervisorRoot = Join-Path $resolvedRoot 'logs'
}

$supervisorPath = Join-Path $supervisorRoot 'run-live-origin-supervisor.cjs'
$supervisorHashPath = Join-Path $supervisorRoot 'run-live-origin-supervisor.sha256'
$supervisorStdout = Join-Path $supervisorRoot 'live-origin-supervisor.stdout.log'
$supervisorStderr = Join-Path $supervisorRoot 'live-origin-supervisor.stderr.log'
$stateFile = Join-Path (Join-Path $resolvedRoot 'logs') 'live-origin-supervisor.state'
New-Item -ItemType Directory -Force -Path $supervisorRoot | Out-Null

$desiredHash = (Get-FileHash -LiteralPath $helperSource -Algorithm SHA256).Hash
$installedHash = ''
if (Test-Path -LiteralPath $supervisorHashPath -PathType Leaf) {
  $installedHash = (Get-Content -LiteralPath $supervisorHashPath -Raw).Trim()
}
$supervisorChanged = $installedHash -ne $desiredHash
Copy-Item -LiteralPath $helperSource -Destination $supervisorPath -Force

function Quote-TaskArgument {
  param([Parameter(Mandatory = $true)][string]$Value)
  return '"' + $Value.Replace('"', '""') + '"'
}

$taskArguments = @(
  (Quote-TaskArgument $supervisorPath),
  '--repo-root',
  (Quote-TaskArgument $resolvedRoot)
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

function Get-RunnerSupervisors {
  return @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object {
      $_.CommandLine -and
      $_.CommandLine.IndexOf($supervisorPath, [StringComparison]::OrdinalIgnoreCase) -ge 0
    })
}

function Stop-ProcessSet {
  param([object[]]$Processes)
  foreach ($item in $Processes) {
    if ($item.ProcessId -and $item.ProcessId -ne $PID) {
      Stop-Process -Id $item.ProcessId -Force -ErrorAction SilentlyContinue
    }
  }
}

function Stop-LegacyUnhealthyOrigin {
  # Retire only the superseded KobeOS supervisors and backend processes. This
  # runs solely while the API is unhealthy, before the full-stack supervisor
  # takes ownership.
  $legacySupervisors = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
    Where-Object {
      $_.CommandLine -and
      ($_.CommandLine -match 'run-live-backend-supervisor\.ps1')
    })
  Stop-ProcessSet -Processes $legacySupervisors
  Start-Sleep -Seconds 2

  $legacyBackends = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object {
      $_.CommandLine -and
      $_.CommandLine -match 'server[\\/]dist[\\/]main\.js'
    })
  Stop-ProcessSet -Processes $legacyBackends
}

$healthyBeforeStart = Test-LocalApi

if ($isAdministrator) {
  $action = New-ScheduledTaskAction `
    -Execute $node `
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
    -Description 'Keeps KobeOS embedded PostgreSQL and the production API running on the Windows origin.'

  Register-ScheduledTask -TaskName $TaskName -InputObject $task -Force | Out-Null
  Write-Host "Installed automatic full-origin startup task '$TaskName' for $resolvedRoot."

  $taskState = (Get-ScheduledTask -TaskName $TaskName).State
  if ($supervisorChanged -or $taskState -ne 'Running' -or -not $healthyBeforeStart) {
    if ($taskState -eq 'Running') {
      Stop-ScheduledTask -TaskName $TaskName
      Start-Sleep -Seconds 2
    }
    if (-not $healthyBeforeStart) {
      Stop-LegacyUnhealthyOrigin
    }
    Start-ScheduledTask -TaskName $TaskName
    Write-Host "Started '$TaskName'; waiting for PostgreSQL and the local API."
  } else {
    Write-Host 'The full-origin startup task is running and the local API is healthy.'
  }
} else {
  $machineTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if ($machineTask -and $machineTask.State -eq 'Running') {
    Write-Host "Machine-level KobeOS startup task '$TaskName' is already running; no runner fallback is needed."
  } elseif ($healthyBeforeStart) {
    Write-Host 'The local API is healthy; no duplicate runner supervisor is needed.'
  } else {
    $existingSupervisors = Get-RunnerSupervisors
    if ($supervisorChanged -and $existingSupervisors.Count -gt 0) {
      Write-Host 'Updating the runner-managed KobeOS full-origin supervisor.'
      Stop-ProcessSet -Processes $existingSupervisors
      Start-Sleep -Seconds 3
      $existingSupervisors = Get-RunnerSupervisors
    }

    if ($existingSupervisors.Count -eq 0) {
      if (-not (Test-LocalApi)) {
        Stop-LegacyUnhealthyOrigin
      }

      # GitHub Actions kills child processes carrying RUNNER_TRACKING_ID after a
      # job. Remove only that marker from this explicit long-running supervisor.
      $hadTrackingId = Test-Path Env:\RUNNER_TRACKING_ID
      $savedTrackingId = $env:RUNNER_TRACKING_ID
      Remove-Item Env:\RUNNER_TRACKING_ID -ErrorAction SilentlyContinue
      try {
        $process = Start-Process `
          -FilePath $node `
          -ArgumentList $taskArguments `
          -WorkingDirectory $resolvedRoot `
          -WindowStyle Hidden `
          -RedirectStandardOutput $supervisorStdout `
          -RedirectStandardError $supervisorStderr `
          -PassThru
        Write-Host "Started runner-managed KobeOS full-origin supervisor pid=$($process.Id)."
      } finally {
        if ($hadTrackingId) {
          $env:RUNNER_TRACKING_ID = $savedTrackingId
        } else {
          Remove-Item Env:\RUNNER_TRACKING_ID -ErrorAction SilentlyContinue
        }
      }
    } else {
      Write-Host "A runner-managed KobeOS full-origin supervisor is active (pid=$($existingSupervisors[0].ProcessId))."
    }
  }
}

Set-Content -LiteralPath $supervisorHashPath -Value $desiredHash -Encoding ASCII

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

# Emit only fixed classifications and counts. Production logs and command lines
# can contain secrets or business data and must never be uploaded to Actions.
if (Test-Path -LiteralPath $stateFile -PathType Leaf) {
  $state = (Get-Content -LiteralPath $stateFile -TotalCount 1).Trim()
  if ($state -match '^[a-z0-9_]+$') {
    Write-Host "origin_supervisor_state=$state"
  } else {
    Write-Host 'origin_supervisor_state=invalid'
  }
} else {
  Write-Host 'origin_supervisor_state=missing'
}

& $node $supervisorPath --repo-root $resolvedRoot --diagnose

foreach ($port in 3000, 5433) {
  $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
  Write-Host "port_${port}_listener_count=$($listeners.Count)"
}

$originProcesses = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object {
    $_.Name -in @('node.exe', 'postgres.exe') -and
    $_.CommandLine -and
    ($_.CommandLine -match 'KobeOS|kobeos|server[\\/]dist[\\/]main|run-live-origin-supervisor')
  })
Write-Host "origin_process_count=$($originProcesses.Count)"
Write-Host "origin_node_count=$(@($originProcesses | Where-Object { $_.Name -eq 'node.exe' }).Count)"
Write-Host "origin_postgres_count=$(@($originProcesses | Where-Object { $_.Name -eq 'postgres.exe' }).Count)"

if ($isAdministrator) {
  throw "KobeOS startup task '$TaskName' was installed, but the local API did not become healthy within $HealthTimeoutSeconds seconds."
}
throw "The runner-managed KobeOS full-origin supervisor started, but the local API did not become healthy within $HealthTimeoutSeconds seconds."

