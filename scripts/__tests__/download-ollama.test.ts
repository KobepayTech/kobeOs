import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { getPlatformTarget, findSystemOllamaDir, pruneGpuLibraries } = require('../download-ollama.cjs');

/** Minimal stand-in for an extracted Ollama runtime. */
function makeRuntime(root: string) {
  const lib = path.join(root, 'lib', 'ollama');
  fs.mkdirSync(path.join(lib, 'cuda_v12'), { recursive: true });
  fs.mkdirSync(path.join(lib, 'cuda_v13'), { recursive: true });
  fs.mkdirSync(path.join(lib, 'vulkan'), { recursive: true });
  fs.writeFileSync(path.join(root, 'ollama.exe'), 'x'.repeat(64));
  fs.writeFileSync(path.join(lib, 'cuda_v12', 'cublasLt64_12.dll'), 'x'.repeat(4096));
  fs.writeFileSync(path.join(lib, 'cuda_v13', 'ggml-cuda.dll'), 'x'.repeat(2048));
  fs.writeFileSync(path.join(lib, 'vulkan', 'ggml-vulkan.dll'), 'x'.repeat(128));
  fs.writeFileSync(path.join(lib, 'ggml-cpu-haswell.dll'), 'x'.repeat(128));
  return lib;
}

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

  it('accepts an explicit OLLAMA_HOME override', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ollama-home-'));
    tempDirs.push(root);

    const installDir = path.join(root, 'Ollama');
    fs.mkdirSync(installDir, { recursive: true });
    fs.writeFileSync(path.join(installDir, 'ollama.exe'), '');

    expect(findSystemOllamaDir('win32', { OLLAMA_HOME: installDir })).toBe(installDir);
  });

  it('drops the CUDA libraries but keeps the CPU and Vulkan runtime', () => {
    // CUDA is 1738 MiB of Ollama's 1863 MiB Windows bundle; without this the
    // installer cannot also carry a 1065 MiB model under GitHub's 2 GiB
    // release asset limit. Vulkan is small and still accelerates integrated
    // GPUs, so it stays.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ollama-prune-'));
    tempDirs.push(root);
    const lib = makeRuntime(root);

    const freed = pruneGpuLibraries(root, {});

    expect(freed).toBeGreaterThanOrEqual(4096 + 2048);
    expect(fs.existsSync(path.join(lib, 'cuda_v12'))).toBe(false);
    expect(fs.existsSync(path.join(lib, 'cuda_v13'))).toBe(false);
    expect(fs.existsSync(path.join(lib, 'vulkan', 'ggml-vulkan.dll'))).toBe(true);
    expect(fs.existsSync(path.join(lib, 'ggml-cpu-haswell.dll'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'ollama.exe'))).toBe(true);
  });

  it('keeps the CUDA libraries when OLLAMA_KEEP_GPU_LIBS=1', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ollama-keep-'));
    tempDirs.push(root);
    const lib = makeRuntime(root);

    expect(pruneGpuLibraries(root, { OLLAMA_KEEP_GPU_LIBS: '1' })).toBe(0);
    expect(fs.existsSync(path.join(lib, 'cuda_v12'))).toBe(true);
  });

  it('is a no-op on a runtime that has no lib directory', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ollama-bare-'));
    tempDirs.push(root);
    fs.writeFileSync(path.join(root, 'ollama.exe'), 'x');

    expect(pruneGpuLibraries(root, {})).toBe(0);
  });
});
