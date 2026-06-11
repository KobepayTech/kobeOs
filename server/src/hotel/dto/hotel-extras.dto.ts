import { IsString, IsNumber, IsOptional, IsEnum, IsUUID, Min } from 'class-validator';

export class CreateHotelChainDto {
  @IsString() slug!: string;
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() brandColor?: string;
}

export class CreateParkingSpotDto {
  @IsUUID() hotelId!: string;
  @IsString() spotNumber!: string;
  @IsEnum(['car', 'motorcycle', 'bus', 'handicap']) type!: 'car' | 'motorcycle' | 'bus' | 'handicap';
  @IsOptional() @IsNumber() @Min(0) ratePerDay?: number;
}

export class UpdateParkingSpotDto {
  @IsOptional() @IsEnum(['free', 'occupied', 'reserved', 'maintenance']) status?: 'free' | 'occupied' | 'reserved' | 'maintenance';
  @IsOptional() @IsString() vehiclePlate?: string;
  @IsOptional() @IsString() vehicleModel?: string;
  @IsOptional() @IsUUID() guestId?: string;
  @IsOptional() reservedUntil?: Date;
}

export class CreateFinancialRecordDto {
  @IsUUID() hotelId!: string;
  @IsString() category!: string;
  @IsNumber() @Min(0) amount!: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() recordDate?: Date;
  @IsOptional() @IsEnum(['daily', 'weekly', 'monthly']) granularity?: 'daily' | 'weekly' | 'monthly';
}

export class HotelAggregationQueryDto {
  @IsOptional() @IsUUID() hotelId?: string;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
}
