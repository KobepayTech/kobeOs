# install-live-backend-service.ps1 — make the KobeOS live backend start on boot
# and restart on crash, so api.kobeapptz.com stops going 530 when the box
# reboots or the API dies.
#
# RUN ONCE on the production origin box, in an ELEVATED PowerShell, from the app
# root (C:\kobeos\app):
#
#   powershell -ExecutionPolicy Bypass -File .\scripts\install-live-backend-service.ps1
#
# It registers a Scheduled Task "KobeOS Live Backend" that runs the supervisor
# (which keeps `node server\dist\main.js` alive) as SYSTEM, at every boot, with
# no run-time limit and Windows' own restart-on-failure as a backstop. It then
# starts the task immediately. Re-running it is safe (it re-registers).
#
# Prerequisite: the local Postgres the backend expects (127.0.0.1:5433, per
# run-live-backend.ps1) must also be running/auto-start — the supervisor will
# retry until it is, but the API can't serve without its database.

$ErrorActionPreference = 'Stop'

$taskName   = 'KobeOS Live Backend'
$scriptDir  = $PSScriptRoot
$supervisor = Join-Path $scriptDir 'live-backend-supervisor.ps1'

if (-not (Test-Path -LiteralPath $supervisor)) {
  throw "Supervisor not found at $supervisor — run this from the app's scripts folder."
}

Write-Host "Registering scheduled task '$taskName' to run: $supervisor"

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File `"$supervisor`""

$trigger = New-ScheduledTaskTrigger -AtStartup

# SYSTEM so it needs no logged-in user and no stored password. If the backend
# needs a specific user profile, swap to: -User '<DOMAIN\user>' -LogonType Password.
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit (New-TimeSpan -Seconds 0) `
  -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
  -Principal $principal -Settings $settings -Force | Out-Null

Write-Host "Registered. Starting it now..."
Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 8

$state = (Get-ScheduledTask -TaskName $taskName).State
Write-Host "Task state: $state"
try {
  $h = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3000/api/health' -TimeoutSec 20
  Write-Host "Local API health: HTTP $($h.StatusCode) — backend is up."
} catch {
  Write-Host "Local API not answering yet on :3000. Give it up to a minute (build/DB warmup),"
  Write-Host "then check logs\kobe-backend-live.err.log and logs\kobe-backend-supervisor.log."
}
Write-Host ""
Write-Host "Done. The backend now starts on boot and restarts on crash."
Write-Host "Manage it with: Get-ScheduledTask '$taskName' | Get-ScheduledTaskInfo"
