@echo off
rem Lance le serveur CET en boucle (redemarre tout seul en cas d arret).
rem Utilise par la tache planifiee "CET Norimagerie" - ne pas lancer a la main.
cd /d "%~dp0"
if not exist logs mkdir logs
:boucle
echo [%date% %time%] Demarrage du serveur >> logs\cet.log
node "%~dp0server.js" >> logs\cet.log 2>&1
echo [%date% %time%] Serveur arrete, redemarrage dans 10 s >> logs\cet.log
timeout /t 10 /nobreak >nul
goto boucle
