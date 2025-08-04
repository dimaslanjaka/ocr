@echo off

setlocal enabledelayedexpansion

:: Get the directory of the current script
set SCRIPT_DIR=%~dp0

:: Define variables
set COMPANY_NAME=WMI
set VERSION=1.0.0.0
set ICON=public/favicon.ico

:: Detect if running inside Docker
set "IS_DOCKER=0"
:: Check for Docker environment file (Linux containers)
if exist "C:\.dockerenv" set "IS_DOCKER=1"
if exist "\\.\pipe\docker_engine" set "IS_DOCKER=1"
if exist "/.dockerenv" set "IS_DOCKER=1"

:: Check for known container environment variables
if defined DOTNET_RUNNING_IN_CONTAINER set "IS_DOCKER=1"
if "%container%"=="container" set "IS_DOCKER=1"

:: Check system info for "Container"
for /f "tokens=*" %%i in ('systeminfo ^| findstr /i "Container"') do (
    set "IS_DOCKER=1"
)

if %IS_DOCKER%==1 (
    set PYTHON_CMD=python
) else (
    set PYTHON_CMD="%SCRIPT_DIR%py"
)

%PYTHON_CMD% -m nuitka ^
  --onefile ^
  --output-dir=dist ^
  --output-file=vscan.exe ^
  --windows-icon-from-ico="%ICON%" ^
  --windows-company-name="%COMPANY_NAME%" ^
  --windows-product-name="Voucher Scanner" ^
  --windows-file-version="%VERSION%" ^
  --msvc=latest ^
  --include-data-file=public/favicon.ico=favicon.ico ^
  --include-data-dir=test/fixtures/=test/fixtures/ ^
  --jobs=1 ^
  src/ocr/focus_pytesseract.py
