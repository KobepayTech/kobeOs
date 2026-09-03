'use strict';

// Keeps the complete Windows origin alive: embedded PostgreSQL first, then the
// production API. This file intentionally has no npm dependencies so it can run
// from the stable origin even when only the built server is installed.

const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const VERSION = '2026-09-02.1';
const LOOP_DELAY_MS = 3_000;
const DATABASE_START_TIMEOUT_MS = 90_000;
const BACKEND_START_TIMEOUT_MS = 150_000;

function parseArgs(argv) {
  const result = { diagnose: false, repoRoot: '' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--diagnose') result.diagnose = true;
    if (argv[i] === '--repo-root' && argv[i + 1]) {
      result.repoRoot = path.resolve(argv[i + 1]);
      i += 1;
    }
  }
  if (!result.repoRoot) throw new Error('missing_repo_root');
  return result;
}

function uniqueExistingDirectories(candidates) {
  const seen = new Set();
  const result = [];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const resolved = path.resolve(candidate);
    const key = process.platform === 'win32' ? resolved.toLowerCase() : resolved;
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      if (fs.statSync(resolved).isDirectory()) result.push(resolved);
    } catch { /* inaccessible or absent */ }
  }
  return result;
}

function userProfiles() {
  if (process.platform !== 'win32') return [os.homedir()];
  const drive = process.env.SystemDrive || path.parse(os.homedir()).root || 'C:';
  const usersRoot = path.join(drive, 'Users');
  try {
    return fs.readdirSync(usersRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(usersRoot, entry.name));
  } catch {
    return [os.homedir()];
  }
}

function isCluster(dataDir) {
  try {
    return fs.statSync(path.join(dataDir, 'PG_VERSION')).isFile()
      && fs.statSync(path.join(dataDir, 'base')).isDirectory()
      && fs.statSync(path.join(dataDir, 'global')).isDirectory();
  } catch {
    return false;
  }
}

function dataDirCandidates(repoRoot) {
  const profiles = userProfiles();
  const candidates = [
    process.env.KOBEOS_PG_DATA_DIR,
    process.env.APPDATA && path.join(process.env.APPDATA, 'KobeOS', 'pgdata'),
    path.join(repoRoot, 'pgdata'),
    path.join(repoRoot, 'data', 'pgdata'),
  ];

  for (const profile of profiles) {
    candidates.push(path.join(profile, 'AppData', 'Roaming', 'KobeOS', 'pgdata'));
    candidates.push(path.join(profile, 'AppData', 'Local', 'KobeOS', 'pgdata'));
  }

  return uniqueExistingDirectories(candidates).filter(isCluster);
}

function selectDataDir(repoRoot, logsDir) {
  const markerPath = path.join(logsDir, 'live-postgres-data-dir.txt');
  try {
    const marked = fs.readFileSync(markerPath, 'utf8').trim();
    if (marked && isCluster(marked)) {
      return { candidates: dataDirCandidates(repoRoot), selected: path.resolve(marked), reason: 'marker' };
    }
  } catch { /* no usable marker yet */ }

  const candidates = dataDirCandidates(repoRoot);
  const explicit = process.env.KOBEOS_PG_DATA_DIR && path.resolve(process.env.KOBEOS_PG_DATA_DIR);
  if (explicit && candidates.some((candidate) => candidate.toLowerCase() === explicit.toLowerCase())) {
    return { candidates, selected: explicit, reason: 'environment' };
  }

  const current = process.env.APPDATA && path.resolve(process.env.APPDATA, 'KobeOS', 'pgdata');
  if (current && candidates.some((candidate) => candidate.toLowerCase() === current.toLowerCase())) {
    return { candidates, selected: current, reason: 'current_profile' };
  }

  if (candidates.length === 1) return { candidates, selected: candidates[0], reason: 'single_candidate' };
  return { candidates, selected: null, reason: candidates.length === 0 ? 'missing' : 'ambiguous' };
}

function isCompleteBinDir(binDir) {
  const extension = process.platform === 'win32' ? '.exe' : '';
  return ['postgres', 'pg_ctl', 'initdb'].every((name) => {
    try {
      return fs.statSync(path.join(binDir, `${name}${extension}`)).isFile();
    } catch {
      return false;
    }
  });
}

function binaryCandidates(repoRoot) {
  const profiles = userProfiles();
  const roots = [
    path.join(repoRoot, 'build', 'postgres', 'bin'),
    path.join(repoRoot, 'node_modules', '@embedded-postgres', 'windows-x64', 'native', 'bin'),
    path.join(repoRoot, 'postgres', 'bin'),
    path.join(repoRoot, 'resources', 'postgres', 'bin'),
    path.join(repoRoot, 'release', 'win-unpacked', 'resources', 'postgres', 'bin'),
    path.join(repoRoot, 'dist', 'win-unpacked', 'resources', 'postgres', 'bin'),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'KobeOS', 'resources', 'postgres', 'bin'),
    process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'KobeOS', 'resources', 'postgres', 'bin'),
  ];

  for (const profile of profiles) {
    roots.push(path.join(profile, 'AppData', 'Local', 'Programs', 'KobeOS', 'resources', 'postgres', 'bin'));
  }
  return uniqueExistingDirectories(roots).filter(isCompleteBinDir);
}

function appendLine(file, value) {
  try {
    fs.appendFileSync(file, `${new Date().toISOString()} ${value}\n`, 'utf8');
  } catch { /* logging must not crash recovery */ }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function tcpListening(port, timeoutMs = 1_500) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

function apiHealthy(timeoutMs = 2_500) {
  return new Promise((resolve) => {
    const request = http.get({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/health',
      timeout: timeoutMs,
    }, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.once('timeout', () => { request.destroy(); resolve(false); });
    request.once('error', () => resolve(false));
  });
}

function readProductionEnvironment(repoRoot) {
  const environment = { ...process.env };
  const envPath = path.join(repoRoot, 'server', '.env.production');
  const contents = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const equals = line.indexOf('=');
    if (equals < 1) continue;
    const name = line.slice(0, equals).trim();
    let value = line.slice(equals + 1);
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }
    environment[name] = value;
  }

  Object.assign(environment, {
    NODE_ENV: 'production',
    PORT: '3000',
    DB_HOST: '127.0.0.1',
    DB_PORT: '5433',
    DB_USERNAME: 'kobeos',
    DB_PASSWORD: 'kobeos_live',
    DB_DATABASE: 'kobeos',
    DB_SYNCHRONIZE: 'false',
    DB_MIGRATIONS_RUN: 'false',
    // Keep the headless origin on the CPU-friendly bundled chat model. Large
    // vision/reasoning models are still selected when a request needs them.
    OLLAMA_MODEL: environment.OLLAMA_MODEL || 'kobechat-fast',
    OLLAMA_KEEP_ALIVE: environment.OLLAMA_KEEP_ALIVE || '10m',
    CORS_ORIGIN: 'https://kobeos-app.pages.dev,https://*.kobeos-app.pages.dev,https://kobeapptz.com,https://*.kobeapptz.com',
    TENANT_BASE_DOMAIN: 'kobeapptz.com',
  });
  return environment;
}

function processAlive(child) {
  return Boolean(child && child.exitCode === null && !child.killed);
}

function stopChild(child) {
  if (!processAlive(child)) return;
  try { child.kill('SIGTERM'); } catch { /* already gone */ }
}

function stopLockedApiListeners() {
  if (process.platform !== 'win32') return false;
  const command = [
    "$ErrorActionPreference = 'Stop'",
    "$listeners = @(Get-NetTCPConnection -State Listen -LocalPort 3000 -ErrorAction SilentlyContinue)",
    "foreach ($listener in $listeners) {",
    "  $listenerProcess = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue",
    "  if (-not $listenerProcess -or $listenerProcess.ProcessName -notmatch '^node(?:js)?$') { exit 41 }",
    "  Stop-Process -Id $listener.OwningProcess -Force -ErrorAction Stop",
    "}",
    "exit 0",
  ].join('\n');
  const result = spawnSync(
    'powershell.exe',
    ['-ExecutionPolicy', 'Bypass', '-NoProfile', '-NonInteractive', '-Command', command],
    { windowsHide: true, stdio: 'ignore', timeout: 10_000 },
  );
  return result.status === 0;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const repoRoot = options.repoRoot;
  const logsDir = path.join(repoRoot, 'logs');
  fs.mkdirSync(logsDir, { recursive: true });

  const selectedData = selectDataDir(repoRoot, logsDir);
  const bins = binaryCandidates(repoRoot);
  if (options.diagnose) {
    process.stdout.write(`origin_supervisor_version=${VERSION}\n`);
    process.stdout.write(`postgres_data_candidate_count=${selectedData.candidates.length}\n`);
    process.stdout.write(`postgres_data_selection=${selectedData.selected ? selectedData.reason : selectedData.reason}\n`);
    process.stdout.write(`postgres_binary_candidate_count=${bins.length}\n`);
    process.stdout.write(`postgres_binary_selection=${bins.length > 0 ? 'available' : 'missing'}\n`);
    return;
  }

  const supervisorLog = path.join(logsDir, 'live-origin-supervisor.log');
  const stateFile = path.join(logsDir, 'live-origin-supervisor.state');
  const deploymentLock = path.join(logsDir, 'deployment.lock');
  const postgresOut = fs.openSync(path.join(logsDir, 'kobe-postgres-live.out.log'), 'a');
  const postgresErr = fs.openSync(path.join(logsDir, 'kobe-postgres-live.err.log'), 'a');
  const backendOut = fs.openSync(path.join(logsDir, 'kobe-backend-live.out.log'), 'a');
  const backendErr = fs.openSync(path.join(logsDir, 'kobe-backend-live.err.log'), 'a');

  let database = null;
  let backend = null;
  let databaseStartedAt = 0;
  let backendStartedAt = 0;
  let lastState = '';

  const setState = (state) => {
    if (state === lastState) return;
    lastState = state;
    try { fs.writeFileSync(stateFile, `${state}\n`, 'utf8'); } catch { /* diagnostic only */ }
    appendLine(supervisorLog, `state=${state}`);
  };

  const shutdown = () => {
    stopChild(backend);
    stopChild(database);
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  appendLine(supervisorLog, `supervisor_started version=${VERSION}`);

  while (true) {
    const databaseUp = await tcpListening(5433);
    if (!databaseUp) {
      if (processAlive(database)) {
        if (Date.now() - databaseStartedAt > DATABASE_START_TIMEOUT_MS) {
          setState('database_start_timeout');
          stopChild(database);
          database = null;
          await delay(5_000);
        } else {
          setState('database_starting');
          await delay(LOOP_DELAY_MS);
        }
        continue;
      }

      const data = selectDataDir(repoRoot, logsDir);
      const availableBins = binaryCandidates(repoRoot);
      if (!data.selected) {
        setState(data.reason === 'ambiguous' ? 'database_cluster_ambiguous' : 'database_cluster_missing');
        await delay(30_000);
        continue;
      }
      if (availableBins.length === 0) {
        setState('database_binary_missing');
        await delay(30_000);
        continue;
      }

      try {
        fs.writeFileSync(path.join(logsDir, 'live-postgres-data-dir.txt'), `${data.selected}\n`, 'utf8');
        const pidFile = path.join(data.selected, 'postmaster.pid');
        if (fs.existsSync(pidFile)) {
          // Match the desktop bootstrap behavior: if :5433 is not listening,
          // this is a crash/reboot remnant and blocks PostgreSQL startup.
          fs.unlinkSync(pidFile);
        }

        const extension = process.platform === 'win32' ? '.exe' : '';
        const executable = path.join(availableBins[0], `postgres${extension}`);
        const child = spawn(executable, [
          '-D', data.selected,
          '-p', '5433',
          '-c', 'listen_addresses=127.0.0.1',
          '-c', 'log_destination=stderr',
          '-c', 'logging_collector=off',
        ], {
          cwd: repoRoot,
          env: { ...process.env, LC_MESSAGES: 'C' },
          windowsHide: true,
          stdio: ['ignore', postgresOut, postgresErr],
        });
        database = child;
        databaseStartedAt = Date.now();
        child.once('error', () => {
          setState('database_spawn_failed');
          if (database === child) database = null;
        });
        child.once('exit', (code) => {
          appendLine(supervisorLog, `database_exit code=${Number.isInteger(code) ? code : 'signal'}`);
          if (database === child) database = null;
        });
        setState('database_starting');
      } catch {
        database = null;
        setState('database_spawn_failed');
        await delay(15_000);
      }
      continue;
    }

    if (fs.existsSync(deploymentLock)) {
      if (processAlive(backend)) {
        stopChild(backend);
        backend = null;
      }
      if (!stopLockedApiListeners()) {
        setState('deployment_drain_failed');
        await delay(LOOP_DELAY_MS);
        continue;
      }
      setState('deployment_paused');
      await delay(LOOP_DELAY_MS);
      continue;
    }

    if (await apiHealthy()) {
      setState('healthy');
      await delay(LOOP_DELAY_MS);
      continue;
    }

    if (processAlive(backend)) {
      if (Date.now() - backendStartedAt > BACKEND_START_TIMEOUT_MS) {
        setState('backend_start_timeout');
        stopChild(backend);
        backend = null;
        await delay(5_000);
      } else {
        setState('backend_starting');
        await delay(LOOP_DELAY_MS);
      }
      continue;
    }

    if (await tcpListening(3000)) {
      setState('api_port_occupied_unhealthy');
      await delay(15_000);
      continue;
    }

    try {
      const bundle = path.join(repoRoot, 'server', 'dist', 'main.js');
      const environment = readProductionEnvironment(repoRoot);
      const child = spawn(process.execPath, [bundle], {
        cwd: repoRoot,
        env: environment,
        windowsHide: true,
        stdio: ['ignore', backendOut, backendErr],
      });
      backend = child;
      backendStartedAt = Date.now();
      child.once('error', () => {
        setState('backend_spawn_failed');
        if (backend === child) backend = null;
      });
      child.once('exit', (code) => {
        appendLine(supervisorLog, `backend_exit code=${Number.isInteger(code) ? code : 'signal'}`);
        if (backend === child) backend = null;
      });
      setState('backend_starting');
    } catch {
      backend = null;
      setState('backend_spawn_failed');
      await delay(15_000);
    }
  }
}

main().catch(() => {
  try {
    const options = parseArgs(process.argv.slice(2));
    const logsDir = path.join(options.repoRoot, 'logs');
    fs.mkdirSync(logsDir, { recursive: true });
    fs.writeFileSync(path.join(logsDir, 'live-origin-supervisor.state'), 'supervisor_crashed\n', 'utf8');
  } catch { /* no safe recovery path remains */ }
  process.exit(1);
});

