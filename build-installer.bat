@echo off
setlocal EnableExtensions
rem Builds the Windows Squirrel installer (out\make\squirrel.windows\x64\TunnelDoctorSetup.exe).
rem   build-installer.bat      build then package
rem   build-installer.bat /s   silent
cd /d "%~dp0"

call "%~dp0build.bat" /s || (echo [installer] ERROR: build failed & exit /b 1)

echo [installer] Packaging with Electron Forge (Squirrel.Windows)
rem Packaging silently stops part-way under Node 23 and newer (the Electron zip
rem extraction never finishes), so packaging always runs on Node 22 LTS.
for /f "tokens=1 delims=." %%V in ('node -p "process.versions.node"') do set "NODE_MAJOR=%%V"
if %NODE_MAJOR% GTR 22 (
  echo [installer] System Node.js is %NODE_MAJOR%; packaging with Node.js 22 LTS through npx
  call npx -y node@22 node_modules\@electron-forge\cli\dist\electron-forge.js make --platform win32 --arch x64
) else (
  call npx electron-forge make --platform win32 --arch x64
)
if errorlevel 1 (echo [installer] ERROR: packaging failed & exit /b 1)

set "OUTDIR=out\make\squirrel.windows\x64"
if not exist "%OUTDIR%\TunnelDoctorSetup.exe" (echo [installer] ERROR: Setup.exe was not produced & exit /b 1)
if not exist "%OUTDIR%\RELEASES" (echo [installer] ERROR: RELEASES was not produced & exit /b 1)
dir /b "%OUTDIR%\*.nupkg" >nul 2>&1 || (echo [installer] ERROR: no .nupkg was produced & exit /b 1)
echo [installer] Installer ready in %OUTDIR%
dir /b "%OUTDIR%"
exit /b 0
