import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { getPlatformTarget, findSystemOllamaDir } = require('../download-ollama.cjs');

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('download-ollama helpers', () => {
  it('uses the current Linux release asset name', () => {
    expect(getPlatformTarget('linux', 'x64')).toMatchObject({
      dir: 'linux-x64',
      asset: 'ollama-linux-amd64.tar.zst',
      bin: 'bin/ollama',
    });
  });

  it('prefers a local Windows Ollama install when one exists', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ollama-install-'));
    tempDirs.push(root);

    const localAppData = path.join(root, 'LocalAppData');
    const installDir = path.join(localAppData, 'Programs', 'Ollama');
    fs.mkdirSync(installDir, { recursive: true });
    fs.writeFileSync(path.join(installDir, 'ollama.exe'), '');

    expect(findSystemOllamaDir('win32', { LOCALAPPDATA: localAppData })).toBe(installDir);
  });
});
