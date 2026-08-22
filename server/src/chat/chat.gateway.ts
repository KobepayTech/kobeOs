import { Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit,
  SubscribeMessage, WebSocketGateway, WebSocketServer,
  MessageBody, ConnectedSocket,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { ChatMessage } from './chat.entity';

interface JwtPayload { sub: string; email: string; }
interface RtcSignalBody { roomId: string; to: string; description?: unknown; candidate?: unknown; }
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 10_000;
const safeRoomId = (value: string) => value.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: (requestOrigin: string | undefined, callback: (err: Error | null, allow: boolean) => void) => {
      const allowed = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((v) => v.trim()).filter(Boolean);
      const baseDomain = (process.env.TENANT_BASE_DOMAIN || process.env.CF_DOMAIN || '').trim().toLowerCase();
      let ok = !requestOrigin || allowed.includes(requestOrigin);
      if (!ok && baseDomain && requestOrigin) {
        try {
          const host = new URL(requestOrigin).hostname.toLowerCase();
          ok = host === baseDomain || host.endsWith(`.${baseDomain}`);
        } catch { ok = false; }
      }
      callback(ok ? null : new Error('Not allowed by CORS'), ok);
    },
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger('ChatGateway');
  private readonly rateLimits = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly jwt: JwtService, private readonly config: ConfigService) {}

  afterInit() { this.logger.log('Chat/WebRTC gateway ready on /chat'); }

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      const secret = this.config.getOrThrow<string>('JWT_SECRET');
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, { secret });
      client.data.userId = payload.sub;
      client.data.email = payload.email;
      this.logger.log(`+ ${payload.email} (${client.id})`);
    } catch (err) {
      this.logger.warn(`refusing connection ${client.id}: ${(err as Error).message}`);
      client.emit('chat:error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    if (client.data?.email) this.logger.log(`- ${client.data.email}`);
    for (const room of client.rooms) {
      if (room.startsWith('rtc:')) this.server.to(room).emit('rtc:peer-left', { peerId: client.id, roomId: room.slice(4) });
    }
    this.rateLimits.delete(client.id);
  }

  @SubscribeMessage('chat:join')
  onJoin(@ConnectedSocket() client: Socket, @MessageBody() body: { channelId: string }) {
    if (!body?.channelId) return { ok: false, error: 'channelId required' };
    client.join(`channel:${body.channelId}`);
    return { ok: true };
  }

  @SubscribeMessage('chat:leave')
  onLeave(@ConnectedSocket() client: Socket, @MessageBody() body: { channelId: string }) {
    if (body?.channelId) client.leave(`channel:${body.channelId}`);
    return { ok: true };
  }

  @SubscribeMessage('chat:message')
  onMessage(@ConnectedSocket() client: Socket) {
    if (!this.checkRateLimit(client)) {
      client.emit('chat:error', { message: 'Rate limit exceeded. Slow down.' });
      return { ok: false, error: 'rate_limited' };
    }
    return { ok: true };
  }

  /** Join an authenticated WebRTC signaling room. Existing peers are returned
   * so the joining browser can create offers without any unauthenticated
   * signaling service. Media still travels peer-to-peer via WebRTC. */
  @SubscribeMessage('rtc:join')
  async rtcJoin(@ConnectedSocket() client: Socket, @MessageBody() body: { roomId: string }) {
    const roomId = safeRoomId(body?.roomId || '');
    if (!roomId) return { ok: false, error: 'roomId required' };
    const room = `rtc:${roomId}`;
    const sockets = await this.server.in(room).fetchSockets();
    const peers = sockets.filter((s) => s.id !== client.id).map((s) => ({ peerId: s.id, email: s.data.email || '' }));
    await client.join(room);
    client.to(room).emit('rtc:peer-joined', { peerId: client.id, email: client.data.email || '', roomId });
    return { ok: true, roomId, peerId: client.id, peers };
  }

  @SubscribeMessage('rtc:leave')
  async rtcLeave(@ConnectedSocket() client: Socket, @MessageBody() body: { roomId: string }) {
    const roomId = safeRoomId(body?.roomId || '');
    if (!roomId) return { ok: false, error: 'roomId required' };
    const room = `rtc:${roomId}`;
    await client.leave(room);
    client.to(room).emit('rtc:peer-left', { peerId: client.id, roomId });
    return { ok: true };
  }

  @SubscribeMessage('rtc:offer')
  rtcOffer(@ConnectedSocket() client: Socket, @MessageBody() body: RtcSignalBody) {
    return this.relayRtc(client, 'rtc:offer', body, 'description');
  }

  @SubscribeMessage('rtc:answer')
  rtcAnswer(@ConnectedSocket() client: Socket, @MessageBody() body: RtcSignalBody) {
    return this.relayRtc(client, 'rtc:answer', body, 'description');
  }

  @SubscribeMessage('rtc:ice')
  rtcIce(@ConnectedSocket() client: Socket, @MessageBody() body: RtcSignalBody) {
    return this.relayRtc(client, 'rtc:ice', body, 'candidate');
  }

  broadcastMessage(msg: ChatMessage) {
    this.server.to(`channel:${msg.channelId}`).emit('chat:message', msg);
  }

  private relayRtc(client: Socket, event: 'rtc:offer' | 'rtc:answer' | 'rtc:ice', body: RtcSignalBody, field: 'description' | 'candidate') {
    if (!this.checkRateLimit(client)) return { ok: false, error: 'rate_limited' };
    const roomId = safeRoomId(body?.roomId || '');
    const target = String(body?.to || '').trim();
    if (!roomId || !target || body?.[field] == null) return { ok: false, error: 'invalid_signal' };
    const room = `rtc:${roomId}`;
    if (!client.rooms.has(room)) return { ok: false, error: 'not_in_room' };
    this.server.to(target).emit(event, { roomId, from: client.id, [field]: body[field] });
    return { ok: true };
  }

  private checkRateLimit(client: Socket): boolean {
    const now = Date.now();
    const entry = this.rateLimits.get(client.id);
    if (!entry || now >= entry.resetAt) {
      this.rateLimits.set(client.id, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
      return true;
    }
    entry.count += 1;
    if (entry.count > RATE_LIMIT_MAX) {
      this.logger.warn(`Rate limit hit: ${client.data?.email ?? client.id}`);
      return false;
    }
    return true;
  }

  private extractToken(client: Socket): string {
    const auth = client.handshake.auth?.token as string | undefined;
    if (auth) return auth.startsWith('Bearer ') ? auth.slice(7) : auth;
    const header = client.handshake.headers.authorization;
    if (header && header.startsWith('Bearer ')) return header.slice(7);
    const q = client.handshake.query?.token;
    if (typeof q === 'string') return q;
    throw new UnauthorizedException('Missing token');
  }
}
