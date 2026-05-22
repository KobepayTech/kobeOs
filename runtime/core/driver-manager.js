'use strict';

const path = require('path');
const fs   = require('fs');

/**
 * DriverManager — loads, manages, and hot-swaps user-space drivers.
 *
 * Driver contract — two supported patterns:
 *
 *   Pattern A (class-based, preferred):
 *     class MyDriver {
 *       get type()    { return 'camera'; }   // used as driver ID
 *       get name()    { return 'KobeCameraDriver'; }
 *       version = '1.0.0';
 *       send(deviceId, command, data) { ... }
 *       getStatus() { ... }
 *     }
 *
 *   Pattern B (legacy object):
 *     module.exports = {
 *       id: 'camera', name: '...', version: '1.0.0',
 *       async init(hal) { ... },
 *       async destroy() { ... },
 *     }
 *
 * Built-in drivers are registered via drivers/index.js.
 * User-installed drivers live in {userData}/drivers/ and use Pattern B.
 */
class DriverManager {
  constructor(hal) {
    this._hal        = hal;
    this._drivers    = new Map(); // id → { instance }
    this._builtinDir = path.join(__dirname, 'drivers');
  }

  // ── Built-in loading ─────────────────────────────────────────────────────

  async loadBuiltins() {
    const indexPath = path.join(this._builtinDir, 'index.js');
    if (fs.existsSync(indexPath)) {
      // Use the registry index for class-based drivers
      const { registerBuiltinDrivers } = require(indexPath);
      registerBuiltinDrivers(this);
      console.log(`[DriverManager] Loaded ${this._drivers.size} built-in driver(s) via registry`);
    } else {
      // Fallback: scan directory for legacy Pattern B drivers
      await this._scanDir(this._builtinDir);
    }
  }

  async loadUserDrivers(userDataPath) {
    const userDriverDir = path.join(userDataPath, 'drivers');
    if (!fs.existsSync(userDriverDir)) return;
    await this._scanDir(userDriverDir);
  }

  async _scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir)
      .filter(f => f.endsWith('.js') && !f.startsWith('_') && f !== 'index.js');

    for (const file of entries) {
      try {
        await this.loadFromFile(path.join(dir, file));
      } catch (err) {
        console.error(`[DriverManager] Failed to load ${file}:`, err.message);
      }
    }
  }

  // ── Registration ─────────────────────────────────────────────────────────

  /**
   * Register a class-based driver instance directly.
   */
  register(id, instance) {
    if (this._drivers.has(id)) {
      console.warn(`[DriverManager] Driver ${id} already registered — skipping`);
      return;
    }
    this._drivers.set(id, { instance });
    console.log(`[DriverManager] Registered driver: ${id} v${instance.version || '?'}`);
  }

  /**
   * Load a legacy Pattern B driver from a file path.
   */
  async loadFromFile(driverPath) {
    const driver = require(driverPath);
    if (!driver.id || typeof driver.init !== 'function') {
      throw new Error(`Invalid driver at ${driverPath}: missing id or init()`);
    }
    if (this._drivers.has(driver.id)) {
      console.warn(`[DriverManager] Driver ${driver.id} already loaded — skipping`);
      return;
    }
    await driver.init(this._hal);
    this._drivers.set(driver.id, { instance: driver });
    console.log(`[DriverManager] Loaded driver: ${driver.id} v${driver.version || '?'}`);
  }

  // ── Unloading ────────────────────────────────────────────────────────────

  async unload(driverId) {
    const entry = this._drivers.get(driverId);
    if (!entry) return;
    try {
      if (typeof entry.instance.destroy === 'function') {
        await entry.instance.destroy();
      }
    } catch (err) {
      console.error(`[DriverManager] Error unloading ${driverId}:`, err.message);
    }
    this._drivers.delete(driverId);
  }

  async unloadAll() {
    for (const id of [...this._drivers.keys()].reverse()) {
      await this.unload(id);
    }
  }

  // ── Access ───────────────────────────────────────────────────────────────

  getDriver(id) {
    return this._drivers.get(id)?.instance;
  }

  getLoaded() {
    return [...this._drivers.entries()].map(([id, { instance }]) => ({
      id,
      name:    instance.name    || id,
      version: instance.version || '?',
      type:    instance.type    || id,
    }));
  }
}

module.exports = DriverManager;
