@echo off
title PhiX - Installation (Windows)
chcp 65001 >nul
setlocal

cd /d "%~dp0"

echo ===================================================
echo     PhiX - Abhaengigkeiten installieren
echo ===================================================
echo.

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [FEHLER] Node.js ist nicht installiert oder nicht im PATH.
    echo        LTS-Version von https://nodejs.org/ installieren und Fenster neu oeffnen.
    pause
    exit /b 1
)

for /f "tokens=1 delims=v." %%a in ('node -p "process.versions.node.split('.')[0]"') do set NODE_MAJOR=%%a
if %NODE_MAJOR% LSS 20 (
    echo [WARNUNG] Node.js 20 oder neuer wird empfohlen.
)

if not exist ".env" (
    if exist ".env.example" copy /Y ".env.example" ".env" >nul
)

if not exist "backend\.env" (
    if exist "backend\.env.example" (
        copy /Y "backend\.env.example" "backend\.env" >nul
        echo backend\.env aus Vorlage erstellt.
    )
)

echo [1/3] Backend ...
cd /d "%~dp0backend"
call npm install
if %ERRORLEVEL% neq 0 goto :fail
call npx prisma generate
if %ERRORLEVEL% neq 0 goto :fail

echo.
echo [2/3] Frontend ...
cd /d "%~dp0Notenauswertung-App"
call npm install
if %ERRORLEVEL% neq 0 goto :fail

echo.
echo [3/3] Fertig.
echo.
echo Naechste Schritte:
echo   - Mit Docker:  start_docker.bat
echo   - Ohne Docker-App-Container: start_notenauswertung.bat
echo     (Datenbank vorher: start_db_docker.bat oder lokales PostgreSQL)
echo.
pause
exit /b 0

:fail
echo.
echo [FEHLER] Installation fehlgeschlagen.
pause
exit /b 1
