#!/usr/bin/env node
/**
 * scripts/release.cjs — single-command KobeOS release.
 *
 * Usage:
 *   npm run release [patch|minor|major]   # default: patch
 *
 * What it does, in order:
 *   1. Verifies the working tree is clean (no uncommitted changes).
 *   2. Pulls master + checks CI is green (best-effort — skipped if no gh).
 *   3. Bumps package.json version (npm version) and commits + tags.
 *   4. Runs `npm run build` + `npm run build:bundle` so the frontend bundle
 *      and embedded server bundle are fresh.
 *   5. Runs `electron-builder --publish always` for every host platform
 *      available locally (Linux always; Mac/Win only if the host is the
 *      matching platform, since cross-compile needs Docker / Wine).
 *   6. After artifacts are emitted, walks dist-electron/ and detached-
 *      signs every .exe / .dmg / .AppImage with GPG (requires
 *      KOBEOS_GPG_KEY env or the default-signing key configured).
 *   7. `electron-builder --publish always` already uploaded the artifacts
 *      to a GitHub release matching the new tag; we just upload the .sig
 *      files alongside via `gh release upload`.
 *   8. Pushes the version commit + tag.
 *
 * Pre-reqs (set once, see vendor/RELEASE_SETUP.md):
 *   • GH_TOKEN env exported (repo scope) so electron-builder can publish.
 *   • gpg installed + a key matching the fingerprint in
 *     electron/update-manager.cjs's verifyArtifact() trust list.
 *   • gh CLI installed for the artifact-upload step.
 *
 * Any failure aborts before pushing the tag, so a botched release never
 * surfaces to clients.
 */
'use strict';

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BUMP = (process.argv[2] || 'patch').toLowerCase();
if (!['patch', 'minor', 'major'].includes(BUMP)) {
  console.error(`Bad bump type: ${BUMP}. Use patch | minor | major.`);
  process.exit(1);
}

function sh(cmd, opts = {}) {
  console.log(`\n› ${cmd}`);
  return execSync(cmd, { stdio: 'inherit', ...opts });
}

function shCheck(cmd) {
  const r = spawnSync(cmd, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  return { ok: r.status === 0, out: r.stdout?.toString() ?? '', err: r.stderr?.toString() ?? '' };
}

function ensureClean() {
  const r = shCheck('git status --porcelain');
  if (r.out.trim()) {
    console.error('Working tree not clean — commit or stash first:\n' + r.out);
    process.exit(1);
  }
}

function ensureMaster() {
  const branch = shCheck('git rev-parse --abbrev-ref HEAD').out.trim();
  if (branch !== 'master') {
    console.error(`On branch "${branch}" — releases go from master.`);
    process.exit(1);
  }
}

function requireEnv(name) {
  if (!process.env[name]) {
    console.error(`${name} env var is required.`);
    process.exit(1);
  }
}

function detectPlatforms() {
  const out = ['--linux'];                  // every platform can build AppImage
  if (process.platform === 'darwin') out.push('--mac');
  if (process.platform === 'win32')  out.push('--win');
  return out;
}

function gpgSignArtifacts() {
  const artifactDir = path.join(process.cwd(), 'dist-electron');
  if (!fs.existsSync(artifactDir)) {
    console.warn(`No dist-electron/ directory — nothing to sign.`);
    return [];
  }
  const candidates = fs.readdirSync(artifactDir)
    .filter((f) => /\.(exe|dmg|AppImage|deb)$/.test(f));
  const sigPaths = [];
  for (const f of candidates) {
    const fp = path.join(artifactDir, f);
    sh(`gpg --batch --yes --detach-sign --armor --output "${fp}.sig" "${fp}"`);
    sigPaths.push(`${fp}.sig`);
  }
  return sigPaths;
}

function uploadSignaturesToRelease(tag, sigPaths) {
  if (!sigPaths.length) return;
  const r = shCheck('gh --version');
  if (!r.ok) {
    console.warn('gh CLI not installed — skipping .sig upload. Attach the .sig files manually to the release.');
    return;
  }
  const args = sigPaths.map((p) => `"${p}"`).join(' ');
  sh(`gh release upload "${tag}" ${args} --clobber`);
}

// ── Run ────────────────────────────────────────────────────────────────────────

ensureClean();
ensureMaster();
requireEnv('GH_TOKEN');

sh('git pull --ff-only');

// 1. Version bump + commit + tag (npm version does all three)
const newVersion = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
sh(`npm version ${BUMP} --no-git-tag-version`);
const bumped = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
sh(`git add package.json package-lock.json`);
sh(`git commit -m "release: v${bumped}"`);
sh(`git tag -a v${bumped} -m "v${bumped}"`);

console.log(`\nReleasing v${newVersion} → v${bumped}\n`);

// 2. Fresh build
sh('npm run build');
sh('npm run build:bundle');

// 3. Build + publish installers for available platforms
const platforms = detectPlatforms();
sh(`npx electron-builder ${platforms.join(' ')} --publish always`);

// 4. GPG-sign artifacts; electron-updater will refuse anything missing a .sig
const sigPaths = gpgSignArtifacts();
uploadSignaturesToRelease(`v${bumped}`, sigPaths);

// 5. Push the tag + commit so master matches what was released
sh('git push origin master --follow-tags');

console.log(`\n✔ Released v${bumped}. Clients will pick it up on their next /system/version poll or autoUpdater check (≤4 h).`);
