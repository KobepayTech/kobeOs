import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAirHubDto {
  @IsString() @MaxLength(20) code!: string;
  @IsString() name!: string;
  @IsString() country!: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsNumber() delayHours?: number;
  @IsOptional() @IsNumber() reliabilityScore?: number;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() notes?: string;
}

export class CreateAirlineDto {
  @IsString() @MaxLength(20) code!: string;
  @IsString() name!: string;
  @IsOptional() @IsString() contractRef?: string;
  @IsOptional() @IsNumber() pricePerKg?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsNumber() reliabilityScore?: number;
  @IsOptional() @IsNumber() averageDelayHours?: number;
  @IsOptional() @IsNumber() cargoCapacityKg?: number;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() notes?: string;
}

export class CreateRoutePlanDto {
  @IsOptional() @IsString() routeCode?: string;
  @IsOptional() @IsString() shipmentId?: string;
  @IsOptional() @IsString() priority?: string;
  @IsString() origin!: string;
  @IsString() destination!: string;
  @IsOptional() @IsString() cargoType?: string;
  @IsOptional() @IsNumber() weightKg?: number;
  @IsOptional() @IsString() selectedAirline?: string;
  @IsOptional() @IsString() selectedFlightNumber?: string;
  @IsOptional() @IsNumber() estimatedFlightHours?: number;
  @IsOptional() @IsNumber() customsDelayHours?: number;
  @IsOptional() @IsNumber() transitDelayHours?: number;
  @IsOptional() @IsNumber() deliveryHours?: number;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() notes?: string;
}
