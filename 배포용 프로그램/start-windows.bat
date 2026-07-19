@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo =========================================
echo   My Data Analysis
echo   http://localhost:3007
echo =========================================
echo.

start "" "http://localhost:3007"
timeout /t 2 /nobreak >nul

bin\my-data-analysis-win-x64.exe
