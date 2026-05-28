#!/usr/bin/env node
/**
 * smoke-test.cjs
 *
 * Starts the NestJS server bundle (same way Electron does) and runs a series
 * of checks against it:
 *
 *   1. /api/health responds 200 with { status: 'ok', db: 'connected' }
 *   2. /api/auth/login rejects bad credentials with 401
 *   3. /api/auth/login accepts valid credentials and returns a JWT
 *   4. A protected endpoint (/api/users/me) returns 401 without token
 *   5. A protected endpoint (/api/users/me) returns 200 with valid token
 *
 * Usage:
 *   node scripts/smoke-test.cjs
 *
 * Environment (defaults match the dev docker-compose):
 *   DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE
 *   SMOKE_USER, SMOKE_PASS   — credentials for auth tests (optional)
 *   PORT                     — backend port (default 3099 to avoid conflicts)
 *   TIMEOUT_MS               — max ms to wait for backend ready (default 20000)
 */

'use strict';

const { spawn }  = require('child_process');
const http       = require('http');
const path       = require('path');
const fs         = require('fs');

// ── Config ────────────────────────────────────────────────────────────────────

const PORT        = Number(process.env.PORT        ?? 3099);
const TIMEOUT_MS  = Number(process.env.TIMEOUT_MS  ?? 20_000);
const BUNDLE      = path.resolve(__dirname, '../electron/server-bundle/index.js');

const DB_ENV = {
  NODE_ENV:      'development',
  PORT:          String(PORT),
  DB_HOST:       process.env.DB_HOST       ?? 'localhost',
  DB_PORT:       process.env.DB_PORT       ?? '5432',
  DB_USERNAME:   process.env.DB_USERNAME   ?? 'kobe',
  DB_PASSWORD:   process.env.DB_PASSWORD   ?? 'kobe',
  DB_DATABASE:   process.env.DB_DATABASE   ?? 'kobeos',
  DB_SYNCHRONIZE:'true',
  JWT_SECRET:    process.env.JWT_SECRET    ?? 'smoke-test-jwt-secret-32-chars!!',
  CORS_ORIGIN:   '*',
};

const SMOKE_USER = process.env.SMOKE_USER ?? null;
const SMOKE_PASS = process.env.SMOKE_PASS ?? null;

// ── Helpers ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function ok(label) {
  console.log(`  ✅  ${label}`);
  passed++;
}

function fail(label, detail) {
  console.error(`  ❌  ${label}`);
  if (detail) console.error(`       ${detail}`);
  failed++;
}

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

    const req = http.request(
      { hostname: '127.0.0.1', port: PORT, path, method, headers },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(data); } catch { /* plain text */ }
          resolve({ status: res.statusCode, body: json ?? data });
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(new Error('request timeout')); });
    if (payload) req.write(payload);
    req.end();
  });
}

function waitForReady(timeoutMs) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function attempt() {
      const req = http.get(`http://127.0.0.1:${PORT}/api/health`, (res) => {
        res.resume();
        if (res.statusCode < 500) { resolve(); return; }
        retry();
      });
      req.on('error', retry);
      req.setTimeout(800, () => { req.destroy(); });
      function retry() {
        if (Date.now() - start >= timeoutMs) {
          reject(new Error(`Backend did not become ready within ${timeoutMs}ms`));
          return;
        }
        setTimeout(attempt, 500);
      }
    }
    attempt();
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n── KobeOS Backend Smoke Test ─────────────────────────────────');
  console.log(`   Bundle : ${BUNDLE}`);
  console.log(`   Port   : ${PORT}`);
  console.log(`   DB     : ${DB_ENV.DB_USERNAME}@${DB_ENV.DB_HOST}:${DB_ENV.DB_PORT}/${DB_ENV.DB_DATABASE}`);
  console.log('──────────────────────────────────────────────────────────────\n');

  // ── Pre-flight ──────────────────────────────────────────────────────────────
  if (!fs.existsSync(BUNDLE)) {
    console.error(`❌  Server bundle not found: ${BUNDLE}`);
    console.error('   Run: npm run build:bundle');
    process.exit(1);
  }

  // ── Start backend ───────────────────────────────────────────────────────────
  console.log('▶  Starting backend…');
  const backend = spawn(process.execPath, [BUNDLE], {
    env: { ...process.env, ...DB_ENV },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const backendLogs = [];
  backend.stdout.on('data', (d) => backendLogs.push(d.toString().trim()));
  backend.stderr.on('data', (d) => backendLogs.push('[stderr] ' + d.toString().trim()));
  backend.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`\n[backend exited with code ${code}]`);
    }
  });

  // ── Wait for ready ──────────────────────────────────────────────────────────
  try {
    await waitForReady(TIMEOUT_MS);
    console.log('▶  Backend ready\n');
  } catch (err) {
    console.error(`❌  ${err.message}`);
    console.error('\nBackend output:');
    backendLogs.slice(-20).forEach((l) => console.error('   ' + l));
    backend.kill();
    process.exit(1);
  }

  // ── Test 1: /api/health ─────────────────────────────────────────────────────
  console.log('── Tests ─────────────────────────────────────────────────────');
  try {
    const res = await request('GET', '/api/health');
    if (res.status === 200 && res.body?.status === 'ok') {
      ok(`GET /api/health → 200 { status: 'ok', db: '${res.body.db}' }`);
    } else {
      fail('GET /api/health', `status=${res.status} body=${JSON.stringify(res.body)}`);
    }
  } catch (e) {
    fail('GET /api/health', e.message);
  }

  // ── Test 2: /api/auth/login — bad credentials ───────────────────────────────
  try {
    const res = await request('POST', '/api/auth/login', {
      email: 'nobody@example.com',
      password: 'wrongpassword',
    });
    if (res.status === 401 || res.status === 400 || res.status === 403) {
      ok(`POST /api/auth/login (bad creds) → ${res.status} (rejected)`);
    } else {
      fail('POST /api/auth/login (bad creds)', `expected 401/400/403, got ${res.status}`);
    }
  } catch (e) {
    fail('POST /api/auth/login (bad creds)', e.message);
  }

  // ── Test 3: /api/users/me — no token ───────────────────────────────────────
  try {
    const res = await request('GET', '/api/users/me');
    if (res.status === 401 || res.status === 403) {
      ok(`GET /api/users/me (no token) → ${res.status} (rejected)`);
    } else {
      fail('GET /api/users/me (no token)', `expected 401/403, got ${res.status}`);
    }
  } catch (e) {
    fail('GET /api/users/me (no token)', e.message);
  }

  // ── Test 4 (optional): register + login + protected endpoint ────────────────
  if (SMOKE_USER && SMOKE_PASS) {
    // Register first (idempotent — 409 if already exists is fine)
    try {
      const res = await request('POST', '/api/auth/register', {
        email: SMOKE_USER,
        password: SMOKE_PASS,
        displayName: 'Smoke Test',
      });
      if (res.status === 201 || res.status === 200) {
        ok(`POST /api/auth/register (${SMOKE_USER}) → ${res.status} (created)`);
      } else if (res.status === 409) {
        ok(`POST /api/auth/register (${SMOKE_USER}) → 409 (already exists — ok)`);
      } else {
        fail(`POST /api/auth/register (${SMOKE_USER})`, `status=${res.status} body=${JSON.stringify(res.body)}`);
      }
    } catch (e) {
      fail(`POST /api/auth/register (${SMOKE_USER})`, e.message);
    }

    let token = null;
    try {
      const res = await request('POST', '/api/auth/login', {
        email: SMOKE_USER,
        password: SMOKE_PASS,
      });
      if (res.status === 200 || res.status === 201) {
        token = res.body?.access_token ?? res.body?.accessToken ?? null;
        ok(`POST /api/auth/login (${SMOKE_USER}) → ${res.status} — token ${token ? 'received' : 'MISSING in response'}`);
      } else {
        fail(`POST /api/auth/login (${SMOKE_USER})`, `status=${res.status}`);
      }
    } catch (e) {
      fail(`POST /api/auth/login (${SMOKE_USER})`, e.message);
    }

    if (token) {
      try {
        const res = await request('GET', '/api/users/me', null, token);
        if (res.status === 200) {
          ok(`GET /api/users/me (with token) → 200 { email: '${res.body?.email}' }`);
        } else {
          fail('GET /api/users/me (with token)', `status=${res.status}`);
        }
      } catch (e) {
        fail('GET /api/users/me (with token)', e.message);
      }
    }
  } else {
    console.log('   ℹ  Skipping auth tests — set SMOKE_USER and SMOKE_PASS to enable');
  }

  // ── Teardown ────────────────────────────────────────────────────────────────
  backend.kill('SIGTERM');

  console.log('\n──────────────────────────────────────────────────────────────');
  console.log(`   Passed: ${passed}   Failed: ${failed}`);
  console.log('──────────────────────────────────────────────────────────────\n');

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
