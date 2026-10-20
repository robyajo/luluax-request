@echo off
title LuluaX-Request Builder (Windows EXE)
echo ========================================================
echo        LuluaX-Request — Windows Executable Builder       
echo ========================================================
echo.

cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    pause
    exit /b 1
)

echo [1/2] Checking build tools and dependencies...
if not exist "node_modules\electron-builder" (
    echo Installing electron and electron-builder...
    call npm install -D electron electron-builder
)

taskkill /F /IM "LuluaX-Request.exe" >nul 2>nul
taskkill /F /IM "LuluaX-Request 1.0.0.exe" >nul 2>nul
taskkill /F /IM "LuluaX-Request Setup*.exe" >nul 2>nul

echo [2/2] Packaging into Windows Setup Installer (.exe)...
call npx electron-builder --win nsis --publish never

echo.
echo ========================================================
echo  BUILD SUCCESS!
echo  Windows Installer: dist\LuluaX-Request Setup 1.0.0.exe
echo ========================================================
pause
