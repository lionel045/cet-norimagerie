@echo off
chcp 65001 >nul
title Formulaire CET - test
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js n'est pas installe. Installe la version LTS puis relance ce fichier.
  start "" https://nodejs.org
  pause
  exit /b
)
if not exist node_modules (
  echo Premiere installation, patiente une minute...
  call npm install
)
start "" cmd /c "timeout /t 3 >nul & start http://localhost:3000 & start http://localhost:3000/boite-test & start http://localhost:3000/tableau-de-bord"
echo.
echo  Formulaire : http://localhost:3000
echo  Mails recus : http://localhost:3000/boite-test
echo  Direction  : http://localhost:3000/tableau-de-bord
echo  Ferme cette fenetre pour arreter.
echo.
node server.js
pause
