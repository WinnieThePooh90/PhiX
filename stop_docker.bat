@echo off
title PhiX - Docker stoppen
chcp 65001 >nul
cd /d "%~dp0"
docker compose down
echo Container gestoppt.
pause
