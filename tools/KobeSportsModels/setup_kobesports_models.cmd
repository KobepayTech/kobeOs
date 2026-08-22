@echo off
setlocal EnableExtensions

set "KOBE_ROOT=C:\KobeOS"
set "MODEL_ROOT=%KOBE_ROOT%\Models\Sports"
set "VENV=%KOBE_ROOT%\vision-env"
set "SCRIPT_DIR=%~dp0"
set "PROFILE=%~1"
if "%PROFILE%"=="" set "PROFILE=balanced"

echo.
echo ============================================================
echo  KobeSports model installer
echo  Destination: %MODEL_ROOT%
echo  Profile: %PROFILE%
echo ============================================================
echo.

if /I not "%PROFILE%"=="lite" if /I not "%PROFILE%"=="balanced" if /I not "%PROFILE%"=="full" (
  echo ERROR: Profile must be lite, balanced, or full.
  echo Example: setup_kobesports_models.cmd balanced
  exit /b 2
)

if not exist "%KOBE_ROOT%" mkdir "%KOBE_ROOT%"
if not exist "%MODEL_ROOT%" mkdir "%MODEL_ROOT%"

set "PY="
where py >nul 2>&1
if not errorlevel 1 set "PY=py -3"
if not defined PY (
  where python >nul 2>&1
  if not errorlevel 1 set "PY=python"
)
if not defined PY (
  echo ERROR: Python 3.10 or newer was not found.
  echo Install Python, tick "Add Python to PATH", then run this file again.
  exit /b 3
)

if not exist "%VENV%\Scripts\python.exe" (
  echo [1/4] Creating Python environment...
  %PY% -m venv "%VENV%"
  if errorlevel 1 exit /b 4
) else (
  echo [1/4] Python environment already exists.
)

echo [2/4] Updating installer tools...
call "%VENV%\Scripts\activate.bat"
python -m pip install --upgrade pip setuptools wheel
if errorlevel 1 exit /b 5

echo [3/4] Installing vision runtime...
python -m pip install --upgrade ultralytics supervision opencv-python-headless
if errorlevel 1 exit /b 6

echo [4/4] Downloading and verifying KobeSports models...
python "%SCRIPT_DIR%download_kobesports_models.py" --root "%MODEL_ROOT%" --profile "%PROFILE%"
if errorlevel 1 (
  echo.
  echo ERROR: Model setup failed. Review the message above.
  exit /b 7
)

echo.
echo ============================================================
echo  DONE
echo  Models: %MODEL_ROOT%\shared
echo  Sport maps: %MODEL_ROOT%\sports
echo  Report: %MODEL_ROOT%\download_report.txt
echo ============================================================
echo.
pause
