const { app, BrowserWindow, ipcMain, net, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, execFile, spawn } = require('child_process');
const { setupAutoUpdater } = require('./update-manager.cjs');
const localdb = require('./localdb');
const syncEngine = require('./sync-engine');
const osUpdateService = require('./os-update-service');
const lanServer = require('./lan-server');
const kobeRuntime = require('./runtime/index');
const { enforceIntegrity } = require('./core-integrity');
const SpeechService = require('../ai/speech/speech-service');
const { registerSpeechIpc } = require('../ai/speech/speech-ipc');
const PostgresManager = require('./pg-bootstrap.cjs');

let mainWindow;
let splashWindow = null;
let backendProcess = null;
let embeddedPg = null;

// ── Splash window ─────────────────────────────────────────────────────────────

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 1920, height: 1080, fullscreen: true,
    frame: false, transparent: false,
    autoHideMenuBar: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: false,
      preload: path.join(__dirname, 'splash-preload.cjs'),
    },
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.on('closed', () => { splashWindow = null; });
}

function sendBootProgress(pct, msg) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('boot-progress', { pct, msg });
  }
}

function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
}

// ── Paths ─────────────────────────────────────────────────────────────────────

const IS_PACKAGED  = app.isPackaged;
const USER_DATA    = app.getPath('userData');

// ── Speech service (whisper.cpp STT + Web Speech TTS) ─────────────────────────
const speechService = new SpeechService({
  userDataPath:   USER_DATA,
  resourcesPath:  IS_PACKAGED ? process.resourcesPath : path.join(__dirname, '../resources'),
  whisperModel:   'whisper:base',
});
registerSpeechIpc(speechService);
const PG_DATA_DIR  = path.join(USER_DATA, 'pgdata');
const SERVER_BUNDLE = IS_PACKAGED
  ? path.join(process.resourcesPath, 'server-bundle', 'index.js')
  : path.join(__dirname, 'server-bundle', 'index.js');

// ── System mode detection ─────────────────────────────────────────────────────
// Desktop app always uses embedded postgres — no system postgres dependency.
// 'live-usb' = embedded postgres on ephemeral storage (ISO boot)
// 'desktop'  = embedded postgres on persistent userData directory
// 'installed' = legacy: system postgres (Linux kiosk installs only)

function getSystemMode() {
  // Packaged desktop app always uses embedded postgres
  if (IS_PACKAGED) return 'desktop';
  // Dev mode: use embedded postgres too (no system postgres required)
  try {
    const mounts = fs.readFileSync('/proc/mounts', 'utf8');
    if (
      mounts.includes('/dev/sr0') ||
      mounts.includes('/dev/cdrom') ||
      mounts.includes('squashfs') ||
      mounts.includes('overlay') ||
      mounts.includes('aufs')
    ) return 'live-usb';
  } catch { /* not Linux */ }
  return 'desktop';
}

// ── Embedded PostgreSQL (live-usb mode) ───────────────────────────────────────

async function startEmbeddedPostgres() {
  const pgManager = new PostgresManager({
    dataDir:       PG_DATA_DIR,
    resourcesPath: IS_PACKAGED ? process.resourcesPath : path.join(__dirname, '..'),
    isPackaged:    IS_PACKAGED,
    port:          5433,
    user:          'kobeos',
    password:      'kobeos_live',
    database:      'kobeos',
  });

  // Throws immediately with a clear message if the binary is missing
  pgManager.validate();

  await pgManager.initialise();
  await pgManager.start();
  await pgManager.createDatabase();

  embeddedPg = pgManager;
  console.log('[KobeOS] Embedded PostgreSQL started on :5433');
  return pgManager.connectionConfig();
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
    // DB_SYNCHRONIZE is intentionally NOT set: in production the database
    // module ignores it (synchronize stays false) and main.ts throws if it
    // sees both NODE_ENV=production and DB_SYNCHRONIZE=true. Schema is
    // applied via migrations on boot (migrationsRun=true when !isDev).
    KOBEOS_DESKTOP: 'true',   // signals embedded desktop mode to bypass prod guards
    JWT_SECRET: getOrCreateJwtSecret(),
    CORS_ORIGIN: 'file://',
  };
  // Kill any stale process on port 3000 before starting
  try {
    const { execSync } = require('child_process');
    if (process.platform !== 'win32') {
      execSync("fuser -k 3000/tcp 2>/dev/null || true", { stdio: 'ignore' });
    }
  } catch { /* ignore */ }

  // Use ELECTRON_RUN_AS_NODE=1 so the Electron binary behaves as plain Node.js
  // without initialising the Electron app (no BrowserWindow, no app.ready, no bootServices).
  backendProcess = spawn(process.execPath, ['--experimental-global-webcrypto', SERVER_BUNDLE], {
    env: { ...env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
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
  if (embeddedPg) {
    try { await embeddedPg.stop(); } catch { /* ignore */ }
    embeddedPg = null;
  }
}

// ── Boot sequence ─────────────────────────────────────────────────────────────

async function bootServices() {
  const mode = getSystemMode();
  console.log('[KobeOS] mode:', mode);

  sendBootProgress(5, 'Starting KobeOS…');
  await new Promise((r) => setTimeout(r, 200));

  let dbConfig;
  if (mode === 'live-usb' || mode === 'desktop') {
    sendBootProgress(15, 'Starting embedded database…');
    dbConfig = await startEmbeddedPostgres();
    sendBootProgress(45, 'Database ready');
  } else {
    // Legacy: Linux kiosk with system postgres
    sendBootProgress(15, 'Connecting to database…');
    dbConfig = await ensureSystemPostgres();
    sendBootProgress(45, 'Database ready');
  }

  await new Promise((r) => setTimeout(r, 400));
  sendBootProgress(55, 'Starting backend services…');
  startBackend(dbConfig);

  // Poll until backend responds on :3000 (max 15 s)
  sendBootProgress(65, 'Waiting for backend…');
  await waitForBackend(3000, 15000);

  sendBootProgress(90, 'Loading KobeOS…');
  await new Promise((r) => setTimeout(r, 300));
  sendBootProgress(100, 'Ready');
  await new Promise((r) => setTimeout(r, 400));
}

/** Poll http://localhost:{port}/api/health until it responds 2xx or timeout elapses. */
function waitForBackend(port, timeoutMs) {
  return new Promise((resolve) => {
    const start = Date.now();
    const http = require('http');
    function attempt() {
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(true);
          return;
        }
        // Got a response but it wasn't healthy (e.g. 404) — keep retrying until timeout.
        if (Date.now() - start >= timeoutMs) {
          console.warn(`[KobeOS] Backend health check returned ${res.statusCode} after ${timeoutMs}ms; continuing anyway`);
          resolve(false);
          return;
        }
        setTimeout(attempt, 500);
      });
      req.on('error', () => {
        if (Date.now() - start >= timeoutMs) {
          console.warn(`[KobeOS] Backend did not respond on /api/health within ${timeoutMs}ms; continuing anyway`);
          resolve(false);
          return;
        }
        setTimeout(attempt, 500);
      });
      req.setTimeout(800, () => { req.destroy(); });
    }
    attempt();
  });
}

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow() {
  const isDev = !IS_PACKAGED;
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1440, width),
    height: Math.min(900, height),
    minWidth: 1024,
    minHeight: 640,
    center: true,
    show: false,
    title: 'KobeOS',
    autoHideMenuBar: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: !isDev,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Block devtools shortcuts in production
  if (!isDev) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.control && input.key.toLowerCase() === 'r') event.preventDefault();
      if (input.control && input.shift && input.key.toLowerCase() === 'i') event.preventDefault();
      if (input.key === 'F12') event.preventDefault();
    });
  }

  // Build application menu with fullscreen toggle
  const { Menu, MenuItem } = require('electron');
  const menu = Menu.buildFromTemplate([
    {
      label: 'KobeOS',
      submenu: [
        { label: 'About KobeOS', role: 'about' },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Fullscreen',
          accelerator: process.platform === 'darwin' ? 'Ctrl+Command+F' : 'F11',
          click: () => {
            const isFS = mainWindow.isFullScreen();
            mainWindow.setFullScreen(!isFS);
            mainWindow.webContents.send('fullscreen-changed', !isFS);
          },
        },
        { type: 'separator' },
        ...(isDev ? [{ label: 'Developer Tools', accelerator: 'F12', role: 'toggleDevTools' }] : []),
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

// Auto-updater with rollback is handled by ./update-manager.cjs

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  // Verify core file integrity before doing anything else (production only)
  const integrityOk = await enforceIntegrity();
  if (!integrityOk) { app.quit(); return; }

  createSplashWindow();
  await new Promise((r) => setTimeout(r, 200));
  try {
    await bootServices();
  } catch (err) {
    // Without this, any boot failure becomes an unhandled rejection and the
    // splash sits on "Starting embedded database…" forever with no feedback.
    console.error('[KobeOS] Boot failed:', err);
    sendBootProgress(100, 'Startup failed — see error dialog');
    dialog.showErrorBox(
      'KobeOS failed to start',
      `${err && err.message ? err.message : err}\n\n` +
      `If this keeps happening: add the KobeOS install folder to your antivirus ` +
      `exclusions, do not run as Administrator, then reopen the app.`
    );
    app.quit();
    return;
  }
  createWindow();
  mainWindow.once('ready-to-show', async () => {
    mainWindow.show();
    closeSplash();
    // Start sync engine after window is visible
    syncEngine.init(mainWindow);
    // Attach speech service renderer (TTS + live STT)
    speechService.attachWindow(mainWindow.webContents);

    // Boot Kobe Runtime (HAL + services + drivers)
    try {
      await kobeRuntime.boot(mainWindow);
      // Attach bluetooth driver to the window for device selection events
      const btDriver = kobeRuntime.driverManager.getDriver('bluetooth');
      if (btDriver) btDriver.attachWindow(mainWindow.webContents);
    } catch (err) {
      console.error('[KobeOS] Runtime boot error:', err.message);
    }
  });
  setupAutoUpdater(mainWindow);

  // Force sync drain when network comes back online
  app.on('network-connected', () => syncEngine.forceDrain());
});

app.on('window-all-closed', async () => {
  await kobeRuntime.shutdown().catch(() => {});
  syncEngine.stop();
  lanServer.stop();
  localdb.close();
  stopBackend();
  await stopEmbeddedPostgres();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  await kobeRuntime.shutdown().catch(() => {});
  syncEngine.stop();
  lanServer.stop();
  localdb.close();
  stopBackend();
  await stopEmbeddedPostgres();
});

// ── System IPC ────────────────────────────────────────────────────────────────

/**
 * Show a native confirmation dialog with Cancel as the default so a misclick
 * can't trigger a destructive op. Returns true only if the user explicitly
 * picks the destructive button. Used to gate shutdown/reboot/disk-install.
 */
async function confirmDestructive(opts) {
  const win = mainWindow ?? BrowserWindow.getFocusedWindow() ?? undefined;
  const { response } = await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: [opts.actionLabel, 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    title: opts.title,
    message: opts.message,
    detail: opts.detail,
    noLink: true,
  });
  return response === 0;
}

ipcMain.handle('system-shutdown', async () => {
  const ok = await confirmDestructive({
    title: 'Shut down KobeOS',
    message: 'Shut down this device now?',
    detail: 'All open work will be closed. Unsaved changes may be lost.',
    actionLabel: 'Shut Down',
  });
  if (!ok) return { confirmed: false };
  exec(process.platform === 'win32' ? 'shutdown /s /t 0' : 'poweroff');
  return { confirmed: true };
});
ipcMain.handle('system-reboot', async () => {
  const ok = await confirmDestructive({
    title: 'Restart KobeOS',
    message: 'Restart this device now?',
    detail: 'All open work will be closed. Unsaved changes may be lost.',
    actionLabel: 'Restart',
  });
  if (!ok) return { confirmed: false };
  exec(process.platform === 'win32' ? 'shutdown /r /t 0' : 'reboot');
  return { confirmed: true };
});
ipcMain.handle('get-system-mode', () => getSystemMode());

ipcMain.handle('toggle-fullscreen', () => {
  if (!mainWindow) return false;
  const next = !mainWindow.isFullScreen();
  mainWindow.setFullScreen(next);
  mainWindow.webContents.send('fullscreen-changed', next);
  return next;
});

ipcMain.handle('is-fullscreen', () => mainWindow ? mainWindow.isFullScreen() : false);

ipcMain.handle('get-backend-status', () => ({
  running: backendProcess !== null,
  pid: backendProcess?.pid ?? null,
  embeddedPg: embeddedPg !== null,
}));

// ── Disk install ──────────────────────────────────────────────────────────────

const DISK_PATH_RE = /^\/dev\/(sd[a-z]|hd[a-z]|vd[a-z]|nvme\d+n\d+|mmcblk\d+)$/;

ipcMain.handle('install-to-disk', async (event, diskPath, options = {}) => {
  if (typeof diskPath !== 'string' || !DISK_PATH_RE.test(diskPath)) {
    return { success: false, error: `Invalid disk path: ${diskPath}` };
  }

  // options.luksPassphrase: string — if provided, root partition is LUKS-encrypted
  const luksPassphrase = typeof options.luksPassphrase === 'string' ? options.luksPassphrase : '';
  const useLuks = luksPassphrase.length >= 8;

  const ok = await confirmDestructive({
    title: 'Install KobeOS to disk',
    message: `Install KobeOS to ${diskPath}?`,
    detail: `THIS WILL ERASE EVERYTHING ON ${diskPath}. All existing partitions and data on this disk will be destroyed.${useLuks ? '\n\nThe root partition will be encrypted with LUKS.' : ''}\n\nThis cannot be undone.`,
    actionLabel: 'Erase & Install',
  });
  if (!ok) return { success: false, error: 'cancelled' };

  // Partition layout (GPT, 4 partitions):
  //   p1  512 MiB  EFI System Partition (FAT32)
  //   p2  2 GiB    Recovery (ext4, read-only squashfs copy)
  //   p3  20 GiB   Root OS  (ext4, optionally LUKS)
  //   p4  rest     User data (ext4, persists across OS reinstalls)

  const script = `
set -e
echo "=== KobeOS Disk Installer (4-partition layout) ==="

# ── Partition ──────────────────────────────────────────────────────────────────
parted -s ${diskPath} mklabel gpt
parted -s ${diskPath} mkpart ESP fat32 1MiB 513MiB
parted -s ${diskPath} set 1 esp on
parted -s ${diskPath} mkpart Recovery ext4 513MiB 2561MiB
parted -s ${diskPath} mkpart Root ext4 2561MiB 22561MiB
parted -s ${diskPath} mkpart UserData ext4 22561MiB 100%

# Inform kernel of new partition table
partprobe ${diskPath} 2>/dev/null || true
sleep 2

# Resolve partition device names (handles both /dev/sdX1 and /dev/nvme0n1p1)
if [ -e "${diskPath}1" ]; then
  PART_EFI="${diskPath}1"
  PART_REC="${diskPath}2"
  PART_ROOT="${diskPath}3"
  PART_DATA="${diskPath}4"
else
  PART_EFI="${diskPath}p1"
  PART_REC="${diskPath}p2"
  PART_ROOT="${diskPath}p3"
  PART_DATA="${diskPath}p4"
fi

# ── Format EFI ─────────────────────────────────────────────────────────────────
mkfs.fat -F32 -n KOBEOS_EFI "$PART_EFI"

# ── Format Recovery ────────────────────────────────────────────────────────────
mkfs.ext4 -F -L KOBEOS_REC "$PART_REC"

# ── Format Root (with optional LUKS) ──────────────────────────────────────────
${useLuks ? `
echo "Setting up LUKS encryption on root partition..."
apt-get install -y --no-install-recommends cryptsetup 2>/dev/null || true
echo -n "${luksPassphrase}" | cryptsetup luksFormat --type luks2 --batch-mode "$PART_ROOT" -
echo -n "${luksPassphrase}" | cryptsetup open "$PART_ROOT" kobeos_root -
mkfs.ext4 -F -L KOBEOS_ROOT /dev/mapper/kobeos_root
ROOT_DEV=/dev/mapper/kobeos_root
` : `
mkfs.ext4 -F -L KOBEOS_ROOT "$PART_ROOT"
ROOT_DEV="$PART_ROOT"
`}

# ── Format UserData ────────────────────────────────────────────────────────────
mkfs.ext4 -F -L KOBEOS_DATA "$PART_DATA"

# ── Mount ──────────────────────────────────────────────────────────────────────
mkdir -p /mnt/kobeos
mount "$ROOT_DEV" /mnt/kobeos
mkdir -p /mnt/kobeos/boot/efi /mnt/kobeos/boot/recovery /mnt/kobeos/userdata
mount "$PART_EFI" /mnt/kobeos/boot/efi
mount "$PART_REC" /mnt/kobeos/boot/recovery
mount "$PART_DATA" /mnt/kobeos/userdata

# ── Copy OS ────────────────────────────────────────────────────────────────────
echo "Copying KobeOS..."
mkdir -p /mnt/kobeos/opt/kobeos
cp -a /opt/kobeos/. /mnt/kobeos/opt/kobeos/

# ── Copy recovery snapshot (squashfs from live media if present) ───────────────
echo "Setting up recovery partition..."
if [ -f /run/live/medium/live/filesystem.squashfs ]; then
  cp /run/live/medium/live/filesystem.squashfs /mnt/kobeos/boot/recovery/filesystem.squashfs
  cp /run/live/medium/live/vmlinuz /mnt/kobeos/boot/recovery/vmlinuz 2>/dev/null || true
  cp /run/live/medium/live/initrd.img /mnt/kobeos/boot/recovery/initrd.img 2>/dev/null || true
fi

# ── Install system packages ────────────────────────────────────────────────────
echo "Installing system packages..."
apt-get install -y --no-install-recommends \
  openbox xorg xinit xauth util-linux \
  postgresql postgresql-client nodejs \
  2>/dev/null || true

# ── Configure PostgreSQL ───────────────────────────────────────────────────────
echo "Configuring PostgreSQL..."
systemctl enable postgresql || true
sudo -u postgres psql -c "CREATE USER kobeos WITH PASSWORD 'kobeos_prod' CREATEDB" 2>/dev/null || true
sudo -u postgres createdb -O kobeos kobeos 2>/dev/null || true

# ── Symlink userdata dirs ──────────────────────────────────────────────────────
# PostgreSQL data and KobeOS user data live on the persistent partition
mkdir -p /mnt/kobeos/userdata/pgdata /mnt/kobeos/userdata/kobeos-home
ln -sfn /userdata/kobeos-home /mnt/kobeos/home/kobeos 2>/dev/null || true

# ── Systemd services ───────────────────────────────────────────────────────────
# Write units to the TARGET (/mnt/kobeos/etc/...) — writing to /etc/...
# would modify the live USB instead of the installed OS.
mkdir -p /mnt/kobeos/etc/systemd/system
cat > /mnt/kobeos/etc/systemd/system/kobeos-backend.service << 'SVCEOF'
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
# DB_SYNCHRONIZE intentionally unset: migrations run automatically in
# production; setting both NODE_ENV=production and DB_SYNCHRONIZE=true
# is rejected by the server bootstrap.
EnvironmentFile=-/opt/kobeos/resources/.env
ExecStart=/usr/bin/node /opt/kobeos/resources/server-bundle/index.js
Restart=on-failure
RestartSec=5
[Install]
WantedBy=multi-user.target
SVCEOF

cat > /mnt/kobeos/etc/systemd/system/kobeos-xorg.service << 'SVCEOF'
[Unit]
Description=KobeOS X Server
After=systemd-udev-settle.service
Before=kobeos-kiosk.service

[Service]
Type=simple
User=root
ExecStart=/usr/bin/Xorg :0 -nolisten tcp -nocursor vt1
Restart=on-failure
RestartSec=2
[Install]
WantedBy=graphical.target
SVCEOF

cat > /mnt/kobeos/etc/systemd/system/kobeos-kiosk.service << 'SVCEOF'
[Unit]
Description=KobeOS Kiosk
After=kobeos-xorg.service kobeos-backend.service
Requires=kobeos-xorg.service kobeos-backend.service

[Service]
Type=simple
User=kobeos
Environment=DISPLAY=:0
Environment=HOME=/home/kobeos
Environment=XAUTHORITY=/home/kobeos/.Xauthority
ExecStartPre=/bin/bash -c "xauth -f /home/kobeos/.Xauthority add :0 . $(mcookie) && chown kobeos:kobeos /home/kobeos/.Xauthority"
ExecStart=/opt/kobeos/kobeos --disable-setuid-sandbox --disable-gpu --kiosk
Restart=on-failure
RestartSec=3
[Install]
WantedBy=graphical.target
SVCEOF

# ── LUKS crypttab (so root unlocks on boot) ────────────────────────────────────
# Write to the target's /etc/crypttab, not the live USB's.
${useLuks ? `
echo "kobeos_root $PART_ROOT none luks,discard" >> /mnt/kobeos/etc/crypttab
` : ''}

# ── fstab ──────────────────────────────────────────────────────────────────────
ROOT_UUID=$(blkid -s UUID -o value "$ROOT_DEV")
EFI_UUID=$(blkid -s UUID -o value "$PART_EFI")
REC_UUID=$(blkid -s UUID -o value "$PART_REC")
DATA_UUID=$(blkid -s UUID -o value "$PART_DATA")

cat > /mnt/kobeos/etc/fstab << FSTABEOF
UUID=$ROOT_UUID  /           ext4  defaults,noatime  0 1
UUID=$EFI_UUID   /boot/efi   vfat  umask=0077        0 2
UUID=$REC_UUID   /boot/recovery ext4 ro,noatime      0 2
UUID=$DATA_UUID  /userdata   ext4  defaults,noatime  0 2
FSTABEOF

# ── Users ──────────────────────────────────────────────────────────────────────
# Create the kobeos user and enable services on the TARGET system, not the
# live USB. chroot + systemctl --root keep both confined to /mnt/kobeos.
chroot /mnt/kobeos useradd -m -s /bin/bash kobeos 2>/dev/null || true
systemctl --root=/mnt/kobeos enable kobeos-xorg.service kobeos-backend.service kobeos-kiosk.service || true


# ── GRUB ──────────────────────────────────────────────────────────────────────
grub-install --target=x86_64-efi --efi-directory=/mnt/kobeos/boot/efi --bootloader-id=KobeOS --removable

# Write custom grub.cfg with recovery entry
cat > /mnt/kobeos/boot/grub/grub.cfg << 'GRUBEOF'
set default=0
set timeout=5
set timeout_style=hidden

menuentry "KobeOS" {
  search --no-floppy --label --set=root KOBEOS_ROOT
  linux  /boot/vmlinuz root=LABEL=KOBEOS_ROOT rw quiet splash
  initrd /boot/initrd.img
}

menuentry "KobeOS (safe mode)" {
  search --no-floppy --label --set=root KOBEOS_ROOT
  linux  /boot/vmlinuz root=LABEL=KOBEOS_ROOT rw nomodeset
  initrd /boot/initrd.img
}

menuentry "KobeOS Recovery" {
  search --no-floppy --label --set=root KOBEOS_REC
  linux  /boot/recovery/vmlinuz boot=live root=LABEL=KOBEOS_REC toram
  initrd /boot/recovery/initrd.img
}
GRUBEOF

umount -R /mnt/kobeos
${useLuks ? 'cryptsetup close kobeos_root 2>/dev/null || true' : ''}
echo "INSTALL_COMPLETE"
`;
  return new Promise((resolve) => {
    execFile('/bin/bash', ['-c', script], { timeout: 900_000 }, (error, stdout, stderr) => {
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

// ── LocalDB IPC handlers ───────────────────────────────────────────────────────

ipcMain.handle('localdb:kvGet', (_e, key) => localdb.kvGet(key));
ipcMain.handle('localdb:kvSet', (_e, key, value) => localdb.kvSet(key, value));
ipcMain.handle('localdb:kvDel', (_e, key) => localdb.kvDel(key));

ipcMain.handle('localdb:query', (_e, table, filters = {}) => {
  return localdb.query(table, filters);
});

ipcMain.handle('localdb:insert', (_e, table, record) => {
  return localdb.insert(table, record);
});

ipcMain.handle('localdb:update', (_e, table, id, changes) => {
  return localdb.update(table, id, changes);
});

ipcMain.handle('localdb:delete', (_e, table, id) => {
  return localdb.delete(table, id);
});

ipcMain.handle('localdb:enqueue', (_e, operation) => {
  return localdb.enqueueOp(operation);
});

ipcMain.handle('localdb:getStats', () => {
  return localdb.getStats();
});

// ── Sync engine IPC handlers ───────────────────────────────────────────────────

ipcMain.handle('sync:status', () => {
  return syncEngine.getStatus();
});

ipcMain.handle('sync:forceSync', async () => {
  return syncEngine.drain();
});

// ── Kobe Runtime IPC handlers ─────────────────────────────────────────────────

// Runtime status
ipcMain.handle('runtime:status', () => kobeRuntime.getStatus());

// HAL
ipcMain.handle('runtime:hal:platform',  () => kobeRuntime.hal.platform);
ipcMain.handle('runtime:hal:display',   () => kobeRuntime.hal.getDisplayInfo());
ipcMain.handle('runtime:hal:network',   () => kobeRuntime.hal.getNetworkInterfaces());
ipcMain.handle('runtime:hal:storage',   () => kobeRuntime.hal.getStorageInfo());
ipcMain.handle('runtime:hal:power',     () => kobeRuntime.hal.getPowerStatus());
ipcMain.handle('runtime:hal:usb',       () => kobeRuntime.hal.getUSBDevices());

// Audio service
ipcMain.handle('runtime:audio:getVolume',   () => kobeRuntime.serviceManager.get('audio')?.getVolume());
ipcMain.handle('runtime:audio:setVolume',   (_e, level) => kobeRuntime.serviceManager.get('audio')?.setVolume(level));
ipcMain.handle('runtime:audio:getMute',     () => kobeRuntime.serviceManager.get('audio')?.getMute());
ipcMain.handle('runtime:audio:setMute',     (_e, muted) => kobeRuntime.serviceManager.get('audio')?.setMute(muted));
ipcMain.handle('runtime:audio:status',      () => kobeRuntime.serviceManager.get('audio')?.getStatus());

// AI service
ipcMain.handle('runtime:ai:chat',    (_e, messages, opts) => kobeRuntime.serviceManager.get('ai')?.chat(messages, opts));
ipcMain.handle('runtime:ai:embed',   (_e, text)           => kobeRuntime.serviceManager.get('ai')?.embed(text));
ipcMain.handle('runtime:ai:status',  ()                   => kobeRuntime.serviceManager.get('ai')?.getStatus());

// File service
ipcMain.handle('runtime:file:read',   (_e, vpath, appId, enc) => kobeRuntime.serviceManager.get('file')?.read(vpath, appId, enc));
ipcMain.handle('runtime:file:write',  (_e, vpath, appId, data) => kobeRuntime.serviceManager.get('file')?.write(vpath, appId, data));
ipcMain.handle('runtime:file:list',   (_e, vpath, appId)       => kobeRuntime.serviceManager.get('file')?.list(vpath, appId));
ipcMain.handle('runtime:file:delete', (_e, vpath, appId)       => kobeRuntime.serviceManager.get('file')?.delete(vpath, appId));
ipcMain.handle('runtime:file:exists', (_e, vpath, appId)       => kobeRuntime.serviceManager.get('file')?.exists(vpath, appId));
ipcMain.handle('runtime:file:mkdir',  (_e, vpath, appId)       => kobeRuntime.serviceManager.get('file')?.mkdir(vpath, appId));
ipcMain.handle('runtime:file:stat',   (_e, vpath, appId)       => kobeRuntime.serviceManager.get('file')?.stat(vpath, appId));
ipcMain.handle('runtime:file:status', ()                        => kobeRuntime.serviceManager.get('file')?.getStatus());

// Cloud service
ipcMain.handle('runtime:cloud:ping',   () => kobeRuntime.serviceManager.get('cloud')?.ping());
ipcMain.handle('runtime:cloud:status', () => kobeRuntime.serviceManager.get('cloud')?.getStatus());

// Device manager
ipcMain.handle('runtime:devices:list',       ()           => kobeRuntime.serviceManager.get('devices')?.getDevices());
ipcMain.handle('runtime:devices:byType',     (_e, type)   => kobeRuntime.serviceManager.get('devices')?.getDevicesByType(type));
ipcMain.handle('runtime:devices:send',       (_e, id, cmd, data) => kobeRuntime.serviceManager.get('devices')?.sendToDevice(id, cmd, data));
ipcMain.handle('runtime:devices:status',     ()           => kobeRuntime.serviceManager.get('devices')?.getStatus());

// Driver commands (direct driver access for advanced apps)
ipcMain.handle('runtime:driver:send', (_e, driverId, deviceId, command, data) => {
  const driver = kobeRuntime.driverManager.getDriver(driverId);
  if (!driver) throw new Error(`Driver not found: ${driverId}`);
  if (typeof driver.send !== 'function') throw new Error(`Driver ${driverId} does not support send`);
  return driver.send(deviceId, command, data);
});

// Bluetooth device selection (from renderer picker UI)
ipcMain.handle('runtime:bluetooth:select',  (_e, deviceId) => {
  const bt = kobeRuntime.driverManager.getDriver('bluetooth');
  if (bt) bt.selectDevice(deviceId);
});
ipcMain.handle('runtime:bluetooth:cancel',  () => {
  const bt = kobeRuntime.driverManager.getDriver('bluetooth');
  if (bt) bt.cancelSelection();
});
ipcMain.handle('runtime:bluetooth:devices', () => {
  const bt = kobeRuntime.driverManager.getDriver('bluetooth');
  return bt ? bt.listKnownDevices() : [];
});
