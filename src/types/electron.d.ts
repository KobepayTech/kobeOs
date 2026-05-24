export interface KobeOSSystemAPI {
  shutdown:         () => Promise<void>;
  reboot:           () => Promise<void>;
  installToDisk:    (disk: string) => Promise<{ success: boolean; output: string; error: string }>;
  scanDisks:        () => Promise<Array<{ name: string; size: string; model: string; path: string }>>;
  getSystemMode:    () => Promise<'live-usb' | 'installed'>;
  getBackendStatus: () => Promise<{ running: boolean; pid: number | null; embeddedPg: boolean }>;
}

export type UpdaterEvent =
  | { event: 'checking' }
  | { event: 'available'; version: string; releaseNotes?: string; releaseDate?: string }
  | { event: 'not-available'; currentVersion: string }
  | { event: 'progress'; percent: number; transferred: number; total: number; bytesPerSecond: number }
  | { event: 'verifying'; version: string }
  | { event: 'downloaded'; version: string }
  | { event: 'error'; message: string };

export interface UpdaterStatus {
  currentVersion: string;
  hasBackup: boolean;
  bootOk: boolean;
  backupVersion: string | null;
}

export interface KobeOSUpdaterAPI {
  check:    () => Promise<void>;
  download: () => Promise<void>;
  install:  () => Promise<void>;
  rollback: () => Promise<{ success: boolean; error?: string }>;
  status:   () => Promise<UpdaterStatus>;
  onEvent:  (cb: (data: UpdaterEvent) => void) => () => void;
}

// ── Local DB ──────────────────────────────────────────────────────────────────

export interface DBStats {
  queueDepth: number;
  unsyncedNotes: number;
  unsyncedOrders: number;
  unsyncedShipments: number;
}

export interface SyncOperation {
  method: string;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface KobeOSDbAPI {
  kvGet:    (key: string) => Promise<string | null>;
  kvSet:    (key: string, value: string) => Promise<void>;
  kvDel:    (key: string) => Promise<void>;
  query:    <T = unknown>(table: string, filters?: Record<string, unknown>) => Promise<T[]>;
  insert:   <T = unknown>(table: string, record: Record<string, unknown>) => Promise<T>;
  update:   (table: string, id: string | number, changes: Record<string, unknown>) => Promise<void>;
  delete:   (table: string, id: string | number) => Promise<void>;
  enqueue:  (operation: SyncOperation) => Promise<void>;
  getStats: () => Promise<DBStats>;
}

// ── Sync engine ───────────────────────────────────────────────────────────────

export interface SyncStatusPayload {
  online: boolean;
  syncing: boolean;
  queueDepth: number;
  stats: DBStats;
}

export interface KobeOSSyncAPI {
  status:    () => Promise<SyncStatusPayload>;
  forceSync: () => Promise<void>;
  onEvent:   (cb: (data: { type: string; [k: string]: unknown }) => void) => () => void;
}

// ── LAN server ────────────────────────────────────────────────────────────────

export interface LanPeer {
  ip: string;
  port: number;
  name: string;
}

export interface LanStatus {
  running: boolean;
  ip: string;
  port: number;
  serviceType: string;
}

export interface KobeOSLanAPI {
  start:    () => Promise<{ success: boolean; ip?: string; port?: number; error?: string }>;
  stop:     () => Promise<{ success: boolean }>;
  status:   () => Promise<LanStatus>;
  discover: () => Promise<LanPeer[]>;
}

// ── OS update service ─────────────────────────────────────────────────────────

export interface OsUpdateStatus {
  status: 'unknown' | 'running' | 'upgrading' | 'up-to-date' | 'complete' | 'reboot-required' | 'error';
  message: string;
  timestamp: string | null;
}

export interface KobeOSOsUpdateAPI {
  status:      () => Promise<OsUpdateStatus>;
  run:         () => Promise<{ success: boolean; output: string; error: string }>;
  clearReboot: () => Promise<{ success: boolean; error?: string }>;
}

// ── Runtime API (HAL + services + drivers) ────────────────────────────────────

export interface KobeOSRuntimeHAL {
  platform: () => Promise<string>;
  display:  () => Promise<Record<string, unknown>>;
  network:  () => Promise<Record<string, unknown>>;
  storage:  () => Promise<Record<string, unknown>>;
  power:    () => Promise<Record<string, unknown>>;
  usb:      () => Promise<unknown[]>;
}

export interface KobeOSRuntimeAudio {
  getVolume: ()              => Promise<number>;
  setVolume: (level: number) => Promise<number>;
  getMute:   ()              => Promise<boolean>;
  setMute:   (muted: boolean) => Promise<boolean>;
  status:    ()              => Promise<Record<string, unknown>>;
}

export interface KobeOSRuntimeAI {
  chat:   (messages: unknown[], opts?: Record<string, unknown>) => Promise<string>;
  embed:  (text: string) => Promise<number[]>;
  status: () => Promise<Record<string, unknown>>;
}

export interface KobeOSRuntimeFile {
  read:   (vpath: string, appId: string, enc?: string) => Promise<string>;
  write:  (vpath: string, appId: string, data: string) => Promise<void>;
  list:   (vpath: string, appId: string) => Promise<{ name: string; type: 'file' | 'dir'; size: number; mtime: Date }[]>;
  delete: (vpath: string, appId: string) => Promise<void>;
  exists: (vpath: string, appId: string) => Promise<boolean>;
  mkdir:  (vpath: string, appId: string) => Promise<void>;
  stat:   (vpath: string, appId: string) => Promise<{ size: number; mtime: Date; isDir: boolean }>;
  status: () => Promise<Record<string, unknown>>;
}

export interface KobeOSRuntimeCloud {
  ping:   () => Promise<number>;
  status: () => Promise<{ running: boolean; online: boolean; latency: number | null }>;
}

export interface KobeOSRuntimeDevices {
  list:   () => Promise<unknown[]>;
  byType: (type: string) => Promise<unknown[]>;
  send:   (id: string, cmd: string, data?: unknown) => Promise<unknown>;
  status: () => Promise<Record<string, unknown>>;
}

export interface KobeOSRuntimeDriver {
  send: (driverId: string, deviceId: string, command: string, data?: unknown) => Promise<unknown>;
}

export interface KobeOSRuntimeBluetooth {
  select:       (deviceId: string) => Promise<void>;
  cancel:       () => Promise<void>;
  devices:      () => Promise<unknown[]>;
  onDeviceList: (cb: (list: unknown[]) => void) => () => void;
}

export interface RuntimeEvent {
  service: string;
  event:   string;
  data:    unknown;
}

export interface KobeOSRuntimeAPI {
  status:    () => Promise<Record<string, unknown>>;
  hal:       KobeOSRuntimeHAL;
  audio:     KobeOSRuntimeAudio;
  ai:        KobeOSRuntimeAI;
  file:      KobeOSRuntimeFile;
  cloud:     KobeOSRuntimeCloud;
  devices:   KobeOSRuntimeDevices;
  driver:    KobeOSRuntimeDriver;
  bluetooth: KobeOSRuntimeBluetooth;
  onEvent:   (cb: (event: RuntimeEvent) => void) => () => void;
}

// ── Global window augmentation ────────────────────────────────────────────────

declare global {
  interface Window {
    kobeOS: {
      system:   KobeOSSystemAPI;
      updater?: KobeOSUpdaterAPI;
      db:       KobeOSDbAPI;
      sync:     KobeOSSyncAPI;
      lan:      KobeOSLanAPI;
      osUpdate: KobeOSOsUpdateAPI;
      runtime?: KobeOSRuntimeAPI;
    };
  }
}

export {};
