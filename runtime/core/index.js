/**
 * KobeRuntime — entry point
 *
 * Boots all services and the HAL in order, then exposes a unified
 * runtime object that main.js attaches to the BrowserWindow via IPC.
 *
 * Boot order:
 *   1. ServiceManager  (lifecycle controller)
 *   2. HAL             (hardware abstraction)
 *   3. DriverManager   (loads built-in + user drivers)
 *   4. Services        (Audio, AI, File, Cloud, DeviceManager)
 */

'use strict';

const ServiceManager = require('./service-manager');
const HAL            = require('./hal');
const DriverManager  = require('./driver-manager');
const Sandbox        = require('../security/sandbox');

const AudioService   = require('../services/audio-service');
const AIService      = require('../services/ai-service');
const FileService    = require('../services/file-service');
const CloudService   = require('../services/cloud-service');
const DeviceManager  = require('../services/device-manager');

class KobeRuntime {
  constructor() {
    this.version        = '1.0.0';
    this.serviceManager = new ServiceManager();
    this.hal            = new HAL();
    this.driverManager  = new DriverManager(this.hal);
    this.sandbox        = new Sandbox();
    this._booted        = false;
    this._mainWindow    = null;
  }

  async boot(mainWindow) {
    if (this._booted) return;
    this._mainWindow = mainWindow;

    console.log('[KobeRuntime] Booting v' + this.version);

    // 1. HAL initialises platform detection
    await this.hal.init();

    // 2. Load built-in drivers
    await this.driverManager.loadBuiltins();

    // 3. Register and start all services
    this.serviceManager.register('audio',   new AudioService(this.hal));
    this.serviceManager.register('ai',      new AIService(this.hal));
    this.serviceManager.register('file',    new FileService(this.hal));
    this.serviceManager.register('cloud',   new CloudService(this.hal));
    this.serviceManager.register('devices', new DeviceManager(this.hal, this.driverManager));

    await this.serviceManager.startAll();

    this._booted = true;
    console.log('[KobeRuntime] All services running');

    // Forward service events to renderer
    this.serviceManager.on('service-event', (name, event, data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('runtime-event', { service: name, event, data });
      }
    });
  }

  async shutdown() {
    if (!this._booted) return;
    console.log('[KobeRuntime] Shutting down...');
    await this.serviceManager.stopAll();
    await this.driverManager.unloadAll();
    this._booted = false;
  }

  /** Returns a safe, serialisable status snapshot for the renderer. */
  getStatus() {
    return {
      version:  this.version,
      booted:   this._booted,
      platform: this.hal.platform,
      services: this.serviceManager.getStatus(),
      drivers:  this.driverManager.getLoaded(),
    };
  }
}

module.exports = new KobeRuntime();
