@echo off
chcp 65001 >nul
cd /d "%~dp0bin"

echo.
echo =========================================
echo   My Data Analysis
echo   http://localhost:3007
echo =========================================
echo.

:: 서버를 백그라운드로 시작
start "MyDataAnalysis Server" /MIN my-data-analysis-win-x64.exe

:: 서버 준비 대기
echo 서버 시작 대기 중...
timeout /t 4 /nobreak >nul

:: 브라우저 열기
start "" "http://localhost:3007"

echo.
echo 브라우저가 열렸습니다.
echo 서버를 종료하려면 이 창을 닫으세요.
echo.
pause
:: 종료 시 서버 프로세스도 종료
taskkill /F /IM my-data-analysis-win-x64.exe >nul 2>&1
