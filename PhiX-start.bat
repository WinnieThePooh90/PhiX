@echo off
REM Startet PhiX (von Desktop-Verknuepfung). Kein pause am Ende.
chcp 65001 >nul
cd /d "%~dp0"

if exist "%~dp0USE_DOCKER.flag" (
    where docker >nul 2>&1
    if %ERRORLEVEL% equ 0 (
        if not exist ".env" if exist ".env.example" copy /Y ".env.example" ".env" >nul
        docker compose up -d --build
        timeout /t 4 /nobreak >nul
        start http://localhost:1990
        exit /b 0
    )
)

where docker >nul 2>&1
if %ERRORLEVEL% equ 0 docker compose up -d db 2>nul

call "%~dp0start_notenauswertung.bat"
