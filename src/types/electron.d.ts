export interface KobeOSSystemAPI {
  shutdown: () => Promise<void>;
  reboot: () => Promise<void>;
  installToDisk: (disk: string) => Promise<{ success: boolean; output: string; error: string }>;
  scanDisks: () => Promise<Array<{ name: string; size: string; model: string; path: string }>>;
  getSystemMode: () => Promise<'live-usb' | 'installed'>;
}

export type UpdaterEvent =
  | { event: 'checking' }
  | { event: 'available'; version: string; releaseNotes?: string }
  | { event: 'not-available' }
  | { event: 'progress'; percent: number; transferred: number; total: number; bytesPerSecond: number }
  | { event: 'downloaded'; version: string }
  | { event: 'error'; message: string };

export interface KobeOSUpdaterAPI {
  check: () => Promise<void>;
  download: () => Promise<void>;
  install: () => Promise<void>;
  /** Register a listener; returns a cleanup function. */
  onEvent: (cb: (data: UpdaterEvent) => void) => () => void;
}

declare global {
  interface Window {
    kobeOS: {
      system: KobeOSSystemAPI;
      /** Only present in Electron builds — undefined in browser/PWA. */
      updater?: KobeOSUpdaterAPI;
    };
  }
}

export {};
