@echo off
chcp 65001 >nul
if "%~1"=="" (
  echo Usage: parse.cmd input.simc [output.txt]
  exit /b 1
)
node "%~dp0run.cjs" %*
exit /b %errorlevel%
