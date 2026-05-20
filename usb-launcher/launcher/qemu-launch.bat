@echo off
:: qemu-launch.bat — Launch KobeOS in QEMU
:: Usage: qemu-launch.bat <ISO_OR_RAW_DISK> <QEMU_EXE>

setlocal
set "ISO=%~1"
set "QEMU=%~2"
set "USB=%~d0"

:: Persistent disk image stored on USB
set "DISK=%USB%\launcher\kobeos-data.qcow2"

:: Detect if booting from raw disk device (Rufus DD mode) or ISO file
set "BOOT_ARGS="
echo %ISO% | findstr /i "PhysicalDrive" >nul
if %errorlevel% equ 0 (
    :: Raw disk — boot directly from the USB physical device
    echo  [INFO] Booting from raw USB device: %ISO%
    set "BOOT_ARGS=-drive file=%ISO%,format=raw,if=ide,media=disk -boot order=c"
) else (
    :: ISO file
    set "BOOT_ARGS=-cdrom "%ISO%" -boot order=d"
)

:: Create persistent data disk if it doesn't exist
if not exist "%DISK%" (
    echo  Creating persistent disk image (20GB)...
    "%QEMU:qemu-system-x86_64.exe=qemu-img.exe%" create -f qcow2 "%DISK%" 20G
    if errorlevel 1 (
        echo  [WARN] Could not create persistent disk. Running without persistence.
        set "DISK="
    ) else (
        echo  [OK] Persistent disk: %DISK%
    )
)

set "DRIVE_ARGS="
if defined DISK (
    set "DRIVE_ARGS=-drive file="%DISK%",format=qcow2,if=virtio"
)

echo.
echo  Launching KobeOS in QEMU...
echo  RAM: 2048MB  CPUs: 2
echo  Boot: %ISO%
if defined DISK echo  Data: %DISK%
echo  Right-Ctrl = release mouse
echo.

start "" "%QEMU%" ^
    -name "KobeOS" ^
    -m 2048 ^
    -smp 2 ^
    -vga virtio ^
    -display sdl,grab-mod=right-ctrl ^
    %BOOT_ARGS% ^
    %DRIVE_ARGS% ^
    -usb -device usb-tablet ^
    -netdev user,id=net0 -device virtio-net,netdev=net0 ^
    -rtc base=localtime ^
    -no-reboot

endlocal
