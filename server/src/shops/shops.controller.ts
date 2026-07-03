import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ShopsService } from './shops.service';

// NOTE: the global ValidationPipe runs with `whitelist: true`, which STRIPS
// any property lacking a class-validator decorator. Without these, every field
// was silently removed and shop create/update failed with "Shop name is
// required". Keep every field decorated.
class UpsertShopDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(200) address?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(80) region?: string;
  @IsOptional() @IsNumber() @Min(0) openingFloat?: number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
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
