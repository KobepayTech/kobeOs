import { IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateItemDto {
  @IsString() @MaxLength(60) sku!: string;
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsOptional() @IsString() @MaxLength(20) unit?: string;
  @IsOptional() @IsInt() quantity?: number;
  @IsOptional() @IsInt() reorderLevel?: number;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsNumber() unitCost?: number;
}
export class UpdateItemDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsInt() reorderLevel?: number;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsNumber() unitCost?: number;
}

export class MovementDto {
  @IsUUID() itemId!: string;
  @IsEnum(['IN', 'OUT', 'ADJUST']) type!: 'IN' | 'OUT' | 'ADJUST';
  @IsInt() quantity!: number;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() note?: string;
}
