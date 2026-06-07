import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ShopsService } from './shops.service';

class UpsertShopDto {
  name?: string;
  address?: string;
  phone?: string;
  region?: string;
  openingFloat?: number;
  currency?: string;
  isDefault?: boolean;
  active?: boolean;
}

/**
 * Owner-scoped CRUD for the merchant's physical shops. The frontend Shop
 * Switcher hits these endpoints and caches the active shopId in
 * localStorage as `kobeos:active-shop-id`.
 */
@UseGuards(JwtAuthGuard)
@Controller('shops')
export class ShopsController {
  constructor(private readonly svc: ShopsService) {}

  @Get() list(@CurrentUser('id') uid: string) {
    return this.svc.list(uid);
  }

  @Get('default') getDefault(@CurrentUser('id') uid: string) {
    return this.svc.getDefault(uid);
  }

  @Post() create(@CurrentUser('id') uid: string, @Body() dto: UpsertShopDto) {
    return this.svc.create(uid, dto);
  }

  @Patch(':id') update(
    @CurrentUser('id') uid: string,
    @Param('id') id: string,
    @Body() dto: UpsertShopDto,
  ) {
    return this.svc.update(uid, id, dto);
  }

  @Delete(':id') remove(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.svc.remove(uid, id);
  }
}
