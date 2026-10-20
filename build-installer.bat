@echo off
title LuluaX-Request Installer Builder (NSIS Setup)
echo ========================================================
echo    LuluaX-Request — Windows Setup Installer Builder     
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
taskkill /F /IM "LuluaX-Request Setup*.exe" >nul 2>nul

echo Packaging full Windows Setup Installer with Installation Wizard and Shortcuts...
call npx electron-builder --win nsis --publish never

echo.
echo ========================================================
echo  BUILD SUCCESS!
echo  Installer created at: dist\LuluaX-Request Setup 1.0.0.exe
echo ========================================================
pause
