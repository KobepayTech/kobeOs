[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$OriginRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$resolvedOrigin = (Resolve-Path -LiteralPath $OriginRoot).Path
$envFile = Join-Path $resolvedOrigin 'server\.env.production'
if (-not (Test-Path -LiteralPath $envFile -PathType Leaf)) {
  throw "Production environment file not found: $envFile"
}

function Read-KobeEnv {
  param([Parameter(Mandatory = $true)][string]$Path)
  $values = @{}
  foreach ($raw in Get-Content -LiteralPath $Path) {
    $line = $raw.Trim()
    if (-not $line -or $line.StartsWith('#')) { continue }
    $equals = $line.IndexOf('=')
    if ($equals -lt 1) { continue }
    $name = $line.Substring(0, $equals).Trim()
    $value = $line.Substring($equals + 1).Trim()
    if ($value.Length -ge 2 -and (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    )) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    $values[$name] = $value
  }
  return $values
}

function Is-Placeholder {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) { return $true }
  return $Value -match '^(YOUR_|CHANGE_ME|CHANGE-ME|REPLACE_)'
}

$values = Read-KobeEnv -Path $envFile
$token = if ($values.ContainsKey('CLOUDFLARE_API_TOKEN')) {
  $values['CLOUDFLARE_API_TOKEN']
} elseif ($values.ContainsKey('CF_API_TOKEN')) {
  $values['CF_API_TOKEN']
} else { '' }

$accountId = if ($values.ContainsKey('CLOUDFLARE_ACCOUNT_ID')) {
  $values['CLOUDFLARE_ACCOUNT_ID']
} elseif ($values.ContainsKey('CF_ACCOUNT_ID')) {
  $values['CF_ACCOUNT_ID']
} else { '' }

if ((Is-Placeholder $token) -or (Is-Placeholder $accountId)) {
  Write-Host 'origin_pages_deploy=skipped_no_cloudflare_credentials'
  exit 0
}

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
Push-Location $repoRoot
try {
  $env:CLOUDFLARE_API_TOKEN = $token
  $env:CLOUDFLARE_ACCOUNT_ID = $accountId
  $env:VITE_API_BASE = 'https://api.kobeapptz.com/api'
  $env:VITE_TENANT_BASE_DOMAIN = 'kobeapptz.com'
  Remove-Item Env:\VITE_API_FALLBACK_BASE -ErrorAction SilentlyContinue

  & npm.cmd ci --legacy-peer-deps
  if ($LASTEXITCODE -ne 0) { throw "Frontend npm ci failed with exit code $LASTEXITCODE." }

  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw "Frontend build failed with exit code $LASTEXITCODE." }

  $headers = @{
    Authorization = "Bearer $token"
    'Content-Type' = 'application/json'
  }

  function Ensure-PagesProject {
    param(
      [Parameter(Mandatory = $true)][string]$Project,
      [Parameter(Mandatory = $true)][string]$Domain
    )

    $projectUrl = "https://api.cloudflare.com/client/v4/accounts/$accountId/pages/projects/$Project"
    try {
      Invoke-RestMethod -Uri $projectUrl -Headers $headers -Method Get | Out-Null
    } catch {
      if ($_.Exception.Response.StatusCode.value__ -ne 404) { throw }
      $projectsUrl = "https://api.cloudflare.com/client/v4/accounts/$accountId/pages/projects"
      $body = @{ name = $Project; production_branch = 'master' } | ConvertTo-Json -Compress
      $created = Invoke-RestMethod -Uri $projectsUrl -Headers $headers -Method Post -Body $body
      if (-not $created.success) { throw "Could not create Cloudflare Pages project $Project." }
    }

    $domainsUrl = "https://api.cloudflare.com/client/v4/accounts/$accountId/pages/projects/$Project/domains"
    $domains = Invoke-RestMethod -Uri $domainsUrl -Headers $headers -Method Get
    $exists = @($domains.result | Where-Object { $_.name -eq $Domain }).Count -gt 0
    if (-not $exists) {
      $body = @{ name = $Domain } | ConvertTo-Json -Compress
      $attached = Invoke-RestMethod -Uri $domainsUrl -Headers $headers -Method Post -Body $body
      if (-not $attached.success) { throw "Could not attach $Domain to $Project." }
    }
  }

  Ensure-PagesProject -Project 'kobeos-lala' -Domain 'lala.kobeapptz.com'
  Ensure-PagesProject -Project 'kobeos-jumla' -Domain 'jumla.kobeapptz.com'

  $tempRoot = Join-Path $env:TEMP 'kobeos-public-pages'
  $lalaDir = Join-Path $tempRoot 'lala'
  $jumlaDir = Join-Path $tempRoot 'jumla'
  if (Test-Path -LiteralPath $tempRoot) {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path $lalaDir, $jumlaDir | Out-Null

  Copy-Item -Path (Join-Path $repoRoot 'dist\*') -Destination $lalaDir -Recurse -Force
  Copy-Item -Path (Join-Path $repoRoot 'dist\*') -Destination $jumlaDir -Recurse -Force
  Copy-Item -LiteralPath (Join-Path $repoRoot 'deploy\lala-pages\_redirects') -Destination (Join-Path $lalaDir '_redirects') -Force
  Copy-Item -LiteralPath (Join-Path $repoRoot 'deploy\jumla-pages\_redirects') -Destination (Join-Path $jumlaDir '_redirects') -Force

  & npx.cmd --yes wrangler@4 pages deploy $lalaDir --project-name kobeos-lala --branch master
  if ($LASTEXITCODE -ne 0) { throw "Lala Pages deployment failed with exit code $LASTEXITCODE." }

  & npx.cmd --yes wrangler@4 pages deploy $jumlaDir --project-name kobeos-jumla --branch master
  if ($LASTEXITCODE -ne 0) { throw "Jumla Pages deployment failed with exit code $LASTEXITCODE." }

  Write-Host 'origin_pages_deploy=success'
} finally {
  Pop-Location
  Remove-Item Env:\CLOUDFLARE_API_TOKEN -ErrorAction SilentlyContinue
  Remove-Item Env:\CLOUDFLARE_ACCOUNT_ID -ErrorAction SilentlyContinue
  Remove-Item Env:\VITE_API_BASE -ErrorAction SilentlyContinue
  Remove-Item Env:\VITE_TENANT_BASE_DOMAIN -ErrorAction SilentlyContinue
}
