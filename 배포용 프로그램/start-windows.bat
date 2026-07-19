@echo off
chcp 65001 >nul
cd /d "%~dp0bin"

echo.
echo =========================================
echo   My Data Analysis
echo   http://localhost:3007
echo =========================================
echo.
echo 서버 시작 중...
echo.

my-data-analysis-win-x64.exe

echo.
echo [서버가 종료되었습니다. 위 에러를 확인하세요.]
echo.
pause
