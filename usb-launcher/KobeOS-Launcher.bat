@echo off
setlocal EnableDelayedExpansion
title KobeOS Launcher

:: ── Resolve USB root (the drive this script is running from) ─────────────────
set "USB=%~d0"
set "ISO=%USB%\KobeOS-Installer.iso"

echo.
echo  ██╗  ██╗ ██████╗ ██████╗ ███████╗ ██████╗ ███████╗
echo  ██║ ██╔╝██╔═══██╗██╔══██╗██╔════╝██╔═══██╗██╔════╝
echo  █████╔╝ ██║   ██║██████╔╝█████╗  ██║   ██║███████╗
echo  ██╔═██╗ ██║   ██║██╔══██╗██╔══╝  ██║   ██║╚════██║
echo  ██║  ██╗╚██████╔╝██████╔╝███████╗╚██████╔╝███████║
echo  ╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝ ╚═════╝ ╚══════╝
echo.
echo  KobeOS Portable Launcher v1.0.0
echo  Running from: %USB%
echo.

:: ── Check ISO exists ──────────────────────────────────────────────────────────
if not exist "%ISO%" (
    echo  [ERROR] KobeOS-Installer.iso not found on %USB%
    echo  Make sure the ISO is in the root of the USB drive.
    pause
    exit /b 1
)

:: ── Detect VirtualBox ─────────────────────────────────────────────────────────
set "VBOX="
for %%P in (
    "%ProgramFiles%\Oracle\VirtualBox\VBoxManage.exe"
    "%ProgramFiles(x86)%\Oracle\VirtualBox\VBoxManage.exe"
    "C:\Program Files\Oracle\VirtualBox\VBoxManage.exe"
) do (
    if exist %%P set "VBOX=%%~P"
)

if defined VBOX (
    echo  [OK] VirtualBox detected: %VBOX%
    echo  Starting KobeOS in VirtualBox...
    call "%USB%\launcher\vbox-launch.bat" "%ISO%" "%VBOX%"
    goto :end
)

:: ── Detect QEMU (portable on USB first, then system) ─────────────────────────
set "QEMU="
if exist "%USB%\launcher\qemu\qemu-system-x86_64.exe" (
    set "QEMU=%USB%\launcher\qemu\qemu-system-x86_64.exe"
    echo  [OK] QEMU portable found on USB
) else (
    for %%P in (
        "%ProgramFiles%\qemu\qemu-system-x86_64.exe"
        "%ProgramFiles(x86)%\qemu\qemu-system-x86_64.exe"
        "C:\Program Files\qemu\qemu-system-x86_64.exe"
    ) do (
        if exist %%P set "QEMU=%%~P"
    )
)

if defined QEMU (
    echo  [OK] QEMU detected: %QEMU%
    echo  Starting KobeOS in QEMU...
    call "%USB%\launcher\qemu-launch.bat" "%ISO%" "%QEMU%"
    goto :end
)

:: ── Neither found — offer to download QEMU portable ──────────────────────────
echo.
echo  [!] Neither VirtualBox nor QEMU was found.
echo.
echo  Options:
echo    1. Download QEMU portable to this USB (requires internet, ~50MB)
echo    2. Install VirtualBox from https://virtualbox.org then re-run
echo    3. Exit
echo.
set /p CHOICE="  Enter choice (1/2/3): "

if "%CHOICE%"=="1" (
    call "%USB%\launcher\download-qemu.bat" "%USB%"
    if exist "%USB%\launcher\qemu\qemu-system-x86_64.exe" (
        set "QEMU=%USB%\launcher\qemu\qemu-system-x86_64.exe"
        call "%USB%\launcher\qemu-launch.bat" "%ISO%" "%QEMU%"
    ) else (
        echo  [ERROR] Download failed. Please install VirtualBox manually.
        pause
    )
) else if "%CHOICE%"=="2" (
    start https://www.virtualbox.org/wiki/Downloads
) else (
    echo  Exiting.
)

:end
endlocal
