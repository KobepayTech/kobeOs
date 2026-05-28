#!/usr/bin/env node
const { existsSync, mkdirSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const root = resolve(__dirname, '..');
const engineRoot = join(root, 'apps', 'kobe-creator', 'media-studios', 'engine');
const target = join(engineRoot, 'MoneyPrinterTurbo');
const repo = process.env.KOBE_CREATOR_MEDIA_REPO || 'https://github.com/harry0703/MoneyPrinterTurbo.git';
const ref = process.env.KOBE_CREATOR_MEDIA_REF || 'main';

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
  console.log(`Cloning MoneyPrinterTurbo into ${target}`);
  run('git', ['clone', '--depth', '1', '--branch', ref, repo, target]);
} else {
  console.log(`MoneyPrinterTurbo engine already exists at ${target}`);
  console.log('Pulling latest changes...');
  run('git', ['pull', '--ff-only'], { cwd: target });
}

const notice = `# Kobe Creator Media Studios Engine\n\nThis directory contains the MoneyPrinterTurbo source code used as the short-video generation engine for Kobe Creator Media Studios.\n\nSource: ${repo}\nRef: ${ref}\n\nBranding rule:\n- The KobeOS product/module name is Kobe Creator Media Studios.\n- The upstream engine attribution remains MoneyPrinterTurbo.\n- Do not remove upstream license or copyright notices.\n\nRun from the KobeOS root:\n\n\`\`\`bash\nnpm run creator:media:clone\nnpm run creator:media:docker\n\`\`\`\n\nDefault upstream runtime ports:\n- Web UI: http://localhost:8501\n- API docs: http://localhost:8080/docs\n`;

writeFileSync(join(engineRoot, 'README.md'), notice);

console.log('Kobe Creator Media Studios engine is ready.');
console.log('Next: run npm run creator:media:docker');
