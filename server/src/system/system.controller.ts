import { Controller, Get } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Public } from '../common/public.decorator';

/**
 * Public version endpoint used by the OTA-update poll on every running
 * client. We don't ship a separate "release manifest" service — the
 * truth is whatever this process is running, computed once at boot.
 *
 * The client polls every 5 minutes; when `buildHash` changes, the client
 * shows an "Update available — reload to apply" banner. For an Electron
 * wrapper the renderer reload swaps in fresh JS without re-installing
 * the binary. For browser visitors it's a normal hard-reload.
 */

interface VersionInfo {
  version: string;
  /** Stable hash of the frontend bundle — changes on every code deploy. */
  buildHash: string;
  /** ISO timestamp when this process started — lets the client tell if
   *  the backend was redeployed even when the bundle is unchanged. */
  startedAt: string;
  channel: 'stable' | 'beta' | 'dev';
}

let CACHED: VersionInfo | null = null;

function readVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch { return '0.0.0'; }
}

/**
 * Compute a hash from the deployed frontend bundle. Vite emits hashed
 * filenames in dist/assets/ so the contents of dist/index.html change
 * on every code revision — hashing index.html gives us a stable signal
 * with no special build step.
 *
 * Falls back to NODE_ENV + process.uptime() in dev so the endpoint
 * still works before a production build exists.
 */
function readBuildHash(): string {
  const candidates = [
    path.join(process.cwd(), '..', 'dist', 'index.html'),       // monorepo: server/cwd → ../dist
    path.join(process.cwd(), 'dist', 'index.html'),             // single-repo build
    path.join(process.cwd(), '..', 'dist2', 'index.html'),      // legacy build dir
  ];
  for (const file of candidates) {
    try {
      const buf = fs.readFileSync(file);
      // FNV-1a 32-bit — small, no crypto import, good enough for "did anything change?"
      let h = 0x811c9dc5;
      for (let i = 0; i < buf.length; i++) {
        h ^= buf[i];
        h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
      }
      return h.toString(16).padStart(8, '0');
    } catch { /* try next candidate */ }
  }
  // Dev fallback — server uptime moves so HMR still picks up changes.
  return `dev-${Math.floor(Date.now() / 60_000).toString(16)}`;
}

@Controller('system')
export class SystemController {
  @Public()
  @Get('version')
  version(): VersionInfo {
    if (!CACHED) {
      CACHED = {
        version: readVersion(),
        buildHash: readBuildHash(),
        startedAt: new Date().toISOString(),
        channel: (process.env.KOBEOS_CHANNEL as VersionInfo['channel']) ?? 'stable',
      };
    }
    return CACHED;
  }
}
