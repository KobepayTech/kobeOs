@echo off
:: vbox-launch.bat — Launch KobeOS ISO in VirtualBox
:: Usage: vbox-launch.bat <ISO_PATH> <VBOXMANAGE_EXE>

setlocal
set "ISO=%~1"
set "VBOX=%~2"
set "USB=%~d0"
set "VM_NAME=KobeOS-Portable"
set "DISK=%USB%\launcher\kobeos-vbox.vdi"

:: Check if VM already exists
"%VBOX%" showvminfo "%VM_NAME%" >nul 2>&1
if %errorlevel% equ 0 (
    echo  [OK] VM "%VM_NAME%" already exists — starting...
    goto :start_vm
)

echo  Creating VirtualBox VM: %VM_NAME%...

:: Create VM
"%VBOX%" createvm --name "%VM_NAME%" --ostype Debian_64 --register

:: Configure VM
"%VBOX%" modifyvm "%VM_NAME%" ^
    --memory 2048 ^
    --cpus 2 ^
    --vram 128 ^
    --graphicscontroller vmsvga ^
    --accelerate3d off ^
    --audio none ^
    --usb on ^
    --usbehci on ^
    --nic1 nat ^
    --natpf1 "kobeos-backend,tcp,,13000,,3000" ^
    --boot1 dvd --boot2 disk --boot3 none

:: Create storage controllers
"%VBOX%" storagectl "%VM_NAME%" --name "SATA" --add sata --controller IntelAhci
"%VBOX%" storagectl "%VM_NAME%" --name "IDE"  --add ide

:: Attach boot medium — raw disk device (Rufus DD) or ISO file
echo %ISO% | findstr /i "PhysicalDrive" >nul
if %errorlevel% equ 0 (
    :: Raw USB disk — create a VMDK wrapper so VirtualBox can use it
    set "VMDK=%USB%\launcher\kobeos-usb.vmdk"
    if not exist "!VMDK!" (
        echo  Creating raw disk VMDK wrapper...
        "%VBOX%" internalcommands createrawvmdk -filename "!VMDK!" -rawdisk "%ISO%"
    )
    "%VBOX%" storageattach "%VM_NAME%" ^
        --storagectl "SATA" --port 1 --device 0 ^
        --type hdd --medium "!VMDK!"
) else (
    "%VBOX%" storageattach "%VM_NAME%" ^
        --storagectl "IDE" --port 0 --device 0 ^
        --type dvddrive --medium "%ISO%"
)

:: Create + attach persistent disk (20GB)
if not exist "%DISK%" (
    echo  Creating persistent disk (20GB)...
    "%VBOX%" createmedium disk --filename "%DISK%" --size 20480 --format VDI
)
"%VBOX%" storageattach "%VM_NAME%" ^
    --storagectl "SATA" --port 0 --device 0 ^
    --type hdd --medium "%DISK%"

:start_vm
echo.
echo  Starting KobeOS in VirtualBox...
echo  (Right-Ctrl to release mouse)
echo.

:: Start in GUI mode
"%VBOX:VBoxManage.exe=VirtualBox.exe%" --startvm "%VM_NAME%"

endlocal
