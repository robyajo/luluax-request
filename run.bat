@echo off
title LuluaX-Request API Client
echo ========================================================
echo         Starting LuluaX-Request API Client              
echo ========================================================
echo.

cd /d "%~dp0"

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    pause
    exit /b 1
)

:: Start Server in background on port 3990
echo [1/2] Starting LuluaX-Request proxy backend server...
start "LuluaX-Request Server" /b node server.js

:: Wait for server to bind
timeout /t 2 /nobreak >nul

:: Launch Desktop App Window
echo [2/2] Opening LuluaX-Request Application Window...
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app=http://127.0.0.1:3990 --window-size=1260,820
) else if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=http://127.0.0.1:3990 --window-size=1260,820
) else (
    start http://127.0.0.1:3990
)

echo.
echo LuluaX-Request is running at http://127.0.0.1:3990
