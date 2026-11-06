@echo off
setlocal
cd /d "%~dp0"
node src/server-with-email.js
if errorlevel 1 pause
endlocal
