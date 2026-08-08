@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title POS Cafe

rem ---------------------------------------------------------------------------
rem  Ouvre le POS en plein ecran, sans barre d'adresse et SANS boite de dialogue
rem  d'impression : le ticket part directement sur l'imprimante par defaut.
rem
rem  Adaptez ces deux lignes si besoin.
rem ---------------------------------------------------------------------------
set "POS_URL=http://127.0.0.1:7777"
set "AGENT=%~dp0..\printer-agent\agent.mjs"

rem --- L'agent sert la page et pilote l'imprimante : on le demarre s'il dort ---
curl -s -o nul --max-time 2 "%POS_URL%/health" 2>nul
if errorlevel 1 (
  where node >nul 2>nul
  if errorlevel 1 (
    echo Node.js est introuvable. Installez-le depuis https://nodejs.org puis relancez.
    pause
    exit /b 1
  )
  echo Demarrage de l'agent d'impression...
  start "Agent impression POS" /min cmd /c node "%AGENT%"
  timeout /t 3 /nobreak >nul
)

rem --- Navigateur : Edge de preference, sinon Chrome ---
rem  (ProgramFiles(x86) contient une parenthese : on le recopie avant la boucle)
set "PF=%ProgramFiles%"
set "PF86=%ProgramFiles(x86)%"
set "BROWSER="
for %%P in (
  "%PF86%\Microsoft\Edge\Application\msedge.exe"
  "%PF%\Microsoft\Edge\Application\msedge.exe"
  "%PF%\Google\Chrome\Application\chrome.exe"
  "%PF86%\Google\Chrome\Application\chrome.exe"
  "%LocalAppData%\Google\Chrome\Application\chrome.exe"
) do if not defined BROWSER if exist %%P set "BROWSER=%%~P"

if not defined BROWSER (
  echo Ni Microsoft Edge ni Google Chrome n'ont ete trouves.
  pause
  exit /b 1
)

rem  --kiosk-printing  : imprime sans boite de dialogue, sur l'imprimante par defaut
rem  --kiosk           : plein ecran, sans barre d'adresse ni onglets
rem  --user-data-dir   : profil dedie, pour ne pas melanger avec la navigation perso
start "" "%BROWSER%" ^
  --kiosk "%POS_URL%" ^
  --kiosk-printing ^
  --edge-kiosk-type=fullscreen ^
  --no-first-run ^
  --disable-features=Translate,AutofillServerCommunication ^
  --user-data-dir="%LocalAppData%\CafePOS\profil"

exit /b 0
