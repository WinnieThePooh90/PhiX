@echo off
title PhiX - Release bauen
chcp 65001 >nul
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\build-windows-release.ps1"
pause
