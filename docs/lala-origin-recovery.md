# Lala / KobeOS Windows origin recovery

Lala's frontend is hosted by Cloudflare Pages. The Windows origin at
`C:\KobeOS\app` serves the KobeOS API on port 3000, and the existing
`cloudflared` Windows service publishes that API at `api.kobeapptz.com`.

The API must not be started from an interactive terminal or an Actions job.
Those processes stop at logout, reboot, or when the self-hosted runner cleans up
job processes. The supported setup is the machine-level scheduled task named
`KobeOS-Live-Backend`.

## Automatic installation

The `Recover Lala Origin on Self-Hosted Runner` workflow installs or repairs the
task before checking the public endpoint. It:

1. validates the stable production tree and production environment file;
2. installs a startup task that runs as `SYSTEM`;
3. supervises `scripts\run-live-backend.ps1` and restarts it after any exit;
4. waits for `http://127.0.0.1:3000/api/health`;
5. restarts the existing Cloudflare connector only if the public API is still
   unavailable.

The supervisor and its log live under `C:\ProgramData\KobeOS`, outside the
Actions checkout, so checkout cleanup cannot remove or terminate them.

## Manual installation

If the self-hosted runner service does not have administrator rights, update the
stable checkout and run the installer once from an elevated PowerShell window:

```powershell
Set-Location C:\KobeOS\app
git pull --ff-only origin master
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\install-live-backend-autostart.ps1 `
  -RepoRoot C:\KobeOS\app
```

## Verification

```powershell
Get-ScheduledTask -TaskName KobeOS-Live-Backend |
  Select-Object TaskName, State

Invoke-WebRequest -UseBasicParsing `
  http://127.0.0.1:3000/api/health

Invoke-WebRequest -UseBasicParsing `
  https://api.kobeapptz.com/api/lala-public/health
```

If startup fails, inspect:

- `C:\ProgramData\KobeOS\live-backend-supervisor.log`
- `C:\KobeOS\app\logs\kobe-backend-live.err.log`

Do not add a port-80 requirement to this origin check. The Lala SPA is served by
Cloudflare Pages; this machine is responsible for the API on port 3000.

