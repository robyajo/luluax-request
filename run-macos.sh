#!/usr/bin/env bash
# ========================================================
#   LuluaX-Request Launcher for macOS (Apple Silicon & Intel)
# ========================================================

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "========================================================"
echo "         Starting LuluaX-Request API Client             "
echo "========================================================"

if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed!"
    exit 1
fi

echo "[1/2] Starting LuluaX-Request local server..."
node server.js &
SERVER_PID=$!

trap "kill $SERVER_PID 2>/dev/null; exit" SIGINT SIGTERM EXIT
sleep 2

echo "[2/2] Launching Desktop Window..."
if [ -d "/Applications/Google Chrome.app" ]; then
    open -na "Google Chrome" --args --app=http://127.0.0.1:3990 --window-size=1260,820
elif [ -d "/Applications/Microsoft Edge.app" ]; then
    open -na "Microsoft Edge" --args --app=http://127.0.0.1:3990 --window-size=1260,820
else
    open http://127.0.0.1:3990
fi

echo ">> LuluaX-Request running at: http://127.0.0.1:3990"
wait $SERVER_PID
