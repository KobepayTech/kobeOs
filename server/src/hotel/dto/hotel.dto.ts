import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateRoomDto {
  @IsString() @MaxLength(40) roomNumber!: string;
  @IsString() @MaxLength(60) type!: string;
  @IsNumber() rate!: number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @IsInt() @Min(1) capacity?: number;
  @IsOptional() @IsEnum(['available', 'occupied', 'reserved', 'maintenance']) status?: 'available' | 'occupied' | 'reserved' | 'maintenance';
}
export class UpdateRoomDto {
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsNumber() rate?: number;
  @IsOptional() @IsInt() capacity?: number;
  @IsOptional() @IsEnum(['available', 'occupied', 'reserved', 'maintenance']) status?: 'available' | 'occupied' | 'reserved' | 'maintenance';
}

export class CreateGuestDto {
  @IsString() @MaxLength(120) name!: string;
  @IsString() @MaxLength(40) phone!: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() nationality?: string;
  @IsOptional() @IsString() idType?: string;
  @IsOptional() @IsString() idNumber?: string;
}
export class UpdateGuestDto extends CreateGuestDto {
  @IsOptional() @IsString() declare name: string;
  @IsOptional() @IsString() declare phone: string;
}

export class CreateBookingDto {
  @IsUUID() roomId!: string;
  @IsUUID() guestId!: string;
  @IsDateString() checkIn!: string;
  @IsDateString() checkOut!: string;
  @IsOptional() @IsInt() @Min(1) guestCount?: number;
  @IsOptional() @IsNumber() totalAmount?: number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
}
export class UpdateBookingDto {
  @IsOptional() @IsEnum(['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED']) status?: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';
  @IsOptional() @IsDateString() checkIn?: string;
  @IsOptional() @IsDateString() checkOut?: string;
  @IsOptional() @IsNumber() totalAmount?: number;
}
