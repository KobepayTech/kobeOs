import { Body, Controller, Get, Param, Post, Query, ParseIntPipe, DefaultValuePipe, Req, BadRequestException } from '@nestjs/common';
import { Public } from '../common/public.decorator';
import { StoreService } from './store.service';
import { TenantRequest } from '../store-settings/tenant.middleware';
import { CreateOrderDto } from '../pos/dto/pos.dto';

@Public()
@Controller('store')
export class StoreController {
  constructor(private readonly svc: StoreService) {}

  /**
   * Resolve store by explicit slug: GET /api/store/kelvinfashion
   * Used by the erp-shop frontend when running inside KobeOS (no subdomain).
   */
  @Get(':slug')
  getBySlug(
    @Param('slug') slug: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(24), ParseIntPipe) limit: number,
  ) {
    return this.svc.getPublicStore(slug, page, Math.min(limit, 100));
  }

  /**
   * Resolve store from subdomain: GET /api/store
   * Used when the request arrives on kelvinfashion.kobeapptz.com — the
   * TenantMiddleware has already resolved req.tenant.
   */
  @Get()
  getFromSubdomain(
    @Req() req: TenantRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(24), ParseIntPipe) limit: number,
  ) {
    if (!req.tenant) {
      return { settings: null, products: [], total: 0 };
    }
    return this.svc.getPublicStore(req.tenant.domainSlug, page, Math.min(limit, 100));
  }

  /**
   * Place a storefront order: POST /api/store/:slug/orders
   * Public — no JWT required. Reuses the POS OrdersService so every
   * cashier-path side effect fires for storefront orders too:
   * atomic stock deduct, warehouse pick ticket, discount engine,
   * BNPL credit check (when paymentMethod is BNPL), journal entries,
   * formatted receipt text.
   */
  @Post(':slug/orders')
  placeOrderBySlug(@Param('slug') slug: string, @Body() dto: CreateOrderDto) {
    return this.svc.placeOrder(slug, dto);
  }

  /** Same as above but resolved via subdomain instead of path slug. */
  @Post('orders')
  placeOrderFromSubdomain(@Req() req: TenantRequest, @Body() dto: CreateOrderDto) {
    if (!req.tenant) {
      throw new BadRequestException('Tenant slug could not be resolved from request host');
    }
    return this.svc.placeOrder(req.tenant.domainSlug, dto);
  }
}
