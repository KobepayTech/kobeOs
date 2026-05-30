import { IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @IsString() @MaxLength(60) sku!: string;
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsNumber() @Min(0) price!: number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @IsInt() @Min(0) stock?: number;
  @IsOptional() @IsInt() @Min(0) reservedStock?: number;
  @IsOptional() @IsString() @MaxLength(80) shelf?: string;
  @IsOptional() @IsString() @MaxLength(80) warehouseId?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
export class UpdateProductDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsInt() @Min(0) stock?: number;
  @IsOptional() @IsInt() @Min(0) reservedStock?: number;
  @IsOptional() @IsString() shelf?: string;
  @IsOptional() @IsString() warehouseId?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class OrderLineDto {
  @IsUUID() productId!: string;
  @IsInt() @Min(1) quantity!: number;
}

export class CreateOrderDto {
  @IsString() orderNumber!: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => OrderLineDto)
  lines!: OrderLineDto[];
  @IsOptional() @IsNumber() @Min(0) taxAmount?: number;
  @IsOptional() @IsNumber() @Min(0) discountAmount?: number;
  @IsOptional() @IsString() discountCode?: string;
  @IsOptional() @IsString() paymentMethod?: string;
  @IsOptional() @IsString() bnplPlan?: string;
  @IsOptional() @IsString() customerName?: string;
  @IsOptional() @IsString() customerPhone?: string;
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
