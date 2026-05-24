'use strict';

const { EventEmitter } = require('events');

/**
 * BaseService — all KobeServices extend this.
 *
 * Subclasses implement:
 *   async _start()   — service-specific startup
 *   async _stop()    — service-specific shutdown
 *   getStatus()      — returns { running, ...serviceData }
 */
class BaseService extends EventEmitter {
  constructor(name, hal) {
    super();
    this.name    = name;
    this.hal     = hal;
    this.running = false;
  }

  async start() {
    if (this.running) return;
    await this._start();
    this.running = true;
  }

  async stop() {
    if (!this.running) return;
    await this._stop();
    this.running = false;
  }

  async _start() {}
  async _stop()  {}

  getStatus() {
    return { running: this.running };
  }

  /** Emit a named event to the ServiceManager (forwarded to renderer). */
  _emit(event, data) {
    this.emit('event', event, data);
  }
}

module.exports = BaseService;
