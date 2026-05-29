'use strict';

const fs = require('fs');
const path = require('path');

const platformPackage = {
  win32: '@embedded-postgres/windows-x64',
  linux: '@embedded-postgres/linux-x64',
  darwin: process.arch === 'arm64'
    ? '@embedded-postgres/darwin-arm64'
    : '@embedded-postgres/darwin-x64',
}[process.platform];

if (!platformPackage) {
  throw new Error(`Unsupported platform for embedded PostgreSQL resources: ${process.platform}`);
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`Source path does not exist: ${src}`);
  }
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

const packageRoot = path.join(process.cwd(), 'node_modules', ...platformPackage.split('/'));
const nativeRoot = path.join(packageRoot, 'native');
const nativeBin = path.join(nativeRoot, 'bin');
const outputRoot = path.join(process.cwd(), 'build', 'postgres');
const outputBin = path.join(outputRoot, 'bin');
const initdb = path.join(nativeBin, process.platform === 'win32' ? 'initdb.exe' : 'initdb');

if (!fs.existsSync(initdb)) {
  throw new Error(
    `PostgreSQL initdb binary was not found at ${initdb}.\n` +
    `Make sure ${platformPackage} is installed before packaging.`,
  );
}

fs.rmSync(outputRoot, { recursive: true, force: true });
copyRecursive(nativeRoot, outputRoot);

const required = ['initdb', 'postgres', 'pg_ctl'].map((name) => process.platform === 'win32' ? `${name}.exe` : name);
for (const binary of required) {
  const target = path.join(outputBin, binary);
  if (!fs.existsSync(target)) {
    throw new Error(`Prepared PostgreSQL binary missing: ${target}`);
  }
}

console.log(`[KobeOS] Prepared direct PostgreSQL resources from ${platformPackage}`);
console.log(`[KobeOS] Output: ${outputRoot}`);
