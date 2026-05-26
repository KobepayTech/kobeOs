import { Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit,
  WebSocketGateway, WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { HotelOrder, HotelServiceRequest } from './hotel.entity';

interface JwtPayload { sub: string; email: string; }

export type HotelEventKind = 'created' | 'status';

@WebSocketGateway({
  namespace: '/hotel',
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
export class HotelGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger('HotelGateway');

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  afterInit() {
    this.logger.log('Hotel WebSocket gateway ready on /hotel');
  }

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      const secret = this.config.getOrThrow<string>('JWT_SECRET');
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, { secret });
      client.data.userId = payload.sub;
      client.data.email = payload.email;
      client.join(`owner:${payload.sub}`);
      this.logger.log(`+ ${payload.email} (${client.id})`);
    } catch (err) {
      this.logger.warn(`refusing connection ${client.id}: ${(err as Error).message}`);
      client.emit('hotel:error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    if (client.data?.email) this.logger.log(`- ${client.data.email}`);
  }

  emitOrder(ownerId: string, order: HotelOrder, kind: HotelEventKind, previousStatus?: string) {
    this.server.to(`owner:${ownerId}`).emit('hotel:order', { kind, order, previousStatus });
  }

  emitServiceRequest(
    ownerId: string,
    request: HotelServiceRequest,
    kind: HotelEventKind,
    previousStatus?: string,
  ) {
    this.server.to(`owner:${ownerId}`).emit('hotel:service-request', { kind, request, previousStatus });
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
