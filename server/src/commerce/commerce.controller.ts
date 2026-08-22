import { Body, Controller, Get, Headers, Param, Patch, Post, Query, Res, UploadedFile, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUrl, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../common/public.decorator';
import { CommerceService } from './commerce.service';

class BusinessDto {
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(160) merchantName?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(63) publicSlug?: string;
}
class FloorDto {
  @IsString() @MaxLength(100) name!: string;
  @IsString() @MaxLength(12) code!: string;
  @IsOptional() @Type(() => Number) @IsInt() level?: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(500) shopCount!: number;
}
class PropertyBuildDto { @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => FloorDto) floors!: FloorDto[]; }
class ClaimDto {
  @IsString() @MaxLength(30) shopCode!: string;
  @IsString() @MaxLength(160) businessName!: string;
  @IsString() @MaxLength(160) merchantName!: string;
  @IsString() @MaxLength(40) phone!: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() @MaxLength(40) whatsapp?: string;
  @IsOptional() @IsString() @MaxLength(500) logoUrl?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) subcategories?: string[];
}
class QuickAddDto {
  @IsOptional() @IsString() @MaxLength(180) name?: string;
  @IsOptional() @IsString() @MaxLength(4000) caption?: string;
  @IsUrl({ require_tld: false }) imageUrl!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12) panelCount?: number;
  @IsOptional() @IsString() @MaxLength(100) category?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) price?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) stock?: number;
}
class CartLineDto {
  @IsUUID() productId!: string;
  @Type(() => Number) @IsNumber() @Min(0.0001) quantity!: number;
  @IsOptional() @IsObject() selectedOptions?: Record<string, string>;
}
class CustomerDto {
  @IsString() @MaxLength(160) name!: string;
  @IsString() @MaxLength(40) phone!: string;
  @IsOptional() @IsEmail() email?: string;
}
class CartDto {
  @ValidateNested() @Type(() => CustomerDto) customer!: CustomerDto;
  @IsIn(['PICKUP', 'DELIVERY']) fulfillment!: 'PICKUP' | 'DELIVERY';
  @IsOptional() @IsString() @MaxLength(500) deliveryAddress?: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CartLineDto) lines!: CartLineDto[];
}
class VehicleListingDto {
  @IsOptional() @IsArray() @IsString({ each: true }) highlights?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) keywords?: string[];
  @IsOptional() @IsString() socialCaption?: string;
  @IsOptional() @IsUrl({ require_tld: false }) verticalVideoUrl?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) purchaseCost?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) dutyCost?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) clearingCost?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) transportCost?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) repairCost?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) advertisingCost?: number;
}
class VehicleDto {
  @IsString() make!: string; @IsString() model!: string;
  @Type(() => Number) @IsInt() @Min(1900) @Max(2200) year!: number;
  @Type(() => Number) @IsNumber() @Min(0.01) price!: number;
  @IsOptional() @IsString() stockNumber?: string; @IsOptional() @IsString() trim?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) mileage?: number;
  @IsOptional() @IsString() transmission?: string; @IsOptional() @IsString() fuel?: string;
  @IsOptional() @IsString() color?: string; @IsOptional() @IsString() interiorColor?: string;
  @IsOptional() @IsString() engine?: string; @IsOptional() @IsString() driveType?: string;
  @IsOptional() @IsString() bodyType?: string; @IsOptional() @IsString() vin?: string;
  @IsOptional() @IsString() registration?: string; @IsOptional() @IsString() dutyStatus?: string;
  @IsOptional() @IsIn(['LOCAL', 'IMPORTED']) source?: 'LOCAL' | 'IMPORTED';
  @IsOptional() @IsBoolean() financingAvailable?: boolean; @IsOptional() @IsBoolean() negotiable?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) features?: string[];
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsIn(['NEW', 'USED', 'IMPORTED']) condition?: 'NEW' | 'USED' | 'IMPORTED';
  @IsOptional() @IsString() description?: string; @IsOptional() @IsArray() @IsUrl({ require_tld: false }, { each: true }) mediaUrls?: string[];
  @IsOptional() @ValidateNested() @Type(() => VehicleListingDto) listing?: VehicleListingDto;
}
class VehicleBuyerRequestDto {
  @IsString() @MaxLength(160) customerName!: string;
  @IsString() @MaxLength(40) customerPhone!: string;
  @IsOptional() @IsString() @MaxLength(40) customerWhatsapp?: string;
  @IsOptional() @IsIn(['OUTRIGHT', 'RESERVE', 'FINANCE']) requestType?: 'OUTRIGHT' | 'RESERVE' | 'FINANCE';
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) offerAmount?: number;
  @IsOptional() @IsIn(['PHONE', 'WHATSAPP', 'SMS', 'EMAIL']) preferredContact?: 'PHONE' | 'WHATSAPP' | 'SMS' | 'EMAIL';
  @IsOptional() @IsString() @MaxLength(2000) tradeInDetails?: string;
  @IsOptional() @IsString() @MaxLength(2000) message?: string;
  @IsOptional() @IsBoolean() reserve?: boolean;
}

@UseGuards(JwtAuthGuard)
@Controller('commerce')
export class CommerceController {
  constructor(private readonly commerce: CommerceService) {}
  @Get('businesses') businesses(@CurrentUser('id') uid: string) { return this.commerce.listBusinesses(uid); }
  @Post('businesses') business(@CurrentUser('id') uid: string, @Body() dto: BusinessDto) { return this.commerce.createBusiness(uid, dto); }
  @Post('businesses/:id/upgrade') upgrade(@CurrentUser('id') uid: string, @Param('id') id: string, @Body('managementToken') token?: string) { return this.commerce.upgradeBusiness(uid, id, token); }
  @Post('businesses/:id/claim-shop') linkShop(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: { shopCode: string; categoryId?: string }) { return this.commerce.linkExistingBusiness(uid, id, dto); }
  @Post('properties/:id/build') build(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: PropertyBuildDto) { return this.commerce.buildProperty(uid, id, dto); }
  @Get('properties/:id/map') map(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.commerce.propertyMap(uid, id); }
  @Post('categories/seed') categories() { return this.commerce.seedCategories(); }
  @Post('products/quick-add') quickAdd(@CurrentUser('id') uid: string, @Body() dto: QuickAddDto) { return this.commerce.quickAdd(uid, dto); }
  @Post('products/quick-add-upload')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 20 * 1024 * 1024 } }))
  quickAddUpload(@CurrentUser('id') uid: string, @UploadedFile() file: Express.Multer.File, @Body() body: Record<string, string>) { return this.commerce.quickAddUpload(uid, { name: body.name, caption: body.caption, panelCount: Number(body.panelCount) || 1, category: body.category, price: Number(body.price) || 0, stock: Number(body.stock) || 0 }, file); }
  @Post('products/quick-add-multiple-upload')
  @UseInterceptors(FilesInterceptor('images', 12, { limits: { fileSize: 20 * 1024 * 1024 } }))
  quickAddMultipleUpload(@CurrentUser('id') uid: string, @UploadedFiles() files: Express.Multer.File[], @Body() body: Record<string, string>) { return this.commerce.quickAddMultipleUpload(uid, { name: body.name, caption: body.caption, category: body.category, price: Number(body.price) || 0, stock: Number(body.stock) || 0, interpretation: body.interpretation === 'ONE_PRODUCT' ? 'ONE_PRODUCT' : 'MULTIPLE_PRODUCTS' }, files); }
  @Post('products/sync') syncProducts(@CurrentUser('id') uid: string) { return this.commerce.syncCatalog(uid); }
  @Post('nodes/register') node(@CurrentUser('id') uid: string, @Body() dto: { nodeName?: string; version?: string; endpoint?: string; catalogueVersion?: string }) { return this.commerce.registerNode(uid, dto); }
  @Get('orders') orders(@CurrentUser('id') uid: string) { return this.commerce.merchantOrders(uid); }
  @Patch('orders/:id/status') orderStatus(@CurrentUser('id') uid: string, @Param('id') id: string, @Body('status') status: 'VIEWED' | 'ACCEPTED' | 'RESERVED' | 'PAYMENT_PENDING' | 'PAID' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED' | 'UNAVAILABLE') { return this.commerce.updateMerchantOrderStatus(uid, id, status); }
  @Get('cars') cars(@CurrentUser('id') uid: string) { return this.commerce.vehicleInventory(uid); }
  @Post('cars') car(@CurrentUser('id') uid: string, @Body() dto: VehicleDto) { return this.commerce.createVehicle(uid, dto); }
  @Patch('cars/:id') updateCar(@CurrentUser('id') uid: string, @Param('id') id: string, @Body() dto: Partial<VehicleDto> & { status?: 'DRAFT' | 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'IN_TRANSIT' | 'COMING_SOON' | 'UNAVAILABLE' }) { return this.commerce.updateVehicle(uid, id, dto); }
  @Post('cars/:id/generate-marketing') generateCarMarketing(@CurrentUser('id') uid: string, @Param('id') id: string) { return this.commerce.generateVehicleMarketing(uid, id); }
}

@Public()
@Controller('commerce-public')
export class CommercePublicController {
  constructor(private readonly commerce: CommerceService) {}
  @Get('categories') categories() { return this.commerce.listCategories(); }
  @Get('lite-stores/:slug') liteStore(@Param('slug') slug: string) { return this.commerce.publicLiteStore(slug); }
  @Get('lite/:businessId') liteDashboard(@Param('businessId') id: string, @Headers('x-kobe-lite-token') token: string) { return this.commerce.liteDashboard(id, token); }
  @Post('lite/:businessId/products') liteProduct(@Param('businessId') id: string, @Headers('x-kobe-lite-token') token: string, @Body() body: { name?: string; caption?: string; imageUrl: string; panelCount?: number; category?: string; price?: number; stock?: number }) { return this.commerce.liteQuickAdd(id, token, body); }
  @Post('lite/:businessId/products/upload')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 20 * 1024 * 1024 } }))
  liteProductUpload(@Param('businessId') id: string, @Headers('x-kobe-lite-token') token: string, @UploadedFile() file: Express.Multer.File, @Body() body: Record<string, string>) { return this.commerce.liteQuickAddUpload(id, token, { name: body.name, caption: body.caption, panelCount: Number(body.panelCount) || 1, category: body.category, price: Number(body.price) || 0, stock: Number(body.stock) || 0 }, file); }
  @Patch('lite/:businessId/products/:productId') liteProductUpdate(@Param('businessId') id: string, @Param('productId') productId: string, @Headers('x-kobe-lite-token') token: string, @Body() body: { name?: string; description?: string; category?: string; price?: number; stock?: number; active?: boolean; imageUrl?: string }) { return this.commerce.liteUpdateProduct(id, token, productId, body); }
  @Get('shop/:code') shop(@Param('code') code: string) { return this.commerce.publicProperty(code); }
  @Post('claims') claim(@Body() dto: ClaimDto) { return this.commerce.claimShop(dto); }
  @Post('nodes/:id/heartbeat') heartbeat(@Param('id') id: string, @Headers('x-kobe-node-key') key: string, @Body() body: { metadata?: Record<string, unknown> }) { return this.commerce.heartbeat(id, key, body?.metadata); }
  @Get('jumla/items') items(@Query() query: Record<string, string>) { return this.commerce.publicItems(query); }
  @Get('jumla/properties') properties(@Query() query: Record<string, string>) { return this.commerce.publicProperties(query); }
  @Post('jumla/interest') interest(@Body() dto: { productId: string; eventType: 'VIEW' | 'SWIPE_LEFT' | 'SWIPE_RIGHT' | 'CART' | 'BUY'; phone?: string; sessionId?: string; metadata?: Record<string, unknown> }) { return this.commerce.recordInterest(dto); }
  @Post('jumla/orders') order(@Body() dto: CartDto) { return this.commerce.submitCart(dto); }
  @Get('cars') cars(@Query() query: Record<string, string>) { return this.commerce.publicVehicles(query); }
  @Post('cars/:id/request') requestCar(@Param('id') id: string, @Body() dto: VehicleBuyerRequestDto) { return this.commerce.vehicleRequest(id, dto); }
  @Get('media/:token') async media(@Param('token') token: string, @Res() res: Response) { const media = await this.commerce.publicMedia(token); res.setHeader('Content-Type', media.mimeType || 'image/webp'); res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); res.end(media.contentBinary); }
}
