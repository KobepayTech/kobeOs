import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';

const METHODS = ['Cash', 'Bank', 'WeChat', 'Alipay', 'Other'] as const;

class ReceiptItemDto {
  @IsString() @MaxLength(200) name!: string;
  @IsNumber() @Min(0) qty!: number;
  @IsOptional() @IsNumber() @Min(0) unitPrice?: number;
}

export class CreateReceiptDto {
  @IsOptional() @IsString() @MaxLength(120) customerName?: string;
  @IsOptional() @IsString() @MaxLength(40) customerPhone?: string;

  @IsOptional() @IsUUID() supplierId?: string;
  @IsString() @MaxLength(160) supplierName!: string;
  @IsOptional() @IsString() @MaxLength(40) supplierPhone?: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ReceiptItemDto)
  items?: ReceiptItemDto[];

  @IsNumber() @Min(0) amountDue!: number;
  @IsOptional() @IsNumber() @Min(0) shipping?: number;
  @IsOptional() @IsNumber() @Min(0) serviceFee?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() createdByName?: string;
}

export class PayReceiptDto {
  @IsEnum(METHODS) method!: (typeof METHODS)[number];
  @IsOptional() @IsString() @MaxLength(120) transactionId?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
