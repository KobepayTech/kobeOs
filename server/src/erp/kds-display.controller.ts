import { createHmac } from 'node:crypto';
import { Controller, Get, Header, Headers, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { Public } from '../common/public.decorator';
import { OrdersService } from '../pos/pos.service';
import { StoreSettings } from '../store-settings/store-settings.entity';
import { RetailMember } from './retail-member.entity';

const audience = 'kobeos-kds-display';
const expiresIn = 12 * 60 * 60;

@Injectable()
export class KdsDisplayTokens {
  constructor(private readonly jwt: JwtService, private readonly config: ConfigService, private readonly db: DataSource) {}

  private get secret() {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET')).update(audience).digest('hex');
  }

  async issue(shop: StoreSettings, userId: string) {
    const token = await this.jwt.signAsync({ shopId: shop.id, ownerId: shop.ownerId }, {
      secret: this.secret, algorithm: 'HS256', audience, subject: userId, expiresIn,
    });
    return { token, expiresIn };
  }

  async ownerFor(authorization?: string) {
    const token = authorization?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token) throw new UnauthorizedException('Pair this display from ERP.');
    let claims: { shopId: string; ownerId: string; sub: string };
    try {
      claims = await this.jwt.verifyAsync(token, { secret: this.secret, algorithms: ['HS256'], audience });
    } catch {
      throw new UnauthorizedException('Display pairing expired. Pair this display again from ERP.');
    }
    const shop = await this.db.getRepository(StoreSettings).findOneBy({ id: claims.shopId, ownerId: claims.ownerId });
    if (shop && claims.sub === shop.ownerId) return shop.ownerId;
    const manager = shop && await this.db.getRepository(RetailMember).findOneBy({
      shopId: shop.id, userId: claims.sub, role: 'manager',
    });
    if (!shop || !manager) throw new UnauthorizedException('Display pairing has been revoked.');
    return shop.ownerId;
  }
}

@Controller('kds-display')
export class KdsDisplayController {
  constructor(private readonly tokens: KdsDisplayTokens, private readonly orders: OrdersService) {}

  @Public()
  @Get('orders')
  @Header('Cache-Control', 'no-store')
  async queue(@Headers('authorization') authorization?: string) {
    return this.orders.listKdsTickets(await this.tokens.ownerFor(authorization));
  }
}
