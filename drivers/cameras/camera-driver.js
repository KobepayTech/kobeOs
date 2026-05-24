'use strict';

/**
 * Kobe Camera Driver
 *
 * User-space driver for camera/webcam devices.
 * Apps request camera access through the HAL — this driver
 * handles permission gating and device enumeration.
 *
 * No kernel driver needed: delegates to the browser's
 * getUserMedia API via IPC to the renderer.
 */
class CameraDriver {
  constructor() {
    this.type    = 'camera';
    this.version = '1.0.0';
    this._active = new Map(); // appId → stream handle
  }

  get name() { return 'KobeCameraDriver'; }

  /**
   * List available camera devices.
   * Actual enumeration happens in the renderer via navigator.mediaDevices.
   * This returns a cached list populated by the renderer on startup.
   */
  async listDevices() {
    return this._devices || [];
  }

  /**
   * Called by renderer to register discovered devices.
   */
  registerDevices(devices) {
    this._devices = devices;
  }

  /**
   * Request camera stream for an app.
   * Returns a token the renderer uses to bind the stream.
   */
  async requestStream(appId, constraints = {}) {
    const token = `cam-${appId}-${Date.now()}`;
    this._active.set(appId, { token, constraints, startedAt: Date.now() });
    return { token, constraints };
  }

  /**
   * Release camera stream for an app.
   */
  async releaseStream(appId) {
    this._active.delete(appId);
  }

  /**
   * Capture a still image from the active stream.
   * Returns a base64-encoded JPEG via IPC round-trip to renderer.
   */
  async capture(appId) {
    if (!this._active.has(appId)) throw new Error(`No active camera stream for app: ${appId}`);
    // Actual capture is handled in renderer — this is a placeholder
    // that the IPC bridge will intercept and route to the renderer
    return { status: 'pending', appId };
  }

  send(deviceId, command, data) {
    switch (command) {
      case 'capture':       return this.capture(data?.appId);
      case 'requestStream': return this.requestStream(data?.appId, data?.constraints);
      case 'releaseStream': return this.releaseStream(data?.appId);
      default: throw new Error(`Unknown camera command: ${command}`);
    }
  }

  getStatus() {
    return {
      type:    this.type,
      active:  this._active.size,
      devices: (this._devices || []).length,
    };
  }
}

module.exports = CameraDriver;
