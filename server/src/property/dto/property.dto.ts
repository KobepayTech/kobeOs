import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreatePropertyDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsEnum(['residential', 'commercial', 'mixed']) type?: 'residential' | 'commercial' | 'mixed';
  @IsOptional() @IsInt() @Min(0) totalUnits?: number;
}
export class UpdatePropertyDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsEnum(['residential', 'commercial', 'mixed']) type?: 'residential' | 'commercial' | 'mixed';
  @IsOptional() @IsInt() @Min(0) totalUnits?: number;
}

export class CreateUnitDto {
  @IsUUID() propertyId!: string;
  @IsString() @MaxLength(40) unitNumber!: string;
  @IsOptional() @IsNumber() rentAmount?: number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @IsEnum(['vacant', 'occupied', 'maintenance']) status?: 'vacant' | 'occupied' | 'maintenance';
}
export class UpdateUnitDto {
  @IsOptional() @IsString() unitNumber?: string;
  @IsOptional() @IsNumber() rentAmount?: number;
  @IsOptional() @IsEnum(['vacant', 'occupied', 'maintenance']) status?: 'vacant' | 'occupied' | 'maintenance';
}

export class CreateTenantDto {
  @IsOptional() @IsUUID() unitId?: string;
  @IsString() @MaxLength(120) name!: string;
  @IsString() @MaxLength(40) phone!: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsDateString() leaseStart?: string;
  @IsOptional() @IsDateString() leaseEnd?: string;
  @IsOptional() @IsEnum(['active', 'past', 'pending']) status?: 'active' | 'past' | 'pending';
}
export class UpdateTenantDto {
  @IsOptional() @IsUUID() unitId?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsDateString() leaseStart?: string;
  @IsOptional() @IsDateString() leaseEnd?: string;
  @IsOptional() @IsEnum(['active', 'past', 'pending']) status?: 'active' | 'past' | 'pending';
}

export class CreatePaymentDto {
  @IsUUID() tenantId!: string;
  @IsUUID() unitId!: string;
  @IsNumber() amount!: number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsDateString() forMonth!: string;
  @IsDateString() paidAt!: string;
  @IsOptional() @IsString() method?: string;
  @IsOptional() @IsString() reference?: string;
}
