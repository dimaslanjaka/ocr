@echo off

setlocal enabledelayedexpansion

:: Get the directory of the current script
set SCRIPT_DIR=%~dp0

python "%SCRIPT_DIR%build.py" %*
