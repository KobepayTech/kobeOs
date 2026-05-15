import { useState, useEffect } from 'react';

export type SystemMode = 'live-usb' | 'installed' | 'development' | 'unknown';

// Extend the window type to include the contextBridge-exposed kobeOS API.
declare global {
  interface Window {
    kobeOS?: {
      system?: {
        shutdown?: () => Promise<void>;
        reboot?: () => Promise<void>;
        installToDisk?: (disk: string) => Promise<{ success: boolean; output: string; error: string }>;
        scanDisks?: () => Promise<{ name: string; size: string; model: string; path: string }[]>;
        getSystemMode?: () => Promise<'live-usb' | 'installed'>;
      };
    };
  }
}

export function useSystemMode(): SystemMode {
  const [mode, setMode] = useState<SystemMode>('unknown');

  useEffect(() => {
    const isElectron = window.navigator.userAgent.toLowerCase().includes('electron');

    if (!isElectron) {
      setMode('development');
      return;
    }

    // Use the IPC bridge exposed by preload.js. fetch('file:///proc/mounts') is
    // blocked by browser security policy and always fails in Electron's renderer.
    window.kobeOS?.system?.getSystemMode?.()
      .then((result) => setMode(result))
      .catch(() => setMode('installed'));
  }, []);

  return mode;
}
