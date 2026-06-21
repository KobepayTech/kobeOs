import { IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { ProductVariant } from '../pos.entity';

export class CreateProductDto {
  @IsString() @MaxLength(60) sku!: string;
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsOptional() @IsString() @MaxLength(80) brand?: string;
  @IsNumber() @Min(0) price!: number;
  @IsOptional() @IsNumber() @Min(0) compareAtPrice?: number;
  @IsOptional() @IsNumber() @Min(0) cost?: number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  /** Unit of sale (piece, m, kg, bag, sheet, litre). Free string. */
  @IsOptional() @IsString() @MaxLength(20) unit?: string;
  /** Allow fractional quantities (cut-to-length cable, weighed cement). */
  @IsOptional() @IsBoolean() decimalQuantity?: boolean;
  @IsOptional() @IsInt() @Min(0) stock?: number;
  @IsOptional() @IsInt() @Min(0) reservedStock?: number;
  @IsOptional() @IsString() @MaxLength(80) shelf?: string;
  @IsOptional() @IsString() @MaxLength(80) warehouseId?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) imageUrls?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsArray() variants?: ProductVariant[];
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsBoolean() featured?: boolean;

  /** Jersey-specific product details */
  @IsOptional() @IsObject() jerseyDetails?: {
    teamClub?: string;
    jerseyType?: 'fan' | 'match' | 'retro' | 'player' | 'kids';
    season?: string;
    badgeOptions?: string[];
    nameNumber?: string;
    size?: string;
    kitType?: 'jersey-only' | 'shorts-socks' | 'full-kit';
  };
}
export class UpdateProductDto {
  @IsOptional() @IsString() @MaxLength(60) sku?: string;
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsOptional() @IsString() @MaxLength(80) brand?: string;
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsNumber() @Min(0) compareAtPrice?: number;
  @IsOptional() @IsNumber() @Min(0) cost?: number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @IsString() @MaxLength(20) unit?: string;
  @IsOptional() @IsBoolean() decimalQuantity?: boolean;
  @IsOptional() @IsInt() @Min(0) stock?: number;
  @IsOptional() @IsInt() @Min(0) reservedStock?: number;
  @IsOptional() @IsString() @MaxLength(80) shelf?: string;
  @IsOptional() @IsString() @MaxLength(80) warehouseId?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) imageUrls?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsArray() variants?: ProductVariant[];
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsBoolean() featured?: boolean;

  /** Jersey-specific product details */
  @IsOptional() @IsObject() jerseyDetails?: {
    teamClub?: string;
    jerseyType?: 'fan' | 'match' | 'retro' | 'player' | 'kids';
    season?: string;
    badgeOptions?: string[];
    nameNumber?: string;
    size?: string;
    kitType?: 'jersey-only' | 'shorts-socks' | 'full-kit';
  };
}

export class OrderLineDto {
  @IsUUID() productId!: string;
  /** Decimal quantity — fractional values allowed for SKUs marked
   *  decimalQuantity = true (cut-to-length cable, weighed cement).
   *  Whole-number SKUs typically send integers. */
  @IsNumber() @Min(0.0001) quantity!: number;
  /** Per-line price after manager-negotiated discount. When unset the
   *  line is charged at the product's catalog price. Must be ≥ 0; the
   *  service additionally enforces it can't exceed the catalog price
   *  (since that would be a markup, not a discount). */
  @IsOptional() @IsNumber() @Min(0) negotiatedPrice?: number;
}

export class CreateOrderDto {
  @IsString() orderNumber!: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => OrderLineDto)
  lines!: OrderLineDto[];
  @IsOptional() @IsNumber() @Min(0) taxAmount?: number;
  /** Manual override; discount engine output wins when couponCode/rules apply. */
  @IsOptional() @IsNumber() @Min(0) discountAmount?: number;
  @IsOptional() @IsString() couponCode?: string;
  @IsOptional() @IsString() customerScope?: string;
  /** Set by a manager/admin for discounts above the approval threshold. */
  @IsOptional() @IsString() approvedBy?: string;
  @IsOptional() @IsString() paymentMethod?: string;
  @IsOptional() @IsString() bnplPlan?: string;
  @IsOptional() @IsString() customerName?: string;
  @IsOptional() @IsString() customerPhone?: string;
  /** BNPL only — number of monthly installments (defaults to 1 = lump sum). */
  @IsOptional() @IsInt() @Min(1) installmentMonths?: number;
}

export class UpdateOrderDto {
  @IsOptional() @IsEnum(['PENDING', 'COMPLETED', 'REFUNDED', 'CANCELLED'])
  status?: 'PENDING' | 'COMPLETED' | 'REFUNDED' | 'CANCELLED';
  @IsOptional() @IsString() paymentMethod?: string;
}

export class UpsertCreditProfileDto {
  @IsString() phone!: string;
  @IsOptional() @IsString() name?: string;
  @IsNumber() @Min(0) creditLimit!: number;
  @IsOptional() @IsNumber() @Min(0) usedCredit?: number;
  @IsOptional() @IsEnum(['A+', 'A', 'B', 'C', 'D']) score?: 'A+' | 'A' | 'B' | 'C' | 'D';
}
