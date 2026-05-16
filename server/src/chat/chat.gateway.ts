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

// Per-socket rate limit: max messages per window.
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 10_000; // 10 seconds

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: (requestOrigin: string | undefined, callback: (err: Error | null, allow: boolean) => void) => {
      const allowed = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');
      if (!requestOrigin || allowed.includes(requestOrigin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger('ChatGateway');

  // socketId → { count, resetAt }
  private readonly rateLimits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  afterInit() {
    this.logger.log('Chat WebSocket gateway ready on /chat');
  }

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
    this.rateLimits.delete(client.id);
  }

  @SubscribeMessage('chat:join')
  onJoin(@ConnectedSocket() client: Socket, @MessageBody() body: { channelId: string }) {
    if (!body?.channelId) return { ok: false, error: 'channelId required' };
    const uid = client.data.userId as string;
    // TODO: replace with actual membership check when ChatMember entity exists
    this.logger.log(`User ${uid} joined channel ${body.channelId}`);
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
    // Message persistence is handled by ChatService via the HTTP endpoint.
    // The gateway only handles real-time broadcast.
    return { ok: true };
  }

  broadcastMessage(msg: ChatMessage) {
    this.server.to(`channel:${msg.channelId}`).emit('chat:message', msg);
  }

  /** Returns false if the socket has exceeded the rate limit window. */
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
