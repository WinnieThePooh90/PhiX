# PhiX – Windows-Installer (Dateien kopieren, npm, Verknuepfungen)
#Requires -Version 5.1
param(
    [string]$InstallDir,
    [ValidateSet('Docker', 'Native', 'Ask')]
    [string]$RunMode = 'Ask',
    [switch]$Silent
)

$ErrorActionPreference = 'Stop'
$AppName = 'PhiX'
$AppVersion = '1.0.0'

$SourceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$DefaultInstall = Join-Path $env:LOCALAPPDATA "Programs\$AppName"

$ExcludeDirNames = @('node_modules', '.git', '.cursor', 'dist', '.vite', '.vite_new')
$ExcludeFileNames = @('.env')

function Write-Title([string]$Text) {
    Write-Host ''
    Write-Host '===================================================' -ForegroundColor Cyan
    Write-Host "    $Text" -ForegroundColor Cyan
    Write-Host '===================================================' -ForegroundColor Cyan
    Write-Host ''
}

function Test-Command([string]$Name) {
    $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Copy-AppFiles([string]$From, [string]$To) {
    if (-not (Test-Path $To)) {
        New-Item -ItemType Directory -Path $To -Force | Out-Null
    }

    if (Get-Command robocopy -ErrorAction SilentlyContinue) {
        $args = @($From, $To, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/nc', '/ns', '/np')
        foreach ($dir in $ExcludeDirNames) { $args += '/XD'; $args += $dir }
        foreach ($file in $ExcludeFileNames) { $args += '/XF'; $args += $file }
        & robocopy @args | Out-Null
        $rc = $LASTEXITCODE
        if ($rc -ge 8) { throw "robocopy fehlgeschlagen (Code $rc)." }
        return
    }

    Write-Host 'robocopy nicht gefunden – kopiere mit PowerShell (kann laenger dauern) ...'
    function Copy-Tree([string]$Src, [string]$Dst) {
        if (-not (Test-Path $Dst)) { New-Item -ItemType Directory -Path $Dst -Force | Out-Null }
        Get-ChildItem -LiteralPath $Src -Force | ForEach-Object {
            if ($ExcludeDirNames -contains $_.Name) { return }
            if (-not $_.PSIsContainer -and $ExcludeFileNames -contains $_.Name) { return }
            $target = Join-Path $Dst $_.Name
            if ($_.PSIsContainer) { Copy-Tree $_.FullName $target } else { Copy-Item -LiteralPath $_.FullName -Destination $target -Force }
        }
    }
    Copy-Tree -Src $From -Dst $To
}

Write-Title "$AppName – Installation"

if (-not $Silent) {
    Write-Host "Quellordner: $SourceRoot"
    Write-Host "Standard-Ziel: $DefaultInstall"
    Write-Host ''
}

if ([string]::IsNullOrWhiteSpace($InstallDir)) {
    if (-not $Silent) {
        try {
            Add-Type -AssemblyName System.Windows.Forms | Out-Null
            $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
            $dialog.Description = "Ordner fuer die $AppName-Installation waehlen"
            $dialog.SelectedPath = (Join-Path $env:LOCALAPPDATA 'Programs')
            if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
                $InstallDir = Join-Path $dialog.SelectedPath $AppName
            }
        } catch {
            # Fallback ohne GUI
        }
    }
    if ([string]::IsNullOrWhiteSpace($InstallDir)) {
        $input = Read-Host "Installationsordner [$DefaultInstall]"
        $InstallDir = if ([string]::IsNullOrWhiteSpace($input)) { $DefaultInstall } else { $input }
    }
}

$InstallDir = [System.IO.Path]::GetFullPath($InstallDir)

if (-not (Test-Command node)) {
    Write-Host ''
    Write-Host '[FEHLER] Node.js ist nicht installiert.' -ForegroundColor Red
    Write-Host 'Bitte LTS von https://nodejs.org/ installieren, PC neu starten (oder PATH aktualisieren),'
    Write-Host 'danach den Installer erneut ausfuehren.'
    Write-Host ''
    if (-not $Silent) {
        $open = Read-Host 'Download-Seite im Browser oeffnen? (j/N)'
        if ($open -match '^[jJyY]') { Start-Process 'https://nodejs.org/' }
        Read-Host 'Enter zum Beenden'
    }
    exit 1
}

$hasDocker = Test-Command docker
if ($RunMode -eq 'Ask' -and -not $Silent) {
    Write-Host ''
    Write-Host 'Startmodus nach der Installation:'
    Write-Host '  [1] Docker (empfohlen, wenn Docker Desktop installiert ist) – http://localhost:1990'
    Write-Host '  [2] Nativ (Node + Datenbank in Docker oder lokal) – http://localhost:5173'
    if ($hasDocker) {
        $choice = Read-Host 'Auswahl [1]'
        $RunMode = if ($choice -eq '2') { 'Native' } else { 'Docker' }
    } else {
        Write-Host '  (Docker nicht gefunden – Modus 2 wird verwendet.)' -ForegroundColor Yellow
        $RunMode = 'Native'
    }
} elseif ($RunMode -eq 'Ask') {
    $RunMode = if ($hasDocker) { 'Docker' } else { 'Native' }
}

if ($RunMode -eq 'Docker' -and -not $hasDocker) {
    Write-Warning 'Docker nicht gefunden. Es wird der native Modus verwendet.'
    $RunMode = 'Native'
}

Write-Host ''
Write-Host "Installiere nach: $InstallDir" -ForegroundColor Yellow
Write-Host ''

if (Test-Path $InstallDir) {
    if (-not $Silent) {
        $overwrite = Read-Host 'Ordner existiert bereits. Aktualisieren? (j/N)'
        if ($overwrite -notmatch '^[jJyY]') {
            Write-Host 'Abgebrochen.'
            exit 0
        }
    }
} else {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

Write-Host '[1/4] Programmdateien kopieren ...'
Copy-AppFiles -From $SourceRoot -To $InstallDir

$flagDocker = Join-Path $InstallDir 'USE_DOCKER.flag'
$flagNative = Join-Path $InstallDir 'USE_NATIVE.flag'
Remove-Item $flagDocker, $flagNative -ErrorAction SilentlyContinue
if ($RunMode -eq 'Docker') {
    New-Item -ItemType File -Path $flagDocker -Force | Out-Null
} else {
    New-Item -ItemType File -Path $flagNative -Force | Out-Null
}

Write-Host '[2/4] Abhaengigkeiten (npm) installieren ...'
& (Join-Path $PSScriptRoot 'install-dependencies.ps1') -InstallRoot $InstallDir

Write-Host '[3/4] Verknuepfungen erstellen ...'
& (Join-Path $PSScriptRoot 'create-shortcuts.ps1') -InstallRoot $InstallDir -AppName $AppName

Write-Host '[4/4] Deinstaller registrieren ...'
& (Join-Path $PSScriptRoot 'post-install.ps1') -InstallRoot $InstallDir -AppName $AppName -AppVersion $AppVersion

Write-Host ''
Write-Title 'Installation abgeschlossen'
Write-Host "Installationsordner: $InstallDir"
Write-Host "Desktop-Verknuepfung: $AppName"
Write-Host ''
if ($RunMode -eq 'Docker') {
    Write-Host 'Start: Doppelklick auf die Desktop-Verknuepfung (Docker Compose).'
} else {
    Write-Host 'Start: Doppelklick auf die Desktop-Verknuepfung.'
    Write-Host 'Hinweis: PostgreSQL noetig – start_db_docker.bat oder lokale DB.'
}
Write-Host ''

if (-not $Silent) {
    $launch = Read-Host 'PhiX jetzt starten? (j/N)'
    if ($launch -match '^[jJyY]') {
        Start-Process -FilePath (Join-Path $InstallDir 'PhiX-start.bat') -WorkingDirectory $InstallDir
    }
    Read-Host 'Enter zum Beenden'
}
