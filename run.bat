@echo off
title LuluaX-Request API Client
echo ========================================================
echo         Starting LuluaX-Request API Client              
echo ========================================================
echo.

cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    pause
    exit /b 1
)

if not exist "dist-electron\server.js" (
    echo Compiling TypeScript source...
    call npx tsc
)

echo [1/2] Starting LuluaX-Request proxy backend server...
start "LuluaX-Request Server" /b node dist-electron/server.js

timeout /t 2 /nobreak >nul

echo [2/2] Opening LuluaX-Request Application Window...
if exist "node_modules\electron" (
    start "" npx electron dist-electron/main.js
) else if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app=http://127.0.0.1:3990 --window-size=1260,820
) else if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=http://127.0.0.1:3990 --window-size=1260,820
) else (
    start http://127.0.0.1:3990
)

echo.
echo LuluaX-Request is running at http://127.0.0.1:3990
