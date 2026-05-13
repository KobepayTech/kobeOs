import { useState, useEffect } from 'react';
export type SystemMode = 'live-usb' | 'installed' | 'development' | 'unknown';
export function useSystemMode(): SystemMode {
  const [mode, setMode] = useState<SystemMode>('unknown');
  useEffect(() => {
    const isElectron = window.navigator.userAgent.toLowerCase().includes('electron');
    if (!isElectron) { setMode('development'); return; }
    fetch('file:///proc/mounts').then(r => r.text()).then(mounts => {
      if (mounts.includes('/dev/sr0') || mounts.includes('/dev/cdrom') || mounts.includes('overlay') || mounts.includes('aufs')) setMode('live-usb');
      else if (mounts.includes('/dev/sda') || mounts.includes('/dev/nvme') || mounts.includes('/dev/mmc')) setMode('installed');
      else setMode('installed');
    }).catch(() => setMode('installed'));
  }, []);
  return mode;
}
