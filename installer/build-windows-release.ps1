# Baut PhiX-Windows-x64.zip – eine Datei zum Verteilen (Node + PostgreSQL + App, lauffertig)
# Auf Windows ausfuehren (Internet fuer Download der Runtimes noetig).
param(
    [string]$OutputDir = '',
    [string]$NodeVersion = '22.16.0',
    [string]$PostgresVersion = '16.14-1',
    [string]$PostgresZipPath = ''
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'download-runtimes.ps1')

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ReleaseName = 'PhiX-Windows-x64'
# Staging in TEMP: vermeidet Dropbox-Sperren bei Move-Item auf viele kleine Dateien (node_modules).
$Staging = if ($OutputDir) {
    Join-Path $OutputDir $ReleaseName
} else {
    Join-Path $env:TEMP $ReleaseName
}
$Cache = Join-Path $ProjectRoot 'release\_cache'
$ZipPath = if ($OutputDir) { Join-Path $OutputDir "$ReleaseName.zip" } else { Join-Path $ProjectRoot "release\$ReleaseName.zip" }

function Write-Step([string]$Msg) {
    Write-Host "`n==> $Msg" -ForegroundColor Cyan
}

function Use-BundledNode([string]$StagingRoot) {
    $nodeDir = Join-Path $StagingRoot 'runtime\node'
    $nodeExe = Join-Path $nodeDir 'node.exe'
    $npmCmd = Join-Path $nodeDir 'npm.cmd'
    if (-not (Test-Path $nodeExe)) {
        throw "node.exe fehlt: $nodeExe (Runtimes entpacken fehlgeschlagen?)"
    }
    $env:Path = $nodeDir + ';' + $env:Path
    Write-Host "  Node: $(& $nodeExe -v)"
    return @{ NodeDir = $nodeDir; Npm = $npmCmd }
}

Write-Step 'Vorbereitung'
if (-not $OutputDir) {
    Write-Host "  Staging (temporaer): $Staging"
}
Remove-DirRetry $Staging
Ensure-Dir $Staging
Ensure-Dir $Cache

$nodeZip = Join-Path $Cache "node-v$NodeVersion-win-x64.zip"
$pgZip = Join-Path $Cache "postgresql-$PostgresVersion-windows-x64-binaries.zip"

Write-Step 'Runtimes laden'
Download-NodeWinZip -NodeVersion $NodeVersion -Dest $nodeZip
Download-PostgresWinZip -PostgresVersion $PostgresVersion -Dest $pgZip -PostgresZipPath $PostgresZipPath

Write-Step 'Runtimes entpacken'
Ensure-Dir (Join-Path $Staging 'runtime')
Expand-ZipContentsTo -ZipPath $nodeZip -DestDir (Join-Path $Staging 'runtime\node')

$pgTemp = Join-Path $env:TEMP ("phix-pg-" + [guid]::NewGuid().ToString('n').Substring(0, 8))
try {
    Ensure-Dir $pgTemp
    Expand-Archive -LiteralPath $pgZip -DestinationPath $pgTemp -Force
    $pgSrc = Join-Path $pgTemp 'pgsql'
    if (-not (Test-Path $pgSrc)) {
        $pgSrc = (Get-ChildItem -LiteralPath $pgTemp -Directory | Select-Object -First 1).FullName
    }
    Copy-TreeRobust $pgSrc (Join-Path $Staging 'runtime\postgresql')
} finally {
    Remove-DirRetry $pgTemp
}

Write-Step 'Frontend bauen'
$nodeTools = Use-BundledNode $Staging
$frontend = Join-Path $ProjectRoot 'Notenauswertung-App'
Push-Location $frontend
Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
Write-Host '  npm ci (Frontend) ...'
& $nodeTools.Npm ci
if ($LASTEXITCODE -ne 0) {
    Write-Host '  Lock-Datei veraltet – npm install synchronisiert package-lock.json ...' -ForegroundColor Yellow
    & $nodeTools.Npm install --no-fund --no-audit
    if ($LASTEXITCODE -ne 0) { throw 'npm install (Frontend) fehlgeschlagen.' }
}
if (-not (Test-Path 'node_modules\react-router-dom')) {
    throw 'Frontend-Abhaengigkeiten unvollstaendig (react-router-dom fehlt).'
}
& $nodeTools.Npm run build
if ($LASTEXITCODE -ne 0) { throw 'npm run build (Frontend) fehlgeschlagen.' }
Pop-Location
Ensure-Dir (Join-Path $Staging 'app\frontend-dist')
Copy-Item -Path (Join-Path $frontend 'dist\*') -Destination (Join-Path $Staging 'app\frontend-dist') -Recurse -Force

Write-Step 'Backend vorbereiten'
$backendStaging = Join-Path $Staging 'app\backend'
Ensure-Dir $backendStaging
$backendSrc = Join-Path $ProjectRoot 'backend'
$backendExclude = @('node_modules', '.env')
Get-ChildItem -LiteralPath $backendSrc -Force | Where-Object { $backendExclude -notcontains $_.Name } | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $backendStaging $_.Name) -Recurse -Force
}
Push-Location $backendStaging
$null = Use-BundledNode $Staging
$prevNodeEnv = $env:NODE_ENV
Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
Write-Host '  npm ci (Backend) ...'
& $nodeTools.Npm ci
if ($LASTEXITCODE -ne 0) {
    Write-Host '  Lock-Datei veraltet – npm install synchronisiert package-lock.json ...' -ForegroundColor Yellow
    & $nodeTools.Npm install --no-fund --no-audit
    if ($LASTEXITCODE -ne 0) { throw 'npm install (Backend) fehlgeschlagen.' }
}
if ($null -ne $prevNodeEnv) { $env:NODE_ENV = $prevNodeEnv } else { Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue }

$dotenvDir = Join-Path $backendStaging 'node_modules\dotenv'
$prismaBin = Join-Path $backendStaging 'node_modules\.bin\prisma.cmd'
if (-not (Test-Path $dotenvDir)) { throw "Release unvollstaendig: dotenv fehlt in $dotenvDir" }
if (-not (Test-Path $prismaBin)) { throw "Release unvollstaendig: prisma fehlt in $prismaBin" }

& $prismaBin generate
if ($LASTEXITCODE -ne 0) { throw 'prisma generate fehlgeschlagen.' }
Pop-Location

Write-Step 'Portable Starter kopieren'
Copy-Item (Join-Path $ProjectRoot 'portable\Start-PhiX.ps1') $Staging -Force
Copy-Item (Join-Path $ProjectRoot 'portable\Initialize-Postgres.ps1') $Staging -Force
Copy-Item (Join-Path $ProjectRoot 'portable\PhiX.cmd') $Staging -Force
Copy-Item (Join-Path $ProjectRoot 'portable\phix-config.json') $Staging -Force

Write-Step 'ZIP erstellen'
Ensure-Dir (Split-Path $ZipPath -Parent)
if (Test-Path $ZipPath) { Remove-Item -LiteralPath $ZipPath -Force }
$zipTemp = Join-Path $env:TEMP "$ReleaseName.zip"
if (Test-Path $zipTemp) { Remove-Item -LiteralPath $zipTemp -Force }
Compress-Archive -Path $Staging -DestinationPath $zipTemp -CompressionLevel Optimal
Copy-Item -LiteralPath $zipTemp -Destination $ZipPath -Force
Remove-Item -LiteralPath $zipTemp -Force -ErrorAction SilentlyContinue
if (-not $OutputDir) {
    Remove-DirRetry $Staging
}

$sizeMb = [math]::Round((Get-Item $ZipPath).Length / 1MB, 1)
Write-Host ''
Write-Host "Fertig: $ZipPath ($sizeMb MB)" -ForegroundColor Green
Write-Host ''
Write-Host 'Verteilung an Endanwender:'
Write-Host '  1. ZIP entpacken'
Write-Host '  2. PhiX.cmd doppelklicken'
Write-Host ''
Write-Host 'Optional Setup.exe: installer\PhiX-Portable.iss mit Inno Setup kompilieren'
