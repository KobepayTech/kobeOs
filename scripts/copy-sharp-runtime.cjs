#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const sourceRoot = path.join(root, 'server', 'node_modules', '@img');
const destinationRoot = path.join(root, 'electron', 'server-bundle', 'node_modules', '@img');

if (!fs.existsSync(sourceRoot)) {
  throw new Error(`Sharp runtime directory is missing: ${sourceRoot}`);
}

const runtimePackages = fs.readdirSync(sourceRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('sharp-'))
  .map((entry) => entry.name);

if (runtimePackages.length === 0) {
  throw new Error('No native Sharp runtime is installed. Run `npm install --include=optional` in server/.');
}

fs.rmSync(destinationRoot, { recursive: true, force: true });
fs.mkdirSync(destinationRoot, { recursive: true });

for (const packageName of runtimePackages) {
  fs.cpSync(path.join(sourceRoot, packageName), path.join(destinationRoot, packageName), {
    recursive: true,
  });
  console.log(`[copy-sharp-runtime] Bundled @img/${packageName}`);
}
