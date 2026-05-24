'use strict';

const BaseService = require('./_base-service');
const http        = require('http');
const https       = require('https');

/**
 * Kobe Cloud Service
 *
 * Manages connectivity to the KobeOS backend API and handles:
 *   - Online/offline detection
 *   - Sync queue drain when connectivity returns
 *   - LAN peer discovery (mDNS)
 *   - Cloud backup scheduling
 *
 * Exposes:
 *   isOnline()
 *   getBackendUrl()
 *   ping()                    → latency ms or null
 *   getLANPeers()             → [{ host, port, name }]
 */
class CloudService extends BaseService {
  constructor(hal) {
    super('cloud', hal);
    this._backendUrl  = process.env.BACKEND_URL || 'http://127.0.0.1:3000';
    this._online      = false;
    this._latency     = null;
    this._lanPeers    = [];
    this._pingTimer   = null;
  }

  async _start() {
    this._online = await this._ping();
    // Poll connectivity every 30s
    this._pingTimer = setInterval(async () => {
      const wasOnline = this._online;
      this._online = await this._ping();
      if (!wasOnline && this._online) {
        this._emit('online', { latency: this._latency });
      } else if (wasOnline && !this._online) {
        this._emit('offline', {});
      }
    }, 30_000);
    console.log(`[CloudService] Backend: ${this._backendUrl} — ${this._online ? 'online' : 'offline'}`);
  }

  async _stop() {
    if (this._pingTimer) { clearInterval(this._pingTimer); this._pingTimer = null; }
  }

  async _ping() {
    const start = Date.now();
    return new Promise(resolve => {
      const url = new URL(`${this._backendUrl}/api/health`);
      const mod = url.protocol === 'https:' ? https : http;
      const req = mod.get(url.toString(), { timeout: 3000 }, res => {
        this._latency = Date.now() - start;
        resolve(res.statusCode < 500);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
    });
  }

  isOnline()      { return this._online; }
  getBackendUrl() { return this._backendUrl; }
  getLatency()    { return this._latency; }
  getLANPeers()   { return this._lanPeers; }

  async ping() {
    this._online = await this._ping();
    return this._latency;
  }

  getStatus() {
    return {
      running:    this.running,
      online:     this._online,
      latency:    this._latency,
      backend:    this._backendUrl,
      lanPeers:   this._lanPeers.length,
    };
  }
}

module.exports = CloudService;
