param(
    [Parameter(Mandatory = $true)]
    [string]$InstallRoot,
    [Parameter(Mandatory = $true)]
    [string]$AppName = 'PhiX'
)

$launcher = Join-Path $InstallRoot 'PhiX-start.bat'
if (-not (Test-Path $launcher)) {
    throw "Launcher nicht gefunden: $launcher"
}

$wsh = New-Object -ComObject WScript.Shell
$icon = "$env:SystemRoot\System32\imageres.dll, 109"

function New-AppShortcut([string]$LinkPath, [string]$Description) {
    $sc = $wsh.CreateShortcut($LinkPath)
    $sc.TargetPath = $launcher
    $sc.WorkingDirectory = $InstallRoot
    $sc.Description = $Description
    $sc.IconLocation = $icon
    $sc.WindowStyle = 7
    $sc.Save()
}

$desktop = [Environment]::GetFolderPath('Desktop')
$programs = [Environment]::GetFolderPath('Programs')
$startMenuDir = Join-Path $programs $AppName

if (-not (Test-Path $startMenuDir)) {
    New-Item -ItemType Directory -Path $startMenuDir -Force | Out-Null
}

New-AppShortcut (Join-Path $desktop "$AppName.lnk") "$AppName starten"
New-AppShortcut (Join-Path $startMenuDir "$AppName.lnk") "$AppName starten"

$uninstallBat = Join-Path $InstallRoot 'Deinstallieren.bat'
if (Test-Path $uninstallBat) {
    $uninstallLink = Join-Path $startMenuDir 'PhiX deinstallieren.lnk'
    $sc = $wsh.CreateShortcut($uninstallLink)
    $sc.TargetPath = $uninstallBat
    $sc.WorkingDirectory = $InstallRoot
    $sc.Description = "$AppName deinstallieren"
    $sc.IconLocation = "$env:SystemRoot\System32\shell32.dll, 31"
    $sc.Save()
}

Write-Host "Verknuepfungen erstellt:" -ForegroundColor Green
Write-Host "  Desktop: $desktop\$AppName.lnk"
Write-Host "  Startmenue: $startMenuDir"
