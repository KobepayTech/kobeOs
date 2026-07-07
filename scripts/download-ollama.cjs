#!/usr/bin/env node
/**
 * Downloads the Ollama runtime for Windows / Linux / macOS into
 * build/ollama/<platform>/ so electron-builder bundles it as extraResources.
 * KobeOS then spawns `ollama serve` on boot (see electron/main.cjs), so shops
 * get the local AI assistant with ZERO manual Ollama install.
 *
 * Run before building (already chained into the electron:build:* scripts):
 *   node scripts/download-ollama.cjs
 *
 * Layout produced (binary path is what resolveOllamaBinary() expects):
 *   build/ollama/win-x64/ollama.exe        (+ lib/ GPU runners)
 *   build/ollama/linux-x64/bin/ollama      (+ lib/)
 *   build/ollama/mac-arm64/ollama
 *   build/ollama/mac-x64/ollama
 *
 * FAIL-SOFT: Ollama is a large, optional download and the AI assistant
 * gracefully degrades without it. If a download fails (offline CI, rate
 * limit) we WARN and exit 0 — the build still succeeds and the app falls
 * back to any `ollama` already on the user's PATH.
 *
 * Override the release with OLLAMA_VERSION=v0.x.y; otherwise the latest
 * GitHub release tag is resolved automatically. Set OLLAMA_SKIP_DOWNLOAD=1
 * to skip entirely (e.g. a lightweight build that relies on system Ollama).
 */

const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'build', 'ollama');
const REPO    = 'ollama/ollama';

function sh(cmd) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim();
}

const REQUIRED = process.env.OLLAMA_REQUIRED === '1';

function resolveVersion() {
  if (process.env.OLLAMA_VERSION) return process.env.OLLAMA_VERSION;
  // Prefer the github.com /releases/latest redirect — it is NOT rate-limited,
  // unlike api.github.com (which 403s on a busy self-hosted runner and used to
  // make this whole step fail silently, shipping installers with no Ollama).
  const nul = process.platform === 'win32' ? 'NUL' : '/dev/null';
  try {
    const finalUrl = sh(`curl -sIL -o ${nul} -w "%{url_effective}" "https://github.com/${REPO}/releases/latest"`);
    const m = finalUrl.match(/\/tag\/(v[\w.\-]+)/);
    if (m) return m[1];
  } catch { /* fall through to the API */ }
  // Fallback: the API, authenticated when a token is present (5000/hr vs 60/hr).
  const auth = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const authArg = auth ? `-H "Authorization: Bearer ${auth}"` : '';
  const json = sh(`curl -L -f -s ${authArg} "https://api.github.com/repos/${REPO}/releases/latest"`);
  const tag = JSON.parse(json).tag_name;
  if (!tag) throw new Error('could not resolve latest Ollama release tag');
  return tag;
}

if (process.env.OLLAMA_SKIP_DOWNLOAD === '1') {
  console.log('OLLAMA_SKIP_DOWNLOAD=1 — skipping Ollama bundling (app will use system Ollama if present).');
  // Still ensure the dir exists so electron-builder's extraResources copy succeeds.
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  process.exit(0);
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // Each installer is per-platform (electron-builder runs on a matching
  // runner), so we bundle ONLY the host platform's runtime — keeps the
  // installer lean and avoids cross-platform extraction quirks. The runtime
  // resolver (electron/main.cjs) reads the same per-platform subfolder.
  const BY_PLATFORM = {
    'win32':          { dir: 'win-x64',   asset: 'ollama-windows-amd64.zip', bin: 'ollama.exe' },
    'linux':          { dir: 'linux-x64', asset: 'ollama-linux-amd64.tgz',   bin: 'bin/ollama' },
    'darwin-arm64':   { dir: 'mac-arm64', asset: 'ollama-darwin.tgz',        bin: 'ollama' },
    'darwin-x64':     { dir: 'mac-x64',   asset: 'ollama-darwin.tgz',        bin: 'ollama' },
  };
  const key = process.platform === 'darwin' ? `darwin-${process.arch === 'arm64' ? 'arm64' : 'x64'}` : process.platform;
  const target = BY_PLATFORM[key];
  if (!target) {
    console.warn(`[download-ollama] unsupported platform "${key}" — skipping (app falls back to system Ollama).`);
    return;
  }

  const version = resolveVersion();
  const base = `https://github.com/${REPO}/releases/download/${version}`;
  console.log(`\nDownloading Ollama ${version} for ${target.dir}...\n`);

  const { dir, asset, bin } = target;
  const platformDir = path.join(OUT_DIR, dir);
  const binPath = path.join(platformDir, bin);
  if (fs.existsSync(binPath)) { console.log(`  skip  ${dir} (already present)`); return; }

  fs.mkdirSync(platformDir, { recursive: true });
  const archivePath = path.join(platformDir, asset);
  console.log(`  down  ${dir}/${asset}`);
  execSync(`curl -L -f -s -S -o "${archivePath}" "${base}/${asset}"`, { stdio: ['ignore', 'inherit', 'inherit'] });

  console.log(`  unpack ${dir}`);
  if (asset.endsWith('.zip')) {
    // bsdtar (the default `tar` on Windows 10+ and macOS) extracts zip; on
    // Linux, GNU tar can't, so fall back to unzip there.
    if (process.platform === 'win32') execSync(`tar -xf "${archivePath}" -C "${platformDir}"`, { stdio: 'inherit' });
    else execSync(`unzip -o -q "${archivePath}" -d "${platformDir}"`, { stdio: 'inherit' });
  } else {
    execSync(`tar -xzf "${archivePath}" -C "${platformDir}"`, { stdio: 'inherit' });
  }
  fs.unlinkSync(archivePath);

  if (fs.existsSync(binPath) && process.platform !== 'win32') fs.chmodSync(binPath, 0o755);
  if (!fs.existsSync(binPath)) throw new Error(`expected binary missing after unpack: ${dir}/${bin}`);

  let bytes = 0;
  const walk = (p) => fs.readdirSync(p).forEach((f) => {
    const fp = path.join(p, f); const st = fs.statSync(fp);
    st.isDirectory() ? walk(fp) : (bytes += st.size);
  });
  walk(platformDir);
  console.log(`  ok    ${dir}  (${(bytes / 1024 / 1024).toFixed(1)} MB)\n`);
})().catch((err) => {
  // When OLLAMA_REQUIRED=1 (the self-hosted AI build), a missing Ollama runtime
  // is a hard failure — otherwise the installer would ship with no AI and the
  // assistant would report "can't reach Ollama".
  if (REQUIRED) {
    console.error(`\n[download-ollama] ERROR: ${err.message}`);
    console.error('[download-ollama] OLLAMA_REQUIRED=1 and the Ollama runtime could not be bundled. Failing the build.\n');
    process.exit(1);
  }
  // Otherwise fail-soft: don't block a build over an optional AI runtime.
  console.warn(`\n[download-ollama] WARN: ${err.message}`);
  console.warn('[download-ollama] Skipping Ollama bundle — the app will fall back to a system Ollama on PATH.\n');
  process.exit(0);
});
