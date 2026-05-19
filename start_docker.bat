@echo off
title PhiX - Docker Compose
chcp 65001 >nul

cd /d "%~dp0"

where docker >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [FEHLER] Docker ist nicht installiert oder nicht im PATH.
    echo        Docker Desktop fuer Windows installieren und starten.
    pause
    exit /b 1
)

if not exist ".env" (
    if exist ".env.example" copy /Y ".env.example" ".env" >nul
)

echo Starte alle Dienste per docker compose ...
docker compose up -d --build
if %ERRORLEVEL% neq 0 (
    echo [FEHLER] docker compose ist fehlgeschlagen.
    pause
    exit /b 1
)

echo.
echo PhiX laeuft unter http://localhost:1990
echo (Port in .env mit FRONTEND_PORT aenderbar)
echo.
start http://localhost:1990
pause
