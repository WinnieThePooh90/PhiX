@echo off
title PhiX Desktop - npm install (Cache außerhalb Dropbox)
chcp 65001 >nul
cd /d "%~dp0"

REM Reduziert EBUSY/cleanup-Warnungen, wenn der Projektordner in Dropbox liegt.
set "ELECTRON_CACHE=%LOCALAPPDATA%\PhiX\electron-cache"
set "npm_config_cache=%LOCALAPPDATA%\PhiX\npm-cache"

call npm install %*
exit /b %ERRORLEVEL%
