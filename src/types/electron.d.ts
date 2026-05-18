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

declare global {
  interface Window {
    kobeOS: {
      system:   KobeOSSystemAPI;
      updater?: KobeOSUpdaterAPI;
    };
  }
}

export {};
