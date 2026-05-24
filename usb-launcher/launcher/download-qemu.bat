@echo off
:: download-qemu.bat — Download QEMU portable to USB
:: Downloads the official QEMU Windows build and extracts to USB\launcher\qemu\

setlocal
set "USB=%~1"
set "QEMU_DIR=%USB%\launcher\qemu"
set "QEMU_ZIP=%TEMP%\qemu-portable.zip"

:: QEMU 8.2 portable Windows build (official qemu.org release)
set "QEMU_URL=https://qemu.weilnetz.de/w64/2024/qemu-w64-setup-20240221.exe"
set "QEMU_SETUP=%TEMP%\qemu-setup.exe"

echo.
echo  Downloading QEMU for Windows (~50MB)...
echo  Source: %QEMU_URL%
echo.

:: Use PowerShell to download (available on all modern Windows)
powershell -NoProfile -Command ^
    "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; " ^
    "Invoke-WebRequest -Uri '%QEMU_URL%' -OutFile '%QEMU_SETUP%' -UseBasicParsing"

if not exist "%QEMU_SETUP%" (
    echo  [ERROR] Download failed. Check your internet connection.
    exit /b 1
)

echo  [OK] Downloaded. Extracting...

:: QEMU installer is an NSIS installer — extract silently to target dir
"%QEMU_SETUP%" /S /D=%QEMU_DIR%

:: Wait for extraction
timeout /t 10 /nobreak >nul

if exist "%QEMU_DIR%\qemu-system-x86_64.exe" (
    echo  [OK] QEMU extracted to %QEMU_DIR%
    del /f /q "%QEMU_SETUP%" 2>nul
) else (
    echo  [WARN] Extraction may still be running. Waiting 20 more seconds...
    timeout /t 20 /nobreak >nul
    if exist "%QEMU_DIR%\qemu-system-x86_64.exe" (
        echo  [OK] QEMU ready.
        del /f /q "%QEMU_SETUP%" 2>nul
    ) else (
        echo  [ERROR] QEMU extraction failed.
        echo  Try installing QEMU manually from https://www.qemu.org/download/#windows
        exit /b 1
    )
)

endlocal
