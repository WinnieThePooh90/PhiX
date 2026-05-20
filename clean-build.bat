@echo off
title PhiX - Build-Artefakte entfernen
chcp 65001 >nul
cd /d "%~dp0"

echo Entferne node_modules, dist, dist-pack, release-Builds, generierte Prisma-Clients ...
echo.

if exist "backend\node_modules" rmdir /s /q "backend\node_modules"
if exist "backend\generated" rmdir /s /q "backend\generated"
if exist "backend\.prisma-generate-dummy.sqlite" del /q "backend\.prisma-generate-dummy.sqlite"
if exist "backend\ci-smoke.sqlite" del /q "backend\ci-smoke.sqlite"

if exist "Notenauswertung-App\node_modules" rmdir /s /q "Notenauswertung-App\node_modules"
if exist "Notenauswertung-App\dist" rmdir /s /q "Notenauswertung-App\dist"
if exist "Notenauswertung-App\.vite" rmdir /s /q "Notenauswertung-App\.vite"

if exist "desktop\node_modules" rmdir /s /q "desktop\node_modules"
if exist "desktop\dist-pack" rmdir /s /q "desktop\dist-pack"

if exist "release\_cache" rmdir /s /q "release\_cache"
if exist "release\PhiX-Windows-x64" rmdir /s /q "release\PhiX-Windows-x64"
if exist "release\PhiX-Windows-x64.zip" del /q "release\PhiX-Windows-x64.zip"

if exist "installer\output" rmdir /s /q "installer\output"

echo.
echo Fertig. Projektordner enthaelt nur Quellcode und Lockfiles.
echo Vor neuem Build: backend + Notenauswertung-App + desktop jeweils npm install, dann desktop npm run dist.
pause
