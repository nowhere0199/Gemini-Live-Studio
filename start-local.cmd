@echo off
setlocal
cd /d "%~dp0"
echo Starting Gemini Live Studio on 127.0.0.1:8765
echo Keep this window open while using the app. Press Ctrl+C to stop.
start "" "http://127.0.0.1:8765"
node server.mjs
