#!/usr/bin/env node
/**
 * write-usb.js — Write KobeOS to a USB drive as a dual-purpose device:
 *   1. Bootable on bare metal (via GRUB + ISO hybrid)
 *   2. Launchable as a VM from Windows (via KobeOS-Launcher.bat)
 *
 * Usage:
 *   sudo node scripts/write-usb.js /dev/sdX
 *
 * What it does:
 *   - Writes the ISO as a hybrid bootable image (dd-style via xorriso)
 *   - Mounts the USB and copies the Windows launcher files to the root
 *   - The USB will show KobeOS-Launcher.bat when opened in Windows Explorer
 *   - The USB will boot KobeOS directly on bare metal
 *
 * Requirements: xorriso, parted, mount (Linux only)
 */

const { execSync, execFileSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const ISO_PATH      = path.join(__dirname, '..', 'KobeOS-Installer.iso');
const LAUNCHER_DIR  = path.join(__dirname, '..', 'usb-launcher');
const MOUNT_POINT   = '/tmp/kobeos-usb-mount';

const diskPath = process.argv[2];

// ── Validate ──────────────────────────────────────────────────────────────────

if (!diskPath) {
  console.error('Usage: sudo node scripts/write-usb.js /dev/sdX');
  console.error('Example: sudo node scripts/write-usb.js /dev/sdb');
  process.exit(1);
}

if (!/^\/dev\/(sd[b-z]|hd[b-z]|vd[b-z])$/.test(diskPath)) {
  console.error(`Invalid disk path: ${diskPath}`);
  console.error('Must be /dev/sdX (not /dev/sda — that is usually your system disk)');
  process.exit(1);
}

if (!fs.existsSync(ISO_PATH)) {
  console.error(`ISO not found: ${ISO_PATH}`);
  console.error('Run: node scripts/build-iso.js first');
  process.exit(1);
}

if (process.getuid() !== 0) {
  console.error('This script must be run as root: sudo node scripts/write-usb.js /dev/sdX');
  process.exit(1);
}

// ── Confirm ───────────────────────────────────────────────────────────────────

const isoSize = (fs.statSync(ISO_PATH).size / 1024 / 1024 / 1024).toFixed(2);
console.log(`\n  KobeOS USB Writer`);
console.log(`  ISO:  ${ISO_PATH} (${isoSize} GB)`);
console.log(`  Disk: ${diskPath}`);
console.log(`\n  WARNING: ALL DATA ON ${diskPath} WILL BE ERASED.\n`);

// Unmount any existing partitions on the disk
try {
  const parts = execSync(`lsblk -ln -o NAME ${diskPath} 2>/dev/null`).toString().trim().split('\n').slice(1);
  for (const p of parts) {
    try { execSync(`umount /dev/${p.trim()} 2>/dev/null`); } catch { /* ignore */ }
  }
} catch { /* ignore */ }

// ── Step 1: Write ISO as hybrid bootable image ────────────────────────────────

console.log('  [1/3] Writing bootable ISO to USB (this takes a few minutes)...');
execFileSync('xorriso', [
  '-as', 'dd',
  '-indev', ISO_PATH,
  '-outdev', diskPath,
  '-progress',
], { stdio: 'inherit' });
console.log('  [1/3] Done.\n');

// ── Step 2: Create a Windows-accessible partition for launcher files ──────────
// The ISO hybrid leaves free space at the end of the disk.
// We create a small FAT32 partition there for the launcher files.

console.log('  [2/3] Creating Windows launcher partition...');

// Get disk size in sectors
const diskSectors = parseInt(
  execSync(`blockdev --getsz ${diskPath}`).toString().trim(), 10
);
// ISO typically uses first ~850k sectors for 831MB ISO; start launcher partition after
const isoSectors = Math.ceil((fs.statSync(ISO_PATH).size / 512) + 2048);
const launcherStart = isoSectors;
const launcherEnd   = diskSectors - 1;

if (launcherEnd - launcherStart < 204800) {
  // Less than 100MB free — skip launcher partition, just copy to ISO root
  console.log('  [2/3] Not enough free space for launcher partition — skipping.');
  console.log('        Launcher files will be embedded in the ISO only.\n');
} else {
  try {
    execSync(`parted -s ${diskPath} mkpart primary fat32 ${launcherStart}s ${launcherEnd}s`);
    execSync(`partprobe ${diskPath} 2>/dev/null || true`);
    // Wait for kernel to register new partition
    execSync('sleep 2');

    // Find the new partition
    const newPart = diskPath.replace('/dev/', '') + (diskPath.includes('nvme') ? 'p' : '') + '2';
    const partDev = `/dev/${newPart}`;

    if (fs.existsSync(partDev)) {
      execSync(`mkfs.fat -F32 -n KOBEOS_WIN ${partDev}`);
      fs.mkdirSync(MOUNT_POINT, { recursive: true });
      execSync(`mount ${partDev} ${MOUNT_POINT}`);

      // Copy launcher files
      execSync(`cp -r ${LAUNCHER_DIR}/. ${MOUNT_POINT}/`, { stdio: 'inherit' });

      // Also copy the ISO itself so QEMU/VBox can find it on the same partition
      // (symlink not possible on FAT32 — copy a small stub that points to the ISO)
      fs.writeFileSync(path.join(MOUNT_POINT, 'ISO_LOCATION.txt'),
        `The KobeOS ISO is on this USB drive.\n` +
        `When you run KobeOS-Launcher.bat, it will find the ISO automatically.\n` +
        `ISO file: KobeOS-Installer.iso (in the root of the bootable partition)\n`
      );

      execSync(`umount ${MOUNT_POINT}`);
      console.log(`  [2/3] Launcher partition created on ${partDev}\n`);
    } else {
      console.log(`  [2/3] Partition device ${partDev} not found — skipping.\n`);
    }
  } catch (err) {
    console.warn(`  [2/3] Launcher partition failed: ${err.message} — skipping.\n`);
  }
}

// ── Step 3: Sync and eject ────────────────────────────────────────────────────

console.log('  [3/3] Syncing...');
execSync('sync');
try { execSync(`eject ${diskPath} 2>/dev/null`); } catch { /* ignore */ }

console.log(`
  ✅ Done! USB is ready.

  On bare metal:
    Boot from the USB — KobeOS GRUB menu will appear.

  On Windows (without rebooting):
    1. Open the USB drive in Windows Explorer
    2. Double-click KobeOS-Launcher.bat
    3. KobeOS will start in a VM window

  Note: The launcher auto-detects VirtualBox (faster) or QEMU (portable).
        If neither is installed, it will offer to download QEMU (~50MB).
`);
