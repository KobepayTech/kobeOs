import {
  IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'] as const;
const POINT_TYPES = ['Earned', 'Redeemed', 'Bonus'] as const;
const SUPPLIER_STATUS = ['Active', 'Inactive'] as const;
const PO_STATUS = ['Delivered', 'In Transit', 'Pending', 'Cancelled'] as const;

/* ---------- accounts ---------- */
export class CreateAccountDto {
  @IsString() @MaxLength(20) code!: string;
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsEnum(ACCOUNT_TYPES) type?: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
  @IsOptional() @IsNumber() balance?: number;
}
export class UpdateAccountDto {
  @IsOptional() @IsString() @MaxLength(20) code?: string;
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsEnum(ACCOUNT_TYPES) type?: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
  @IsOptional() @IsNumber() balance?: number;
}

/* ---------- transactions ---------- */
export class CreateTransactionDto {
  @IsOptional() @IsString() @MaxLength(40) date?: string;
  @IsOptional() @IsString() @MaxLength(20) account?: string;
  @IsOptional() @IsNumber() @Min(0) debit?: number;
  @IsOptional() @IsNumber() @Min(0) credit?: number;
  @IsOptional() @IsString() @MaxLength(280) description?: string;
}
export class UpdateTransactionDto extends CreateTransactionDto {}

/* ---------- loyalty customers ---------- */
export class CreateLoyaltyCustomerDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsInt() points?: number;
  @IsOptional() @IsString() @MaxLength(40) joinDate?: string;
  @IsOptional() @IsInt() @Min(0) visits?: number;
}
export class UpdateLoyaltyCustomerDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsInt() points?: number;
  @IsOptional() @IsString() @MaxLength(40) joinDate?: string;
  @IsOptional() @IsInt() @Min(0) visits?: number;
}

/* ---------- rewards ---------- */
export class CreateRewardDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsInt() @Min(0) points?: number;
  @IsOptional() @IsString() @MaxLength(40) image?: string;
  @IsOptional() @IsInt() @Min(0) stock?: number;
}
export class UpdateRewardDto extends CreateRewardDto {}

/* ---------- points entries ---------- */
export class CreatePointsEntryDto {
  @IsOptional() @IsString() @MaxLength(120) customer?: string;
  @IsOptional() @IsEnum(POINT_TYPES) type?: 'Earned' | 'Redeemed' | 'Bonus';
  @IsOptional() @IsInt() points?: number;
  @IsOptional() @IsString() @MaxLength(280) description?: string;
  @IsOptional() @IsString() @MaxLength(40) date?: string;
}
export class UpdatePointsEntryDto extends CreatePointsEntryDto {}

/* ---------- suppliers ---------- */
export class CreateSupplierDto {
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(120) contact?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(80) country?: string;
  @IsOptional() @IsNumber() @Min(0) rating?: number;
  @IsOptional() @IsEnum(SUPPLIER_STATUS) status?: 'Active' | 'Inactive';
}
export class UpdateSupplierDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MaxLength(120) contact?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(80) country?: string;
  @IsOptional() @IsNumber() @Min(0) rating?: number;
  @IsOptional() @IsEnum(SUPPLIER_STATUS) status?: 'Active' | 'Inactive';
}

/* ---------- purchase orders ---------- */
export class PoItemDto {
  @IsString() @MaxLength(160) name!: string;
  @IsInt() @Min(0) qty!: number;
  @IsNumber() @Min(0) price!: number;
}
export class CreatePurchaseOrderDto {
  @IsString() @MaxLength(40) poNumber!: string;
  @IsOptional() @IsString() @MaxLength(160) supplier?: string;
  @IsOptional() @IsNumber() @Min(0) total?: number;
  @IsOptional() @IsEnum(PO_STATUS) status?: 'Delivered' | 'In Transit' | 'Pending' | 'Cancelled';
  @IsOptional() @IsString() @MaxLength(40) date?: string;
  @IsOptional() @IsString() @MaxLength(40) deliveryDate?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PoItemDto) items?: PoItemDto[];
}
export class UpdatePurchaseOrderDto {
  @IsOptional() @IsString() @MaxLength(40) poNumber?: string;
  @IsOptional() @IsString() @MaxLength(160) supplier?: string;
  @IsOptional() @IsNumber() @Min(0) total?: number;
  @IsOptional() @IsEnum(PO_STATUS) status?: 'Delivered' | 'In Transit' | 'Pending' | 'Cancelled';
  @IsOptional() @IsString() @MaxLength(40) date?: string;
  @IsOptional() @IsString() @MaxLength(40) deliveryDate?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PoItemDto) items?: PoItemDto[];
}
