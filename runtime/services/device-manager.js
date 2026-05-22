'use strict';

const BaseService = require('./_base-service');

/**
 * Kobe Device Manager
 *
 * Manages all peripheral devices via the driver system.
 * Handles hot-plug events and routes device I/O through the HAL.
 *
 * Supported device categories:
 *   - USB (generic, POS scanners, payment terminals)
 *   - Bluetooth (controllers, headsets, printers)
 *   - Serial (POS printers, vending machines, kiosks)
 *   - HID (keyboards, mice, gamepads, drawing tablets)
 *   - Camera / Microphone (via HAL media permissions)
 *
 * Exposes:
 *   getDevices()                     → all connected devices
 *   getDevicesByType(type)           → filtered list
 *   sendToDevice(deviceId, command)  → driver-specific command
 *   onDeviceEvent(cb)                → hot-plug / data events
 */
class DeviceManager extends BaseService {
  constructor(hal, driverManager) {
    super('devices', hal);
    this._driverManager = driverManager;
    this._devices       = new Map(); // deviceId → device info
    this._listeners     = [];
  }

  async _start() {
    // Register USB hot-plug via Electron's USB API
    this._setupUSBHotplug();
    // Register Bluetooth scanning
    this._setupBluetooth();
    console.log('[DeviceManager] Started — monitoring devices');
  }

  async _stop() {
    this._devices.clear();
    this._listeners = [];
  }

  _setupUSBHotplug() {
    try {
      const { app } = require('electron');
      // Electron 22+ supports USB device events
      app.on('usb-device-added', (event, device) => {
        const id = `usb-${device.vendorId}-${device.productId}`;
        const info = {
          id, type: 'usb',
          vendorId:  device.vendorId,
          productId: device.productId,
          name:      device.productName || `USB ${device.vendorId}:${device.productId}`,
          connected: true,
        };
        this._devices.set(id, info);
        this.hal.registerUSBDevice(info);
        this._emit('device-connected', info);
        console.log(`[DeviceManager] USB connected: ${info.name}`);
      });

      app.on('usb-device-removed', (event, device) => {
        const id = `usb-${device.vendorId}-${device.productId}`;
        this._devices.delete(id);
        this.hal.unregisterUSBDevice(id);
        this._emit('device-disconnected', { id });
      });
    } catch { /* USB events not available in this Electron version */ }
  }

  _setupBluetooth() {
    // Bluetooth device selection is handled in the renderer via Web Bluetooth API
    // DeviceManager tracks paired devices here
  }

  getDevices() {
    return [...this._devices.values()];
  }

  getDevicesByType(type) {
    return [...this._devices.values()].filter(d => d.type === type);
  }

  async sendToDevice(deviceId, command, data) {
    const device = this._devices.get(deviceId);
    if (!device) throw new Error(`Device not found: ${deviceId}`);

    // Route to appropriate driver
    const driver = this._driverManager.getDriver(device.driverType || device.type);
    if (!driver) throw new Error(`No driver for device type: ${device.type}`);
    if (typeof driver.send !== 'function') throw new Error(`Driver ${device.type} does not support send`);

    return driver.send(deviceId, command, data);
  }

  registerDevice(device) {
    this._devices.set(device.id, device);
    this._emit('device-registered', device);
  }

  getStatus() {
    return {
      running: this.running,
      devices: this._devices.size,
      types:   [...new Set([...this._devices.values()].map(d => d.type))],
    };
  }
}

module.exports = DeviceManager;
