# Deinstallation von PhiX (Windows)
param(
    [string]$InstallRoot,
    [switch]$ShortcutsOnly
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($InstallRoot)) {
    $InstallRoot = $env:PHIX_INSTALL_DIR
}
if ([string]::IsNullOrWhiteSpace($InstallRoot)) {
    $default = Join-Path $env:LOCALAPPDATA 'Programs\PhiX'
    $input = Read-Host "Installationsordner [$default]"
    $InstallRoot = if ([string]::IsNullOrWhiteSpace($input)) { $default } else { $input }
}

$InstallRoot = $InstallRoot.TrimEnd('\')

if (-not $ShortcutsOnly) {
    if (-not (Test-Path $InstallRoot)) {
        Write-Host "Ordner nicht gefunden: $InstallRoot" -ForegroundColor Yellow
    } else {
        $confirm = Read-Host "PhiX wirklich aus '$InstallRoot' entfernen? (j/N)"
        if ($confirm -notmatch '^[jJyY]') {
            Write-Host 'Abgebrochen.'
            exit 0
        }
    }
}

$appName = 'PhiX'
$desktopLink = Join-Path ([Environment]::GetFolderPath('Desktop')) "$appName.lnk"
$programs = Join-Path ([Environment]::GetFolderPath('Programs')) $appName

foreach ($path in @($desktopLink, $programs)) {
    if (Test-Path $path) {
        Remove-Item -LiteralPath $path -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "Entfernt: $path"
    }
}

$uninstallKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\PhiX'
if (Test-Path $uninstallKey) {
    Remove-Item -LiteralPath $uninstallKey -Recurse -Force
}

if (-not $ShortcutsOnly -and (Test-Path $InstallRoot)) {
    Set-Location $env:TEMP
    Remove-Item -LiteralPath $InstallRoot -Recurse -Force
    Write-Host "PhiX wurde deinstalliert." -ForegroundColor Green
} elseif ($ShortcutsOnly) {
    Write-Host 'Verknuepfungen und Registry bereinigt.' -ForegroundColor Green
} else {
    Write-Host 'Bereinigung abgeschlossen.' -ForegroundColor Green
}
