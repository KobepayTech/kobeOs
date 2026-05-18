const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, execFile, spawn } = require('child_process');
const { setupAutoUpdater } = require('./update-manager');

let mainWindow;
let backendProcess = null;
let embeddedPg = null;

// ── Paths ─────────────────────────────────────────────────────────────────────

const IS_PACKAGED  = app.isPackaged;
const USER_DATA    = app.getPath('userData');
const PG_DATA_DIR  = path.join(USER_DATA, 'pgdata');
const SERVER_BUNDLE = IS_PACKAGED
  ? path.join(process.resourcesPath, 'server-bundle', 'index.js')
  : path.join(__dirname, 'server-bundle', 'index.js');

// ── System mode detection ─────────────────────────────────────────────────────

function getSystemMode() {
  try {
    const mounts = fs.readFileSync('/proc/mounts', 'utf8');
    if (
      mounts.includes('/dev/sr0') ||
      mounts.includes('/dev/cdrom') ||
      mounts.includes('overlay') ||
      mounts.includes('aufs')
    ) return 'live-usb';
    return 'installed';
  } catch {
    return 'installed';
  }
}

// ── Embedded PostgreSQL (live-usb mode) ───────────────────────────────────────

async function startEmbeddedPostgres() {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const pg = new EmbeddedPostgres({
    databaseDir: PG_DATA_DIR,
    user: 'kobeos',
    password: 'kobeos_live',
    port: 5433,
    persistent: true,
  });
  await pg.initialise();
  await pg.start();
  const client = pg.getPgClient();
  await client.connect();
  try { await client.query('CREATE DATABASE kobeos'); } catch { /* exists */ }
  finally { await client.end(); }
  embeddedPg = pg;
  console.log('[KobeOS] Embedded PostgreSQL started on :5433');
  return { host: '127.0.0.1', port: 5433, user: 'kobeos', password: 'kobeos_live', database: 'kobeos' };
}

// ── System PostgreSQL (installed mode) ────────────────────────────────────────

async function ensureSystemPostgres() {
  return new Promise((resolve) => {
    const setup = [
      `sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='kobeos'" | grep -q 1 || sudo -u postgres psql -c "CREATE USER kobeos WITH PASSWORD 'kobeos_prod' CREATEDB"`,
      `sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='kobeos'" | grep -q 1 || sudo -u postgres createdb -O kobeos kobeos`,
    ].join(' && ');
    exec(setup, (err) => {
      if (err) console.warn('[KobeOS] PG setup warning:', err.message);
      resolve({ host: '127.0.0.1', port: 5432, user: 'kobeos', password: 'kobeos_prod', database: 'kobeos' });
    });
  });
}

// ── JWT secret ────────────────────────────────────────────────────────────────

function getOrCreateJwtSecret() {
  const secretFile = path.join(USER_DATA, '.jwt_secret');
  if (fs.existsSync(secretFile)) return fs.readFileSync(secretFile, 'utf8').trim();
  const secret = require('crypto').randomBytes(36).toString('hex');
  fs.mkdirSync(USER_DATA, { recursive: true });
  fs.writeFileSync(secretFile, secret, { mode: 0o600 });
  return secret;
}

// ── NestJS backend ────────────────────────────────────────────────────────────

function startBackend(dbConfig) {
  if (!fs.existsSync(SERVER_BUNDLE)) {
    console.warn('[KobeOS] Server bundle not found:', SERVER_BUNDLE);
    return;
  }
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: '3000',
    DB_HOST: dbConfig.host,
    DB_PORT: String(dbConfig.port),
    DB_USERNAME: dbConfig.user,
    DB_PASSWORD: dbConfig.password,
    DB_DATABASE: dbConfig.database,
    DB_SYNCHRONIZE: 'true',
    JWT_SECRET: getOrCreateJwtSecret(),
    CORS_ORIGIN: 'file://',
  };
  backendProcess = spawn(process.execPath, [SERVER_BUNDLE], {
    env, stdio: ['ignore', 'pipe', 'pipe'], detached: false,
  });
  backendProcess.stdout.on('data', (d) => console.log('[backend]', d.toString().trim()));
  backendProcess.stderr.on('data', (d) => console.error('[backend]', d.toString().trim()));
  backendProcess.on('exit', (code, signal) => {
    console.log(`[KobeOS] Backend exited code=${code} signal=${signal}`);
    backendProcess = null;
  });
  console.log('[KobeOS] Backend started pid=' + backendProcess.pid);
}

function stopBackend() {
  if (backendProcess) { backendProcess.kill('SIGTERM'); backendProcess = null; }
}

async function stopEmbeddedPostgres() {
  if (embeddedPg) { try { await embeddedPg.stop(); } catch { } embeddedPg = null; }
}

// ── Boot sequence ─────────────────────────────────────────────────────────────

async function bootServices() {
  const mode = getSystemMode();
  console.log('[KobeOS] mode:', mode);
  let dbConfig;
  if (mode === 'live-usb') {
    dbConfig = await startEmbeddedPostgres();
  } else {
    dbConfig = await ensureSystemPostgres();
  }
  await new Promise((r) => setTimeout(r, 1500));
  startBackend(dbConfig);
  await new Promise((r) => setTimeout(r, 3000));
}

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow() {
  const isDev = !IS_PACKAGED;
  mainWindow = new BrowserWindow({
    width: 1920, height: 1080, fullscreen: true, kiosk: true,
    autoHideMenuBar: true, frame: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: !isDev,
    },
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

// Auto-updater with rollback is handled by ./update-manager.js

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  await bootServices();
  createWindow();
  setupAutoUpdater(mainWindow);
});

app.on('window-all-closed', async () => {
  stopBackend();
  await stopEmbeddedPostgres();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  stopBackend();
  await stopEmbeddedPostgres();
});

// ── System IPC ────────────────────────────────────────────────────────────────

ipcMain.handle('system-shutdown', () => {
  exec(process.platform === 'win32' ? 'shutdown /s /t 0' : 'poweroff');
});
ipcMain.handle('system-reboot', () => {
  exec(process.platform === 'win32' ? 'shutdown /r /t 0' : 'reboot');
});
ipcMain.handle('get-system-mode', () => getSystemMode());
ipcMain.handle('get-backend-status', () => ({
  running: backendProcess !== null,
  pid: backendProcess?.pid ?? null,
  embeddedPg: embeddedPg !== null,
}));

// ── Disk install ──────────────────────────────────────────────────────────────

const DISK_PATH_RE = /^\/dev\/(sd[a-z]|hd[a-z]|vd[a-z]|nvme\d+n\d+|mmcblk\d+)$/;

ipcMain.handle('install-to-disk', async (event, diskPath) => {
  if (typeof diskPath !== 'string' || !DISK_PATH_RE.test(diskPath)) {
    return { success: false, error: `Invalid disk path: ${diskPath}` };
  }
  const script = `
set -e
echo "=== KobeOS Disk Installer ==="

parted -s ${diskPath} mklabel gpt
parted -s ${diskPath} mkpart primary fat32 1MiB 512MiB
parted -s ${diskPath} set 1 esp on
parted -s ${diskPath} mkpart primary ext4 512MiB 100%
mkfs.fat -F32 ${diskPath}1
mkfs.ext4 -F ${diskPath}2

mkdir -p /mnt/kobeos
mount ${diskPath}2 /mnt/kobeos
mkdir -p /mnt/kobeos/boot/efi
mount ${diskPath}1 /mnt/kobeos/boot/efi

echo "Copying KobeOS..."
mkdir -p /mnt/kobeos/opt/kobeos
cp -a /opt/kobeos/. /mnt/kobeos/opt/kobeos/

echo "Installing system packages..."
apt-get install -y --no-install-recommends openbox xorg xinit postgresql postgresql-client nodejs 2>/dev/null || true

echo "Configuring PostgreSQL..."
systemctl enable postgresql || true
sudo -u postgres psql -c "CREATE USER kobeos WITH PASSWORD 'kobeos_prod' CREATEDB" 2>/dev/null || true
sudo -u postgres createdb -O kobeos kobeos 2>/dev/null || true

cat > /etc/systemd/system/kobeos-backend.service << 'SVCEOF'
[Unit]
Description=KobeOS Backend API
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=kobeos
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=DB_HOST=127.0.0.1
Environment=DB_PORT=5432
Environment=DB_USERNAME=kobeos
Environment=DB_PASSWORD=kobeos_prod
Environment=DB_DATABASE=kobeos
Environment=DB_SYNCHRONIZE=true
EnvironmentFile=-/opt/kobeos/resources/.env
ExecStart=/usr/bin/node /opt/kobeos/resources/server-bundle/index.js
Restart=on-failure
RestartSec=5
[Install]
WantedBy=multi-user.target
SVCEOF

cat > /etc/systemd/system/kobeos-kiosk.service << 'SVCEOF'
[Unit]
Description=KobeOS Kiosk
After=graphical.target kobeos-backend.service
Requires=kobeos-backend.service

[Service]
Type=simple
User=kobeos
Environment=DISPLAY=:0
Environment=HOME=/home/kobeos
ExecStartPre=/bin/bash -c "Xorg :0 -nolisten tcp &"
ExecStartPre=/bin/sleep 2
ExecStart=/opt/kobeos/kobeos --no-sandbox --disable-gpu --kiosk
Restart=on-failure
RestartSec=3
[Install]
WantedBy=graphical.target
SVCEOF

useradd -m -s /bin/bash kobeos 2>/dev/null || true
systemctl enable kobeos-backend.service kobeos-kiosk.service || true

grub-install --target=x86_64-efi --efi-directory=/mnt/kobeos/boot/efi --bootloader-id=KobeOS --removable
grub-mkconfig -o /mnt/kobeos/boot/grub/grub.cfg

umount -R /mnt/kobeos
echo "INSTALL_COMPLETE"
`;
  return new Promise((resolve) => {
    execFile('/bin/bash', ['-c', script], { timeout: 600_000 }, (error, stdout, stderr) => {
      resolve({ success: !error, output: stdout, error: stderr });
    });
  });
});

ipcMain.handle('scan-disks', async () => {
  return new Promise((resolve) => {
    exec('lsblk -d -o NAME,SIZE,TYPE,MODEL -n | grep disk', (error, stdout) => {
      if (error) return resolve([]);
      const disks = stdout.trim().split('\n').filter(Boolean).map((line) => {
        const parts = line.trim().split(/\s+/);
        return { name: parts[0], size: parts[1], model: parts.slice(3).join(' '), path: `/dev/${parts[0]}` };
      });
      resolve(disks);
    });
  });
});
