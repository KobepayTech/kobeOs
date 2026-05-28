#!/usr/bin/env node
const { existsSync, mkdirSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const root = resolve(__dirname, '..');
const engineRoot = join(root, 'apps', 'kobe-security', 'engine');
const target = join(engineRoot, 'ruview');
const repo = process.env.KOBE_SECURITY_RUVIEW_REPO || 'https://github.com/ruvnet/RuView.git';
const ref = process.env.KOBE_SECURITY_RUVIEW_REF || 'main';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

mkdirSync(engineRoot, { recursive: true });

if (!existsSync(target)) {
  console.log(`Cloning RuView into ${target}`);
  run('git', ['clone', '--depth', '1', '--branch', ref, repo, target]);
} else {
  console.log(`RuView engine already exists at ${target}`);
  console.log('Pulling latest changes...');
  run('git', ['pull', '--ff-only'], { cwd: target });
}

const notice = `# Kobe Security Engine\n\nThis directory contains the RuView source code used as the sensing engine for the Kobe Security module.\n\nSource: ${repo}\nRef: ${ref}\n\nBranding rule:\n- The KobeOS product/module name is Kobe Security.\n- The sensing engine attribution remains RuView / WiFi-DensePose.\n- Do not remove the upstream license or copyright notices.\n\nRun from the KobeOS root:\n\n\`\`\`bash\nnpm run security:engine:clone\nnpm run security:engine:docker\n\`\`\`\n`;

writeFileSync(join(engineRoot, 'README.md'), notice);

console.log('Kobe Security engine is ready.');
console.log('Next: run docker compose -f docker/ruview-kobe-security.compose.yml up -d');
