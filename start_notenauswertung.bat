@echo off
title PhiX - nativer Start (Windows)
chcp 65001 >nul
setlocal

cd /d "%~dp0"

echo ===================================================
echo     PhiX - nativer Start (Backend + Frontend)
echo ===================================================
echo.

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [FEHLER] Node.js fehlt. Zuerst install_windows.bat ausfuehren.
    pause
    exit /b 1
)

if not exist "backend\node_modules" (
    echo [HINWEIS] Backend noch nicht installiert. Starte install_windows.bat ...
    call "%~dp0install_windows.bat"
)

if not exist "Notenauswertung-App\node_modules" (
    echo [HINWEIS] Frontend noch nicht installiert. Starte install_windows.bat ...
    call "%~dp0install_windows.bat"
)

if not exist "backend\.env" (
    if exist "backend\.env.example" (
        copy /Y "backend\.env.example" "backend\.env" >nul
        echo backend\.env wurde erstellt. DATABASE_URL bei Bedarf anpassen.
    ) else (
        echo [FEHLER] backend\.env fehlt.
        pause
        exit /b 1
    )
)

netstat -ano | findstr /R /C:":5173 .*LISTENING" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo Frontend laeuft bereits. Oeffne Browser ...
    start http://localhost:5173
    exit /b 0
)

netstat -ano | findstr /R /C:":3000 .*LISTENING" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [HINWEIS] Port 3000 ist bereits belegt. Backend evtl. schon gestartet.
) else (
    echo Starte Backend auf Port 3000 ...
    echo Fenster "PhiX Backend" nicht schliessen!
    start "PhiX Backend (NICHT SCHLIESSEN)" cmd /k "cd /d "%~dp0backend" && npm start"
    echo Warte auf Datenbank und Backend ...
    timeout /t 6 /nobreak >nul
)

echo Starte Frontend (Vite) auf Port 5173 ...
echo Fenster "PhiX Frontend" nicht schliessen!
start "PhiX Frontend (NICHT SCHLIESSEN)" cmd /k "cd /d "%~dp0Notenauswertung-App" && npm run dev"

timeout /t 4 /nobreak >nul
echo Oeffne Browser ...
start http://localhost:5173

echo.
echo Hinweis: PostgreSQL muss erreichbar sein.
echo   - start_db_docker.bat  ODER
echo   - lokale Installation mit Zugangsdaten aus backend\.env
echo.
exit /b 0
