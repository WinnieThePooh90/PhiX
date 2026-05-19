@echo off
title PhiX - Docker Compose
chcp 65001 >nul
setlocal EnableDelayedExpansion

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

set "DB_PORT=5432"
if exist ".env" (
    for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env") do (
        if /i "%%a"=="DB_PORT" (
            set "DB_PORT=%%b"
            set "DB_PORT=!DB_PORT:"=!"
        )
    )
)

netstat -ano | findstr /R /C:":!DB_PORT! .*LISTENING" >nul 2>&1
if !ERRORLEVEL! equ 0 (
    echo.
    echo [FEHLER] Port !DB_PORT! ist bereits belegt.
    echo        phix-db kann deshalb nicht starten.
    echo.
    echo Haeufige Ursachen:
    echo   - alter Docker-Container ^(z.B. nach start_db_docker.bat^)
    echo   - lokale PostgreSQL unter Windows
    echo   - alter Compose-Stack mit anderem Projektnamen
    echo.
    echo Beheben ^(eine Option^):
    echo   1. stop_docker.bat ausfuehren
    echo   2. Docker Desktop: Container stoppen/entfernen, der Port !DB_PORT! nutzt
    echo   3. In .env anderen Host-Port: DB_PORT=5433  ^(intern bleibt 5432^)
    echo.
    echo Laufende Container mit diesem Port:
    docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}" 2>nul | findstr "!DB_PORT!"
    echo.
    pause
    exit /b 1
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
