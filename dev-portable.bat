@echo off
title LuluaX-Request (Development Portable Review)
echo ========================================================
echo  LuluaX-Request — Build Portable and Launch for Review  
echo ========================================================
echo.

cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    pause
    exit /b 1
)

taskkill /F /IM "LuluaX-Request.exe" >nul 2>nul
taskkill /F /IM "LuluaX-Request 1.0.0.exe" >nul 2>nul

echo [1/2] Building standalone portable executable...
call npx electron-builder --win portable --publish never

if %errorlevel% neq 0 (
    echo [ERROR] Build failed!
    pause
    exit /b 1
)

echo.
echo [2/2] Launching portable app for instant review...
if exist "dist\LuluaX-Request 1.0.0.exe" (
    start "" "dist\LuluaX-Request 1.0.0.exe"
    echo App launched! Check your taskbar / screen.
) else (
    echo Binary not found in dist!
)

exit /b 0
