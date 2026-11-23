@echo off
chcp 65001 >nul
title Ajouter un compte au tableau de bord CET
cd /d "%~dp0"
if not exist node_modules (
  echo Lance d'abord "Lancer le test.bat" une fois pour installer l'application.
  pause
  exit /b
)
echo.
set /p EMAIL=Adresse mail (ex. lekoue@norimagerie.com) : 
set /p NOM=Prenom et NOM : 
set /p FONCTION=Fonction : 
node ajouter-compte.js "%EMAIL%" "%NOM%" "%FONCTION%"
pause
