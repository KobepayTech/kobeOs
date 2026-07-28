import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePropertyDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() plotNo?: string;
  @IsOptional() @IsString() blockNo?: string;
  @IsOptional() @IsEnum(['residential', 'commercial', 'mixed']) type?: 'residential' | 'commercial' | 'mixed';
  @IsOptional() @IsInt() @Min(0) totalUnits?: number;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() notes?: string;
}
export class UpdatePropertyDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() plotNo?: string;
  @IsOptional() @IsString() blockNo?: string;
  @IsOptional() @IsEnum(['residential', 'commercial', 'mixed']) type?: 'residential' | 'commercial' | 'mixed';
  @IsOptional() @IsInt() @Min(0) totalUnits?: number;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() notes?: string;
}

export class CreateUnitDto {
  @IsUUID() propertyId!: string;
  @IsString() @MaxLength(40) unitNumber!: string;
  @IsOptional() @IsString() @MaxLength(80) type?: string;
  @IsOptional() @IsNumber() @Min(0) bedrooms?: number;
  @IsOptional() @IsNumber() @Min(0) bathrooms?: number;
  @IsOptional() @IsInt() @Min(0) sqft?: number;
  @IsOptional() @IsString() @MaxLength(40) floor?: string;
  @IsOptional() @IsString() @MaxLength(60) corridor?: string;
  @IsOptional() @IsIn(['left', 'right', 'end', 'single']) corridorSide?: 'left' | 'right' | 'end' | 'single';
  @IsOptional() @IsInt() @Min(0) @Max(1000) layoutPosition?: number;
  @IsOptional() @IsNumber() @Min(0) rentAmount?: number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @IsEnum(['vacant', 'occupied', 'turnover', 'unavailable', 'maintenance']) status?: 'vacant' | 'occupied' | 'turnover' | 'unavailable' | 'maintenance';
  @IsOptional() @IsString() notes?: string;
}
export class UpdateUnitDto {
  @IsOptional() @IsUUID() propertyId?: string;
  @IsOptional() @IsString() @MaxLength(40) unitNumber?: string;
  @IsOptional() @IsString() @MaxLength(80) type?: string;
  @IsOptional() @IsNumber() @Min(0) bedrooms?: number;
  @IsOptional() @IsNumber() @Min(0) bathrooms?: number;
  @IsOptional() @IsInt() @Min(0) sqft?: number;
  @IsOptional() @IsString() @MaxLength(40) floor?: string;
  @IsOptional() @IsString() @MaxLength(60) corridor?: string;
  @IsOptional() @IsIn(['left', 'right', 'end', 'single']) corridorSide?: 'left' | 'right' | 'end' | 'single';
  @IsOptional() @IsInt() @Min(0) @Max(1000) layoutPosition?: number;
  @IsOptional() @IsNumber() @Min(0) rentAmount?: number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @IsEnum(['vacant', 'occupied', 'turnover', 'unavailable', 'maintenance']) status?: 'vacant' | 'occupied' | 'turnover' | 'unavailable' | 'maintenance';
  @IsOptional() @IsString() notes?: string;
}

/** A room/unit proposal used by the bulk property onboarding transaction. */
export class PropertyLayoutUnitDto {
  @IsString() @MaxLength(40) unitNumber!: string;
  @IsOptional() @IsString() @MaxLength(80) type?: string;
  @IsOptional() @IsNumber() @Min(0) bedrooms?: number;
  @IsOptional() @IsNumber() @Min(0) bathrooms?: number;
  @IsOptional() @IsInt() @Min(0) sqft?: number;
  @IsString() @MaxLength(40) floor!: string;
  @IsOptional() @IsString() @MaxLength(60) corridor?: string;
  @IsOptional() @IsIn(['left', 'right', 'end', 'single']) corridorSide?: 'left' | 'right' | 'end' | 'single';
  @IsOptional() @IsInt() @Min(0) @Max(1000) layoutPosition?: number;
  @IsOptional() @IsNumber() @Min(0) rentAmount?: number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @IsEnum(['vacant', 'occupied', 'turnover', 'unavailable', 'maintenance']) status?: 'vacant' | 'occupied' | 'turnover' | 'unavailable' | 'maintenance';
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class OnboardPropertyDto {
  @ValidateNested() @Type(() => CreatePropertyDto)
  property!: CreatePropertyDto;

  @IsArray() @ArrayMaxSize(500)
  @ValidateNested({ each: true }) @Type(() => PropertyLayoutUnitDto)
  units!: PropertyLayoutUnitDto[];

  @IsOptional() @IsString() @MaxLength(2000)
  layoutPrompt?: string;
}

export class LayoutProposalDto {
  @IsString() @MaxLength(2000)
  prompt!: string;

  @IsOptional() @IsString() @MaxLength(40)
  startingRoom?: string;

  @IsOptional() @IsNumber() @Min(0)
  defaultRent?: number;

  @IsOptional() @IsString() @MaxLength(80)
  defaultType?: string;
}

export class CreateTenantDto {
  @IsOptional() @IsUUID() unitId?: string;
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() middleName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsString() @MaxLength(40) phone!: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() profilePicUrl?: string;
  @IsOptional() @IsString() tin?: string;
  @IsOptional() @IsString() businessLicense?: string;
  @IsOptional() @IsString() employer?: string;
  @IsOptional() @IsNumber() monthlyIncome?: number;
  @IsOptional() @IsString() emergencyContact?: string;
  @IsOptional() @IsString() shortCode?: string;
  @IsOptional() @IsString() paymentCode?: string;
  @IsOptional() @IsDateString() leaseStart?: string;
  @IsOptional() @IsDateString() leaseEnd?: string;
  @IsOptional() @IsEnum(['active', 'past', 'pending', 'late', 'moving_out']) status?: 'active' | 'past' | 'pending' | 'late' | 'moving_out';
  @IsOptional() @IsString() notes?: string;
}
export class UpdateTenantDto {
  @IsOptional() @IsUUID() unitId?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() middleName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() profilePicUrl?: string;
  @IsOptional() @IsString() tin?: string;
  @IsOptional() @IsString() businessLicense?: string;
  @IsOptional() @IsString() employer?: string;
  @IsOptional() @IsNumber() monthlyIncome?: number;
  @IsOptional() @IsString() emergencyContact?: string;
  @IsOptional() @IsString() shortCode?: string;
  @IsOptional() @IsString() paymentCode?: string;
  @IsOptional() @IsDateString() leaseStart?: string;
  @IsOptional() @IsDateString() leaseEnd?: string;
  @IsOptional() @IsEnum(['active', 'past', 'pending', 'late', 'moving_out']) status?: 'active' | 'past' | 'pending' | 'late' | 'moving_out';
  @IsOptional() @IsString() notes?: string;
}

export class CreatePaymentDto {
  @IsOptional() @IsUUID() chargeId?: string;
  @IsUUID() tenantId!: string;
  @IsUUID() unitId!: string;
  @IsNumber() amount!: number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsDateString() forMonth!: string;
  @IsDateString() paidAt!: string;
  @IsOptional() @IsString() method?: string;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() notes?: string;
}
