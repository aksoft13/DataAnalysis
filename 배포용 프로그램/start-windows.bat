@echo off
cd /d "%~dp0bin"

echo.
echo =========================================
echo   My Data Analysis
echo   http://localhost:3007
echo =========================================
echo.
echo Starting server...
echo.

my-data-analysis-win-x64.exe

echo.
echo [Server stopped. Check error above.]
echo.
pause
