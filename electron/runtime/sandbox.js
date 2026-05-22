'use strict';

/**
 * Sandbox — per-app permission system.
 *
 * Each app declares permissions in its manifest.ts:
 *   permissions: ['camera', 'microphone', 'storage', 'network', 'pos', 'payment']
 *
 * The sandbox enforces these at the IPC layer — if an app tries to call
 * a HAL method it doesn't have permission for, the call is rejected.
 *
 * Permission levels:
 *   'granted'  — always allowed
 *   'ask'      — prompt user on first use
 *   'denied'   — always blocked
 */
class Sandbox {
  constructor() {
    // appId → Set<permission>
    this._grants = new Map();
    // Default permissions all apps get without asking
    this._defaults = new Set(['storage:read', 'storage:write', 'network:read']);
  }

  // ── Permission management ─────────────────────────────────────────────────

  grant(appId, permission) {
    if (!this._grants.has(appId)) this._grants.set(appId, new Set(this._defaults));
    this._grants.get(appId).add(permission);
  }

  revoke(appId, permission) {
    this._grants.get(appId)?.delete(permission);
  }

  has(appId, permission) {
    if (!this._grants.has(appId)) {
      // First access — grant defaults
      this._grants.set(appId, new Set(this._defaults));
    }
    return this._grants.get(appId).has(permission);
  }

  // ── IPC guard ─────────────────────────────────────────────────────────────

  /**
   * Wraps an IPC handler with a permission check.
   * Usage: sandbox.guard('camera:read', handler)
   */
  guard(permission, handler) {
    return async (event, ...args) => {
      // Extract appId from the sender URL or a passed header
      const appId = this._getAppId(event);
      if (!this.has(appId, permission)) {
        throw new Error(`Permission denied: ${permission} for app ${appId}`);
      }
      return handler(event, ...args);
    };
  }

  _getAppId(event) {
    // In production, derive from the app's registered ID
    // For now, use the sender frame URL as a proxy
    try {
      const url = event.senderFrame?.url || '';
      const match = url.match(/app[=/]([a-z0-9-]+)/i);
      return match ? match[1] : 'unknown';
    } catch {
      return 'unknown';
    }
  }

  // ── Bulk grant from manifest ──────────────────────────────────────────────

  applyManifest(appId, permissions = []) {
    for (const perm of permissions) {
      this.grant(appId, perm);
    }
  }

  getGrants(appId) {
    return [...(this._grants.get(appId) || this._defaults)];
  }
}

module.exports = Sandbox;
