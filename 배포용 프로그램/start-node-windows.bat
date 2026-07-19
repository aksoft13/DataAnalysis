@echo off
cd /d "%~dp0bin"

echo.
echo =========================================
echo   My Data Analysis (Node.js)
echo   http://localhost:3007
echo =========================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
  echo [ERROR] Node.js not installed.
  echo Download from https://nodejs.org
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies...
  npm install --production
  echo.
)

echo Starting server...
start "" "http://localhost:3007"
timeout /t 2 /nobreak >nul
node server.js

echo.
echo [Server stopped.]
pause
