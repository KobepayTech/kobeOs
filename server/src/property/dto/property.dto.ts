import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

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
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsNumber() bedrooms?: number;
  @IsOptional() @IsNumber() bathrooms?: number;
  @IsOptional() @IsInt() @Min(0) sqft?: number;
  @IsOptional() @IsString() floor?: string;
  @IsOptional() @IsNumber() rentAmount?: number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @IsEnum(['vacant', 'occupied', 'turnover', 'unavailable', 'maintenance']) status?: 'vacant' | 'occupied' | 'turnover' | 'unavailable' | 'maintenance';
  @IsOptional() @IsString() notes?: string;
}
export class UpdateUnitDto {
  @IsOptional() @IsUUID() propertyId?: string;
  @IsOptional() @IsString() unitNumber?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsNumber() bedrooms?: number;
  @IsOptional() @IsNumber() bathrooms?: number;
  @IsOptional() @IsInt() @Min(0) sqft?: number;
  @IsOptional() @IsString() floor?: string;
  @IsOptional() @IsNumber() rentAmount?: number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @IsEnum(['vacant', 'occupied', 'turnover', 'unavailable', 'maintenance']) status?: 'vacant' | 'occupied' | 'turnover' | 'unavailable' | 'maintenance';
  @IsOptional() @IsString() notes?: string;
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
