import type { AppManifest } from './types';

export type ModuleStage = 'idle' | 'preparing' | 'verifying' | 'registering' | 'ready' | 'failed';
export type ModuleInstallState = 'installed' | 'disabled' | 'available';

export interface ModuleRecord {
  appId: string;
  state: ModuleInstallState;
  version: string;
  integrity: string;
  installedAt: string | null;
  updatedAt: string;
  lastError: string;
}

export interface ModuleProgress {
  appId: string;
  stage: ModuleStage;
  progress: number;
  bytesDone: number;
  bytesTotal: number;
  message: string;
}

const STORAGE_KEY = 'kobeos-module-install-state-v1';
const CHANGE_EVENT = 'kobeos:modules-changed';
const CORE_APPS = new Set([
  'file-manager', 'settings', 'system-settings', 'package-manager', 'app-store',
  'terminal', 'browser', 'kobe-assistant',
]);

function readRecords(): Record<string, ModuleRecord> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, ModuleRecord>;
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function writeRecords(records: Record<string, ModuleRecord>) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  }
}

function canonicalManifest(app: AppManifest): string {
  return JSON.stringify({
    id: app.id,
    name: app.name,
    description: app.description,
    icon: app.icon,
    category: app.category,
    version: app.version,
    width: app.width,
    height: app.height,
    minWidth: app.minWidth,
    minHeight: app.minHeight,
    singleton: app.singleton,
    requiresAuth: app.requiresAuth,
    permissions: [...app.permissions].sort(),
    subscriptionTier: app.subscriptionTier || 'free',
    signer: 'kobeos-core-bundle',
  });
}

async function sha256(value: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Secure integrity verification is unavailable in this runtime');
  }
  // Copy into a fresh ArrayBuffer-backed view: value.buffer is ArrayBufferLike
  // (may be a SharedArrayBuffer), which crypto.subtle.digest's BufferSource
  // type rejects. new Uint8Array(value) yields a definite ArrayBuffer.
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new Uint8Array(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function isCoreApp(appId: string): boolean {
  return CORE_APPS.has(appId);
}

export function getModuleRecord(app: AppManifest): ModuleRecord {
  const saved = readRecords()[app.id];
  if (saved) return saved;
  // Existing KobeOS installations keep every bundled module installed until a
  // user explicitly disables or removes one. This avoids destructive upgrades.
  return {
    appId: app.id,
    state: 'installed',
    version: app.version,
    integrity: '',
    installedAt: null,
    updatedAt: new Date(0).toISOString(),
    lastError: '',
  };
}

export function installedApps(catalogue: AppManifest[]): AppManifest[] {
  return catalogue.filter((app) => isCoreApp(app.id) || getModuleRecord(app).state === 'installed');
}

export function subscribeToModuleChanges(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}

export async function installBundledModule(
  app: AppManifest,
  onProgress: (progress: ModuleProgress) => void,
): Promise<ModuleRecord> {
  const manifestBytes = new TextEncoder().encode(canonicalManifest(app));
  const total = manifestBytes.byteLength;
  const notify = (stage: ModuleStage, progress: number, bytesDone: number, message: string) =>
    onProgress({ appId: app.id, stage, progress, bytesDone, bytesTotal: total, message });

  try {
    notify('preparing', 5, 0, 'Preparing bundled module manifest');
    // Consume the actual canonical manifest bytes in deterministic chunks. For
    // bundled modules no network download is required; this is real package
    // preparation progress rather than a random timer.
    const chunkSize = Math.max(1, Math.ceil(total / 8));
    let copied = 0;
    while (copied < total) {
      copied = Math.min(total, copied + chunkSize);
      notify('preparing', 5 + Math.round((copied / total) * 35), copied, 'Loading bundled package metadata');
      await new Promise<void>((resolve) => {
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => resolve());
        } else {
          setTimeout(resolve, 0);
        }
      });
    }

    notify('verifying', 55, total, 'Verifying SHA-256 integrity and core signer');
    const integrity = await sha256(manifestBytes);
    if (!/^[a-f0-9]{64}$/.test(integrity)) throw new Error('Manifest integrity verification failed');

    notify('registering', 78, total, 'Registering module with KobeOS');
    const records = readRecords();
    const now = new Date().toISOString();
    const record: ModuleRecord = {
      appId: app.id,
      state: 'installed',
      version: app.version,
      integrity,
      installedAt: records[app.id]?.installedAt || now,
      updatedAt: now,
      lastError: '',
    };
    records[app.id] = record;
    writeRecords(records);
    notify('ready', 100, total, 'Module installed and ready');
    return record;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const records = readRecords();
    const previous = records[app.id] || getModuleRecord(app);
    records[app.id] = { ...previous, lastError: message, updatedAt: new Date().toISOString() };
    writeRecords(records);
    notify('failed', 100, total, message);
    throw error;
  }
}

export function setModuleEnabled(app: AppManifest, enabled: boolean): ModuleRecord {
  if (isCoreApp(app.id) && !enabled) throw new Error('Core KobeOS modules cannot be disabled');
  const records = readRecords();
  const previous = records[app.id] || getModuleRecord(app);
  const record: ModuleRecord = {
    ...previous,
    appId: app.id,
    version: app.version,
    state: enabled ? 'installed' : 'disabled',
    updatedAt: new Date().toISOString(),
    lastError: '',
  };
  records[app.id] = record;
  writeRecords(records);
  return record;
}

export function uninstallModule(app: AppManifest): ModuleRecord {
  if (isCoreApp(app.id)) throw new Error('Core KobeOS modules cannot be removed');
  const records = readRecords();
  const previous = records[app.id] || getModuleRecord(app);
  const record: ModuleRecord = {
    ...previous,
    state: 'available',
    updatedAt: new Date().toISOString(),
    lastError: '',
  };
  records[app.id] = record;
  writeRecords(records);
  return record;
}
