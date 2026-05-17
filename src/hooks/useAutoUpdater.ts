import { useEffect, useState } from 'react';
import type { UpdaterEvent } from '@/types/electron';

export type UpdaterState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available'; version: string; releaseNotes?: string }
  | { status: 'downloading'; percent: number; bytesPerSecond: number }
  | { status: 'ready'; version: string }
  | { status: 'error'; message: string };

/**
 * Subscribes to Electron auto-updater events exposed via window.kobeOS.updater.
 * Returns current update state and action handlers.
 * Safe to use in browser/PWA — returns idle state when updater is unavailable.
 */
export function useAutoUpdater() {
  const [state, setState] = useState<UpdaterState>({ status: 'idle' });

  useEffect(() => {
    const updater = window.kobeOS?.updater;
    if (!updater) return;

    const cleanup = updater.onEvent((data: UpdaterEvent) => {
      switch (data.event) {
        case 'checking':
          setState({ status: 'checking' });
          break;
        case 'available':
          setState({ status: 'available', version: data.version, releaseNotes: data.releaseNotes });
          break;
        case 'not-available':
          setState({ status: 'idle' });
          break;
        case 'progress':
          setState({ status: 'downloading', percent: data.percent, bytesPerSecond: data.bytesPerSecond });
          break;
        case 'downloaded':
          setState({ status: 'ready', version: data.version });
          break;
        case 'error':
          setState({ status: 'error', message: data.message });
          break;
      }
    });

    return cleanup;
  }, []);

  const download = () => window.kobeOS?.updater?.download();
  const install = () => window.kobeOS?.updater?.install();
  const check = () => window.kobeOS?.updater?.check();

  return { state, download, install, check };
}
