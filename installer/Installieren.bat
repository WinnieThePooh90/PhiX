@echo off
title PhiX - Installation
chcp 65001 >nul

cd /d "%~dp0"

echo.
echo ===================================================
echo     PhiX - Windows-Installer
echo ===================================================
echo.

where powershell >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [FEHLER] PowerShell nicht gefunden.
    pause
    exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-PhiX.ps1"
set ERR=%ERRORLEVEL%
if %ERR% neq 0 pause
exit /b %ERR%
