@echo off
setlocal EnableDelayedExpansion
title KobeOS Launcher

:: ── Resolve USB root (the drive this script is running from) ─────────────────
set "USB=%~d0"

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

:: ── Locate the ISO ────────────────────────────────────────────────────────────
:: Priority:
::   1. KobeOS-Installer.iso in USB root (manual copy or write-usb.js)
::   2. The USB drive itself as a raw device (written by Rufus in DD mode)
::      — QEMU and VirtualBox can boot directly from the physical disk device

set "ISO="
set "USE_RAW_DISK=0"

:: Check for ISO file first
if exist "%USB%\KobeOS-Installer.iso" (
    set "ISO=%USB%\KobeOS-Installer.iso"
    echo  [OK] Found ISO file: %ISO%
    goto :iso_found
)

:: No ISO file — detect the physical disk letter so we can pass the raw device
:: to QEMU/VirtualBox (works when Rufus wrote in DD mode)
echo  [INFO] No ISO file found on %USB%
echo  [INFO] Detecting USB physical disk for direct boot (Rufus DD mode)...

for /f "tokens=*" %%D in ('wmic logicaldisk where "DeviceID='%USB:~0,2%'" get DeviceID^,VolumeName /format:list 2^>nul') do (
    echo %%D | findstr /i "kobeos" >nul && set "USE_RAW_DISK=1"
)

:: Use PowerShell to find the physical disk number for this drive letter
for /f "usebackq tokens=*" %%P in (`powershell -NoProfile -Command ^
    "$dl = '%USB:~0,2%'; $disk = Get-Partition | Where-Object { $_.DriveLetter -eq $dl[0] } | Get-Disk; if($disk){ '\\.\PhysicalDrive' + $disk.Number }"`) do (
    set "RAW_DISK=%%P"
)

if defined RAW_DISK (
    echo  [OK] USB physical device: %RAW_DISK%
    set "ISO=%RAW_DISK%"
    set "USE_RAW_DISK=1"
    goto :iso_found
)

echo  [ERROR] Could not find KobeOS ISO or detect USB disk.
echo.
echo  Solutions:
echo    A) Copy KobeOS-Installer.iso to the root of this USB drive, OR
echo    B) Re-write the USB with Rufus using DD Image mode and a KobeOS ISO
echo       labelled KOBEOS (check volume label in Rufus before writing)
echo.
pause
exit /b 1

:iso_found

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
