import { Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit,
  WebSocketGateway, WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { PosOrder, PosOrderItem } from './pos.entity';
import { buildOriginPredicate } from '../common/cors';

interface JwtPayload { sub: string; email: string; }

/**
 * Real-time channel for the in-store "Kitchen Display System" TV and
 * the mobile-app order-prepare flow. Every event is scoped to the
 * owner's room so one tenant's TV never sees another's orders.
 *
 * Events emitted (server → client):
 *   kds:order:created   — new order just placed at the till
 *   kds:order:status    — fulfillmentStatus changed (NEW → PREPARING →
 *                          READY → COLLECTED). The card moves columns
 *                          on the TV; the row drops off the mobile
 *                          "to prepare" list.
 */
export type KdsEventKind = 'created' | 'status';

export interface KdsOrderPayload {
  kind: KdsEventKind;
  order: PosOrder;
  items: PosOrderItem[];
  previousFulfillmentStatus?: PosOrder['fulfillmentStatus'];
}

@WebSocketGateway({
  namespace: '/pos',
  cors: { origin: buildOriginPredicate().predicate, credentials: true },
})
export class PosGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger('PosGateway');

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  afterInit() {
    this.logger.log('POS WebSocket gateway ready on /pos');
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
      client.emit('pos:error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    if (client.data?.email) this.logger.log(`- ${client.data.email}`);
  }

  emitOrder(
    ownerId: string,
    order: PosOrder,
    items: PosOrderItem[],
    kind: KdsEventKind,
    previousFulfillmentStatus?: PosOrder['fulfillmentStatus'],
  ) {
    const payload: KdsOrderPayload = { kind, order, items, previousFulfillmentStatus };
    this.server.to(`owner:${ownerId}`).emit('kds:order', payload);
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
