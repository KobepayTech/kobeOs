╔══════════════════════════════════════════════════════════╗
║              KobeOS Portable USB Drive                  ║
║                    Version 1.0.0                        ║
╚══════════════════════════════════════════════════════════╝

This USB drive works in two ways:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  HOW TO WRITE THIS USB (using Rufus)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  1. Download Rufus from https://rufus.ie
  2. Open Rufus, select your USB drive
  3. Click SELECT and choose KobeOS-Installer.iso
  4. IMPORTANT: When Rufus asks "Write in ISO or DD mode?"
     → Choose DD Image mode
  5. Click START and wait for it to finish
  6. After Rufus finishes, copy these files to the USB root:
       KobeOS-Launcher.bat
       README.txt
       autorun.inf
       launcher\  (entire folder)

  That's it — the USB is now dual-purpose.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  OPTION 1 — Run inside Windows (no reboot needed)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  1. Open this USB drive in Windows Explorer
  2. Double-click: KobeOS-Launcher.bat
  3. KobeOS opens in a VM window — Windows keeps running

  The launcher automatically detects:
    • VirtualBox (if installed) — best performance
    • QEMU (if installed or found on this USB) — portable
    • If neither found, it offers to download QEMU (~50MB)

  Your KobeOS data is saved to:
    launcher\kobeos-data.qcow2  (QEMU)
    launcher\kobeos-vbox.vdi    (VirtualBox)
  These files persist on the USB between sessions.

  Controls inside the VM:
    • Right-Ctrl     — release mouse from VM window
    • Right-Ctrl+F   — toggle fullscreen


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  OPTION 2 — Boot natively (restart required)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  1. Restart your computer
  2. Press F12 / F2 / Del / Esc during startup to open boot menu
     (key varies by manufacturer — usually shown on screen)
  3. Select this USB drive from the boot menu
  4. Choose from the KobeOS menu:
       • Try KobeOS Live       — run without installing
       • Install KobeOS to Disk — install permanently
       • Safe graphics mode    — use if screen is blank
       • Recovery              — restore an installed system


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  REQUIREMENTS (for VM mode)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  • Windows 10 or 11 (64-bit)
  • At least 4GB RAM free
  • At least 25GB free on the USB drive
  • VirtualBox 6.1+ (https://virtualbox.org) OR
    QEMU for Windows (launcher can download automatically)

  Note: On some systems, VirtualBox requires
  "Hyper-V" to be disabled in Windows features.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  TROUBLESHOOTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  "Windows protected your PC" warning:
    Click "More info" → "Run anyway"
    (The launcher is a plain .bat script, not signed)

  Black screen in VM:
    The launcher uses "safe graphics" mode by default.
    If still black, try VirtualBox instead of QEMU.

  USB not booting on bare metal:
    Make sure Secure Boot is disabled in BIOS/UEFI.
    Try the "Safe graphics / nomodeset" boot option.

  VirtualBox VM already exists error:
    Delete the VM named "KobeOS-Portable" in VirtualBox
    Manager, then re-run the launcher.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  KobepayTech — https://github.com/KobepayTech/kobeOs
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
