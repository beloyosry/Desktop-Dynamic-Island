@echo off
rem Double-click: creates the desktop shortcut + start-with-Windows entry and launches Dynamic Island Pro.
cd /d "%~dp0"
if not exist "node_modules\electron\dist\electron.exe" (
  echo electron.exe not found. Run "npm install" in this folder first.
  pause
  exit /b 1
)
call npm.cmd run build
if errorlevel 1 exit /b 1
start "" "node_modules\electron\dist\electron.exe" "%~dp0." --setup
echo Dynamic Island Pro is starting.
timeout /t 3 >nul
