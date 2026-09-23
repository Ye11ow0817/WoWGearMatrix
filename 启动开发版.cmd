@echo off
setlocal
pushd "%~dp0"
if errorlevel 1 exit /b 1
call npm.cmd start
set "app_exit=%errorlevel%"
popd
if not "%app_exit%"=="0" (
  echo.
  echo Failed to start the development app. See the error above.
  pause
)
exit /b %app_exit%
