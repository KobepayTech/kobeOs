$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $repoRoot 'server\.env.production'

Get-Content -LiteralPath $envFile | ForEach-Object {
  $line = $_.Trim()
  if ($line -and -not $line.StartsWith('#') -and $line -match '^([^=]+)=(.*)$') {
    $name = $matches[1].Trim()
    $value = $matches[2]
    if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    Set-Item -Path ("Env:" + $name) -Value $value
  }
}

$env:NODE_ENV = 'production'
$env:PORT = '3000'
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '5433'
$env:DB_USERNAME = 'kobeos'
$env:DB_PASSWORD = 'kobeos_live'
$env:DB_DATABASE = 'kobeos'
$env:DB_SYNCHRONIZE = 'false'
$env:DB_MIGRATIONS_RUN = 'false'
$env:CORS_ORIGIN = 'https://kobeos-app.pages.dev,https://*.kobeos-app.pages.dev,https://kobeapptz.com,https://*.kobeapptz.com'
$env:TENANT_BASE_DOMAIN = 'kobeapptz.com'

$logDir = Join-Path $repoRoot 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$stdoutLog = Join-Path $logDir 'kobe-backend-live.out.log'
$stderrLog = Join-Path $logDir 'kobe-backend-live.err.log'

Set-Location $repoRoot
& 'C:\Program Files\nodejs\node.exe' 'server\dist\main.js' >> $stdoutLog 2>> $stderrLog
exit $LASTEXITCODE
