@echo off
setlocal
cd /d "%~dp0"
set PORT=8000

echo.
echo =============================================
echo       MOHIT CAREERX - JOB PORTAL
echo =============================================
echo.
echo Starting local web server at:
echo http://localhost:%PORT%/
echo.
echo Keep this window open while using the portal.
echo Close this window to stop the server.
echo.

where py >nul 2>&1
if %errorlevel%==0 (
  start "MOHIT CAREERX Browser" http://localhost:%PORT%/index.html
  py -m http.server %PORT%
  goto :eof
)

where python >nul 2>&1
if %errorlevel%==0 (
  start "MOHIT CAREERX Browser" http://localhost:%PORT%/index.html
  python -m http.server %PORT%
  goto :eof
)

echo Python was not found on this computer.
echo Install Python, then double-click this file again.
pause
