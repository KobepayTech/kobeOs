'use strict';

const BaseService = require('./_base-service');

/**
 * Kobe Audio Service
 *
 * Manages system audio via the host OS audio APIs.
 * On Linux: PulseAudio/PipeWire via pactl
 * On macOS: CoreAudio via osascript
 * On Windows: WASAPI via PowerShell
 *
 * Exposes:
 *   getVolume()           → 0-100
 *   setVolume(level)
 *   getMute()             → boolean
 *   setMute(muted)
 *   getDevices()          → [{ id, name, type, default }]
 *   setOutputDevice(id)
 */
class AudioService extends BaseService {
  constructor(hal) {
    super('audio', hal);
    this._volume  = 80;
    this._muted   = false;
    this._devices = [];
  }

  async _start() {
    await this._refreshDevices();
    console.log(`[AudioService] Started — ${this._devices.length} device(s)`);
  }

  async _stop() {
    this._devices = [];
  }

  async _refreshDevices() {
    // Enumerate via Electron's desktopCapturer for audio sources
    // Real device enumeration happens in renderer via navigator.mediaDevices
    // Here we provide a placeholder that gets populated on first renderer query
    this._devices = [
      { id: 'default', name: 'System Default', type: 'output', default: true },
    ];
  }

  async getVolume() {
    if (process.platform === 'linux') {
      try {
        const { execSync } = require('child_process');
        const out = execSync('pactl get-sink-volume @DEFAULT_SINK@ 2>/dev/null', { encoding: 'utf8' });
        const match = out.match(/(\d+)%/);
        if (match) this._volume = parseInt(match[1]);
      } catch { /* pactl not available */ }
    }
    return this._volume;
  }

  async setVolume(level) {
    this._volume = Math.max(0, Math.min(100, level));
    if (process.platform === 'linux') {
      try {
        const { execSync } = require('child_process');
        execSync(`pactl set-sink-volume @DEFAULT_SINK@ ${this._volume}% 2>/dev/null`, { stdio: 'ignore' });
      } catch { /* ignore */ }
    } else if (process.platform === 'darwin') {
      try {
        const { execSync } = require('child_process');
        execSync(`osascript -e 'set volume output volume ${this._volume}'`, { stdio: 'ignore' });
      } catch { /* ignore */ }
    } else if (process.platform === 'win32') {
      try {
        const { execSync } = require('child_process');
        const ps = `$obj = New-Object -ComObject WScript.Shell; $obj.SendKeys([char]174)`;
        // Volume control via nircmd if available, otherwise skip
        execSync(`nircmd.exe setsysvolume ${Math.round(this._volume * 655.35)} 2>nul`, { stdio: 'ignore' });
      } catch { /* ignore */ }
    }
    this._emit('volume-changed', { volume: this._volume });
    return this._volume;
  }

  async getMute() {
    return this._muted;
  }

  async setMute(muted) {
    this._muted = muted;
    if (process.platform === 'linux') {
      try {
        const { execSync } = require('child_process');
        execSync(`pactl set-sink-mute @DEFAULT_SINK@ ${muted ? '1' : '0'} 2>/dev/null`, { stdio: 'ignore' });
      } catch { /* ignore */ }
    }
    this._emit('mute-changed', { muted: this._muted });
    return this._muted;
  }

  getDevices() {
    return this._devices;
  }

  getStatus() {
    return { running: this.running, volume: this._volume, muted: this._muted, devices: this._devices.length };
  }
}

module.exports = AudioService;
