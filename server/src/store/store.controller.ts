import { Controller, Get, Param, Query, ParseIntPipe, DefaultValuePipe, Req } from '@nestjs/common';
import { Public } from '../common/public.decorator';
import { StoreService } from './store.service';
import { TenantRequest } from '../store-settings/tenant.middleware';

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
}
