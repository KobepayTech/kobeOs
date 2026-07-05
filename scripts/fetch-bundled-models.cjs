#!/usr/bin/env node
/**
 * fetch-bundled-models.cjs
 *
 * Populates models/bundled/ with the GGUF files listed in
 * models/bundled/models.json so electron-builder bakes them into the
 * installer (extraResources → resources/models). KobeOS then registers each
 * one into the bundled Ollama on the user's first boot (see
 * electron/main.cjs → importBundledModels) — no download on the shop laptop.
 *
 * Two sources, so it works on either kind of runner:
 *
 *   1. Self-hosted runner with the GGUFs on local disk:
 *        set KOBE_MODELS_DIR=C:\KobeOS\Models
 *      Each model's `file` is copied from there.
 *
 *   2. GitHub-hosted runner (no local disk): give each model a `url` in
 *      models.json (HuggingFace / a GitHub Release asset / your R2/CDN) and
 *      it's downloaded. Private URLs can use a token via KOBE_MODELS_AUTH
 *      (sent as an Authorization header).
 *
 * A file already present in models/bundled/ is left alone (skip). This is
 * FAIL-SOFT by default: a missing source warns and the build continues
 * (installer just won't bundle that model). Set KOBE_MODELS_REQUIRED=1 to
 * make a missing model fail the build instead.
 *
 *   node scripts/fetch-bundled-models.cjs
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'models', 'bundled');
const MANIFEST = path.join(OUT_DIR, 'models.json');
// Fall back to the conventional Windows models folder if the env var didn't
// reach us (e.g. an empty workflow input) so the standard path still works.
const LOCAL_DIR = process.env.KOBE_MODELS_DIR || (process.platform === 'win32' ? 'C:\\KobeOS\\Models' : '');
const AUTH = process.env.KOBE_MODELS_AUTH || '';
const REQUIRED = process.env.KOBE_MODELS_REQUIRED === '1';

function fail(msg) {
  if (REQUIRED) { console.error(`[fetch-bundled-models] ERROR: ${msg}`); process.exit(1); }
  console.warn(`[fetch-bundled-models] WARN: ${msg}`);
}

// Diagnostics: show exactly what source we resolved and what's in it, so a
// "no source" failure is self-explanatory (wrong path vs. permissions vs. name).
console.log(`[fetch-bundled-models] KOBE_MODELS_DIR=${JSON.stringify(process.env.KOBE_MODELS_DIR || '')}  resolved LOCAL_DIR=${JSON.stringify(LOCAL_DIR)}`);
if (LOCAL_DIR) {
  if (fs.existsSync(LOCAL_DIR)) {
    let listing = [];
    try { listing = fs.readdirSync(LOCAL_DIR); } catch (e) { console.log(`[fetch-bundled-models]   cannot list ${LOCAL_DIR}: ${e.message}`); }
    const ggufs = listing.filter((f) => f.toLowerCase().endsWith('.gguf'));
    console.log(`[fetch-bundled-models]   ${LOCAL_DIR} exists; ${ggufs.length} gguf file(s): ${ggufs.join(', ') || '(none)'}`);
  } else {
    console.log(`[fetch-bundled-models]   ${LOCAL_DIR} does NOT exist or is not readable by this account (runner may run as NetworkService).`);
  }
}

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
if (!fs.existsSync(MANIFEST)) {
  console.log('[fetch-bundled-models] no models/bundled/models.json — nothing to fetch.');
  process.exit(0);
}

let manifest;
try { manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); }
catch (e) { fail(`models.json unreadable: ${e.message}`); process.exit(REQUIRED ? 1 : 0); }

const models = Array.isArray(manifest.models) ? manifest.models : [];
if (!models.length) { console.log('[fetch-bundled-models] models.json lists no models — skipping.'); process.exit(0); }

let fetched = 0, skipped = 0, missing = 0;
for (const m of models) {
  const file = m && m.file;
  if (!file) continue;
  const dest = path.join(OUT_DIR, file);

  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    console.log(`  skip  ${file} (already present)`);
    skipped++;
    continue;
  }

  // Source 1: local directory on a self-hosted runner.
  if (LOCAL_DIR) {
    const src = path.join(LOCAL_DIR, file);
    if (fs.existsSync(src)) {
      console.log(`  copy  ${file}  ←  ${src}`);
      fs.copyFileSync(src, dest);
      fetched++;
      continue;
    }
  }

  // Source 2: download by URL (GitHub-hosted runner).
  if (m.url) {
    console.log(`  down  ${file}  ←  ${m.url}`);
    const authArg = AUTH ? `-H "Authorization: ${AUTH}"` : '';
    try {
      execSync(`curl -L -f -s -S ${authArg} -o "${dest}" "${m.url}"`, { stdio: ['ignore', 'inherit', 'inherit'] });
      fetched++;
      continue;
    } catch (e) {
      try { fs.rmSync(dest, { force: true }); } catch { /* ignore */ }
      fail(`download failed for ${file}: ${e.message}`);
      missing++;
      continue;
    }
  }

  fail(`no source for "${file}" — set KOBE_MODELS_DIR or add a "url" in models.json.`);
  missing++;
}

console.log(`\n[fetch-bundled-models] fetched ${fetched}, skipped ${skipped}, missing ${missing}.`);
for (const dir of [OUT_DIR]) {
  for (const f of fs.readdirSync(dir).filter((x) => x.toLowerCase().endsWith('.gguf'))) {
    console.log(`  bundled: ${f}  (${(fs.statSync(path.join(dir, f)).size / 1024 / 1024).toFixed(1)} MB)`);
  }
}
if (REQUIRED && missing > 0) process.exit(1);
