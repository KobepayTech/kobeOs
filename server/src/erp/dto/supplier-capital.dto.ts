import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

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
