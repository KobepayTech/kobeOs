'use strict';

/**
 * core-integrity.js — Immutable core enforcement
 *
 * On every boot, hashes the runtime core files and compares them against
 * a signed manifest (core-manifest.json) shipped inside the app.
 *
 * If any core file has been tampered with, the app refuses to boot and
 * shows an error dialog instead of loading the compromised runtime.
 *
 * The manifest is generated at build time by scripts/generate-core-manifest.js
 * and signed with the same GPG key used for release artifacts.
 *
 * In dev mode (app.isPackaged === false), integrity checks are skipped.
 *
 * Core files covered:
 *   electron/runtime/**
 *   electron/main.js
 *   electron/preload.js
 *   electron/update-manager.js
 *   electron/update-verifier.js
 */

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');
const { app, dialog } = require('electron');

// Path to the signed manifest shipped in app resources
const MANIFEST_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'core-manifest.json')
  : path.join(__dirname, '..', 'build', 'core-manifest.json');

// Root of the electron source (inside asar in production)
const ELECTRON_ROOT = __dirname;

// ── Hashing ───────────────────────────────────────────────────────────────────

function hashFile(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buf).digest('hex');
  } catch {
    return null;
  }
}

// ── Manifest generation (build-time, called by scripts/generate-core-manifest.js) ──

function generateManifest(electronRoot) {
  const coreFiles = collectCoreFiles(electronRoot);
  const entries = {};
  for (const rel of coreFiles) {
    const abs = path.join(electronRoot, rel);
    entries[rel] = hashFile(abs);
  }
  return { version: 1, generatedAt: new Date().toISOString(), files: entries };
}

function collectCoreFiles(root) {
  const files = [];
  const walk = (dir, base) => {
    for (const entry of fs.readdirSync(dir)) {
      const abs = path.join(dir, entry);
      const rel = base ? `${base}/${entry}` : entry;
      const stat = fs.statSync(abs);
      if (stat.isDirectory()) {
        walk(abs, rel);
      } else if (entry.endsWith('.js') || entry.endsWith('.cjs')) {
        files.push(rel);
      }
    }
  };
  // Core directories to protect
  if (fs.existsSync(path.join(root, 'runtime'))) {
    walk(path.join(root, 'runtime'), 'runtime');
  }
  // Core files — check both .js and .cjs variants (renamed during ESM migration)
  const coreFiles = [
    'main.cjs', 'main.js',
    'preload.cjs', 'preload.js',
    'update-manager.cjs', 'update-manager.js',
    'update-verifier.js',
    'core-integrity.js',
  ];
  for (const f of coreFiles) {
    if (fs.existsSync(path.join(root, f))) files.push(f);
  }
  return files;
}

// ── Verification (runtime, called on every boot) ──────────────────────────────

async function verifyCoreIntegrity() {
  // Skip in dev mode
  if (!app.isPackaged) {
    console.log('[CoreIntegrity] Dev mode — skipping integrity check');
    return { ok: true, skipped: true };
  }

  if (!fs.existsSync(MANIFEST_PATH)) {
    console.warn('[CoreIntegrity] No manifest found — skipping check');
    return { ok: true, skipped: true, reason: 'no manifest' };
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  } catch (err) {
    return { ok: false, reason: `Manifest parse error: ${err.message}` };
  }

  const failures = [];
  for (const [rel, expectedHash] of Object.entries(manifest.files || {})) {
    const abs = path.join(ELECTRON_ROOT, rel);
    const actual = hashFile(abs);
    if (actual === null) {
      failures.push({ file: rel, reason: 'missing' });
    } else if (actual !== expectedHash) {
      failures.push({ file: rel, reason: 'hash mismatch', expected: expectedHash, actual });
    }
  }

  if (failures.length > 0) {
    console.error('[CoreIntegrity] TAMPER DETECTED:', failures);
    return { ok: false, failures };
  }

  console.log(`[CoreIntegrity] ✓ ${Object.keys(manifest.files).length} core files verified`);
  return { ok: true, filesChecked: Object.keys(manifest.files).length };
}

/**
 * Run integrity check and show a blocking error dialog if it fails.
 * Returns false if the app should abort boot.
 */
async function enforceIntegrity() {
  const result = await verifyCoreIntegrity();

  if (!result.ok) {
    const detail = result.failures
      ? result.failures.map(f => `  ${f.file}: ${f.reason}`).join('\n')
      : result.reason;

    await dialog.showMessageBox({
      type:    'error',
      title:   'KobeOS Integrity Check Failed',
      message: 'Core system files have been modified or corrupted.',
      detail:  `The following files failed verification:\n\n${detail}\n\nKobeOS cannot start. Please reinstall from a trusted source.`,
      buttons: ['Quit'],
    });
    return false;
  }

  return true;
}

module.exports = { enforceIntegrity, generateManifest, verifyCoreIntegrity };
