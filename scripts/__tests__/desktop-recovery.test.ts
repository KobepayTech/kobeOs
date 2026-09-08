// @vitest-environment node
import { readFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import { runInNewContext } from 'node:vm';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const source = readFileSync(path.resolve('electron/main.cjs'), 'utf8');
function harness(kind: 'backend' | 'tunnel') {
  const children: Array<EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; kill: ReturnType<typeof vi.fn>; pid: number }> = [];
  const spawn = vi.fn(() => {
    const child = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter(), kill: vi.fn(), pid: children.length + 1 });
    children.push(child);
    return child;
  });
  const code = kind === 'backend'
    ? 'let backendProcess = null;\n' + source.slice(source.indexOf('let backendRestartTimer'), source.indexOf('// ── Cloudflared auto-start')) + '\n({ start: startBackend, stop: stopBackend })'
    : 'let cloudflaredProcess = null, cloudflaredRestartTimer = null, cloudflaredRestartAttempts = 0, cloudflaredStopping = false;\n' + source.slice(source.indexOf('function startCloudflared()'), source.indexOf('/** IPC: renderer (TunnelSection)')) + '\n({ start: startCloudflared, stop: stopCloudflared })';
  const lifecycle = runInNewContext(code, {
    spawn, setTimeout, clearTimeout, Date, console: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
    fs: { existsSync: () => true }, SERVER_BUNDLE: '/bundle', IS_PACKAGED: false, path, __dirname: '/app/electron',
    process: { env: {}, platform: 'win32', execPath: '/electron' }, require: () => ({}),
    getOrCreateJwtSecret: () => 'test', defaultBundledModel: () => 'test',
    readPersistedToken: () => 'test', resolveCloudflaredBinary: () => '/cloudflared',
  }) as { start(config: object): void; stop(): void };
  return { ...lifecycle, spawn, children };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
it.each(['backend', 'tunnel'] as const)('restarts crashed %s with backoff and prevents duplicates', async (kind) => {
  const h = harness(kind);
  h.start({}); h.start({});
  expect(h.spawn).toHaveBeenCalledTimes(1);
  h.children[0].emit('close', 1, null);
  await vi.advanceTimersByTimeAsync(1000);
  expect(h.spawn).toHaveBeenCalledTimes(2);
  h.children[1].emit('close', 1, null);
  await vi.advanceTimersByTimeAsync(1000);
  expect(h.spawn).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(1000);
  expect(h.spawn).toHaveBeenCalledTimes(3);
  h.stop();
  h.children[2].emit('close', 0, null);
  await vi.advanceTimersByTimeAsync(60000);
  expect(h.spawn).toHaveBeenCalledTimes(3);
});
it.each(['backend', 'tunnel'] as const)('cancels pending %s recovery on intentional stop', async (kind) => {
  const h = harness(kind);
  h.start({});
  h.children[0].emit('error', new Error('spawn failed'));
  h.children[0].emit('close', -1, null);
  h.stop();
  await vi.advanceTimersByTimeAsync(60000);
  expect(h.spawn).toHaveBeenCalledTimes(1);
});
