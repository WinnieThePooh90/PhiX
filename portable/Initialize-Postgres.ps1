# Erstinitialisierung der mitgelieferten PostgreSQL-Portable-Installation
param(
    [Parameter(Mandatory = $true)]
    [string]$Root
)

$ErrorActionPreference = 'Stop'

$configPath = Join-Path $Root 'phix-config.json'
$config = @{
    pgPort     = 5432
    httpPort   = 3000
    dbName     = 'notenauswertung'
    dbUser     = 'noten_user'
    dbPassword = 'noten_password'
}
if (Test-Path $configPath) {
    $config = (Get-Content $configPath -Raw | ConvertFrom-Json)
}

$pgPort = [int]$config.pgPort
$pgBin = Join-Path $Root 'runtime\postgresql\bin'
$pgData = Join-Path $Root 'data\postgres'
$logsDir = Join-Path $Root 'logs'
$initFlag = Join-Path $pgData 'PHIX_INITIALIZED'

if (-not (Test-Path (Join-Path $pgBin 'initdb.exe'))) {
    throw "PostgreSQL runtime fehlt unter $pgBin (Release neu bauen)."
}

if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
}

if (Test-Path $initFlag) {
    return
}

Write-Host 'Erstinitialisierung der Datenbank (einmalig) ...'

if (Test-Path $pgData) {
    Remove-Item -LiteralPath $pgData -Recurse -Force
}
New-Item -ItemType Directory -Path $pgData -Force | Out-Null

$env:PATH = "$pgBin;$env:PATH"

& (Join-Path $pgBin 'initdb.exe') -D $pgData -U postgres -E UTF8 --locale=C -A trust
if ($LASTEXITCODE -ne 0) { throw 'initdb fehlgeschlagen.' }

$pgConf = Join-Path $pgData 'postgresql.conf'
(Get-Content $pgConf) + "port = $pgPort" + "listen_addresses = '127.0.0.1'" | Set-Content $pgConf

$logFile = Join-Path $logsDir 'postgresql.log'
& (Join-Path $pgBin 'pg_ctl.exe') -D $pgData -l $logFile -w start
if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL konnte nicht gestartet werden.' }

Start-Sleep -Seconds 2

$sql = @"
CREATE USER $($config.dbUser) WITH PASSWORD '$($config.dbPassword)' CREATEDB;
CREATE DATABASE $($config.dbName) OWNER $($config.dbUser);
"@
$sql | & (Join-Path $pgBin 'psql.exe') -h 127.0.0.1 -p $pgPort -U postgres -d postgres -v ON_ERROR_STOP=1
if ($LASTEXITCODE -ne 0) { throw 'Datenbank-Benutzer/DB anlegen fehlgeschlagen.' }

& (Join-Path $pgBin 'pg_ctl.exe') -D $pgData -w stop
if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL Stop nach Init fehlgeschlagen.' }

New-Item -ItemType File -Path $initFlag -Force | Out-Null
Write-Host 'Datenbank initialisiert.' -ForegroundColor Green
