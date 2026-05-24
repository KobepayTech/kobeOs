#!/usr/bin/env node
'use strict';

/**
 * generate-core-manifest.js
 *
 * Generates build/core-manifest.json containing SHA-256 hashes of all
 * core Electron runtime files. Run this as part of the release build
 * AFTER the source is finalised but BEFORE packaging.
 *
 * Usage:
 *   node scripts/generate-core-manifest.js
 *
 * The manifest is then packaged into app resources by electron-builder
 * via the extraResources config in package.json.
 *
 * To sign the manifest (optional, for GPG-verified integrity):
 *   gpg --detach-sign --armor --output build/core-manifest.json.sig build/core-manifest.json
 */

const path = require('path');
const fs   = require('fs');

const ROOT          = path.join(__dirname, '..');
const ELECTRON_ROOT = path.join(ROOT, 'electron');
const OUT_PATH      = path.join(ROOT, 'build', 'core-manifest.json');

// Dynamically require the generator from core-integrity (avoids duplicating logic)
// We stub app/dialog since we're running outside Electron
const Module = require('module');
const origLoad = Module._load;
Module._load = function(request, ...args) {
  if (request === 'electron') {
    return {
      app:    { isPackaged: false, getPath: () => '/tmp', getVersion: () => '0.0.0' },
      dialog: {},
    };
  }
  return origLoad.call(this, request, ...args);
};

const { generateManifest } = require('../electron/core-integrity');

const manifest = generateManifest(ELECTRON_ROOT);

fs.mkdirSync(path.join(ROOT, 'build'), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(manifest, null, 2));

console.log(`[generate-core-manifest] Written to ${OUT_PATH}`);
console.log(`[generate-core-manifest] ${Object.keys(manifest.files).length} files hashed`);
Object.entries(manifest.files).forEach(([f, h]) => console.log(`  ${h.slice(0, 12)}…  ${f}`));
