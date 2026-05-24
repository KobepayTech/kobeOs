'use strict';

const { SerialPort } = (() => { try { return require('serialport'); } catch { return {}; } })();

/**
 * Kobe POS Driver
 *
 * User-space driver for Point-of-Sale peripherals:
 *   - Receipt printers (ESC/POS over USB serial or network)
 *   - Barcode scanners (HID keyboard emulation or serial)
 *   - Cash drawers (triggered via printer kick command)
 *   - Customer displays (VFD/LCD over serial)
 *
 * ESC/POS command set is used for all receipt printers.
 * Barcode scanners in HID mode are handled transparently by the OS
 * and appear as keyboard input — no driver needed for those.
 */
class POSDriver {
  constructor() {
    this.type    = 'pos';
    this.version = '1.0.0';
    this._printers = new Map();  // portPath → SerialPort instance
    this._scanners = new Map();  // deviceId → scanner info
  }

  get name() { return 'KobePOSDriver'; }

  // ── Printer ─────────────────────────────────────────────────────────────

  async connectPrinter(portPath, baudRate = 9600) {
    if (!SerialPort) throw new Error('serialport module not installed');
    if (this._printers.has(portPath)) return { status: 'already-connected', portPath };

    return new Promise((resolve, reject) => {
      const port = new SerialPort({ path: portPath, baudRate }, err => {
        if (err) return reject(err);
        this._printers.set(portPath, port);
        resolve({ status: 'connected', portPath });
      });
    });
  }

  async disconnectPrinter(portPath) {
    const port = this._printers.get(portPath);
    if (!port) return;
    await new Promise(r => port.close(r));
    this._printers.delete(portPath);
  }

  /**
   * Print a receipt using ESC/POS commands.
   * @param {string} portPath - Serial port path
   * @param {Buffer|string} data - Raw ESC/POS bytes or plain text
   */
  async print(portPath, data) {
    const port = this._printers.get(portPath);
    if (!port) throw new Error(`Printer not connected: ${portPath}`);

    const buf = Buffer.isBuffer(data) ? data : this._textToEscPos(data);
    return new Promise((resolve, reject) => {
      port.write(buf, err => err ? reject(err) : resolve({ status: 'printed', bytes: buf.length }));
    });
  }

  /**
   * Open cash drawer (ESC/POS kick command on pin 2).
   */
  async openCashDrawer(portPath) {
    const kickCmd = Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA]); // ESC p 0 25 250
    return this.print(portPath, kickCmd);
  }

  /**
   * Convert plain text to minimal ESC/POS byte sequence.
   */
  _textToEscPos(text) {
    const init  = Buffer.from([0x1B, 0x40]);          // ESC @ — initialize
    const feed  = Buffer.from([0x0A, 0x0A, 0x0A]);    // 3× line feed
    const cut   = Buffer.from([0x1D, 0x56, 0x41, 0x10]); // GS V A — partial cut
    const body  = Buffer.from(text, 'utf8');
    return Buffer.concat([init, body, feed, cut]);
  }

  // ── Scanner ─────────────────────────────────────────────────────────────

  /**
   * Register a barcode scanner (serial mode).
   * HID scanners don't need registration — they emit keyboard events.
   */
  registerScanner(deviceId, portPath, baudRate = 9600) {
    this._scanners.set(deviceId, { deviceId, portPath, baudRate });
    return { status: 'registered', deviceId };
  }

  listPrinters() {
    return [...this._printers.keys()].map(p => ({ portPath: p, connected: true }));
  }

  listScanners() {
    return [...this._scanners.values()];
  }

  send(deviceId, command, data) {
    switch (command) {
      case 'connectPrinter':    return this.connectPrinter(data?.portPath, data?.baudRate);
      case 'disconnectPrinter': return this.disconnectPrinter(data?.portPath);
      case 'print':             return this.print(data?.portPath, data?.data);
      case 'openCashDrawer':    return this.openCashDrawer(data?.portPath);
      case 'registerScanner':   return this.registerScanner(deviceId, data?.portPath, data?.baudRate);
      case 'listPrinters':      return this.listPrinters();
      case 'listScanners':      return this.listScanners();
      default: throw new Error(`Unknown POS command: ${command}`);
    }
  }

  getStatus() {
    return {
      type:     this.type,
      printers: this._printers.size,
      scanners: this._scanners.size,
    };
  }
}

module.exports = POSDriver;
