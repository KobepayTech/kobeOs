import { useState, useEffect } from 'react';

export type SystemMode = 'live-usb' | 'installed' | 'development' | 'unknown';

// Window type is declared in src/types/electron.d.ts

export function useSystemMode(): SystemMode {
  const [mode, setMode] = useState<SystemMode>('unknown');

  useEffect(() => {
    const isElectron = window.navigator.userAgent.toLowerCase().includes('electron');

    if (!isElectron) {
      // Use a microtask so the state update happens outside the render cycle
      Promise.resolve().then(() => setMode('development'));
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
