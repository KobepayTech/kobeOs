'use strict';

/**
 * Kobe Bluetooth Driver
 *
 * User-space driver for Bluetooth peripherals.
 * Electron exposes Bluetooth via the Web Bluetooth API in the renderer.
 * This driver acts as the main-process coordinator:
 *   - Intercepts `select-bluetooth-device` events
 *   - Maintains a registry of paired/known devices
 *   - Routes device selection to the requesting app
 *   - Supports auto-connect for known devices (POS printers, headsets)
 *
 * Supported device profiles:
 *   - SPP (Serial Port Profile) — Bluetooth receipt printers
 *   - A2DP — Audio headsets
 *   - HID — Keyboards, mice, barcode scanners
 *   - Generic — Any Web Bluetooth GATT device
 */
class BluetoothDriver {
  constructor() {
    this.type    = 'bluetooth';
    this.version = '1.0.0';
    this._knownDevices  = new Map(); // deviceId → device info
    this._pendingSelect = null;      // resolve fn for current device selection
    this._webContents   = null;      // set by main.js after window creation
  }

  get name() { return 'KobeBluetoothDriver'; }

  /**
   * Called by main.js after BrowserWindow is created.
   * Attaches the select-bluetooth-device handler.
   */
  attachWindow(webContents) {
    this._webContents = webContents;

    webContents.on('select-bluetooth-device', (event, deviceList, callback) => {
      event.preventDefault();

      // Auto-select a known/paired device if present
      for (const device of deviceList) {
        if (this._knownDevices.has(device.deviceId)) {
          console.log(`[BluetoothDriver] Auto-selecting known device: ${device.deviceName}`);
          callback(device.deviceId);
          return;
        }
      }

      // Store callback for manual selection via IPC
      this._pendingSelect = { callback, deviceList };

      // Notify renderer to show device picker
      if (!webContents.isDestroyed()) {
        webContents.send('bluetooth:device-list', deviceList);
      }
    });
  }

  /**
   * Called from IPC when the user selects a device in the renderer UI.
   */
  selectDevice(deviceId) {
    if (!this._pendingSelect) return;
    const { callback, deviceList } = this._pendingSelect;
    this._pendingSelect = null;

    const device = deviceList.find(d => d.deviceId === deviceId);
    if (device) {
      this._knownDevices.set(deviceId, { ...device, pairedAt: Date.now() });
      callback(deviceId);
    } else {
      callback(''); // cancel
    }
  }

  /**
   * Cancel pending device selection (user dismissed picker).
   */
  cancelSelection() {
    if (!this._pendingSelect) return;
    this._pendingSelect.callback('');
    this._pendingSelect = null;
  }

  // ── Known Device Management ──────────────────────────────────────────────

  pairDevice(deviceId, info) {
    this._knownDevices.set(deviceId, { ...info, deviceId, pairedAt: Date.now() });
    return { status: 'paired', deviceId };
  }

  unpairDevice(deviceId) {
    this._knownDevices.delete(deviceId);
    return { status: 'unpaired', deviceId };
  }

  listKnownDevices() {
    return [...this._knownDevices.values()];
  }

  isKnown(deviceId) {
    return this._knownDevices.has(deviceId);
  }

  send(deviceId, command, data) {
    switch (command) {
      case 'selectDevice':      return this.selectDevice(data?.deviceId);
      case 'cancelSelection':   return this.cancelSelection();
      case 'pairDevice':        return this.pairDevice(data?.deviceId, data?.info);
      case 'unpairDevice':      return this.unpairDevice(data?.deviceId);
      case 'listKnownDevices':  return this.listKnownDevices();
      default: throw new Error(`Unknown bluetooth command: ${command}`);
    }
  }

  getStatus() {
    return {
      type:         this.type,
      knownDevices: this._knownDevices.size,
      hasPending:   !!this._pendingSelect,
    };
  }
}

module.exports = BluetoothDriver;
