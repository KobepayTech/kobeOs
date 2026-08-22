import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateKobePayLinkDto {
  @IsString() kobepayBusinessId!: string;
  @IsOptional() @IsString() kobepayUserId?: string;
  @IsString() customerPhone!: string;
  @IsOptional() @IsEnum(['active', 'disabled']) status?: 'active' | 'disabled';
  @IsOptional() @IsString() notes?: string;
}

export class CreateSupplierDto {
  @IsString() name!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() cnyAccount?: string;
  @IsOptional() @IsString() contactPerson?: string;
  @IsOptional() @IsString() notes?: string;
}

export class CreatePurchaseOrderDto {
  @IsString() poNumber!: string;
  @IsUUID() supplierId!: string;
  @IsNumber() totalCny!: number;
  @IsOptional() @IsDateString() expectedDate?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PurchaseOrderLineDto)
  items?: PurchaseOrderLineDto[];
  @IsOptional() @IsNumber() @Min(0)
  transportCost?: number;
}

export class PurchaseOrderLineDto {
  @IsString() name!: string;
  @IsNumber() @Min(0.0001) qty!: number;
  @IsNumber() @Min(0) price!: number;
  @IsOptional() @IsNumber() @Min(0) sellPrice?: number;
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() currency?: string;
}

export class ReceivePurchaseOrderLineDto {
  @IsInt() @Min(0) lineIndex!: number;
  @IsNumber() @Min(0) quantityReceived!: number;
  @IsNumber() @Min(0) damagedQuantity!: number;
}

export class ReceivePurchaseOrderDto {
  @IsOptional() @IsNumber() @Min(0)
  transportCost?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ReceivePurchaseOrderLineDto)
  lines?: ReceivePurchaseOrderLineDto[];
}

export class CreatePoFromReceiptDto {
  @IsOptional() @IsString() poNumber?: string;
  @IsOptional() @IsNumber() totalCny?: number;
  @IsOptional() @IsDateString() expectedDate?: string;
  @IsOptional() @IsString() notes?: string;
}

export class CreateSupplierFromReceiptDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() cnyAccount?: string;
  @IsOptional() @IsString() contactPerson?: string;
  @IsOptional() @IsString() notes?: string;
}

export class KobePaySupplierReceiptWebhookDto {
  @IsString() receiptId!: string;
  @IsString() kobepayBusinessId!: string;
  @IsOptional() @IsString() kobepayUserId?: string;
  @IsString() customerPhone!: string;
  @IsString() supplierPhone!: string;
  @IsOptional() @IsString() supplierName?: string;
  @IsNumber() sentAmount!: number;
  @IsEnum(['TZS', 'USD']) sentCurrency!: 'TZS' | 'USD';
  @IsNumber() exchangeRate!: number;
  @IsNumber() supplierReceivedAmount!: number;
  @IsOptional() @IsString() supplierCurrency?: string;
  @IsOptional() @IsNumber() feeAmount?: number;
  @IsOptional() @IsString() feeCurrency?: string;
  @IsOptional() @IsString() purpose?: string;
  @IsDateString() paidAt!: string;
  @IsOptional() @IsString() notes?: string;
}

export class AttachReceiptToPoDto {
  @IsUUID() poId!: string;
}

export class AttachReceiptToSupplierDto {
  @IsUUID() supplierId!: string;
}

export class MarkReceiptDto {
  @IsEnum(['advance', 'expense', 'freight', 'ignored']) status!: 'advance' | 'expense' | 'freight' | 'ignored';
  @IsOptional() @IsString() notes?: string;
}
