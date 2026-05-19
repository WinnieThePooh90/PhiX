# PhiX Portable – startet DB + Backend + Browser (keine separate Node-/Docker-Installation)
$ErrorActionPreference = 'Stop'

$Root = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
Set-Location $Root

$configPath = Join-Path $Root 'phix-config.json'
$config = @{
    pgPort     = 5432
    httpPort   = 3000
    dbName     = 'notenauswertung'
    dbUser     = 'noten_user'
    dbPassword = 'noten_password'
}
if (Test-Path $configPath) {
    $config = Get-Content $configPath -Raw | ConvertFrom-Json
}

$pgBin = Join-Path $Root 'runtime\postgresql\bin'
$pgData = Join-Path $Root 'data\postgres'
$nodeDir = Join-Path $Root 'runtime\node'
$backendDir = Join-Path $Root 'app\backend'
$frontendDist = Join-Path $Root 'app\frontend-dist'
$logsDir = Join-Path $Root 'logs'
$prismaCmd = Join-Path $backendDir 'node_modules\.bin\prisma.cmd'

foreach ($dir in @($pgBin, $nodeDir, $backendDir, $frontendDist)) {
    if (-not (Test-Path $dir)) {
        Write-Host "[FEHLER] Unvollstaendige Installation: $dir fehlt." -ForegroundColor Red
        Read-Host 'Enter'
        exit 1
    }
}

if (-not (Test-Path $prismaCmd)) {
    Write-Host "[FEHLER] Prisma fehlt: $prismaCmd" -ForegroundColor Red
    Write-Host 'Release neu bauen (Build-Release.bat).' -ForegroundColor Yellow
    Read-Host 'Enter'
    exit 1
}

if (-not (Test-Path $logsDir)) { New-Item -ItemType Directory -Path $logsDir -Force | Out-Null }

& (Join-Path $Root 'Initialize-Postgres.ps1') -Root $Root

$env:PATH = "$pgBin;$nodeDir;$backendDir\node_modules\.bin;$env:PATH"
$logFile = Join-Path $logsDir 'postgresql.log'

$pgRunning = $false
try {
    $null = & (Join-Path $pgBin 'pg_isready.exe') -h 127.0.0.1 -p $config.pgPort 2>$null
    if ($LASTEXITCODE -eq 0) { $pgRunning = $true }
} catch { }

if (-not $pgRunning) {
    Write-Host 'Starte PostgreSQL ...'
    & (Join-Path $pgBin 'pg_ctl.exe') -D $pgData -l $logFile start
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL Start fehlgeschlagen.' }
    Start-Sleep -Seconds 2
}

$dbUrl = "postgresql://$($config.dbUser):$($config.dbPassword)@127.0.0.1:$($config.pgPort)/$($config.dbName)?schema=public"
$backendEnv = Join-Path $backendDir '.env'
@"
DATABASE_URL="$dbUrl"
PHIX_STANDALONE=1
PORT=$($config.httpPort)
"@ | Set-Content -Path $backendEnv -Encoding UTF8

$env:DATABASE_URL = $dbUrl
$env:PHIX_STANDALONE = '1'
$env:PHIX_FRONTEND_DIST = $frontendDist
$env:PORT = [string]$config.httpPort

$url = "http://127.0.0.1:$($config.httpPort)/"
Write-Host ''
Write-Host "PhiX laeuft unter $url" -ForegroundColor Green
Write-Host 'Dieses Fenster offen lassen. Zum Beenden: Strg+C' -ForegroundColor Yellow
Write-Host ''

Start-Process $url

$nodeExe = Join-Path $nodeDir 'node.exe'
Set-Location $backendDir
& $prismaCmd db push
if ($LASTEXITCODE -ne 0) {
    Write-Host '[FEHLER] Datenbank-Schema (prisma db push) fehlgeschlagen.' -ForegroundColor Red
    Read-Host 'Enter'
    exit 1
}

$env:NODE_ENV = 'production'
& $nodeExe server.js
if ($LASTEXITCODE -ne 0) {
    Write-Host '[FEHLER] Backend konnte nicht starten.' -ForegroundColor Red
    Read-Host 'Enter'
    exit 1
}
