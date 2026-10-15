@echo off
title LEGA - Servidor
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Falta instalar Node.js ^(gratis^): https://nodejs.org  - elegi la version LTS.
  echo  Despues de instalarlo, volve a abrir este archivo.
  echo.
  pause
  exit /b
)
node servidor.js
pause
