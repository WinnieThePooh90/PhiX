@echo off
title PhiX
chcp 65001 >nul
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-PhiX.ps1"
if %ERRORLEVEL% neq 0 pause
