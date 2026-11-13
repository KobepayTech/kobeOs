import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { IsEmail, IsString, Matches, MaxLength } from 'class-validator';
import { DataSource, MoreThanOrEqual } from 'typeorm';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CommerceBusiness, MerchantOrder } from '../commerce/commerce.entity';
import { DeliveryPointDto } from '../common/delivery-point.dto';
import { RetailMember } from '../erp/retail-member.entity';
import { StoreSettings } from '../store-settings/store-settings.entity';
import { User } from '../users/user.entity';
import { BodaRider } from './boda-rider.entity';

const LOCATION_VALID_MS = 5 * 60_000;
const SEARCH_RADIUS_KM = 10;

class RegisterRiderDto {
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @Matches(/\S/) @MaxLength(120) name!: string;
  @IsString() @Matches(/^(?:\+255|0)[67]\d{8}$/) phone!: string;
}

export function riderDistanceKm(from: DeliveryPointDto, to: DeliveryPointDto) {
  const radians = Math.PI / 180;
  const latitude = (to.latitude - from.latitude) * radians;
  const longitude = (to.longitude - from.longitude) * radians;
  const a = Math.sin(latitude / 2) ** 2
    + Math.cos(from.latitude * radians) * Math.cos(to.latitude * radians) * Math.sin(longitude / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}

@Controller('erp-delivery/:slug/riders')
@UseGuards(JwtAuthGuard)
export class BodaRiderController {
  constructor(private readonly db: DataSource) {}

  private get riders() { return this.db.getRepository(BodaRider); }

  private async shop(actor: AuthUser, slug: string) {
    if (!actor.id || !['user', 'admin'].includes(actor.role ?? '')) throw new ForbiddenException();
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)) throw new NotFoundException('Shop not found.');
    const shops = await this.db.getRepository(StoreSettings).find({ where: { domainSlug: slug }, take: 2 });
    if (shops.length !== 1) throw new NotFoundException('Shop not found.');
    return shops[0];
  }

  private async ownedShop(actor: AuthUser, slug: string) {
    const shop = await this.shop(actor, slug);
    if (shop.ownerId !== actor.id) throw new ForbiddenException('Only the shop owner can manage registered riders.');
    return shop;
  }

  @Get()
  async roster(@CurrentUser() actor: AuthUser, @Param('slug') slug: string) {
    const shop = await this.ownedShop(actor, slug);
    return this.riders.find({ where: { shopId: shop.id }, select: ['id', 'name', 'phone'], order: { name: 'ASC' } });
  }

  @Post()
  async register(@CurrentUser() actor: AuthUser, @Param('slug') slug: string, @Body() dto: RegisterRiderDto) {
    const shop = await this.ownedShop(actor, slug);
    const user = await this.db.getRepository(User).findOneBy({ email: dto.email.trim().toLowerCase() });
    if (!user || !['user', 'admin'].includes(user.role)) throw new NotFoundException('Ask the rider to create a KobeOS account first.');
    const phone = dto.phone.startsWith('0') ? `+255${dto.phone.slice(1)}` : dto.phone;
    await this.riders.upsert({ shopId: shop.id, userId: user.id, name: dto.name.trim(), phone }, ['shopId', 'userId']);
    return { registered: true };
  }

  @Delete(':id')
  async remove(@CurrentUser() actor: AuthUser, @Param('slug') slug: string, @Param('id', ParseUUIDPipe) id: string) {
    const shop = await this.ownedShop(actor, slug);
    await this.riders.delete({ id, shopId: shop.id });
    return { removed: true };
  }

  @Get('me')
  async current(@CurrentUser() actor: AuthUser, @Param('slug') slug: string) {
    const shop = await this.shop(actor, slug);
    const rider = await this.riders.findOneBy({ shopId: shop.id, userId: actor.id });
    if (!rider) throw new ForbiddenException('Ask the shop owner to register your KobeOS account as a rider.');
    return { name: rider.name, availableUntil: rider.locationAt ? new Date(rider.locationAt.getTime() + LOCATION_VALID_MS) : null };
  }

  @Put('me/location')
  async publish(@CurrentUser() actor: AuthUser, @Param('slug') slug: string, @Body() point: DeliveryPointDto) {
    const shop = await this.shop(actor, slug);
    if (point.latitude === undefined || point.longitude === undefined) throw new BadRequestException('A location is required.');
    const locationAt = new Date();
    const result = await this.riders.update({ shopId: shop.id, userId: actor.id }, { ...point, locationAt });
    if (!result.affected) throw new ForbiddenException('Your rider account is not registered with this shop.');
    return { availableUntil: new Date(locationAt.getTime() + LOCATION_VALID_MS) };
  }

  @Delete('me/location')
  async clear(@CurrentUser() actor: AuthUser, @Param('slug') slug: string) {
    const shop = await this.shop(actor, slug);
    await this.riders.update({ shopId: shop.id, userId: actor.id }, { latitude: null, longitude: null, locationAt: null });
    return { availableUntil: null };
  }

  private async dispatchShop(actor: AuthUser, slug: string) {
    const shop = await this.shop(actor, slug);
    if (shop.ownerId !== actor.id) {
      const member = await this.db.getRepository(RetailMember).findOneBy({ shopId: shop.id, userId: actor.id });
      if (!member || !['manager', 'staff'].includes(member.role)) throw new ForbiddenException('Your account has no dispatch access for this shop.');
    }
    return shop;
  }

  @Get('jumla-orders')
  async jumlaOrders(@CurrentUser() actor: AuthUser, @Param('slug') slug: string) {
    const shop = await this.dispatchShop(actor, slug);
    // Prefer the shop slug; an owner can operate multiple commerce businesses.
    const businesses = this.db.getRepository(CommerceBusiness);
    const bySlug = await businesses.findOneBy({ publicSlug: slug, ownerUserId: shop.ownerId });
    const owned = bySlug ? [bySlug] : await businesses.find({ where: { ownerUserId: shop.ownerId }, take: 2 });
    if (owned.length !== 1) return [];
    return this.db.getRepository(MerchantOrder).find({
      where: { businessId: owned[0].id, channel: 'jumla', merchantLocked: false, fulfillment: 'DELIVERY', status: 'READY' },
      select: ['id', 'orderNumber', 'deliveryAddress', 'deliveryPoint'],
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  @Post('nearby')
  async nearby(@CurrentUser() actor: AuthUser, @Param('slug') slug: string, @Body() pickup: DeliveryPointDto) {
    const shop = await this.dispatchShop(actor, slug);
    const rows = await this.riders.find({
      where: { shopId: shop.id, locationAt: MoreThanOrEqual(new Date(Date.now() - LOCATION_VALID_MS)) },
      select: ['id', 'name', 'phone', 'latitude', 'longitude'],
    });
    return rows.flatMap(({ id, name, phone, latitude, longitude }) =>
      latitude === null || longitude === null ? [] : [{ id, name, phone, distanceKm: riderDistanceKm(pickup, { latitude, longitude }) }],
    ).filter(rider => rider.distanceKm <= SEARCH_RADIUS_KM)
      .sort((a, b) => a.distanceKm - b.distanceKm || a.id.localeCompare(b.id))
      .slice(0, 10)
      .map(rider => ({ ...rider, distanceKm: Math.round(rider.distanceKm * 10) / 10 }));
  }
}
