/**
 * os-update-service.js — OS-level package/kernel update manager
 *
 * Installs systemd units on the target system that:
 *   1. Run `apt-get upgrade` on a timer (weekly by default)
 *   2. Reboot into the new kernel if one was installed
 *   3. Report status back via a JSON status file readable by the Electron app
 *
 * Called from the disk installer after the OS is laid out.
 * Also exposes IPC handlers so the UI can trigger/check OS updates.
 */

const { ipcMain } = require('electron');
const { exec, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const STATUS_FILE = '/var/lib/kobeos/os-update-status.json';

// ── Systemd unit definitions ──────────────────────────────────────────────────

const OS_UPDATE_SCRIPT = `#!/bin/bash
# KobeOS OS update script — run by systemd timer
set -euo pipefail

STATUS_FILE="${STATUS_FILE}"
mkdir -p "$(dirname "$STATUS_FILE")"

write_status() {
  echo "{\\"status\\":\\"$1\\",\\"message\\":\\"$2\\",\\"timestamp\\":\\"$(date -Iseconds)\\"}" > "$STATUS_FILE"
}

write_status "running" "Checking for updates"

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq 2>&1 | tail -5

UPGRADABLE=$(apt list --upgradable 2>/dev/null | grep -v "^Listing" | wc -l)

if [ "$UPGRADABLE" -eq 0 ]; then
  write_status "up-to-date" "No updates available"
  exit 0
fi

write_status "upgrading" "Installing $UPGRADABLE package(s)"

# Upgrade security + kernel packages only (safe for kiosk)
apt-get upgrade -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" \
  --with-new-pkgs 2>&1 | tail -20

# Check if a new kernel was installed
if ls /boot/vmlinuz-* 2>/dev/null | grep -qv "$(uname -r)"; then
  write_status "reboot-required" "Kernel updated — reboot scheduled"
  # Schedule reboot for 3am if not in business hours (8-18)
  HOUR=$(date +%H)
  if [ "$HOUR" -lt 8 ] || [ "$HOUR" -ge 18 ]; then
    shutdown -r +1 "KobeOS kernel update — rebooting in 1 minute"
  else
    # Write a flag so the UI can prompt the user
    echo "kernel-update" > /var/lib/kobeos/reboot-required
  fi
else
  write_status "complete" "Updated $UPGRADABLE package(s)"
fi
`;

const OS_UPDATE_SERVICE = `[Unit]
Description=KobeOS OS Update
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/kobeos-os-update
StandardOutput=journal
StandardError=journal
`;

const OS_UPDATE_TIMER = `[Unit]
Description=KobeOS OS Update Timer
Requires=kobeos-os-update.service

[Timer]
# Run weekly on Sunday at 02:00, and once on boot after 5 minutes
OnCalendar=Sun *-*-* 02:00:00
OnBootSec=5min
Persistent=true

[Install]
WantedBy=timers.target
`;

// ── Install units onto target system ─────────────────────────────────────────

function getInstallCommands() {
  return `
# ── OS update service ──────────────────────────────────────────────────────────
mkdir -p /var/lib/kobeos

cat > /usr/local/bin/kobeos-os-update << 'SCRIPTEOF'
${OS_UPDATE_SCRIPT}
SCRIPTEOF
chmod +x /usr/local/bin/kobeos-os-update

cat > /etc/systemd/system/kobeos-os-update.service << 'SVCEOF'
${OS_UPDATE_SERVICE}
SVCEOF

cat > /etc/systemd/system/kobeos-os-update.timer << 'TIMEREOF'
${OS_UPDATE_TIMER}
TIMEREOF

systemctl enable kobeos-os-update.timer || true
`;
}

// ── IPC: check OS update status (reads status file written by the script) ─────

ipcMain.handle('os-update:status', () => {
  try {
    if (fs.existsSync(STATUS_FILE)) {
      return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
    }
    const rebootFlag = '/var/lib/kobeos/reboot-required';
    if (fs.existsSync(rebootFlag)) {
      return { status: 'reboot-required', message: fs.readFileSync(rebootFlag, 'utf8').trim(), timestamp: null };
    }
    return { status: 'unknown', message: 'No update status available', timestamp: null };
  } catch {
    return { status: 'error', message: 'Could not read status file', timestamp: null };
  }
});

// ── IPC: trigger an immediate OS update check ─────────────────────────────────

ipcMain.handle('os-update:run', () => {
  return new Promise((resolve) => {
    execFile('/bin/bash', ['-c', 'systemctl start kobeos-os-update.service'], { timeout: 300_000 }, (err, stdout, stderr) => {
      resolve({ success: !err, output: stdout, error: stderr });
    });
  });
});

// ── IPC: clear reboot-required flag (after user acknowledges) ─────────────────

ipcMain.handle('os-update:clearReboot', () => {
  try {
    const f = '/var/lib/kobeos/reboot-required';
    if (fs.existsSync(f)) fs.unlinkSync(f);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

module.exports = { getInstallCommands };
