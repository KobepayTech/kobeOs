'use strict';

const os   = require('os');
const path = require('path');
const fs   = require('fs');

/**
 * Hardware Abstraction Layer (HAL)
 *
 * Apps never talk to hardware directly. They call HAL methods which
 * delegate to the appropriate platform driver or system API.
 *
 * HAL API surface (exposed to renderer via IPC):
 *
 *   hal.platform          — { os, arch, hostname, cpus, memory, gpu }
 *   hal.display.*         — screen info, DPI, orientation
 *   hal.network.*         — connectivity, interfaces
 *   hal.storage.*         — volumes, free space
 *   hal.power.*           — battery, AC status
 *   hal.input.*           — keyboard, mouse, touch, gamepad
 *   hal.media.*           — cameras, microphones, speakers
 *   hal.peripheral.*      — USB, Bluetooth, serial, POS, payment
 */
class HAL {
  constructor() {
    this.platform = null;
    this._initialized = false;
  }

  async init() {
    this.platform = await this._detectPlatform();
    this._initialized = true;
    console.log(`[HAL] Platform: ${this.platform.os} ${this.platform.arch} — ${this.platform.hostname}`);
  }

  // ── Platform detection ────────────────────────────────────────────────────

  async _detectPlatform() {
    const { app } = require('electron');
    let gpuInfo = {};
    try {
      gpuInfo = await app.getGPUInfo('basic');
    } catch { /* headless / no GPU */ }

    return {
      os:       process.platform,           // linux | darwin | win32
      arch:     process.arch,               // x64 | arm64
      hostname: os.hostname(),
      release:  os.release(),
      cpus:     os.cpus().length,
      memory:   Math.round(os.totalmem() / 1024 / 1024 / 1024) + 'GB',
      gpu:      gpuInfo?.gpuDevice?.[0]?.deviceId ?? 'unknown',
    };
  }

  // ── Display ───────────────────────────────────────────────────────────────

  getDisplayInfo() {
    try {
      const { screen } = require('electron');
      return screen.getAllDisplays().map(d => ({
        id:          d.id,
        bounds:      d.bounds,
        workArea:    d.workAreaSize,
        scaleFactor: d.scaleFactor,
        rotation:    d.rotation,
        primary:     d.id === screen.getPrimaryDisplay().id,
      }));
    } catch {
      return [];
    }
  }

  // ── Network ───────────────────────────────────────────────────────────────

  getNetworkInterfaces() {
    const ifaces = os.networkInterfaces();
    const result = [];
    for (const [name, addrs] of Object.entries(ifaces)) {
      for (const addr of addrs) {
        if (!addr.internal) {
          result.push({ name, family: addr.family, address: addr.address, mac: addr.mac });
        }
      }
    }
    return result;
  }

  isOnline() {
    const ifaces = os.networkInterfaces();
    return Object.values(ifaces).flat().some(a => !a.internal && a.family === 'IPv4');
  }

  // ── Storage ───────────────────────────────────────────────────────────────

  async getStorageInfo() {
    const { app } = require('electron');
    try {
      const userData = app.getPath('userData');
      const stat = fs.statfsSync ? fs.statfsSync(userData) : null;
      if (stat) {
        return {
          path:      userData,
          total:     Math.round(stat.blocks * stat.bsize / 1024 / 1024 / 1024) + 'GB',
          free:      Math.round(stat.bfree  * stat.bsize / 1024 / 1024 / 1024) + 'GB',
          available: Math.round(stat.bavail * stat.bsize / 1024 / 1024 / 1024) + 'GB',
        };
      }
    } catch { /* statfs not available */ }
    return { path: 'unknown', total: 'unknown', free: 'unknown' };
  }

  // ── Power ─────────────────────────────────────────────────────────────────

  async getPowerStatus() {
    try {
      const { powerMonitor } = require('electron');
      return {
        onBattery:   powerMonitor.onBatteryPower,
        // batteryLevel only available on some platforms
        batteryLevel: powerMonitor.getSystemIdleState ? null : null,
      };
    } catch {
      return { onBattery: false };
    }
  }

  // ── Media devices ─────────────────────────────────────────────────────────
  // Actual enumeration happens in the renderer via navigator.mediaDevices.
  // HAL provides the permission gate.

  async requestMediaPermission(type) {
    // type: 'camera' | 'microphone' | 'screen'
    const { systemPreferences } = require('electron');
    if (process.platform === 'darwin') {
      try {
        const status = systemPreferences.getMediaAccessStatus(type);
        if (status !== 'granted') {
          return await systemPreferences.askForMediaAccess(type);
        }
        return true;
      } catch { return false; }
    }
    return true; // Linux/Windows: granted by default
  }

  // ── Peripheral / USB ──────────────────────────────────────────────────────

  getUSBDevices() {
    // Returns devices registered by the driver system
    return this._usbDevices || [];
  }

  registerUSBDevice(device) {
    if (!this._usbDevices) this._usbDevices = [];
    this._usbDevices.push(device);
  }

  unregisterUSBDevice(deviceId) {
    if (!this._usbDevices) return;
    this._usbDevices = this._usbDevices.filter(d => d.deviceId !== deviceId);
  }
}

module.exports = HAL;
