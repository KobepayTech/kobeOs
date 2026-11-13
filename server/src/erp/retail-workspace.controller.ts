import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { IsBoolean, IsEmail, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { DataSource, In } from 'typeorm';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DiscountApprovalService } from '../discount-approval/discount-approval.service';
import { DiscountRequest } from '../discount-approval/discount-approval.entity';
import { KdsDisplayTokens } from './kds-display.controller';
import { OrdersService } from '../pos/pos.service';
import { PosOrder, PosProduct } from '../pos/pos.entity';
import { StoreRegistration } from '../store-registry/store-registry.entity';
import { StoreSettings } from '../store-settings/store-settings.entity';
import { User } from '../users/user.entity';
import { RETAIL_ROLES, RetailMember, RetailRole } from './retail-member.entity';

class RetailMemberDto {
  @IsEmail() @MaxLength(254) email!: string;
  @IsIn(RETAIL_ROLES) role!: RetailRole;
  @IsOptional() @IsBoolean() canFulfill?: boolean;
}

class RetailDiscountDto {
  @IsUUID() productId!: string;
  @IsInt() @Min(1) @Max(10000) quantity!: number;
  @IsNumber({ maxDecimalPlaces: 4 }) @Min(0.0001) @Max(1e12) requestedPrice!: number;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

@Controller('retail-workspace')
@UseGuards(JwtAuthGuard)
export class RetailWorkspaceController {
  constructor(private readonly db: DataSource, private readonly discounts: DiscountApprovalService, private readonly pos: OrdersService, private readonly displayTokens: KdsDisplayTokens) {}

  private async scope(actor: AuthUser, slug?: string) {
    if (!actor.id || !['user', 'admin'].includes(actor.role ?? '')) throw new ForbiddenException();
    const stores = this.db.getRepository(StoreSettings);
    if (!slug) {
      const shop = await stores.findOneBy({ ownerId: actor.id });
      return { ownerId: actor.id, shop, role: 'owner' as const, canFulfill: true };
    }
    if (typeof slug !== 'string') throw new BadRequestException('Choose one shop.');
    const normalized = slug.trim().toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(normalized)) throw new NotFoundException('Shop not found.');
    const matching = await stores.find({ where: { domainSlug: normalized }, take: 2 });
    if (matching.length !== 1) throw new NotFoundException('Shop workspace is unavailable.');
    const shop = matching[0];
    if (shop.ownerId === actor.id) return { ownerId: shop.ownerId, shop, role: 'owner' as const, canFulfill: true };
    const member = await this.db.getRepository(RetailMember).findOneBy({ shopId: shop.id, userId: actor.id });
    if (!member || !RETAIL_ROLES.includes(member.role)) throw new ForbiddenException('Your KobeOS account has no access to this shop.');
    return { ownerId: shop.ownerId, shop, role: member.role, canFulfill: member.role === 'manager' || member.canFulfill === true };
  }

  private async ownedShop(actor: AuthUser, slug?: string) {
    const scope = await this.scope(actor, slug);
    if (scope.role !== 'owner') throw new ForbiddenException('Only the shop owner can manage access.');
    if (!scope.shop?.domainSlug) throw new BadRequestException('Set your store address before adding shop staff.');
    return scope.shop;
  }

  @Get()
  async overview(@CurrentUser() actor: AuthUser, @Query('slug') slug?: string) {
    const { shop, ownerId, role, canFulfill } = await this.scope(actor, slug);
    const products = this.db.getRepository(PosProduct);
    const orders = this.db.getRepository(PosOrder);
    const requests = this.db.getRepository(DiscountRequest);
    const reviewFilter = role === 'owner' ? { ownerId } : { ownerId, sellerId: actor.id };
    const [inventory, pendingOrders, pendingApprovals, registration] = await Promise.all([
      products.createQueryBuilder('p')
        .select('COUNT(*)', 'skus').addSelect('COALESCE(SUM(p.stock), 0)', 'units')
        .addSelect('COUNT(*) FILTER (WHERE p.stock - p."reservedStock" <= 5)', 'low')
        .where('p."ownerId" = :ownerId AND p.active = true', { ownerId }).getRawOne<{ skus: string; units: string; low: string }>(),
      orders.countBy({ ownerId, status: 'PENDING' }),
      requests.countBy({ ...reviewFilter, status: In(['PENDING', 'COUNTERED']) }),
      shop?.domainSlug ? this.db.getRepository(StoreRegistration).findOne({
        where: { slug: shop.domainSlug, ownerId }, select: ['lastSeenAt', 'status'],
      }) : null,
    ]);
    const links = await this.db.getRepository(RetailMember).findBy({ userId: actor.id });
    const linked = links.length ? await this.db.getRepository(StoreSettings).find({
      where: { id: In(links.map(link => link.shopId)) }, select: ['domainSlug', 'storeName'],
    }) : [];
    return {
      name: shop?.storeName || 'My shop', slug: shop?.domainSlug || '', role, published: shop?.isPublished ?? false,
      canFulfill,
      canManageTeam: role === 'owner' && !!shop?.domainSlug,
      inventory: { skus: Number(inventory?.skus ?? 0), units: Number(inventory?.units ?? 0), low: Number(inventory?.low ?? 0) },
      pendingOrders, pendingApprovals, linked: linked.filter(shop => !!shop.domainSlug),
      localServer: registration ? { status: registration.status, lastSeenAt: registration.lastSeenAt } : null,
    };
  }

  @Get('stock')
  async stock(@CurrentUser() actor: AuthUser, @Query('slug') slug?: string) {
    const { ownerId } = await this.scope(actor, slug);
    const rows = await this.db.getRepository(PosProduct).find({
      where: { ownerId, active: true }, order: { name: 'ASC', id: 'ASC' },
      select: ['id', 'sku', 'name', 'price', 'currency', 'stock', 'reservedStock'],
    });
    return rows.map(({ reservedStock, ...row }) => ({ ...row, stock: Math.max(0, row.stock - reservedStock) }));
  }

  @Get('orders')
  async orders(@CurrentUser() actor: AuthUser, @Query('slug') slug?: string) {
    const { ownerId } = await this.scope(actor, slug);
    return this.db.getRepository(PosOrder).find({
      where: { ownerId }, order: { createdAt: 'DESC' }, take: 50,
      select: ['id', 'orderNumber', 'status', 'fulfillmentStatus', 'createdAt', 'total', 'currency', 'salesChannel'],
    });
  }

  @Post('orders/:id/prepare')
  async prepareOrder(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Query('slug') slug?: string) {
    const { ownerId, role } = await this.scope(actor, slug);
    if (role === 'staff') throw new ForbiddenException('Only shop managers and owners can prepare orders.');
    const order = await this.db.getRepository(PosOrder).findOneBy({ id, ownerId, status: 'COMPLETED' });
    if (!order) throw new NotFoundException('Paid shop order not found.');
    const result = await this.pos.markPreparing(ownerId, id);
    return { fulfillmentStatus: result.fulfillmentStatus };
  }

  @Get('fulfillment')
  async fulfillmentQueue(@CurrentUser() actor: AuthUser, @Query('slug') slug?: string) {
    const { ownerId, canFulfill } = await this.scope(actor, slug);
    if (!canFulfill) throw new ForbiddenException('Your account cannot fulfill orders for this shop.');
    return this.pos.listKdsTickets(ownerId);
  }

  @Post('fulfillment/display')
  async pairDisplay(@CurrentUser() actor: AuthUser, @Query('slug') slug?: string) {
    const { shop, role } = await this.scope(actor, slug);
    if (!shop || role === 'staff') throw new ForbiddenException('Only shop owners and managers can pair a display.');
    return this.displayTokens.issue(shop, actor.id);
  }

  @Post('fulfillment/:id/:action')
  async fulfillOrder(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('action') action: string,
    @Query('slug') slug?: string,
  ) {
    const { ownerId, canFulfill } = await this.scope(actor, slug);
    if (!canFulfill) throw new ForbiddenException('Your account cannot fulfill orders for this shop.');
    switch (action) {
      case 'start': return { fulfillmentStatus: (await this.pos.markPreparing(ownerId, id)).fulfillmentStatus };
      case 'ready': return { fulfillmentStatus: (await this.pos.markReady(ownerId, id)).fulfillmentStatus };
      case 'collected': return { fulfillmentStatus: (await this.pos.markCollected(ownerId, id)).fulfillmentStatus };
      default: throw new BadRequestException('Unknown fulfillment action.');
    }
  }

  @Get('team')
  async team(@CurrentUser() actor: AuthUser, @Query('slug') slug?: string) {
    const shop = await this.ownedShop(actor, slug);
    const members = await this.db.getRepository(RetailMember).findBy({ shopId: shop.id });
    if (!members.length) return [];
    const users = await this.db.getRepository(User).find({
      where: { id: In(members.map(member => member.userId)) }, select: ['id', 'email', 'displayName'],
    });
    return users.map(user => {
      const member = members.find(member => member.userId === user.id)!;
      return { ...user, role: member.role, canFulfill: member.canFulfill };
    });
  }

  @Post('team')
  async setRole(@CurrentUser() actor: AuthUser, @Body() dto: RetailMemberDto, @Query('slug') slug?: string) {
    const shop = await this.ownedShop(actor, slug);
    const user = await this.db.getRepository(User).findOneBy({ email: dto.email.trim().toLowerCase() });
    if (!user || !['user', 'admin'].includes(user.role)) throw new NotFoundException('KobeOS shop account not found.');
    if (user.id === actor.id) throw new BadRequestException('The shop owner already has access.');
    await this.db.getRepository(RetailMember).upsert({ shopId: shop.id, userId: user.id, role: dto.role, ...(dto.canFulfill == null ? {} : { canFulfill: dto.canFulfill }) }, ['shopId', 'userId']);
    return { id: user.id, role: dto.role };
  }

  @Delete('team/:id')
  async revoke(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) userId: string, @Query('slug') slug?: string) {
    const shop = await this.ownedShop(actor, slug);
    await this.db.getRepository(RetailMember).delete({ shopId: shop.id, userId });
    return { revoked: true };
  }

  @Get('discounts')
  async discountQueue(@CurrentUser() actor: AuthUser, @Query('slug') slug?: string) {
    const { ownerId, role } = await this.scope(actor, slug);
    return this.db.getRepository(DiscountRequest).find({
      where: role === 'owner' ? { ownerId } : { ownerId, sellerId: actor.id },
      order: { createdAt: 'DESC' }, take: 50,
      select: ['id', 'productName', 'sellerName', 'status', 'currency', 'quantity', 'requestedPrice', 'approvedPrice', 'standardPrice', 'reason', 'expiresAt',
        ...(role === 'owner' ? ['unitCost' as const] : [])],
    });
  }

  @Post('discounts')
  async requestDiscount(@CurrentUser() actor: AuthUser, @Body() dto: RetailDiscountDto, @Query('slug') slug?: string) {
    const { ownerId, role } = await this.scope(actor, slug);
    if (role === 'owner') throw new ForbiddenException('The owner reviews requests from shop staff.');
    const user = await this.db.getRepository(User).findOneBy({ id: actor.id });
    const request = await this.discounts.createRequest(ownerId, actor.id, {
      ...dto, standardPrice: 0, sellerName: user?.displayName || actor.email,
    }, true);
    return { id: request.id, status: request.status };
  }

  @Post('discounts/:id/approve')
  async approve(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Query('slug') slug?: string) {
    const { ownerId, role } = await this.scope(actor, slug);
    if (role !== 'owner') throw new ForbiddenException('Only the shop owner can approve prices.');
    const request = await this.discounts.approveForCheckout(ownerId, actor.id, id);
    return { id: request.id, status: request.status };
  }

  @Post('discounts/:id/reject')
  async reject(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Query('slug') slug?: string) {
    const { ownerId, role } = await this.scope(actor, slug);
    if (role !== 'owner') throw new ForbiddenException('Only the shop owner can reject prices.');
    const request = await this.discounts.rejectRequest(ownerId, actor.id, id, {});
    return { id: request.id, status: request.status };
  }

  @Post('discounts/:id/cash-sale')
  async cashSale(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Query('slug') slug?: string) {
    const { ownerId, role } = await this.scope(actor, slug);
    if (role === 'owner') throw new ForbiddenException('The cashier who requested the discount records the payment.');
    const request = await this.discounts.completeSale(ownerId, actor.id, id, { paymentMethod: 'cash' });
    return { id: request.id, status: request.status };
  }
}
