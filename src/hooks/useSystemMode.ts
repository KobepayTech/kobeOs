import { useState, useEffect } from 'react';

export type SystemMode = 'live-usb' | 'installed' | 'development' | 'unknown';


export function useSystemMode(): SystemMode {
  const [mode, setMode] = useState<SystemMode>(() => {
    // Synchronously determine if we're in a non-Electron environment so the
    // initial render already has the correct value without a setState cascade.
    const isElectron = window.navigator.userAgent.toLowerCase().includes('electron');
    return isElectron ? 'unknown' : 'development';
  });

  useEffect(() => {
    const isElectron = window.navigator.userAgent.toLowerCase().includes('electron');
    if (!isElectron) return;

    // Use the IPC bridge exposed by preload.js. fetch('file:///proc/mounts') is
    // blocked by browser security policy and always fails in Electron's renderer.
    window.kobeOS?.system?.getSystemMode?.()
      .then((result) => setMode(result))
      .catch(() => setMode('installed'));
  }, []);

  return mode;
}
