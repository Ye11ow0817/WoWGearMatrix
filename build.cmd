@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1"
set "build_exit=%errorlevel%"
if not "%build_exit%"=="0" echo Build failed. See error above.
pause
exit /b %build_exit%
