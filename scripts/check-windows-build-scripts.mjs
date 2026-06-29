#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const scripts = packageJson.scripts || {};
const names = Object.keys(scripts).filter((name) => name.startsWith('electron:build:win'));
const failures = [];

for (const name of names) {
  const command = String(scripts[name] || '');
  const isMain = name === 'electron:build:win';
  const delegates = !isMain && /npm\s+run\s+electron:build:win(\s|$)/.test(command);
  const checksFrontend = /npm\s+run\s+build(\s|&&|$)/.test(command);
  if (!delegates && !checksFrontend) {
    failures.push(`${name}: ${command}`);
  }
}

if (failures.length) {
  console.error('Every Windows installer script must include npm run build or call electron:build:win.');
  for (const item of failures) console.error(`- ${item}`);
  process.exit(1);
}

console.log('Windows installer scripts are OK.');
