'use strict';

/**
 * pg-bootstrap.cjs
 *
 * Self-contained PostgreSQL lifecycle manager for packaged Electron apps.
 *
 * Bypasses embedded-postgres's internal binary resolution (which uses
 * import.meta.url and breaks on Windows inside an asar archive) by
 * resolving binary paths directly from app.asar.unpacked.
 *
 * Supports Windows (x64), Linux (x64), macOS (x64/arm64).
 */

const { spawn, execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const net  = require('net');

// ── Platform binary resolution ────────────────────────────────────────────────

const PLATFORM_PKG = {
  win32:  '@embedded-postgres/windows-x64',
  linux:  '@embedded-postgres/linux-x64',
  darwin: process.arch === 'arm64'
    ? '@embedded-postgres/darwin-arm64'
    : '@embedded-postgres/darwin-x64',
}[process.platform];

const BIN_EXT = process.platform === 'win32' ? '.exe' : '';

/**
 * Resolve the directory containing postgres binaries.
 * In packaged mode: app.asar.unpacked/node_modules/<platform-pkg>/native/bin
 * In dev mode:      node_modules/<platform-pkg>/native/bin
 */
function resolveBinDir(resourcesPath, isPackaged) {
  const base = isPackaged
    ? path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', PLATFORM_PKG)
    : path.join(__dirname, '..', 'node_modules', PLATFORM_PKG);

  return path.join(base, 'native', 'bin');
}

function getBinPaths(resourcesPath, isPackaged) {
  const binDir = resolveBinDir(resourcesPath, isPackaged);
  return {
    initdb:   path.join(binDir, `initdb${BIN_EXT}`),
    postgres: path.join(binDir, `postgres${BIN_EXT}`),
    pg_ctl:   path.join(binDir, `pg_ctl${BIN_EXT}`),
    binDir,
  };
}

// ── Port availability ─────────────────────────────────────────────────────────

function isPortFree(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.once('listening', () => { s.close(); resolve(true); });
    s.listen(port, '127.0.0.1');
  });
}

// ── PostgresManager ───────────────────────────────────────────────────────────

class PostgresManager {
  /**
   * @param {object} opts
   * @param {string} opts.dataDir       — path to pgdata directory
   * @param {string} opts.resourcesPath — Electron process.resourcesPath
   * @param {boolean} opts.isPackaged   — app.isPackaged
   * @param {number}  [opts.port]       — default 5433
   * @param {string}  [opts.user]       — default 'kobeos'
   * @param {string}  [opts.password]   — default 'kobeos_live'
   * @param {string}  [opts.database]   — default 'kobeos'
   */
  constructor(opts) {
    this.dataDir       = opts.dataDir;
    this.resourcesPath = opts.resourcesPath;
    this.isPackaged    = opts.isPackaged;
    this.port          = opts.port     || 5433;
    this.user          = opts.user     || 'kobeos';
    this.password      = opts.password || 'kobeos_live';
    this.database      = opts.database || 'kobeos';
    this._process      = null;
    this._bins         = null;
  }

  // ── Validation ──────────────────────────────────────────────────────────────

  validate() {
    if (!PLATFORM_PKG) {
      throw new Error(`Unsupported platform: ${process.platform}`);
    }
    const bins = getBinPaths(this.resourcesPath, this.isPackaged);
    if (!fs.existsSync(bins.initdb)) {
      throw new Error(
        `PostgreSQL binary not found: ${bins.initdb}\n` +
        `Platform package: ${PLATFORM_PKG}\n` +
        `Make sure it is listed in package.json optionalDependencies and asarUnpack.`
      );
    }
    this._bins = bins;
    console.log(`[pg-bootstrap] Binaries resolved: ${bins.binDir}`);
    return bins;
  }

  // ── initdb ──────────────────────────────────────────────────────────────────

  async initialise() {
    const bins = this._bins || this.validate();
    const pgVersionFile = path.join(this.dataDir, 'PG_VERSION');
    if (fs.existsSync(pgVersionFile)) {
      console.log('[pg-bootstrap] Data directory already initialised — skipping initdb');
      return;
    }

    fs.mkdirSync(this.dataDir, { recursive: true });

    // Write password file for --pwfile
    const pwFile = path.join(this.dataDir, '..', '.pgpass_init');
    fs.writeFileSync(pwFile, this.password + '\n', { mode: 0o600 });

    console.log('[pg-bootstrap] Running initdb...');
    await new Promise((resolve, reject) => {
      const args = [
        `--pgdata=${this.dataDir}`,
        `--auth=md5`,
        `--username=${this.user}`,
        `--pwfile=${pwFile}`,
        '--encoding=UTF8',
        '--locale=C',
      ];
      const env = { ...process.env, LC_MESSAGES: 'C' };
      const proc = spawn(bins.initdb, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });

      proc.stdout.on('data', (d) => console.log('[initdb]', d.toString().trim()));
      proc.stderr.on('data', (d) => console.error('[initdb]', d.toString().trim()));
      proc.on('close', (code) => {
        try { fs.unlinkSync(pwFile); } catch { /* ignore */ }
        if (code === 0) resolve();
        else reject(new Error(`initdb exited with code ${code}`));
      });
      proc.on('error', (err) => {
        try { fs.unlinkSync(pwFile); } catch { /* ignore */ }
        reject(err);
      });
    });

    console.log('[pg-bootstrap] initdb complete');
  }

  // ── start ───────────────────────────────────────────────────────────────────

  async start() {
    const bins = this._bins || this.validate();

    // Remove stale postmaster.pid
    const pidFile = path.join(this.dataDir, 'postmaster.pid');
    if (fs.existsSync(pidFile)) {
      try { fs.unlinkSync(pidFile); } catch { /* ignore */ }
    }

    // Clean stale shared memory on Linux
    if (process.platform === 'linux') {
      try {
        execSync("ipcs -m | awk 'NR>3 && $6==0 {print $2}' | xargs -r ipcrm -m", { stdio: 'ignore' });
        execSync("ipcs -s | awk 'NR>3 && $6==0 {print $2}' | xargs -r ipcrm -s", { stdio: 'ignore' });
      } catch { /* ignore */ }
    }

    // Check port
    const portFree = await isPortFree(this.port);
    if (!portFree) {
      console.log(`[pg-bootstrap] Port ${this.port} already in use — assuming postgres is running`);
      return;
    }

    console.log(`[pg-bootstrap] Starting postgres on port ${this.port}...`);
    await new Promise((resolve, reject) => {
      const args = [
        '-D', this.dataDir,
        '-p', String(this.port),
        '-c', 'listen_addresses=127.0.0.1',
        '-c', 'log_destination=stderr',
        '-c', 'logging_collector=off',
      ];
      const env = { ...process.env, LC_MESSAGES: 'C' };
      this._process = spawn(bins.postgres, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });

      let started = false;
      const onData = (d) => {
        const msg = d.toString();
        console.log('[postgres]', msg.trim());
        if (!started && (msg.includes('database system is ready') || msg.includes('ready to accept connections'))) {
          started = true;
          resolve();
        }
      };

      this._process.stdout.on('data', onData);
      this._process.stderr.on('data', onData);
      this._process.on('error', reject);
      this._process.on('close', (code) => {
        if (!started) reject(new Error(`postgres exited early with code ${code}`));
      });

      // Timeout after 30s
      setTimeout(() => {
        if (!started) {
          started = true; // prevent double-resolve
          resolve(); // proceed anyway — postgres may have started without the log line
        }
      }, 30_000);
    });

    console.log(`[pg-bootstrap] PostgreSQL ready on 127.0.0.1:${this.port}`);
  }

  // ── createDatabase ──────────────────────────────────────────────────────────

  async createDatabase() {
    // Use node-postgres to create the database if it doesn't exist
    const { Client } = require('pg');
    const client = new Client({
      host:     '127.0.0.1',
      port:     this.port,
      user:     this.user,
      password: this.password,
      database: 'postgres', // connect to default db first
    });
    await client.connect();
    try {
      const res = await client.query(
        `SELECT 1 FROM pg_database WHERE datname = $1`, [this.database]
      );
      if (res.rowCount === 0) {
        await client.query(`CREATE DATABASE "${this.database}"`);
        console.log(`[pg-bootstrap] Database '${this.database}' created`);
      }
    } finally {
      await client.end();
    }
  }

  // ── stop ────────────────────────────────────────────────────────────────────

  async stop() {
    if (this._process) {
      console.log('[pg-bootstrap] Stopping postgres...');
      this._process.kill('SIGTERM');
      await new Promise((resolve) => {
        this._process.once('close', resolve);
        setTimeout(resolve, 5000); // force after 5s
      });
      this._process = null;
      console.log('[pg-bootstrap] PostgreSQL stopped');
    }
  }

  // ── connectionConfig ────────────────────────────────────────────────────────

  connectionConfig() {
    return {
      host:     '127.0.0.1',
      port:     this.port,
      user:     this.user,
      password: this.password,
      database: this.database,
    };
  }
}

module.exports = PostgresManager;
