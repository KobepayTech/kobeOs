@echo off
:: qemu-launch.bat — Launch KobeOS ISO in QEMU
:: Usage: qemu-launch.bat <ISO_PATH> <QEMU_EXE>

setlocal
set "ISO=%~1"
set "QEMU=%~2"
set "USB=%~d0"

:: Persistent disk image stored on USB (survives reboots, acts like installed storage)
set "DISK=%USB%\launcher\kobeos-data.qcow2"

:: Create a 20GB persistent disk image if it doesn't exist
if not exist "%DISK%" (
    echo  Creating persistent disk image (20GB)...
    "%QEMU:qemu-system-x86_64.exe=qemu-img.exe%" create -f qcow2 "%DISK%" 20G
    if errorlevel 1 (
        echo  [WARN] Could not create persistent disk. Running without persistence.
        set "DISK="
    ) else (
        echo  [OK] Persistent disk created: %DISK%
    )
)

:: Build drive args
set "DRIVE_ARGS="
if defined DISK (
    set "DRIVE_ARGS=-drive file="%DISK%",format=qcow2,if=virtio"
)

echo.
echo  Launching KobeOS in QEMU...
echo  RAM: 2048MB  CPUs: 2  KVM: auto-detect
echo  ISO: %ISO%
if defined DISK echo  Disk: %DISK%
echo.

:: Launch QEMU
:: -enable-kvm is ignored on Windows (no KVM), but harmless
:: -vga virtio gives best display compatibility
:: -usb -device usb-tablet fixes mouse capture
start "" "%QEMU%" ^
    -name "KobeOS" ^
    -m 2048 ^
    -smp 2 ^
    -vga virtio ^
    -display sdl,grab-mod=right-ctrl ^
    -cdrom "%ISO%" ^
    -boot order=d ^
    %DRIVE_ARGS% ^
    -usb -device usb-tablet ^
    -netdev user,id=net0 -device virtio-net,netdev=net0 ^
    -rtc base=localtime ^
    -no-reboot

endlocal
