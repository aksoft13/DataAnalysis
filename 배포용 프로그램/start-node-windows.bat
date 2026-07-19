@echo off
chcp 65001 >nul
cd /d "%~dp0bin"

echo.
echo =========================================
echo   My Data Analysis (Node.js 실행)
echo   http://localhost:3007
echo =========================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
  echo [오류] Node.js가 설치되어 있지 않습니다.
  echo https://nodejs.org 에서 설치 후 다시 실행하세요.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo 의존성 설치 중 (최초 1회)...
  npm install --production
  echo.
)

echo 서버 시작 중...
start "" "http://localhost:3007"
timeout /t 2 /nobreak >nul
node server.js

echo.
echo [서버가 종료되었습니다.]
pause
