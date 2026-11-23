@echo off
chcp 65001 >nul
title Installation du service CET Norimagerie
cd /d "%~dp0"

rem -- Droits administrateur
net session >nul 2>&1
if errorlevel 1 (
  echo.
  echo  Ce fichier doit etre lance en administrateur :
  echo  clic droit sur "Installer en service.bat" puis "Executer en tant qu'administrateur".
  echo.
  pause
  exit /b
)

rem -- Node.js
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js n'est pas installe. Installe la version LTS ^(https://nodejs.org^) puis relance.
  start "" https://nodejs.org
  pause
  exit /b
)

rem -- Configuration
if not exist .env (
  echo Le fichier .env est introuvable dans ce dossier. Copie-le a cote de server.js puis relance.
  pause
  exit /b
)
findstr /b /c:"PUBLIC_URL=" .env >nul
if errorlevel 1 (
  >>.env echo.
  >>.env echo PUBLIC_URL=http://%COMPUTERNAME%:3000
  echo Ajout dans .env : PUBLIC_URL=http://%COMPUTERNAME%:3000
)

echo.
echo [1/4] Installation des dependances...
call npm install --omit=dev --no-fund --no-audit
if errorlevel 1 (
  echo Echec de npm install. Verifie la connexion Internet puis relance.
  pause
  exit /b
)

echo [2/4] Creation de la tache planifiee "CET Norimagerie" (demarrage avec Windows)...
schtasks /end /tn "CET Norimagerie" >nul 2>&1
schtasks /delete /tn "CET Norimagerie" /f >nul 2>&1
schtasks /create /tn "CET Norimagerie" /tr "\"%~dp0service-cet.cmd\"" /sc onstart /ru SYSTEM /rl HIGHEST /f >nul
if errorlevel 1 (
  echo Impossible de creer la tache planifiee.
  pause
  exit /b
)

echo [3/4] Ouverture du port 3000 dans le pare-feu...
netsh advfirewall firewall delete rule name="CET Norimagerie" >nul 2>&1
netsh advfirewall firewall add rule name="CET Norimagerie" dir=in action=allow protocol=TCP localport=3000 profile=domain,private >nul

echo [4/4] Demarrage...
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"name='node.exe'\" | Where-Object { $_.CommandLine -like '*%~dp0server.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
schtasks /run /tn "CET Norimagerie" >nul
timeout /t 6 /nobreak >nul

powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing http://localhost:3000 -TimeoutSec 10; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  echo.
  echo  Le serveur ne repond pas encore. Regarde le fichier logs\cet.log pour voir l'erreur.
  echo.
  pause
  exit /b
)

echo.
echo  ============================================================
echo   Service installe et demarre.
echo.
echo   Formulaire salaries : http://%COMPUTERNAME%:3000
echo   Tableau de bord     : http://%COMPUTERNAME%:3000/tableau-de-bord
echo.
echo   Il redemarre tout seul avec Windows et en cas de plantage.
echo   Journal du serveur  : %~dp0logs\cet.log
echo  ============================================================
echo.
pause
