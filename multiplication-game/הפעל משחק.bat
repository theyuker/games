@echo off
rem Serves the game from http://localhost so Chrome remembers the microphone permission
rem (a page opened as a file asks again every time listening restarts).
cd /d "%~dp0"
start "multiplication-game server" /min python -m http.server 8765 --bind 127.0.0.1
timeout /t 1 /nobreak >nul
start chrome http://localhost:8765/
