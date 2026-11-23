@echo off
chcp 65001 >nul
title Desinstallation du service CET Norimagerie
cd /d "%~dp0"

net session >nul 2>&1
if errorlevel 1 (
  echo Lance ce fichier en administrateur ^(clic droit, Executer en tant qu'administrateur^).
  pause
  exit /b
)

echo Arret du service...
schtasks /end /tn "CET Norimagerie" >nul 2>&1
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"name='node.exe'\" | Where-Object { $_.CommandLine -like '*%~dp0server.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
schtasks /delete /tn "CET Norimagerie" /f >nul 2>&1
netsh advfirewall firewall delete rule name="CET Norimagerie" >nul 2>&1
echo.
echo Service arrete et supprime. Les donnees dans Supabase ne sont pas touchees.
echo.
pause
