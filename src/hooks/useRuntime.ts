/**
 * useRuntime — React hook for accessing the Kobe Runtime API.
 *
 * Provides typed access to all runtime services exposed via
 * window.kobeOS.runtime. Falls back gracefully when running in a
 * browser (non-Electron) context.
 *
 * Usage:
 *   const { audio, file, cloud, hal, ai, devices, driver, bluetooth } = useRuntime();
 *   const volume = await audio.getVolume();
 *   const files  = await file.list('/user/documents', 'my-app');
 */

import { useEffect, useRef } from 'react';
import type {
  KobeOSRuntimeAPI,
  KobeOSRuntimeAudio,
  KobeOSRuntimeAI,
  KobeOSRuntimeFile,
  KobeOSRuntimeCloud,
  KobeOSRuntimeDevices,
  KobeOSRuntimeDriver,
  KobeOSRuntimeBluetooth,
  RuntimeEvent,
} from '../types/electron.d';

// ── Noop fallback for browser context ────────────────────────────────────────

const noop = () => Promise.resolve(undefined as never);

const noopRuntime: KobeOSRuntimeAPI = {
  status:    noop,
  hal:       { platform: noop, display: noop, network: noop, storage: noop, power: noop, usb: noop },
  audio:     { getVolume: noop, setVolume: noop, getMute: noop, setMute: noop, status: noop },
  ai:        { chat: noop, embed: noop, status: noop },
  file:      { read: noop, write: noop, list: noop, delete: noop, exists: noop, mkdir: noop, stat: noop, status: noop },
  cloud:     { ping: noop, status: noop },
  devices:   { list: noop, byType: noop, send: noop, status: noop },
  driver:    { send: noop },
  bluetooth: { select: noop, cancel: noop, devices: noop, onDeviceList: () => () => {} },
  onEvent:   () => () => {},
};

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Returns the Kobe Runtime API.
 * In a browser context (no Electron), returns a noop stub so apps
 * can be developed and tested without the desktop runtime.
 */
export function useRuntime(): KobeOSRuntimeAPI {
  return window.kobeOS?.runtime ?? noopRuntime;
}

/**
 * Subscribe to runtime service events.
 * Automatically unsubscribes on component unmount.
 *
 * @example
 *   useRuntimeEvent((e) => {
 *     if (e.service === 'cloud' && e.event === 'offline') showOfflineBanner();
 *   });
 */
export function useRuntimeEvent(cb: (event: RuntimeEvent) => void): void {
  const cbRef = useRef(cb);
  cbRef.current = cb;

  useEffect(() => {
    const runtime = window.kobeOS?.runtime;
    if (!runtime) return;
    const unsub = runtime.onEvent((e) => cbRef.current(e));
    return unsub;
  }, []);
}

/**
 * Subscribe to Bluetooth device list events.
 * Fires when the OS presents a list of nearby devices for the user to pick.
 */
export function useBluetoothDeviceList(cb: (devices: unknown[]) => void): void {
  const cbRef = useRef(cb);
  cbRef.current = cb;

  useEffect(() => {
    const runtime = window.kobeOS?.runtime;
    if (!runtime) return;
    const unsub = runtime.bluetooth.onDeviceList((list) => cbRef.current(list));
    return unsub;
  }, []);
}

export type {
  KobeOSRuntimeAPI as RuntimeApi,
  KobeOSRuntimeAudio as AudioApi,
  KobeOSRuntimeAI as AIApi,
  KobeOSRuntimeFile as FileApi,
  KobeOSRuntimeCloud as CloudApi,
  KobeOSRuntimeDevices as DevicesApi,
  KobeOSRuntimeDriver as DriverApi,
  KobeOSRuntimeBluetooth as BluetoothApi,
  RuntimeEvent,
};
