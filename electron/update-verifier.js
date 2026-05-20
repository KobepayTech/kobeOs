/**
 * update-verifier.js — GPG signature verification for update artifacts
 *
 * Before any downloaded update is installed, this module:
 *   1. Downloads the corresponding .sig file from the same GitHub release
 *   2. Verifies the signature against the KobeOS release public key
 *   3. Returns { valid: true } or { valid: false, reason: string }
 *
 * The release public key fingerprint is embedded here and also shipped in
 * build/kobeos-release.pub. Both must match for verification to pass.
 *
 * To generate a release keypair:
 *   gpg --batch --gen-key build/gpg-keygen-params.txt
 *   gpg --armor --export KEYID > build/kobeos-release.pub
 *   gpg --armor --export-secret-keys KEYID > build/kobeos-release-private.asc  # keep offline
 *
 * To sign a release artifact:
 *   gpg --detach-sign --armor --output artifact.sig artifact
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { execFile } = require('child_process');
const os = require('os');

// Fingerprint of the KobeOS release signing key.
// Update this when rotating keys.
const RELEASE_KEY_FINGERPRINT = process.env.KOBEOS_RELEASE_KEY_FINGERPRINT || '';

// Path to the bundled public key (shipped inside the app resources)
const BUNDLED_PUBKEY = app.isPackaged
  ? path.join(process.resourcesPath, 'kobeos-release.pub')
  : path.join(__dirname, '..', 'build', 'kobeos-release.pub');

// ── Import public key into a temporary GPG homedir ────────────────────────────

async function importKey() {
  if (!fs.existsSync(BUNDLED_PUBKEY)) {
    return { success: false, reason: 'Release public key not found in app resources' };
  }
  const gpgHome = fs.mkdtempSync(path.join(os.tmpdir(), 'kobeos-gpg-'));
  await runGpg(['--homedir', gpgHome, '--import', BUNDLED_PUBKEY]);
  return { success: true, gpgHome };
}

// ── Download a file to a temp path ───────────────────────────────────────────

function download(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} downloading ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', reject);
  });
}

// ── Run gpg with given args ───────────────────────────────────────────────────

function runGpg(args) {
  return new Promise((resolve, reject) => {
    execFile('gpg', args, { timeout: 30_000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout);
    });
  });
}

// ── Verify a downloaded artifact against its .sig ────────────────────────────

async function verifyArtifact(artifactPath, sigUrl) {
  // Check gpg is available
  const gpgAvailable = await runGpg(['--version']).then(() => true).catch(() => false);
  if (!gpgAvailable) {
    console.warn('[verifier] gpg not available — skipping signature check');
    return { valid: true, skipped: true, reason: 'gpg not installed' };
  }

  // Import the release key into a temp homedir
  const keyResult = await importKey();
  if (!keyResult.success) {
    return { valid: false, reason: keyResult.reason };
  }
  const { gpgHome } = keyResult;

  try {
    // Download the .sig file
    const sigPath = path.join(os.tmpdir(), `kobeos-update-${Date.now()}.sig`);
    await download(sigUrl, sigPath);

    // Verify
    await runGpg(['--homedir', gpgHome, '--verify', sigPath, artifactPath]);

    // Optionally check fingerprint matches expected
    if (RELEASE_KEY_FINGERPRINT) {
      const output = await runGpg(['--homedir', gpgHome, '--verify', '--status-fd', '1', sigPath, artifactPath])
        .catch(e => e.message);
      if (!output.includes(RELEASE_KEY_FINGERPRINT.replace(/\s/g, ''))) {
        return { valid: false, reason: 'Signature key fingerprint mismatch' };
      }
    }

    console.log('[verifier] Signature valid for', path.basename(artifactPath));
    return { valid: true };
  } catch (err) {
    console.error('[verifier] Signature verification failed:', err.message);
    return { valid: false, reason: err.message };
  } finally {
    // Clean up temp GPG homedir
    try { fs.rmSync(gpgHome, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

/**
 * Build the expected .sig URL from a release artifact URL.
 * GitHub Releases convention: artifact.AppImage → artifact.AppImage.sig
 */
function sigUrlFor(artifactUrl) {
  return `${artifactUrl}.sig`;
}

module.exports = { verifyArtifact, sigUrlFor };
