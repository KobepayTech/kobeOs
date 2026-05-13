const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920, height: 1080, fullscreen: true, kiosk: true,
    autoHideMenuBar: true, frame: false,
    webPreferences: {
      nodeIntegration: true, contextIsolation: false,
      enableRemoteModule: true, webSecurity: false
    }
  });

  const isDev = !app.isPackaged;
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

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('system-shutdown', () => {
  exec(process.platform === 'win32' ? 'shutdown /s /t 0' : 'poweroff');
});

ipcMain.handle('system-reboot', () => {
  exec(process.platform === 'win32' ? 'shutdown /r /t 0' : 'reboot');
});

ipcMain.handle('install-to-disk', async (event, diskPath) => {
  return new Promise((resolve) => {
    const script = `
      echo "Installing KobeOS to ${diskPath}..."
      parted ${diskPath} mklabel gpt
      parted ${diskPath} mkpart primary ext4 1MiB 512MiB
      parted ${diskPath} mkpart primary ext4 512MiB 100%
      mkfs.ext4 ${diskPath}1 && mkfs.ext4 ${diskPath}2
      mkdir -p /mnt/kobeos && mount ${diskPath}2 /mnt/kobeos
      cp -a /opt/kobeos/* /mnt/kobeos/
      mkdir -p /mnt/kobeos/boot/efi && mount ${diskPath}1 /mnt/kobeos/boot/efi
      grub-install --target=x86_64-efi --efi-directory=/mnt/kobeos/boot/efi --bootloader-id=KobeOS --removable
      grub-mkconfig -o /mnt/kobeos/boot/grub/grub.cfg
      umount -R /mnt/kobeos
      echo "INSTALL_COMPLETE"
    `;
    exec(script, { timeout: 300000 }, (error, stdout, stderr) => {
      resolve({ success: !error, output: stdout, error: stderr });
    });
  });
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
