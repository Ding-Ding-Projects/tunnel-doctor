@echo off
setlocal EnableExtensions
rem Tunnel Doctor hosted form launcher (Docker Compose).
rem   host.bat             keyboard menu
rem   host.bat --detached  pull, start in the background, wait for health, print the LAN URL
rem   host.bat --logs      status plus live logs (Ctrl+C stops following; containers keep running)
rem   host.bat --stop      stop the containers (data volume is kept)
rem Never removes volumes. Set TD_PORT or TD_TAG in the environment or a .env file.

cd /d "%~dp0"
if /i "%~1"=="--detached" goto :detached
if /i "%~1"=="--logs" goto :logs
if /i "%~1"=="--stop" goto :stop
if /i "%~1"=="--help" goto :help
if not "%~1"=="" goto :help

:menu
echo.
echo  Tunnel Doctor host
echo  ------------------
echo   1  Start in the background (detached)
echo   2  Live status and logs
echo   3  Stop the containers
echo   4  Quit
choice /c 1234 /n /m "Choose 1-4: "
if errorlevel 4 exit /b 0
if errorlevel 3 call :stop_impl & goto :menu
if errorlevel 2 call :logs_impl & goto :menu
if errorlevel 1 call :detached_impl & goto :menu
goto :menu

:help
echo Usage: host.bat [--detached ^| --logs ^| --stop]
echo   With no option a keyboard menu is shown.
exit /b 2

:detached
call :detached_impl
exit /b %errorlevel%

:logs
call :logs_impl
exit /b %errorlevel%

:stop
call :stop_impl
exit /b %errorlevel%

rem ---------------------------------------------------------------

:check_runtime
where docker >nul 2>&1
if errorlevel 1 (
  echo ERROR: Docker was not found. Install Docker Desktop and start it, then run this again.
  exit /b 1
)
docker compose version >nul 2>&1
if errorlevel 1 (
  echo ERROR: "docker compose" is not available. Update Docker Desktop to a version that includes Compose v2.
  exit /b 1
)
docker info >nul 2>&1
if errorlevel 1 (
  echo ERROR: The Docker engine is not running. Start Docker Desktop and wait until it is ready.
  exit /b 1
)
exit /b 0

:detached_impl
call :check_runtime
if errorlevel 1 exit /b 1
echo Pulling the published image...
docker compose pull
if errorlevel 1 (
  echo ERROR: Pulling the image failed. Check your network and the TD_TAG value.
  exit /b 1
)
echo Starting Tunnel Doctor...
docker compose up -d
if errorlevel 1 (
  echo ERROR: Starting the containers failed.
  exit /b 1
)
set "CID="
for /f %%C in ('docker compose ps -q tunnel-doctor') do set "CID=%%C"
if not defined CID (
  echo ERROR: The container did not start.
  exit /b 1
)
echo Waiting for the health check ^(up to 90 seconds^)...
set /a TRIES=0
:wait_health
set "HEALTH="
for /f %%H in ('docker inspect --format "{{.State.Health.Status}}" %CID% 2^>nul') do set "HEALTH=%%H"
if /i "%HEALTH%"=="healthy" goto :healthy
if /i "%HEALTH%"=="unhealthy" goto :unhealthy
set /a TRIES+=1
if %TRIES% geq 30 goto :unhealthy
ping -n 4 127.0.0.1 >nul
goto :wait_health

:unhealthy
echo ERROR: Tunnel Doctor did not become healthy. Last log lines:
docker compose logs --tail 40 tunnel-doctor
exit /b 1

:healthy
set "PORT="
for /f "tokens=2 delims=:" %%P in ('docker compose port tunnel-doctor 8080') do set "PORT=%%P"
if not defined PORT set "PORT=8080"
set "LANIP="
set "IPFILE=%TEMP%\tunnel-doctor-ip.txt"
powershell -NoProfile -Command "$ip = (Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' -and $_.InterfaceAlias -notmatch 'vEthernet|WSL|VMware|VirtualBox|docker' } | Select-Object -First 1).IPv4Address.IPAddress; if (-not $ip) { $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' -and $_.InterfaceAlias -notmatch 'vEthernet|WSL|Loopback|VMware|VirtualBox|docker' } | Select-Object -First 1).IPAddress }; $ip" > "%IPFILE%" 2>nul
if exist "%IPFILE%" set /p LANIP=<"%IPFILE%"
del "%IPFILE%" >nul 2>&1
echo.
echo Tunnel Doctor is healthy.
if defined LANIP (
  echo   LAN address : %LANIP%
  echo   Port        : %PORT%
  echo   Open        : http://%LANIP%:%PORT%/
) else (
  echo   Could not detect a LAN address. Open http://localhost:%PORT%/ on this computer.
)
echo   The first visit asks you to set a password.
exit /b 0

:logs_impl
call :check_runtime
if errorlevel 1 exit /b 1
echo.
docker compose ps
echo.
echo Following logs. Press Ctrl+C to stop following.
echo If asked "Terminate batch job", answer N to return, or Y to exit. Containers keep running either way.
echo.
docker compose logs -f --tail 100 %~2
exit /b 0

:stop_impl
call :check_runtime
if errorlevel 1 exit /b 1
docker compose stop
if errorlevel 1 (
  echo ERROR: Stopping the containers failed.
  exit /b 1
)
echo Stopped. Your data volume is kept.
exit /b 0
