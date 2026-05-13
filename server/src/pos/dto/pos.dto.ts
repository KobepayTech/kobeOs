import { IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @IsString() @MaxLength(60) sku!: string;
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsNumber() price!: number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @IsInt() @Min(0) stock?: number;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
export class UpdateProductDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsNumber() price?: number;
  @IsOptional() @IsInt() @Min(0) stock?: number;
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
  @IsOptional() @IsNumber() taxAmount?: number;
  @IsOptional() @IsNumber() discountAmount?: number;
  @IsOptional() @IsString() paymentMethod?: string;
  @IsOptional() @IsString() customerName?: string;
  @IsOptional() @IsString() customerPhone?: string;
}

export class UpdateOrderDto {
  @IsOptional() @IsEnum(['PENDING', 'COMPLETED', 'REFUNDED', 'CANCELLED'])
  status?: 'PENDING' | 'COMPLETED' | 'REFUNDED' | 'CANCELLED';
  @IsOptional() @IsString() paymentMethod?: string;
}
