/**
 * update-manager.js
 *
 * Handles remote updates via GitHub Releases (electron-updater) with
 * automatic rollback if the new version fails to boot cleanly.
 *
 * Rollback strategy:
 *   - Before applying an update, copy app.asar → app.asar.backup
 *   - On first launch after update, write a "boot-ok" stamp after 30s
 *   - On next launch, if no stamp exists → update failed → restore backup
 *   - Exposes rollback() IPC so the user can manually revert too
 */

const { ipcMain, app } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const { verifyArtifact, sigUrlFor } = require('./update-verifier');

const RESOURCES     = process.resourcesPath || path.join(__dirname, '..');
const ASAR_PATH     = path.join(RESOURCES, 'app.asar');
const ASAR_BACKUP   = path.join(RESOURCES, 'app.asar.backup');
const BOOT_STAMP    = path.join(app.getPath('userData'), '.boot-ok');
const VERSION_FILE  = path.join(app.getPath('userData'), '.current-version');
const BOOT_OK_DELAY = 30_000; // ms after launch before marking boot as successful

let mainWindow = null;
let bootOkTimer = null;

// ── Boot health check ─────────────────────────────────────────────────────────

function checkRollbackNeeded() {
  const currentVersion = app.getVersion();
  const lastVersion = fs.existsSync(VERSION_FILE)
    ? fs.readFileSync(VERSION_FILE, 'utf8').trim()
    : null;

  // If version changed since last run and no boot-ok stamp → previous update failed
  if (lastVersion && lastVersion !== currentVersion && !fs.existsSync(BOOT_STAMP)) {
    console.warn(`[updater] Boot failed for v${currentVersion} (last ok: v${lastVersion}) — rolling back`);
    return true;
  }
  return false;
}

function performRollback() {
  if (!fs.existsSync(ASAR_BACKUP)) {
    console.error('[updater] No backup found — cannot roll back');
    return { success: false, error: 'No backup available' };
  }
  try {
    fs.copyFileSync(ASAR_BACKUP, ASAR_PATH);
    // Restore the version stamp to the backup version
    const backupVersionFile = path.join(app.getPath('userData'), '.backup-version');
    if (fs.existsSync(backupVersionFile)) {
      fs.copyFileSync(backupVersionFile, VERSION_FILE);
    }
    console.log('[updater] Rollback complete — restarting');
    app.relaunch();
    app.exit(0);
    return { success: true };
  } catch (err) {
    console.error('[updater] Rollback failed:', err.message);
    return { success: false, error: err.message };
  }
}

function markBootOk() {
  const userData = app.getPath('userData');
  fs.mkdirSync(userData, { recursive: true });
  fs.writeFileSync(BOOT_STAMP, new Date().toISOString());
  fs.writeFileSync(VERSION_FILE, app.getVersion());
  console.log(`[updater] Boot OK — v${app.getVersion()} marked healthy`);
}

function clearBootStamp() {
  // Called just before applying an update so the next boot can detect failure
  try { fs.unlinkSync(BOOT_STAMP); } catch { /* didn't exist */ }
  // Save current version as the backup version reference
  const backupVersionFile = path.join(app.getPath('userData'), '.backup-version');
  fs.writeFileSync(backupVersionFile, app.getVersion());
}

// ── Backup current asar before update ────────────────────────────────────────

function backupCurrentAsar() {
  if (!fs.existsSync(ASAR_PATH)) return;
  try {
    fs.copyFileSync(ASAR_PATH, ASAR_BACKUP);
    console.log('[updater] Backed up app.asar →', ASAR_BACKUP);
  } catch (err) {
    console.warn('[updater] Could not back up app.asar:', err.message);
  }
}

// ── Auto-updater setup ────────────────────────────────────────────────────────

function setupAutoUpdater(win) {
  mainWindow = win;

  if (!app.isPackaged) {
    console.log('[updater] Dev mode — auto-updater disabled');
    return;
  }

  // Check if we need to roll back before doing anything else
  if (checkRollbackNeeded()) {
    performRollback();
    return; // app will relaunch
  }

  // Schedule boot-ok stamp after 30s of clean running
  bootOkTimer = setTimeout(markBootOk, BOOT_OK_DELAY);

  // Hands-off self-update (default ON; set KOBE_AUTO_UPDATE=off to disable).
  // Safe pattern: download the update in the background, verify its GPG
  // signature (see the 'update-downloaded' handler), then install on the NEXT
  // quit — never interrupting the user mid-work. A failed signature check
  // disables the on-quit install so a bad update is never applied.
  const handsOff = String(process.env.KOBE_AUTO_UPDATE || 'on').toLowerCase() !== 'off';
  autoUpdater.autoDownload = handsOff;
  autoUpdater.autoInstallOnAppQuit = handsOff;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;
  // Delta (differential) updates: electron-updater downloads only changed blocks
  // when the publisher generates blockmap files alongside the release artifacts.
  // Enabled via differentialPackage:true in electron-builder config.
  autoUpdater.disableDifferentialDownload = false;

  const emit = (payload) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater', payload);
    }
    console.log('[updater]', JSON.stringify(payload));
  };

  autoUpdater.on('checking-for-update', () =>
    emit({ event: 'checking' }));

  autoUpdater.on('update-available', (info) =>
    emit({ event: 'available', version: info.version, releaseNotes: info.releaseNotes, releaseDate: info.releaseDate }));

  autoUpdater.on('update-not-available', () =>
    emit({ event: 'not-available', currentVersion: app.getVersion() }));

  autoUpdater.on('download-progress', (p) =>
    emit({ event: 'progress', percent: Math.round(p.percent), transferred: p.transferred, total: p.total, bytesPerSecond: p.bytesPerSecond }));

  autoUpdater.on('update-downloaded', async (info) => {
    // Verify GPG signature before allowing install
    if (info.downloadedFile && info.releaseFiles) {
      const artifactFile = info.downloadedFile;
      // Find the download URL for the artifact to derive the .sig URL
      const releaseFile = info.releaseFiles.find(f => f.url && artifactFile.endsWith(f.url.split('/').pop()));
      const sigUrl = releaseFile ? sigUrlFor(releaseFile.url) : null;

      if (sigUrl) {
        emit({ event: 'verifying', version: info.version });
        const result = await verifyArtifact(artifactFile, sigUrl);
        if (!result.valid && !result.skipped) {
          console.error('[updater] Signature verification failed — aborting install:', result.reason);
          emit({ event: 'error', message: `Signature verification failed: ${result.reason}` });
          // Block the hands-off on-quit install so a bad update is never applied.
          autoUpdater.autoInstallOnAppQuit = false;
          // Restore boot stamp so we don't false-rollback
          markBootOk();
          return;
        }
      }
    }

    // Back up current asar and clear boot stamp BEFORE installing
    backupCurrentAsar();
    clearBootStamp();
    emit({ event: 'downloaded', version: info.version });
  });

  autoUpdater.on('error', (err) => {
    emit({ event: 'error', message: err.message });
    // If update errored mid-download, restore boot stamp so we don't false-rollback
    markBootOk();
  });

  // Check on launch, then every 4 hours
  setTimeout(() => autoUpdater.checkForUpdates().catch((e) => console.warn('[updater] check failed:', e.message)), 10_000);
  setInterval(() => autoUpdater.checkForUpdates().catch((e) => console.warn('[updater] check failed:', e.message)), 4 * 60 * 60 * 1_000);
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

ipcMain.handle('updater-check', () =>
  autoUpdater.checkForUpdates().catch((e) => ({ error: e.message })));

ipcMain.handle('updater-download', () =>
  autoUpdater.downloadUpdate().catch((e) => ({ error: e.message })));

ipcMain.handle('updater-install', () => {
  // Quit and install — electron-updater swaps app.asar then relaunches
  autoUpdater.quitAndInstall(false, true);
});

ipcMain.handle('updater-rollback', () => performRollback());

ipcMain.handle('updater-status', () => ({
  currentVersion: app.getVersion(),
  hasBackup: fs.existsSync(ASAR_BACKUP),
  bootOk: fs.existsSync(BOOT_STAMP),
  backupVersion: (() => {
    const f = path.join(app.getPath('userData'), '.backup-version');
    return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim() : null;
  })(),
}));

module.exports = { setupAutoUpdater };
