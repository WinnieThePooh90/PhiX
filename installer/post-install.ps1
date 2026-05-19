param(
    [Parameter(Mandatory = $true)]
    [string]$InstallRoot,
    [string]$AppName = 'PhiX',
    [string]$AppVersion = '1.0.0'
)

$bat = @"
@echo off
title PhiX deinstallieren
chcp 65001 >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\Uninstall-PhiX.ps1" -InstallRoot "%~dp0"
pause
"@
$batPath = Join-Path $InstallRoot 'Deinstallieren.bat'
Set-Content -Path $batPath -Value $bat.TrimEnd() -Encoding ASCII

$keyPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\PhiX'
New-Item -Path $keyPath -Force | Out-Null
$uninstallPs1 = Join-Path $InstallRoot 'installer\Uninstall-PhiX.ps1'
Set-ItemProperty -Path $keyPath -Name 'DisplayName' -Value $AppName
Set-ItemProperty -Path $keyPath -Name 'DisplayVersion' -Value $AppVersion
Set-ItemProperty -Path $keyPath -Name 'Publisher' -Value $AppName
Set-ItemProperty -Path $keyPath -Name 'InstallLocation' -Value $InstallRoot
Set-ItemProperty -Path $keyPath -Name 'UninstallString' -Value "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$uninstallPs1`" -InstallRoot `"$InstallRoot`""
