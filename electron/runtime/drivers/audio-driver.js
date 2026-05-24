'use strict';

const { execSync } = require('child_process');

/**
 * Kobe Audio Driver
 *
 * User-space driver for audio I/O.
 * Wraps platform audio commands (pactl on Linux, osascript on macOS,
 * nircmd on Windows) to control volume, mute, and device selection.
 *
 * The AudioService delegates hardware calls here; apps never call
 * platform commands directly.
 */
class AudioDriver {
  constructor() {
    this.type    = 'audio';
    this.version = '1.0.0';
    this._platform = process.platform;
  }

  get name() { return 'KobeAudioDriver'; }

  // ── Volume ──────────────────────────────────────────────────────────────

  getVolume() {
    try {
      if (this._platform === 'linux') {
        const out = execSync('pactl get-sink-volume @DEFAULT_SINK@', { encoding: 'utf8' });
        const m = out.match(/(\d+)%/);
        return m ? parseInt(m[1], 10) : 50;
      }
      if (this._platform === 'darwin') {
        const out = execSync('osascript -e "output volume of (get volume settings)"', { encoding: 'utf8' });
        return parseInt(out.trim(), 10);
      }
      if (this._platform === 'win32') {
        // nircmd is optional; fall back to 50
        const out = execSync('nircmd.exe getdefaultsounddevice', { encoding: 'utf8' }).trim();
        return 50; // nircmd doesn't expose volume easily; use Web Audio API in renderer
      }
    } catch { /* ignore */ }
    return 50;
  }

  setVolume(level) {
    const v = Math.max(0, Math.min(100, level));
    try {
      if (this._platform === 'linux')  execSync(`pactl set-sink-volume @DEFAULT_SINK@ ${v}%`);
      if (this._platform === 'darwin') execSync(`osascript -e "set volume output volume ${v}"`);
      if (this._platform === 'win32')  execSync(`nircmd.exe setsysvolume ${Math.round(v * 655.35)}`);
    } catch { /* ignore */ }
    return v;
  }

  // ── Mute ────────────────────────────────────────────────────────────────

  getMute() {
    try {
      if (this._platform === 'linux') {
        const out = execSync('pactl get-sink-mute @DEFAULT_SINK@', { encoding: 'utf8' });
        return out.includes('yes');
      }
      if (this._platform === 'darwin') {
        const out = execSync('osascript -e "output muted of (get volume settings)"', { encoding: 'utf8' });
        return out.trim() === 'true';
      }
    } catch { /* ignore */ }
    return false;
  }

  setMute(muted) {
    try {
      if (this._platform === 'linux')  execSync(`pactl set-sink-mute @DEFAULT_SINK@ ${muted ? '1' : '0'}`);
      if (this._platform === 'darwin') execSync(`osascript -e "set volume ${muted ? 'with' : 'without'} output muted"`);
      if (this._platform === 'win32')  execSync(`nircmd.exe mutesysvolume ${muted ? '1' : '0'}`);
    } catch { /* ignore */ }
    return muted;
  }

  // ── Devices ─────────────────────────────────────────────────────────────

  listDevices() {
    try {
      if (this._platform === 'linux') {
        const out = execSync('pactl list short sinks', { encoding: 'utf8' });
        return out.trim().split('\n').filter(Boolean).map(line => {
          const parts = line.split('\t');
          return { id: parts[0], name: parts[1] || 'Unknown', type: 'output' };
        });
      }
    } catch { /* ignore */ }
    return [];
  }

  send(deviceId, command, data) {
    switch (command) {
      case 'getVolume':  return this.getVolume();
      case 'setVolume':  return this.setVolume(data?.level);
      case 'getMute':    return this.getMute();
      case 'setMute':    return this.setMute(data?.muted);
      case 'listDevices': return this.listDevices();
      default: throw new Error(`Unknown audio command: ${command}`);
    }
  }

  getStatus() {
    return {
      type:     this.type,
      platform: this._platform,
      volume:   this.getVolume(),
      muted:    this.getMute(),
    };
  }
}

module.exports = AudioDriver;
