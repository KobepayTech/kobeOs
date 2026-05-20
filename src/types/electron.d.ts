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
    };
  }
}

export {};
