@echo off
setlocal EnableExtensions
rem Builds Tunnel Doctor on a fresh Windows machine.
rem   build.bat            install dependencies and run the unit tests
rem   build.bat --run      also launch the desktop app afterwards (aliases: /run, RUN_AFTER_BUILD=1)
rem   build.bat /s         silent: never prompts, never launches
cd /d "%~dp0"

set "RUN=0"
set "SILENT=0"
for %%A in (%*) do (
  if /i "%%~A"=="--run" set "RUN=1"
  if /i "%%~A"=="/run" set "RUN=1"
  if /i "%%~A"=="/s" set "SILENT=1"
  if /i "%%~A"=="--silent" set "SILENT=1"
)
if "%RUN_AFTER_BUILD%"=="1" set "RUN=1"
if "%SILENT%"=="1" set "RUN=0"

call :ensure_node || exit /b 1

echo [build] Installing dependencies
call npm ci --no-audit --no-fund
if errorlevel 1 (
  echo [build] npm ci failed, trying npm install
  call npm install --no-audit --no-fund || (echo [build] ERROR: dependency install failed & exit /b 1)
)

echo [build] Writing build provenance
call node scripts\build-meta.js || exit /b 1

echo [build] Running unit tests
call node --test test\ || (echo [build] ERROR: tests failed & exit /b 1)

if "%RUN%"=="1" (
  echo [build] Launching the desktop app
  call npx electron .
  exit /b %ERRORLEVEL%
)
echo [build] Done.
exit /b 0

:ensure_node
where node >nul 2>&1 && goto :node_ok
echo [build] Node.js was not found. Installing Node.js LTS with winget.
where winget >nul 2>&1 || (echo [build] ERROR: winget is not available. Install Node.js 20 or newer from https://nodejs.org and run build.bat again. & exit /b 1)
winget install --id OpenJS.NodeJS.LTS --exact --accept-source-agreements --accept-package-agreements --silent
if errorlevel 1 (echo [build] ERROR: Node.js install failed or was cancelled. & exit /b 1)
for /f "tokens=2*" %%P in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul ^| find "Path"') do set "PATH=%%Q;%PATH%"
where node >nul 2>&1 || (echo [build] ERROR: Node.js installed but is not on PATH yet. Open a new terminal and run build.bat again. & exit /b 1)
:node_ok
for /f "tokens=1 delims=." %%V in ('node -p "process.versions.node"') do set "NODE_MAJOR=%%V"
if %NODE_MAJOR% LSS 20 (echo [build] ERROR: Node.js 20 or newer is required, found %NODE_MAJOR%. & exit /b 1)
exit /b 0
