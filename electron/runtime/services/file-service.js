'use strict';

const BaseService = require('./_base-service');
const path        = require('path');
const fs          = require('fs');
const { app }     = require('electron');

/**
 * Kobe File Service
 *
 * Unified virtual filesystem for all KobeOS apps.
 * Apps never access the host filesystem directly — they go through
 * this service which enforces sandboxing and provides a consistent API.
 *
 * Virtual paths:
 *   /user/documents   → userData/Documents
 *   /user/downloads   → userData/Downloads
 *   /user/pictures    → userData/Pictures
 *   /user/music       → userData/Music
 *   /user/videos      → userData/Videos
 *   /apps/{appId}     → userData/apps/{appId}   (app-private storage)
 *   /shared           → userData/shared          (cross-app shared storage)
 *   /tmp              → userData/tmp             (cleared on restart)
 *
 * Exposes:
 *   read(virtualPath)
 *   write(virtualPath, data)
 *   list(virtualPath)
 *   delete(virtualPath)
 *   exists(virtualPath)
 *   mkdir(virtualPath)
 *   stat(virtualPath)
 */
class FileService extends BaseService {
  constructor(hal) {
    super('file', hal);
    this._root = null;
    this._mounts = {};
  }

  async _start() {
    this._root = app.getPath('userData');
    this._mounts = {
      '/user/documents': path.join(this._root, 'Documents'),
      '/user/downloads': path.join(this._root, 'Downloads'),
      '/user/pictures':  path.join(this._root, 'Pictures'),
      '/user/music':     path.join(this._root, 'Music'),
      '/user/videos':    path.join(this._root, 'Videos'),
      '/shared':         path.join(this._root, 'shared'),
      '/tmp':            path.join(this._root, 'tmp'),
    };

    // Ensure all mount points exist
    for (const dir of Object.values(this._mounts)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Clear /tmp on start
    this._clearTmp();
    console.log(`[FileService] Root: ${this._root}`);
  }

  async _stop() {
    this._clearTmp();
  }

  _clearTmp() {
    const tmp = this._mounts['/tmp'];
    if (tmp && fs.existsSync(tmp)) {
      try {
        fs.rmSync(tmp, { recursive: true, force: true });
        fs.mkdirSync(tmp, { recursive: true });
      } catch { /* ignore */ }
    }
  }

  _resolve(virtualPath, appId) {
    // App-private paths
    if (virtualPath.startsWith('/apps/')) {
      const rel = virtualPath.slice('/apps/'.length);
      const appDir = path.join(this._root, 'apps', rel);
      // Ensure app dir exists
      fs.mkdirSync(path.join(this._root, 'apps', rel.split('/')[0]), { recursive: true });
      return appDir;
    }

    // Check mounts
    for (const [mount, real] of Object.entries(this._mounts)) {
      if (virtualPath === mount || virtualPath.startsWith(mount + '/')) {
        const rel = virtualPath.slice(mount.length);
        const resolved = path.join(real, rel);
        // Security: prevent path traversal
        if (!resolved.startsWith(real)) throw new Error('Path traversal denied');
        return resolved;
      }
    }

    throw new Error(`Unknown virtual path: ${virtualPath}`);
  }

  read(virtualPath, appId, encoding = 'utf8') {
    const real = this._resolve(virtualPath, appId);
    return fs.readFileSync(real, encoding);
  }

  write(virtualPath, appId, data) {
    const real = this._resolve(virtualPath, appId);
    fs.mkdirSync(path.dirname(real), { recursive: true });
    fs.writeFileSync(real, data);
  }

  list(virtualPath, appId) {
    const real = this._resolve(virtualPath, appId);
    if (!fs.existsSync(real)) return [];
    return fs.readdirSync(real).map(name => {
      const stat = fs.statSync(path.join(real, name));
      return { name, type: stat.isDirectory() ? 'dir' : 'file', size: stat.size, mtime: stat.mtime };
    });
  }

  delete(virtualPath, appId) {
    const real = this._resolve(virtualPath, appId);
    fs.rmSync(real, { recursive: true, force: true });
  }

  exists(virtualPath, appId) {
    try { return fs.existsSync(this._resolve(virtualPath, appId)); } catch { return false; }
  }

  mkdir(virtualPath, appId) {
    const real = this._resolve(virtualPath, appId);
    fs.mkdirSync(real, { recursive: true });
  }

  stat(virtualPath, appId) {
    const real = this._resolve(virtualPath, appId);
    const s = fs.statSync(real);
    return { size: s.size, mtime: s.mtime, isDir: s.isDirectory() };
  }

  getMounts() { return Object.keys(this._mounts); }

  getStatus() {
    return { running: this.running, root: this._root, mounts: Object.keys(this._mounts).length };
  }
}

module.exports = FileService;
