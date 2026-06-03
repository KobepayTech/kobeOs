#!/usr/bin/env node
/**
 * Downloads cloudflared binaries for Windows, Linux, and macOS
 * into build/cloudflared/ so electron-builder bundles them as extraResources.
 *
 * Run before building:
 *   node scripts/download-cloudflared.cjs
 *
 * Output:
 *   build/cloudflared/cloudflared-win-x64.exe
 *   build/cloudflared/cloudflared-linux-x64
 *   build/cloudflared/cloudflared-mac-x64
 *   build/cloudflared/cloudflared-mac-arm64
 */

const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'build', 'cloudflared');
const VERSION = '2026.5.2';

const BINARIES = [
  {
    url:  `https://github.com/cloudflare/cloudflared/releases/download/${VERSION}/cloudflared-windows-amd64.exe`,
    dest: 'cloudflared-win-x64.exe',
  },
  {
    url:  `https://github.com/cloudflare/cloudflared/releases/download/${VERSION}/cloudflared-linux-amd64`,
    dest: 'cloudflared-linux-x64',
    exec: true,
  },
  {
    url:  `https://github.com/cloudflare/cloudflared/releases/download/${VERSION}/cloudflared-darwin-amd64.tgz`,
    dest: 'cloudflared-mac-x64.tgz',
    tgz:  'cloudflared-mac-x64',
  },
  {
    url:  `https://github.com/cloudflare/cloudflared/releases/download/${VERSION}/cloudflared-darwin-arm64.tgz`,
    dest: 'cloudflared-mac-arm64.tgz',
    tgz:  'cloudflared-mac-arm64',
  },
];

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

(async () => {
  console.log(`\nDownloading cloudflared ${VERSION} binaries...\n`);

  for (const { url, dest, exec: makeExec, tgz } of BINARIES) {
    const destPath  = path.join(OUT_DIR, dest);
    const finalPath = tgz ? path.join(OUT_DIR, tgz) : destPath;

    if (fs.existsSync(finalPath)) {
      console.log(`  skip  ${tgz ?? dest} (already exists)`);
      continue;
    }

    console.log(`  down  ${dest}`);
    // curl -L follows all redirects (GitHub uses multiple hops to S3/CDN)
    execSync(`curl -L -f -s -S -o "${destPath}" "${url}"`, { stdio: ['ignore', 'inherit', 'inherit'] });

    if (makeExec && process.platform !== 'win32') {
      fs.chmodSync(destPath, 0o755);
    }

    if (tgz && process.platform !== 'win32') {
      console.log(`  untar ${dest}`);
      execSync(`tar -xzf "${destPath}" -C "${OUT_DIR}" cloudflared`, { stdio: 'inherit' });
      fs.renameSync(path.join(OUT_DIR, 'cloudflared'), finalPath);
      fs.chmodSync(finalPath, 0o755);
      fs.unlinkSync(destPath);
    }

    console.log(`  ok    ${tgz ?? dest}`);
  }

  console.log('\nDone. Files in build/cloudflared/:');
  fs.readdirSync(OUT_DIR).forEach((f) => {
    const mb = (fs.statSync(path.join(OUT_DIR, f)).size / 1024 / 1024).toFixed(1);
    console.log(`  ${f.padEnd(30)} ${mb} MB`);
  });
  console.log('');
})().catch((err) => {
  console.error('\nError:', err.message);
  process.exit(1);
});
