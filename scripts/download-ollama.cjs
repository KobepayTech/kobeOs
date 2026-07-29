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

const { execFileSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'build', 'ollama');
const REPO = 'ollama/ollama';
const REQUIRED = process.env.OLLAMA_REQUIRED === '1';

function sh(cmd) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim();
}

function run(command, args, stdio = ['ignore', 'pipe', 'inherit']) {
  const output = execFileSync(command, args, { stdio });
  return Buffer.isBuffer(output) ? output.toString().trim() : '';
}

function getPlatformTarget(platform = process.platform, arch = process.arch) {
  const byPlatform = {
    'win32': { dir: 'win-x64', asset: 'ollama-windows-amd64.zip', bin: 'ollama.exe' },
    'linux': { dir: 'linux-x64', asset: 'ollama-linux-amd64.tar.zst', bin: 'bin/ollama' },
    'darwin-arm64': { dir: 'mac-arm64', asset: 'ollama-darwin.tgz', bin: 'ollama' },
    'darwin-x64': { dir: 'mac-x64', asset: 'ollama-darwin.tgz', bin: 'ollama' },
  };
  const key = platform === 'darwin' ? `darwin-${arch === 'arm64' ? 'arm64' : 'x64'}` : platform;
  return byPlatform[key] ?? null;
}

function findSystemOllamaDir(platform = process.platform, env = process.env) {
  if (platform !== 'win32') return null;

  const candidates = [
    env.OLLAMA_HOME,
    env.LOCALAPPDATA ? path.join(env.LOCALAPPDATA, 'Programs', 'Ollama') : null,
    env.ProgramFiles ? path.join(env.ProgramFiles, 'Ollama') : null,
    env['ProgramFiles(x86)'] ? path.join(env['ProgramFiles(x86)'], 'Ollama') : null,
  ].filter(Boolean);

  try {
    const fromPath = run(process.platform === 'win32' ? 'where.exe' : 'where', ['ollama.exe'])
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => path.dirname(line));
    candidates.push(...fromPath);
  } catch {
    console.log('  note  ollama.exe not found in PATH; checking standard install locations');
  }

  for (const candidate of new Set(candidates)) {
    if (fs.existsSync(path.join(candidate, 'ollama.exe'))) return candidate;
  }
  return null;
}

function copyDirectoryContents(sourceDir, destinationDir) {
  fs.mkdirSync(destinationDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir)) {
    fs.cpSync(path.join(sourceDir, entry), path.join(destinationDir, entry), { recursive: true, force: true });
  }
}

async function resolveVersion() {
  if (process.env.OLLAMA_VERSION) return process.env.OLLAMA_VERSION;
  // Prefer the github.com /releases/latest redirect — it is NOT rate-limited,
  // unlike api.github.com (which 403s on a busy self-hosted runner and used to
  // make this whole step fail silently, shipping installers with no Ollama).
  const nul = process.platform === 'win32' ? 'NUL' : '/dev/null';
  try {
    const finalUrl = run('curl', ['-sIL', '-o', nul, '-w', '%{url_effective}', `https://github.com/${REPO}/releases/latest`]);
    const match = finalUrl.match(/\/tag\/(v[\w.-]+)/);
    if (match) return match[1];
  } catch {
    // Fall through to the API.
  }

  const auth = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const headers = { 'User-Agent': 'kobeos-build' };
  if (auth) headers.Authorization = `Bearer ${auth}`;

  const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers });
  if (!response.ok) {
    throw new Error(`could not resolve latest Ollama release tag (${response.status} ${response.statusText})`);
  }

  const tag = (await response.json()).tag_name;
  if (!tag) throw new Error('could not resolve latest Ollama release tag');
  return tag;
}

function summarizeDirectoryBytes(rootDir) {
  try {
    let bytes = 0;
    const walk = (current) => fs.readdirSync(current).forEach((entry) => {
      const fullPath = path.join(current, entry);
      const stats = fs.statSync(fullPath);
      if (stats.isDirectory()) walk(fullPath);
      else bytes += stats.size;
    });
    walk(rootDir);
    return bytes;
  } catch (error) {
    throw new Error(`cannot calculate bundled Ollama size for ${rootDir}: ${error.message}`);
  }
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const target = getPlatformTarget();
  if (!target) {
    const key = process.platform === 'darwin' ? `darwin-${process.arch === 'arm64' ? 'arm64' : 'x64'}` : process.platform;
    console.warn(`[download-ollama] unsupported platform "${key}" — skipping (app falls back to system Ollama).`);
    return;
  }

  const { dir, asset, bin } = target;
  const platformDir = path.join(OUT_DIR, dir);
  const binPath = path.join(platformDir, bin);
  if (fs.existsSync(binPath)) {
    console.log(`  skip  ${dir} (already present)`);
    return;
  }

  fs.mkdirSync(platformDir, { recursive: true });

  const systemOllamaDir = findSystemOllamaDir();
  if (systemOllamaDir) {
    console.log(`\nCopying Ollama from local install at ${systemOllamaDir}...\n`);
    copyDirectoryContents(systemOllamaDir, platformDir);
    if (fs.existsSync(binPath)) {
      const bytes = summarizeDirectoryBytes(platformDir);
      console.log(`  ok    ${dir}  (${(bytes / 1024 / 1024).toFixed(1)} MB, copied from local install)\n`);
      return;
    }
    console.warn(`  warn  local Ollama copy from ${systemOllamaDir} did not produce ${bin}; falling back to GitHub download`);
  }

  const version = await resolveVersion();
  const base = `https://github.com/${REPO}/releases/download/${version}`;
  console.log(`\nDownloading Ollama ${version} for ${dir}...\n`);

  const archivePath = path.join(platformDir, asset);
  console.log(`  down  ${dir}/${asset}`);
  run('curl', [
    '-L', '-f', '-s', '-S',
    '--retry', '4',
    '--retry-delay', '3',
    '--retry-all-errors',
    '--connect-timeout', '30',
    '--max-time', '1800',
    '-o', archivePath,
    `${base}/${asset}`,
  ], ['ignore', 'inherit', 'inherit']);

  console.log(`  unpack ${dir}`);
  if (asset.endsWith('.zip')) {
    // bsdtar (the default `tar` on Windows 10+ and macOS) extracts zip; on
    // Linux, GNU tar can't, so fall back to unzip there.
    if (process.platform === 'win32') run('tar', ['-xf', archivePath, '-C', platformDir], 'inherit');
    else run('unzip', ['-o', '-q', archivePath, '-d', platformDir], 'inherit');
  } else if (asset.endsWith('.tar.zst')) {
    run('tar', ['--zstd', '-xf', archivePath, '-C', platformDir], 'inherit');
  } else {
    run('tar', ['-xzf', archivePath, '-C', platformDir], 'inherit');
  }
  fs.unlinkSync(archivePath);

  if (fs.existsSync(binPath) && process.platform !== 'win32') fs.chmodSync(binPath, 0o755);
  if (!fs.existsSync(binPath)) throw new Error(`expected binary missing after unpack: ${dir}/${bin}`);

  const bytes = summarizeDirectoryBytes(platformDir);
  console.log(`  ok    ${dir}  (${(bytes / 1024 / 1024).toFixed(1)} MB)\n`);
}

module.exports = { getPlatformTarget, findSystemOllamaDir };

if (process.env.OLLAMA_SKIP_DOWNLOAD === '1') {
  console.log('OLLAMA_SKIP_DOWNLOAD=1 — skipping Ollama bundling (app will use system Ollama if present).');
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
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
}
