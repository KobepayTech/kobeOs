const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const { autoUpdater } = require('electron-updater');

let mainWindow;

function createWindow() {
  const isDev = !app.isPackaged;

  mainWindow = new BrowserWindow({
    width: 1920, height: 1080, fullscreen: true, kiosk: true,
    autoHideMenuBar: true, frame: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,   // required for contextBridge in preload.js to work
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: !isDev,      // disable only in dev for local file:// resource loading
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.key.toLowerCase() === 'r') event.preventDefault();
    if (input.control && input.shift && input.key.toLowerCase() === 'i') event.preventDefault();
    if (input.key === 'F12') event.preventDefault();
    if (input.key === 'F5') event.preventDefault();
  });
}

// ── Auto-updater ──────────────────────────────────────────────────────────────

function setupAutoUpdater(win) {
  // Only run in packaged builds — skip in dev
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = false;       // ask user before downloading
  autoUpdater.autoInstallOnAppQuit = true;

  // Forward updater events to the renderer via IPC
  autoUpdater.on('checking-for-update', () => {
    win.webContents.send('updater', { event: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    win.webContents.send('updater', { event: 'available', version: info.version, releaseNotes: info.releaseNotes });
  });

  autoUpdater.on('update-not-available', () => {
    win.webContents.send('updater', { event: 'not-available' });
  });

  autoUpdater.on('download-progress', (progress) => {
    win.webContents.send('updater', {
      event: 'progress',
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    win.webContents.send('updater', { event: 'downloaded', version: info.version });
  });

  autoUpdater.on('error', (err) => {
    win.webContents.send('updater', { event: 'error', message: err.message });
  });

  // Check for updates 5s after launch, then every 4 hours
  setTimeout(() => autoUpdater.checkForUpdates(), 5_000);
  setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1_000);
}

// Renderer-initiated updater actions
ipcMain.handle('updater-download', () => autoUpdater.downloadUpdate());
ipcMain.handle('updater-install', () => {
  autoUpdater.quitAndInstall(false, true); // isSilent=false, isForceRunAfter=true
});
ipcMain.handle('updater-check', () => autoUpdater.checkForUpdates());

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater(mainWindow);
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('system-shutdown', () => {
  exec(process.platform === 'win32' ? 'shutdown /s /t 0' : 'poweroff');
});

ipcMain.handle('system-reboot', () => {
  exec(process.platform === 'win32' ? 'shutdown /r /t 0' : 'reboot');
});

// Allowlist: only canonical block device paths are accepted.
const DISK_PATH_RE = /^\/dev\/(sd[a-z]|hd[a-z]|vd[a-z]|nvme\d+n\d+|mmcblk\d+)$/;

ipcMain.handle('install-to-disk', async (event, diskPath) => {
  if (typeof diskPath !== 'string' || !DISK_PATH_RE.test(diskPath)) {
    return { success: false, error: `Invalid disk path: ${diskPath}` };
  }
  // Use execFile with an explicit argument array to avoid shell interpolation.
  const { execFile } = require('child_process');
  const script = [
    `echo "Installing KobeOS to ${diskPath}..."`,
    `parted ${diskPath} mklabel gpt`,
    `parted ${diskPath} mkpart primary ext4 1MiB 512MiB`,
    `parted ${diskPath} mkpart primary ext4 512MiB 100%`,
    `mkfs.ext4 ${diskPath}1 && mkfs.ext4 ${diskPath}2`,
    `mkdir -p /mnt/kobeos && mount ${diskPath}2 /mnt/kobeos`,
    `cp -a /opt/kobeos/* /mnt/kobeos/`,
    `mkdir -p /mnt/kobeos/boot/efi && mount ${diskPath}1 /mnt/kobeos/boot/efi`,
    `grub-install --target=x86_64-efi --efi-directory=/mnt/kobeos/boot/efi --bootloader-id=KobeOS --removable`,
    `grub-mkconfig -o /mnt/kobeos/boot/grub/grub.cfg`,
    `umount -R /mnt/kobeos`,
    `echo "INSTALL_COMPLETE"`,
  ].join('\n');
  return new Promise((resolve) => {
    execFile('/bin/bash', ['-c', script], { timeout: 300000 }, (error, stdout, stderr) => {
      resolve({ success: !error, output: stdout, error: stderr });
    });
  });
});

// Reads /proc/mounts to determine whether we're running from a live USB or an installed system.
ipcMain.handle('get-system-mode', () => {
  const fs = require('fs');
  try {
    const mounts = fs.readFileSync('/proc/mounts', 'utf8');
    if (
      mounts.includes('/dev/sr0') ||
      mounts.includes('/dev/cdrom') ||
      mounts.includes('overlay') ||
      mounts.includes('aufs')
    ) {
      return 'live-usb';
    }
    return 'installed';
  } catch {
    // /proc/mounts unavailable (Windows, macOS dev builds)
    return 'installed';
  }
});

ipcMain.handle('scan-disks', async () => {
  return new Promise((resolve) => {
    exec("lsblk -d -o NAME,SIZE,TYPE,MODEL -n | grep disk", (error, stdout) => {
      if (error) return resolve([]);
      const disks = stdout.trim().split('\n').map(line => {
        const parts = line.trim().split(/\s+/);
        return { name: parts[0], size: parts[1], model: parts.slice(3).join(' '), path: `/dev/${parts[0]}` };
      });
      resolve(disks);
    });
  });
});
