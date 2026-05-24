/**
 * KobeOS TypeScript SDK
 *
 * Provides typed access to the KobeOS runtime APIs from any
 * TypeScript/JavaScript app running inside the KobeOS shell.
 *
 * Usage (inside a KobeOS app):
 *   import { KobeRuntime } from '@kobeos/sdk';
 *   const rt = new KobeRuntime();
 *   const volume = await rt.audio.getVolume();
 */

export { useRuntime, useRuntimeEvent, useBluetoothDeviceList } from '../../src/hooks/useRuntime';
export type {
  RuntimeApi,
  AudioApi,
  AIApi,
  FileApi,
  CloudApi,
  DevicesApi,
  DriverApi,
  BluetoothApi,
  RuntimeEvent,
} from '../../src/hooks/useRuntime';

/**
 * KobeRuntime — direct (non-hook) access for non-React code.
 * Returns window.kobeOS.runtime or a noop stub.
 */
export function getRuntime() {
  if (typeof window !== 'undefined' && window.kobeOS?.runtime) {
    return window.kobeOS.runtime;
  }
  return null;
}
