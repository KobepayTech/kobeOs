#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const scripts = packageJson.scripts || {};
const names = Object.keys(scripts).filter((name) => name.startsWith('electron:build:win'));
const failures = [];
const projectRoot = fileURLToPath(new URL('..', import.meta.url));

for (const name of names) {
  const command = String(scripts[name] || '');
  const isMain = name === 'electron:build:win';
  const delegates = !isMain && /npm\s+run\s+electron:build:win(\s|$)/.test(command);
  const checksFrontend = /npm\s+run\s+build(\s|&&|$)/.test(command);
  if (!delegates && !checksFrontend) {
    failures.push(`${name}: ${command}`);
  }
}

const postgresResource = (packageJson.build?.extraResources || []).find(
  (resource) => resource?.from === 'build/postgres' && resource?.to === 'postgres',
);
if (!postgresResource) {
  failures.push('package.json: build/postgres must be copied to resources/postgres');
}

const splashHtml = readFileSync(new URL('../electron/splash.html', import.meta.url), 'utf8');
if (!splashHtml.includes('<link rel="stylesheet" href="./splash.css"')) {
  failures.push('electron/splash.html: external splash.css link is missing');
}
if (/<style(?:\s|>)/i.test(splashHtml) || /<script(?:\s|>)/i.test(splashHtml)) {
  failures.push('electron/splash.html: inline CSS or JavaScript can render as visible startup text');
}
if (!existsSync(new URL('../electron/splash.css', import.meta.url))) {
  failures.push('electron/splash.css: startup stylesheet is missing');
}
if (!existsSync(new URL('../electron/splash-preload.cjs', import.meta.url))) {
  failures.push('electron/splash-preload.cjs: startup progress preload is missing');
}

const installerNsh = readFileSync(new URL('../build/installer.nsh', import.meta.url), 'utf8');
if (/ExecWait\s+'"\$0"\s+\/S(?:\s+_\?=\$INSTDIR)?'/i.test(installerNsh)) {
  failures.push(
    'build/installer.nsh: customInstall must not run an existing uninstaller after extracting the new payload',
  );
}

const selfHostedWorkflow = readFileSync(
  new URL('../.github/workflows/build-windows-selfhosted.yml', import.meta.url),
  'utf8',
);
if (!/electron-builder\s+--win\s+nsis-web\b/.test(selfHostedWorkflow)) {
  failures.push(
    '.github/workflows/build-windows-selfhosted.yml: offline AI builds must use nsis-web because embedded NSIS packages are limited to 4 GiB',
  );
}
if (!/\*\.nsis\.7z/.test(selfHostedWorkflow)) {
  failures.push(
    '.github/workflows/build-windows-selfhosted.yml: the NSIS sidecar package must be validated and copied with the setup EXE',
  );
}

const runBlockNonAscii = [];
let inRunBlock = false;
let runBlockIndent = 0;
for (const [index, line] of selfHostedWorkflow.split(/\r?\n/).entries()) {
  const indent = line.match(/^ */)?.[0].length ?? 0;
  if (inRunBlock && indent <= runBlockIndent && line.trim()) {
    inRunBlock = false;
  }

  if (!inRunBlock) {
    const match = line.match(/^(\s*)run:\s*\|$/);
    if (match) {
      inRunBlock = true;
      runBlockIndent = match[1].length;
    }
    continue;
  }

  if ([...line].some((char) => char.charCodeAt(0) > 127)) {
    runBlockNonAscii.push(index + 1);
  }
}

if (runBlockNonAscii.length) {
  failures.push(
    `.github/workflows/build-windows-selfhosted.yml: PowerShell run blocks must stay ASCII-only for Windows PowerShell compatibility (non-ASCII on lines ${runBlockNonAscii.join(', ')})`,
  );
}

if (failures.length) {
  console.error(`Windows startup/build validation failed for ${projectRoot}:`);
  for (const item of failures) console.error(`- ${item}`);
  process.exit(1);
}

console.log('Windows startup and installer scripts are OK.');
