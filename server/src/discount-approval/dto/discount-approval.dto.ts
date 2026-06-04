import {
  IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional,
  IsString, IsUUID, Max, MaxLength, Min,
} from 'class-validator';

// ─── Seller DTOs ──────────────────────────────────────────────────────────────

export class CreateDiscountRequestDto {
  @IsUUID() productId!: string;

  @IsOptional() @IsString() @MaxLength(200) productName?: string;

  @IsOptional() @IsUUID() variantId?: string;

  @IsOptional() @IsUUID() customerId?: string;

  @IsOptional() @IsString() @MaxLength(200) customerName?: string;

  @IsInt() @Min(1) quantity!: number;

  @IsNumber() @Min(0) standardPrice!: number;

  /** Unit cost — used for margin display. Seller reads from product record. */
  @IsOptional() @IsNumber() @Min(0) unitCost?: number;

  @IsNumber() @Min(0) requestedPrice!: number;

  @IsOptional() @IsString() @MaxLength(500) reason?: string;

  @IsOptional() @IsString() photoUrl?: string;

  @IsOptional() @IsString() @MaxLength(10) currency?: string;

  /** Seller name — passed from frontend session for display in owner queue */
  @IsOptional() @IsString() @MaxLength(200) sellerName?: string;
}

// ─── Owner DTOs ───────────────────────────────────────────────────────────────

export class ApproveDiscountRequestDto {
  /** Owner can approve at the requested price or a different price */
  @IsNumber() @Min(0) approvedPrice!: number;

  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class CounterDiscountRequestDto {
  @IsNumber() @Min(0) counterPrice!: number;

  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class RejectDiscountRequestDto {
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

// ─── Sale completion ──────────────────────────────────────────────────────────

export class CompleteDiscountSaleDto {
  @IsEnum(['cash', 'mpesa', 'credit', 'bank', 'kobepay'])
  paymentMethod!: 'cash' | 'mpesa' | 'credit' | 'bank' | 'kobepay';

  @IsOptional() @IsString() @MaxLength(200) customerName?: string;

  @IsOptional() @IsString() @MaxLength(30) customerPhone?: string;
}

// ─── Rule management ──────────────────────────────────────────────────────────

export class CreateApprovalRuleDto {
  @IsString() @MaxLength(200) ruleName!: string;

  @IsOptional() @IsString() description?: string;

  @IsOptional() @IsNumber() @Min(0) @Max(100) maxDiscountPercent?: number;

  @IsOptional() @IsNumber() @Min(0) @Max(100) minMarginPercent?: number;

  @IsOptional() @IsString() minCustomerTier?: string;

  @IsOptional() @IsInt() @Min(1) minQuantity?: number;

  @IsOptional() @IsArray() @IsString({ each: true }) allowedSellerRoles?: string[];

  @IsOptional() @IsBoolean() isActive?: boolean;

  @IsOptional() @IsInt() @Min(1) priority?: number;

  @IsOptional() @IsInt() @Min(1) expiryMinutes?: number;
}

export class UpdateApprovalRuleDto {
  @IsOptional() @IsString() @MaxLength(200) ruleName?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) maxDiscountPercent?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) minMarginPercent?: number;
  @IsOptional() @IsString() minCustomerTier?: string;
  @IsOptional() @IsInt() @Min(1) minQuantity?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) allowedSellerRoles?: string[];
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(1) priority?: number;
  @IsOptional() @IsInt() @Min(1) expiryMinutes?: number;
}

// ─── Query filters ────────────────────────────────────────────────────────────

export class ListRequestsQueryDto {
  @IsOptional() @IsEnum(['DRAFT','PENDING','APPROVED','COUNTERED','REJECTED','EXPIRED','COMPLETED'])
  status?: string;

  @IsOptional() @IsUUID() sellerId?: string;

  @IsOptional() @IsUUID() productId?: string;
}

// ─── Computed response shape (not validated — returned by service) ─────────────

export interface DiscountCalculations {
  standardTotal: number;
  proposedTotal: number;
  discountAmount: number;
  discountPercent: number;
  standardMarginPercent: number;
  newMarginPercent: number;
  profit: number;
}

export function computeDiscountCalcs(
  standardPrice: number,
  proposedPrice: number,
  unitCost: number,
  quantity: number,
): DiscountCalculations {
  const std = Number(standardPrice);
  const prop = Number(proposedPrice);
  const cost = Number(unitCost);
  const qty  = Number(quantity);

  const standardTotal    = std * qty;
  const proposedTotal    = prop * qty;
  const discountAmount   = standardTotal - proposedTotal;
  const discountPercent  = std > 0 ? ((std - prop) / std) * 100 : 0;
  const standardMarginPercent = std > 0 ? ((std - cost) / std) * 100 : 0;
  const newMarginPercent      = prop > 0 ? ((prop - cost) / prop) * 100 : 0;
  const profit = (prop - cost) * qty;

  return {
    standardTotal,
    proposedTotal,
    discountAmount,
    discountPercent,
    standardMarginPercent,
    newMarginPercent,
    profit,
  };
}
