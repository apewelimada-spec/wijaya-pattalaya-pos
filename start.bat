@echo off
setlocal
title Wijaya Pattalaya POS
cd /d "%~dp0"

set "URL=file:///%~dp0index.html"
set "URL=%URL:\=/%"
set "PROFILE=%LOCALAPPDATA%\WijayaPattalayaPOS\browser-profile"
if not exist "%PROFILE%" mkdir "%PROFILE%" >nul 2>nul

set "BROWSER="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "BROWSER=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

if defined BROWSER (
  start "" "%BROWSER%" --app="%URL%" --user-data-dir="%PROFILE%" --window-size=1440,900 --no-first-run --no-default-browser-check
) else (
  start "" "%URL%"
)
exit /b 0
