@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\release.ps1"
set "release_exit=%errorlevel%"
if not "%release_exit%"=="0" echo Release failed. See error above.
pause
exit /b %release_exit%
