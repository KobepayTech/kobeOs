import {
  IsDateString, IsEnum, IsInt, IsNumber, IsOptional,
  IsString, IsUUID, MaxLength, Min,
} from 'class-validator';

export class CreateParcelDto {
  @IsString() @MaxLength(40) parcelId!: string;
  @IsString() @MaxLength(120) senderName!: string;
  @IsString() @MaxLength(40) senderPhone!: string;
  @IsString() @MaxLength(120) ownerName!: string;
  @IsString() @MaxLength(40) ownerPhone!: string;
  @IsString() @MaxLength(120) destination!: string;
  @IsOptional() @IsInt() @Min(1) packageCount?: number;
  @IsOptional() @IsNumber() weight?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(['PAY_NOW', 'PAY_ON_ARRIVAL']) paymentMode?: 'PAY_NOW' | 'PAY_ON_ARRIVAL';
}

export class UpdateParcelDto {
  @IsOptional() @IsString() destination?: string;
  @IsOptional() @IsString() description?: string;
}

export class UpdateParcelStatusDto {
  @IsEnum(['REGISTERED', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED', 'CANCELLED'])
  status!: string;
}

export class CreateShipmentDto {
  @IsString() shipmentId!: string;
  @IsString() origin!: string;
  @IsString() destination!: string;
  @IsOptional() @IsNumber() weight?: number;
  @IsOptional() @IsDateString() etd?: string;
  @IsOptional() @IsDateString() eta?: string;
  @IsOptional() @IsString() carrier?: string;
  @IsOptional() @IsString() flightNumber?: string;
}

export class UpdateShipmentDto {
  @IsOptional() @IsString() origin?: string;
  @IsOptional() @IsString() destination?: string;
  @IsOptional() @IsNumber() weight?: number;
  @IsOptional() @IsDateString() etd?: string;
  @IsOptional() @IsDateString() eta?: string;
  @IsOptional() @IsString() carrier?: string;
  @IsOptional() @IsString() flightNumber?: string;
}

export class UpdateShipmentStatusDto {
  @IsEnum(['PENDING', 'LOADING', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED', 'CANCELLED'])
  status!: string;
}

export class AssignDriverDto {
  @IsUUID() driverId!: string;
}

export class AssignFlightDto {
  @IsUUID() flightId!: string;
}

export class CreateDriverDto {
  @IsString() @MaxLength(120) name!: string;
  @IsString() @MaxLength(40) phone!: string;
  @IsOptional() @IsString() vehicle?: string;
  @IsOptional() @IsString() plateNumber?: string;
  @IsOptional() @IsEnum(['AVAILABLE', 'ON_TRIP', 'OFF_DUTY']) status?: 'AVAILABLE' | 'ON_TRIP' | 'OFF_DUTY';
}

export class UpdateDriverDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() vehicle?: string;
  @IsOptional() @IsString() plateNumber?: string;
  @IsOptional() @IsEnum(['AVAILABLE', 'ON_TRIP', 'OFF_DUTY']) status?: 'AVAILABLE' | 'ON_TRIP' | 'OFF_DUTY';
  @IsOptional() @IsNumber() rating?: number;
}

export class CreateFlightDto {
  @IsString() flightNumber!: string;
  @IsString() origin!: string;
  @IsString() destination!: string;
  @IsDateString() departureAt!: string;
  @IsDateString() arrivalAt!: string;
  @IsOptional() @IsString() carrier?: string;
  @IsOptional() @IsNumber() capacityKg?: number;
  @IsOptional() @IsString() status?: string;
}

export class UpdateFlightDto {
  @IsOptional() @IsDateString() departureAt?: string;
  @IsOptional() @IsDateString() arrivalAt?: string;
  @IsOptional() @IsString() carrier?: string;
  @IsOptional() @IsNumber() capacityKg?: number;
  @IsOptional() @IsNumber() bookedKg?: number;
  @IsOptional() @IsString() status?: string;
}
