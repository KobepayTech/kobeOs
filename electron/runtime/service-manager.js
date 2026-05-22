'use strict';

const { EventEmitter } = require('events');

/**
 * ServiceManager — lifecycle controller for all KobeRuntime services.
 *
 * Each service must implement:
 *   async start()  — initialise and begin work
 *   async stop()   — clean shutdown
 *   getStatus()    — returns { running, ... }
 */
class ServiceManager extends EventEmitter {
  constructor() {
    super();
    this._services = new Map(); // name → service instance
  }

  register(name, service) {
    if (this._services.has(name)) {
      throw new Error(`Service already registered: ${name}`);
    }
    // Forward events from service to runtime
    if (typeof service.on === 'function') {
      service.on('event', (event, data) => {
        this.emit('service-event', name, event, data);
      });
    }
    this._services.set(name, service);
    console.log(`[ServiceManager] Registered: ${name}`);
  }

  async startAll() {
    for (const [name, svc] of this._services) {
      try {
        await svc.start();
        console.log(`[ServiceManager] Started: ${name}`);
      } catch (err) {
        console.error(`[ServiceManager] Failed to start ${name}:`, err.message);
        // Non-fatal — runtime continues without this service
      }
    }
  }

  async stopAll() {
    const names = [...this._services.keys()].reverse(); // stop in reverse order
    for (const name of names) {
      try {
        await this._services.get(name).stop();
        console.log(`[ServiceManager] Stopped: ${name}`);
      } catch (err) {
        console.error(`[ServiceManager] Error stopping ${name}:`, err.message);
      }
    }
  }

  get(name) {
    return this._services.get(name);
  }

  getStatus() {
    const status = {};
    for (const [name, svc] of this._services) {
      try {
        status[name] = svc.getStatus();
      } catch {
        status[name] = { running: false, error: 'status unavailable' };
      }
    }
    return status;
  }
}

module.exports = ServiceManager;
