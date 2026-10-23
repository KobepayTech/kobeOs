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

const VERSION = '2026-10-23.1';

// The credentials the supervisor hands the backend. Named here because the
// cluster it provisions has to be created with the same ones.
const DB_USERNAME = 'kobeos';
const DB_PASSWORD = 'kobeos_live';
const DB_DATABASE = 'kobeos';
const DB_PORT = '5433';
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

/**
 * Create the cluster this origin has never had.
 *
 * Only ever called when no cluster exists anywhere the supervisor searches,
 * so it cannot overwrite data: initdb itself refuses a non-empty directory,
 * and the caller refuses the ambiguous case outright.
 *
 * Authentication is scram-sha-256 with the same credentials the supervisor
 * hands the backend, rather than the `trust` that embedded Postgres usually
 * ships with — the cluster only listens on 127.0.0.1, but trust would let any
 * local process on the origin connect as superuser.
 */
function provisionCluster({ binDir, dataDir, supervisorLog }) {
  const extension = process.platform === 'win32' ? '.exe' : '';
  const initdb = path.join(binDir, `initdb${extension}`);
  const passwordFile = path.join(os.tmpdir(), `kobeos-initdb-${process.pid}-${Date.now()}`);

  try {
    fs.mkdirSync(dataDir, { recursive: true });
    if (fs.readdirSync(dataDir).length > 0) {
      appendLine(supervisorLog, `provision_refused reason=data_dir_not_empty dir=${dataDir}`);
      return false;
    }

    fs.writeFileSync(passwordFile, `${DB_PASSWORD}\n`, { encoding: 'utf8', mode: 0o600 });
    const result = spawnSync(initdb, [
      '-D', dataDir,
      '-U', DB_USERNAME,
      '--pwfile', passwordFile,
      '--auth-local=scram-sha-256',
      '--auth-host=scram-sha-256',
      '-E', 'UTF8',
    ], { encoding: 'utf8', windowsHide: true });

    if (result.status !== 0) {
      const detail = `${result.stderr || ''}${result.error ? ` ${result.error.message}` : ''}`.trim();
      appendLine(supervisorLog, `provision_failed status=${result.status} detail=${detail.slice(0, 400)}`);
      return false;
    }
    appendLine(supervisorLog, `provision_ok dir=${dataDir}`);
    return true;
  } catch (error) {
    appendLine(supervisorLog, `provision_failed error=${String(error && error.message).slice(0, 400)}`);
    return false;
  } finally {
    try { fs.unlinkSync(passwordFile); } catch { /* already gone */ }
  }
}

/**
 * Make sure the database the backend connects to exists.
 *
 * Idempotent and cheap: psql -lqt lists databases, and createdb only runs
 * when the name is absent. Returns true when the database is present
 * afterwards, false when it could not be created.
 */
/**
 * Rebuild the database when it was migrated by a different bundle.
 *
 * The rollback path restores the previously installed server, and that older
 * bundle boots with migrations enabled and applies its own migration set to
 * whatever database it finds. The result is a schema no current migration can
 * extend — the origin ended up with CreatorCommerceNetwork1783700000000
 * applied at a timestamp this repository calls AddProviderSetup, and a
 * creator_attribution_links the current migrations cannot add an index to.
 *
 * This belongs here rather than in the release workflow: the release stops the
 * runtime before swapping bundles, which stops PostgreSQL too, so a check
 * there runs against a database that is not listening. The supervisor starts
 * the database first and the backend second, so between those two it has a
 * live connection and knows exactly which bundle is about to migrate.
 *
 * Only ever rebuilds while every guarded table is empty.
 */
async function ensureSchemaCompatible({ repoRoot, supervisorLog }) {
  const GUARDED = ['users', 'hotel_bookings', 'payment_transactions', 'pos_orders',
    'commerce_businesses', 'property_leases', 'rent_payments'];

  // The names TypeORM will record, read from the compiled migrations this
  // bundle ships. Both forms: an explicit `name = "Xxx<timestamp>"`, and the
  // class declaration it falls back to when a migration omits one.
  const known = new Set();
  try {
    const dir = path.join(repoRoot, 'server', 'dist', 'migrations');
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.js')) continue;
      const src = fs.readFileSync(path.join(dir, file), 'utf8');
      for (const m of src.matchAll(/name\s*=\s*["']([A-Za-z0-9_]+\d{10,})["']/g)) known.add(m[1].toLowerCase());
      for (const m of src.matchAll(/class\s+([A-Za-z0-9_]+\d{10,})/g)) known.add(m[1].toLowerCase());
    }
  } catch (error) {
    appendLine(supervisorLog, `schema_check=migrations_unreadable ${String(error && error.message).slice(0, 160)}`);
    return;
  }
  // A blind check must not be what decides to drop a database.
  if (known.size === 0) {
    appendLine(supervisorLog, 'schema_check=inconclusive_no_known_migrations');
    return;
  }

  let Client;
  try {
    ({ Client } = require(path.join(repoRoot, 'server', 'node_modules', 'pg')));
  } catch {
    appendLine(supervisorLog, 'schema_check=pg_client_unavailable');
    return;
  }
  const connect = async (database) => {
    const client = new Client({
      host: '127.0.0.1', port: Number(DB_PORT), user: DB_USERNAME,
      password: DB_PASSWORD, database, connectionTimeoutMillis: 10_000,
    });
    await client.connect();
    return client;
  };

  let live;
  try {
    live = await connect(DB_DATABASE);
  } catch (error) {
    appendLine(supervisorLog, `schema_check=unreachable ${String(error && error.message).slice(0, 160)}`);
    return;
  }

  try {
    let applied;
    try {
      applied = (await live.query('SELECT name FROM kobeos_migrations')).rows.map((r) => r.name);
    } catch {
      appendLine(supervisorLog, 'schema_check=no_migration_table');
      return;
    }
    const foreign = applied.filter((name) => !known.has(String(name).toLowerCase()));
    if (foreign.length === 0) {
      appendLine(supervisorLog, `schema_check=compatible applied=${applied.length}`);
      return;
    }

    let rows = 0;
    for (const table of GUARDED) {
      try {
        rows += (await live.query(`SELECT count(*)::int AS n FROM "${table}"`)).rows[0].n;
      } catch { /* table absent in this schema */ }
    }
    if (rows > 0) {
      appendLine(supervisorLog,
        `schema_check=foreign_but_populated foreign=${foreign.length} rows=${rows} sample=${foreign.slice(0, 3).join(' ')}`);
      return;
    }
    appendLine(supervisorLog,
      `schema_check=rebuilding foreign=${foreign.length} sample=${foreign.slice(0, 3).join(' ')}`);
    await live.end();
    live = null;

    const admin = await connect('postgres');
    try {
      await admin.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
         WHERE datname = $1 AND pid <> pg_backend_pid()`, [DB_DATABASE]);
      await admin.query(`DROP DATABASE IF EXISTS "${DB_DATABASE.replace(/"/g, '""')}"`);
      await admin.query(
        `CREATE DATABASE "${DB_DATABASE.replace(/"/g, '""')}" OWNER "${DB_USERNAME.replace(/"/g, '""')}"`);
    } finally {
      await admin.end().catch(() => {});
    }
    appendLine(supervisorLog, 'schema_check=rebuilt_from_empty');
  } finally {
    if (live) await live.end().catch(() => {});
  }
}

async function ensureDatabase({ repoRoot, supervisorLog }) {
  // Preferred path: the pg driver the backend already depends on. The bundled
  // PostgreSQL ships postgres, pg_ctl and initdb but no client tools, so
  // createdb is simply not on this machine — and pulling one in to create one
  // database would be silly when a working client is already installed.
  try {
    const { Client } = require(path.join(repoRoot, 'server', 'node_modules', 'pg'));
    const client = new Client({
      host: '127.0.0.1',
      port: Number(DB_PORT),
      user: DB_USERNAME,
      password: DB_PASSWORD,
      database: 'postgres',
      connectionTimeoutMillis: 10_000,
    });
    await client.connect();
    try {
      const found = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [DB_DATABASE]);
      if (found.rowCount > 0) return true;
      // CREATE DATABASE cannot be parameterised. DB_DATABASE is a constant in
      // this file, not input, and is quoted regardless.
      await client.query(`CREATE DATABASE "${DB_DATABASE.replace(/"/g, '""')}" OWNER "${DB_USERNAME.replace(/"/g, '""')}"`);
      appendLine(supervisorLog, `database_created name=${DB_DATABASE} via=pg`);
      return true;
    } finally {
      await client.end().catch(() => {});
    }
  } catch (error) {
    appendLine(supervisorLog, `database_pg_client_failed detail=${String(error && error.message).slice(0, 300)}`);
    // Fall through to the client binaries, in case a distribution has them.
  }

  const extension = process.platform === 'win32' ? '.exe' : '';
  // Not every bundled distribution ships the client tools beside the server
  // ones, and isCompleteBinDir deliberately does not require them — adding
  // them there could disqualify a bin dir that can still run the cluster.
  const binDir = binaryCandidates(repoRoot).find((dir) =>
    ['psql', 'createdb'].every((name) => {
      try { return fs.statSync(path.join(dir, `${name}${extension}`)).isFile(); } catch { return false; }
    }));
  if (!binDir) {
    appendLine(supervisorLog, 'database_probe_failed detail=psql/createdb not found beside the server binaries');
    return false;
  }
  const psql = path.join(binDir, `psql${extension}`);
  const createdb = path.join(binDir, `createdb${extension}`);
  const env = { ...process.env, PGPASSWORD: DB_PASSWORD };
  const connection = ['-h', '127.0.0.1', '-p', DB_PORT, '-U', DB_USERNAME];

  const listed = spawnSync(psql, [...connection, '-tAc',
    `SELECT 1 FROM pg_database WHERE datname = '${DB_DATABASE}'`, '-d', 'postgres',
  ], { encoding: 'utf8', env, windowsHide: true });

  if (listed.status === 0 && listed.stdout && listed.stdout.trim() === '1') return true;
  if (listed.status !== 0) {
    appendLine(supervisorLog, `database_probe_failed detail=${String(listed.stderr || '').trim().slice(0, 300)}`);
    return false;
  }

  const created = spawnSync(createdb, [...connection, '-O', DB_USERNAME, DB_DATABASE], {
    encoding: 'utf8', env, windowsHide: true,
  });
  if (created.status !== 0) {
    appendLine(supervisorLog, `database_create_failed detail=${String(created.stderr || '').trim().slice(0, 300)}`);
    return false;
  }
  appendLine(supervisorLog, `database_created name=${DB_DATABASE}`);
  return true;
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
    DB_PORT,
    DB_USERNAME,
    DB_PASSWORD,
    DB_DATABASE,
    DB_SYNCHRONIZE: 'false',
    // The backend owns the schema. This was 'false', which assumed something
    // else had already migrated the cluster — nothing does, so a newly
    // provisioned origin would come up pointed at an empty database and fail
    // every query. Migrations are idempotent and guarded.
    DB_MIGRATIONS_RUN: 'true',
    // Keep the headless origin on the CPU-friendly bundled chat model. Large
    // vision/reasoning models are still selected when a request needs them.
    // Must match models/bundled/models.json "name" and DEFAULT_MODEL_ROUTING
    // .everyday — "kobechat-fast" is registered by nothing and never resolved.
    OLLAMA_MODEL: environment.OLLAMA_MODEL || 'kobechat',
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

      let data = selectDataDir(repoRoot, logsDir);
      const availableBins = binaryCandidates(repoRoot);

      // First run on a machine that has never held a cluster. isCompleteBinDir
      // already insists initdb is present beside postgres and pg_ctl, but
      // nothing ever called it, so a fresh origin sat in
      // database_cluster_missing for ever and never started the API. Ambiguity
      // is still refused: picking between two existing clusters is a choice
      // about live data and belongs to a human.
      if (!data.selected && data.reason === 'missing' && availableBins.length > 0) {
        setState('database_provisioning');
        const created = provisionCluster({
          binDir: availableBins[0],
          dataDir: path.join(repoRoot, 'pgdata'),
          supervisorLog,
        });
        if (created) {
          data = selectDataDir(repoRoot, logsDir);
        } else {
          setState('database_provision_failed');
          await delay(30_000);
          continue;
        }
      }

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

    // initdb creates the cluster with postgres/template0/template1 only, so a
    // freshly provisioned origin has no kobeos database for the backend to
    // connect to. Idempotent: skipped the moment it exists.
    if (!(await ensureDatabase({ repoRoot, supervisorLog }))) {
      setState('database_create_failed');
      await delay(30_000);
      continue;
    }

    // The database is up and this bundle is the one about to migrate it.
    await ensureSchemaCompatible({ repoRoot, supervisorLog });
    if (!(await ensureDatabase({ repoRoot, supervisorLog }))) {
      setState('database_create_failed');
      await delay(30_000);
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

