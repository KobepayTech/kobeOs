import { BadRequestException, ConflictException, Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import ffmpegPath from 'ffmpeg-static';
import { LiveSaleService } from './live-sale.service';
import { AuditService } from '../audit/audit.service';

export function broadcastTarget(platform: string, serverUrl: string, streamKey: string): string {
  let url: URL;
  try { url = new URL(serverUrl); } catch { throw new BadRequestException('Enter the stream URL supplied by the platform.'); }
  const domains = platform === 'instagram' ? ['instagram.com', 'cdninstagram.com', 'facebook.com']
    : platform === 'tiktok' ? ['tiktok.com', 'tiktokv.com', 'tiktokcdn.com'] : [];
  if (!['rtmp:', 'rtmps:'].includes(url.protocol) || !domains.some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`)) ||
      url.username || url.password || url.search || url.hash || (url.port && !['443', '1935'].includes(url.port))) {
    throw new BadRequestException('Use an Instagram or TikTok RTMP/RTMPS server URL without credentials or query parameters.');
  }
  // Keys can contain signed query parameters. Never log, persist or return them.
  if (!streamKey || streamKey.length > 2048 || /[\s#]/.test(streamKey) || [...streamKey].some(char => char.charCodeAt(0) < 32) || streamKey.startsWith('/') || streamKey.includes('://')) {
    throw new BadRequestException('Enter a valid stream key from the platform.');
  }
  return `${url.toString().replace(/\/$/, '')}/${streamKey}`;
}

type Broadcast = { ownerId: string; process: ChildProcessWithoutNullStreams; sequence: number; touched: number; sending: boolean; writing: boolean };

@Injectable()
export class BroadcastService implements OnModuleDestroy {
  private readonly broadcasts = new Map<string, Broadcast>();
  private readonly pending = new Map<string, string>();
  private readonly timer = setInterval(() => {
    for (const [id, item] of this.broadcasts) if (Date.now() - item.touched > 30_000) this.close(id);
  }, 5_000).unref();
  constructor(private readonly sales: LiveSaleService, private readonly audit: AuditService) {}

  private binary(): string | null {
    if (process.env.FFMPEG_BIN) return process.env.FFMPEG_BIN;
    try {
      // Optional platform binary supplied at installation; missing binary is
      // reported before camera access instead of crashing the whole API.
      const binary = ffmpegPath;
      return binary && existsSync(binary) ? binary : null;
    } catch { return null; }
  }
  async status(uid: string, id: string) {
    await this.sales.getSession(uid, id);
    const item = this.broadcasts.get(id);
    return { available: !!this.binary(), status: item ? (item.sending ? 'sending' : 'starting') : 'stopped',
      detail: item ? 'Sending video to the platform. Confirm Go Live in its live producer.' : 'Camera broadcaster stopped.' };
  }
  async start(uid: string, id: string, serverUrl: string, key: string) {
    const session = await this.sales.getSession(uid, id);
    if (session.status !== 'LIVE' || session.kind === 'post') throw new BadRequestException('Open a live-selling session first.');
    const target = broadcastTarget(session.platform, serverUrl, key);
    if (this.broadcasts.has(id) || this.pending.has(id)) throw new ConflictException('This session is already broadcasting.');
    const configured = Number(process.env.LIVE_BROADCAST_MAX || 2);
    const max = Number.isInteger(configured) && configured > 0 ? Math.min(configured, 20) : 2;
    if (this.broadcasts.size + this.pending.size >= max || [...this.pending.values()].includes(uid) || [...this.broadcasts.values()].some(item => item.ownerId === uid)) {
      throw new ServiceUnavailableException('Broadcast capacity reached. Stop another camera broadcast first.');
    }
    const binary = this.binary();
    if (!binary) throw new ServiceUnavailableException('Camera broadcasting needs FFmpeg on this server. Phone live selling is still available.');
    this.pending.set(id, uid);
    try {
      await this.audit.log({ action: 'CREATE', entityType: 'live_broadcast', entityId: id, userId: uid, metadata: { platform: session.platform } });
      const child = spawn(binary, ['-hide_banner', '-loglevel', 'error', '-nostats', '-progress', 'pipe:1',
        '-protocol_whitelist', 'pipe', '-f', 'webm', '-i', 'pipe:0',
        '-threads', '2', '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency', '-pix_fmt', 'yuv420p',
        '-r', '30', '-g', '60', '-b:v', '2500k', '-maxrate', '3000k', '-bufsize', '5000k',
        '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-f', 'flv', target], { windowsHide: true, shell: false });
      const item: Broadcast = { ownerId: uid, process: child, sequence: 0, touched: Date.now(), sending: false, writing: false };
      this.broadcasts.set(id, item);
      // FFmpeg errors can contain the secret destination: consume, never log.
      child.stderr.resume();
      child.stdout.on('data', () => { item.sending = true; });
      child.stdin.on('error', () => this.close(id));
      child.once('close', () => { if (this.broadcasts.get(id) === item) this.broadcasts.delete(id); });
      await new Promise<void>((resolve, reject) => {
        child.once('spawn', resolve);
        child.once('error', () => { this.close(id); reject(new ServiceUnavailableException('Camera encoder could not start. Contact support.')); });
      });
      return { status: 'starting' };
    } finally { this.pending.delete(id); }
  }
  async chunk(uid: string, id: string, sequence: number, data: string) {
    const item = this.broadcasts.get(id);
    if (!item || item.ownerId !== uid) throw new BadRequestException('Camera broadcast is not running. Start it again.');
    if (sequence !== item.sequence || item.writing) throw new ConflictException('Video chunks arrived out of order. Restart the camera broadcast.');
    if (!data || data.length > 1_400_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw new BadRequestException('Invalid video chunk.');
    item.writing = true;
    item.touched = Date.now();
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => { this.close(id); reject(new ServiceUnavailableException('Broadcast connection stalled.')); }, 10_000);
        item.process.stdin.write(Buffer.from(data, 'base64'), error => {
          clearTimeout(timer);
          if (error) reject(new ServiceUnavailableException('Platform disconnected. Start the broadcast again.'));
          else resolve();
        });
      });
      item.sequence++;
      return { sequence: item.sequence };
    } finally { item.writing = false; }
  }
  async stop(uid: string, id: string) {
    await this.sales.getSession(uid, id);
    const existed = this.broadcasts.has(id);
    this.close(id);
    if (existed) await this.audit.log({ action: 'UPDATE', entityType: 'live_broadcast', entityId: id, userId: uid, metadata: { status: 'stopped' } });
    return { status: 'stopped' };
  }
  private close(id: string) {
    const item = this.broadcasts.get(id);
    this.broadcasts.delete(id);
    if (item) { item.process.stdin.destroy(); item.process.kill('SIGKILL'); }
  }
  onModuleDestroy() { clearInterval(this.timer); for (const id of this.broadcasts.keys()) this.close(id); }
}
