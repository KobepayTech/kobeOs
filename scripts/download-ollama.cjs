#!/usr/bin/env node
/**
 * Bundle the Ollama runtime used by KobeOS installers.
 *
 * The module is intentionally CommonJS because build scripts and tests require()
 * it directly. Keep helper functions side-effect free and only execute downloads
 * when this file is run as the main program.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'build', 'ollama');
const REPO = 'ollama/ollama';
const REQUIRED = process.env.OLLAMA_REQUIRED === '1';

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    stdio: ['ignore', 'pipe', 'inherit'],
    ...options,
  }).toString().trim();
}

function getPlatformTarget(platform = process.platform, arch = process.arch) {
  if (platform === 'win32' && arch === 'x64') {
    return { dir: 'win-x64', asset: 'ollama-windows-amd64.zip', bin: 'ollama.exe' };
  }
  if (platform === 'linux' && arch === 'x64') {
    return { dir: 'linux-x64', asset: 'ollama-linux-amd64.tar.zst', bin: 'bin/ollama' };
  }
  if (platform === 'darwin' && arch === 'arm64') {
    return { dir: 'mac-arm64', asset: 'ollama-darwin.tgz', bin: 'ollama' };
  }
  if (platform === 'darwin' && arch === 'x64') {
    return { dir: 'mac-x64', asset: 'ollama-darwin.tgz', bin: 'ollama' };
  }
  return null;
}

function findSystemOllamaDir(platform = process.platform, env = process.env) {
  const candidates = [];

  if (env.OLLAMA_HOME) candidates.push(env.OLLAMA_HOME);
  if (env.OLLAMA_LOCAL_DIR) candidates.push(env.OLLAMA_LOCAL_DIR);

  if (platform === 'win32') {
    if (env.LOCALAPPDATA) candidates.push(path.join(env.LOCALAPPDATA, 'Programs', 'Ollama'));
    if (env.ProgramFiles) candidates.push(path.join(env.ProgramFiles, 'Ollama'));
    if (env['ProgramFiles(x86)']) candidates.push(path.join(env['ProgramFiles(x86)'], 'Ollama'));
  }

  const binaryName = platform === 'win32' ? 'ollama.exe' : 'ollama';
  for (const raw of candidates) {
    if (!raw) continue;
    const resolved = path.resolve(raw);
    if (!fs.existsSync(resolved)) continue;
    const stat = fs.statSync(resolved);
    const dir = stat.isFile() ? path.dirname(resolved) : resolved;
    const binary = stat.isFile() ? resolved : path.join(dir, binaryName);
    if (fs.existsSync(binary)) return dir;
  }

  return null;
}

function directorySize(dir) {
  let bytes = 0;
  if (!fs.existsSync(dir)) return bytes;
  const walk = (current) => {
    for (const file of fs.readdirSync(current)) {
      const item = path.join(current, file);
      const stat = fs.statSync(item);
      if (stat.isDirectory()) walk(item);
      else bytes += stat.size;
    }
  };
  walk(dir);
  return bytes;
}

function copyLocalRuntime(platformDir, target, env = process.env) {
  const sourceDir = findSystemOllamaDir(process.platform, env);
  if (!sourceDir) return false;

  const sourceBin = path.join(sourceDir, process.platform === 'win32' ? 'ollama.exe' : 'ollama');
  if (!fs.existsSync(sourceBin)) return false;

  console.log(`  local ${sourceDir}`);
  fs.mkdirSync(path.dirname(path.join(platformDir, target.bin)), { recursive: true });
  fs.copyFileSync(sourceBin, path.join(platformDir, target.bin));

  const sourceLib = path.join(sourceDir, 'lib');
  if (fs.existsSync(sourceLib) && fs.statSync(sourceLib).isDirectory()) {
    fs.cpSync(sourceLib, path.join(platformDir, 'lib'), { recursive: true, force: true });
  }

  const bytes = directorySize(platformDir);
  console.log(`  ok    local Ollama runtime (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
  return true;
}

function resolveVersion(env = process.env) {
  if (env.OLLAMA_VERSION) return env.OLLAMA_VERSION;

  const nullDevice = process.platform === 'win32' ? 'NUL' : '/dev/null';
  try {
    const finalUrl = run('curl', [
      '-sIL', '-o', nullDevice, '-w', '%{url_effective}',
      `https://github.com/${REPO}/releases/latest`,
    ]);
    const match = finalUrl.match(/\/tag\/(v[\w.\-]+)/);
    if (match) return match[1];
  } catch {
    // Fall through to the API request below.
  }

  const args = ['-L', '-f', '-s'];
  const token = env.GITHUB_TOKEN || env.GH_TOKEN;
  if (token) args.push('-H', `Authorization: Bearer ${token}`);
  args.push(`https://api.github.com/repos/${REPO}/releases/latest`);
  const json = run('curl', args);
  const tag = JSON.parse(json).tag_name;
  if (!tag) throw new Error('could not resolve latest Ollama release tag');
  return tag;
}

function extractArchive(archivePath, platformDir, asset) {
  if (asset.endsWith('.zip')) {
    if (process.platform === 'win32') {
      run('tar', ['-xf', archivePath, '-C', platformDir], { stdio: 'inherit' });
    } else {
      run('unzip', ['-o', '-q', archivePath, '-d', platformDir], { stdio: 'inherit' });
    }
    return;
  }

  if (asset.endsWith('.tar.zst')) {
    run('tar', ['--zstd', '-xf', archivePath, '-C', platformDir], { stdio: 'inherit' });
    return;
  }

  run('tar', ['-xzf', archivePath, '-C', platformDir], { stdio: 'inherit' });
}

async function main() {
  if (process.env.OLLAMA_SKIP_DOWNLOAD === '1') {
    console.log('OLLAMA_SKIP_DOWNLOAD=1 — skipping Ollama bundling.');
    fs.mkdirSync(OUT_DIR, { recursive: true });
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const target = getPlatformTarget();
  if (!target) {
    console.warn(`[download-ollama] unsupported platform "${process.platform}-${process.arch}" — skipping.`);
    return;
  }

  const platformDir = path.join(OUT_DIR, target.dir);
  const binPath = path.join(platformDir, target.bin);
  if (fs.existsSync(binPath)) {
    console.log(`  skip  ${target.dir} (already present)`);
    return;
  }

  if (copyLocalRuntime(platformDir, target)) return;

  const version = resolveVersion();
  const base = `https://github.com/${REPO}/releases/download/${version}`;
  fs.mkdirSync(platformDir, { recursive: true });
  const archivePath = path.join(platformDir, target.asset);

  console.log(`Downloading Ollama ${version} for ${target.dir}...`);
  run('curl', [
    '-L', '-f', '-s', '-S',
    '--retry', '4', '--retry-delay', '3', '--retry-all-errors',
    '--connect-timeout', '30', '--max-time', '1800',
    '-o', archivePath,
    `${base}/${target.asset}`,
  ], { stdio: 'inherit' });

  extractArchive(archivePath, platformDir, target.asset);
  fs.rmSync(archivePath, { force: true });

  if (fs.existsSync(binPath) && process.platform !== 'win32') fs.chmodSync(binPath, 0o755);
  if (!fs.existsSync(binPath)) throw new Error(`expected binary missing after unpack: ${target.dir}/${target.bin}`);

  const bytes = directorySize(platformDir);
  console.log(`  ok    ${target.dir} (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
}

module.exports = {
  getPlatformTarget,
  findSystemOllamaDir,
  resolveVersion,
  directorySize,
};

if (require.main === module) {
  main().catch((err) => {
    if (REQUIRED) {
      console.error(`\n[download-ollama] ERROR: ${err.message}`);
      console.error('[download-ollama] OLLAMA_REQUIRED=1 and the runtime could not be bundled.');
      process.exit(1);
    }
    console.warn(`\n[download-ollama] WARN: ${err.message}`);
    console.warn('[download-ollama] Skipping bundle — KobeOS will fall back to system Ollama on PATH.');
    process.exit(0);
  });
}
