@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Installer Node.js LTS fra https://nodejs.org og start denne filen pa nytt.
  pause
  exit /b 1
)
echo Apne http://localhost:3000 i nettleseren.
echo Hold dette vinduet apent mens du bruker Kvadrat.
node server.mjs
pause
