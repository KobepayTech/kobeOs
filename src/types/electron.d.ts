export interface KobeOSSystemAPI {
  shutdown: () => Promise<void>;
  reboot: () => Promise<void>;
  installToDisk: (disk: string) => Promise<{ success: boolean; output: string; error: string }>;
  scanDisks: () => Promise<Array<{ name: string; size: string; model: string; path: string }>>;
}

declare global {
  interface Window {
    kobeOS: { system: KobeOSSystemAPI; };
  }
}

export {};
