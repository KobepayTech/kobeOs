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

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: true, credentials: true },
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger('ChatGateway');

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
      const secret = this.config.get<string>('JWT_SECRET', 'change-me');
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

  /** Called by ChatService after a REST POST persists a message. */
  broadcastMessage(msg: ChatMessage) {
    this.server.to(`channel:${msg.channelId}`).emit('chat:message', msg);
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
