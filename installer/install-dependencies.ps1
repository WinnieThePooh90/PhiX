# npm install fuer Backend und Frontend (wird vom Installer aufgerufen)
param(
    [Parameter(Mandatory = $true)]
    [string]$InstallRoot
)

$ErrorActionPreference = 'Stop'
Set-Location $InstallRoot

function Write-Step([string]$Message) {
    Write-Host "  $Message"
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js ist nicht installiert oder nicht im PATH."
}

$nodeMajor = [int](node -p "process.versions.node.split('.')[0]")
if ($nodeMajor -lt 20) {
    Write-Warning "Node.js 20 oder neuer wird empfohlen (gefunden: v$(node -p 'process.version'))."
}

if (-not (Test-Path (Join-Path $InstallRoot '.env')) -and (Test-Path (Join-Path $InstallRoot '.env.example'))) {
    Copy-Item (Join-Path $InstallRoot '.env.example') (Join-Path $InstallRoot '.env')
}

$backendEnv = Join-Path $InstallRoot 'backend\.env'
$backendEnvExample = Join-Path $InstallRoot 'backend\.env.example'
if (-not (Test-Path $backendEnv) -and (Test-Path $backendEnvExample)) {
    Copy-Item $backendEnvExample $backendEnv
}

Write-Step 'Backend: npm install ...'
Set-Location (Join-Path $InstallRoot 'backend')
& npm install --no-fund --no-audit
if ($LASTEXITCODE -ne 0) { throw "npm install (Backend) fehlgeschlagen." }

Write-Step 'Backend: Prisma Client generieren ...'
& npx prisma generate
if ($LASTEXITCODE -ne 0) { throw "prisma generate fehlgeschlagen." }

Write-Step 'Frontend: npm install ...'
Set-Location (Join-Path $InstallRoot 'Notenauswertung-App')
& npm install --no-fund --no-audit
if ($LASTEXITCODE -ne 0) { throw "npm install (Frontend) fehlgeschlagen." }

Set-Location $InstallRoot
Write-Host 'Abhaengigkeiten installiert.' -ForegroundColor Green
