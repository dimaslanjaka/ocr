@echo off
echo Creating python3 executable...

REM Activate virtual environment
call venv\Scripts\activate

REM Copy python.exe to python3.exe in the virtual environment
copy "venv\Scripts\python.exe" "venv\Scripts\python3.exe"

REM Also create it in the main Python installation
copy "C:\Program Files\Python3\python.exe" "C:\Program Files\Python3\python3.exe"

echo python3 executable created successfully!
echo Now try: yarn add node-easyocr

pause
