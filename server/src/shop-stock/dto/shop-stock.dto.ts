import {
  IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min,
} from 'class-validator';

export class CreateAllocationDto {
  @IsString() @MaxLength(80) allocationNumber!: string;

  @IsOptional() @IsString() @MaxLength(100) shopId?: string;
  @IsOptional() @IsString() @MaxLength(200) shopName?: string;
  @IsOptional() @IsString() @MaxLength(100) warehouseId?: string;
  @IsOptional() @IsString() @MaxLength(200) warehouseName?: string;

  @IsNumber() @Min(0) totalValue!: number;
  @IsInt() @Min(1) totalPieces!: number;

  @IsOptional() @IsString() @MaxLength(10) currency?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateAllocationDto {
  @IsOptional() @IsString() @MaxLength(200) shopName?: string;
  @IsOptional() @IsString() @MaxLength(200) warehouseName?: string;
  @IsOptional() @IsNumber() @Min(0) totalValue?: number;
  @IsOptional() @IsInt() @Min(1) totalPieces?: number;
  @IsOptional() @IsEnum(['OPEN', 'CLOSED', 'RECONCILED']) status?: 'OPEN' | 'CLOSED' | 'RECONCILED';
  @IsOptional() @IsString() notes?: string;
}

export class CalculateEstimateDto {
  /** Cumulative sales value to apply against this allocation */
  @IsNumber() @Min(0) salesValue!: number;
}

export class ReconcileDto {
  @IsNumber() @Min(0) physicalCount!: number;

  @IsOptional()
  @IsEnum(['SHRINKAGE', 'SURPLUS', 'UNRECORDED_SALE', 'ERROR'])
  varianceType?: 'SHRINKAGE' | 'SURPLUS' | 'UNRECORDED_SALE' | 'ERROR';

  @IsOptional() @IsString() notes?: string;
}

export class AllocationQueryDto {
  @IsOptional() @IsString() shopId?: string;
  @IsOptional() @IsEnum(['OPEN', 'CLOSED', 'RECONCILED']) status?: 'OPEN' | 'CLOSED' | 'RECONCILED';
}

// ---- Response shapes (plain interfaces, not validated) ----

export interface EstimateResult {
  allocationId: string;
  allocationNumber: string;
  shopName: string | null;
  warehouseName: string | null;
  totalValue: number;
  totalPieces: number;
  averagePieceValue: number;
  currency: string;
  salesValue: number;
  estimatedSoldPieces: number;
  estimatedRemainingPieces: number;
  superProfit: number;
  accuracy: 'ESTIMATE';
  status: string;
}

export interface ReconciliationResult {
  allocationId: string;
  estimatedPieces: number;
  physicalCount: number;
  variance: number;
  varianceType: string;
  notes: string | null;
}
