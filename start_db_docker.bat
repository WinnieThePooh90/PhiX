@echo off
title PhiX - nur Datenbank (Docker)
chcp 65001 >nul

cd /d "%~dp0"

where docker >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [FEHLER] Docker nicht gefunden.
    pause
    exit /b 1
)

echo Starte PostgreSQL-Container ...
docker compose up -d db
if %ERRORLEVEL% neq 0 (
    pause
    exit /b 1
)

echo.
echo Datenbank bereit auf localhost:5432
echo Anschliessend: start_notenauswertung.bat
echo.
pause
