import { IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRoomDto {
  @IsString() @MaxLength(40) roomNumber!: string;
  @IsString() @MaxLength(60) type!: string;
  @IsNumber() @Min(0) rate!: number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @IsInt() @Min(1) capacity?: number;
  @IsOptional() @IsEnum(['available', 'occupied', 'reserved', 'maintenance']) status?: 'available' | 'occupied' | 'reserved' | 'maintenance';
}
export class UpdateRoomDto {
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsNumber() @Min(0) rate?: number;
  @IsOptional() @IsInt() @Min(1) capacity?: number;
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
  @IsOptional() @IsNumber() @Min(0) totalAmount?: number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
}
export class UpdateBookingDto {
  @IsOptional() @IsEnum(['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED']) status?: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';
  @IsOptional() @IsDateString() checkIn?: string;
  @IsOptional() @IsDateString() checkOut?: string;
  @IsOptional() @IsNumber() @Min(0) totalAmount?: number;
}

export class CreateTenantDto {
  /** URL-safe slug: lowercase letters, digits, hyphens; 2–40 chars. */
  @IsString() @Matches(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/) slug!: string;
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(20) brandColor?: string;
  @IsOptional() @IsString() @MaxLength(500) logoUrl?: string;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
}
export class UpdateTenantDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(20) brandColor?: string;
  @IsOptional() @IsString() @MaxLength(500) logoUrl?: string;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
}

export class CreateMenuItemDto {
  @IsString() @MaxLength(120) name!: string;
  @IsString() @MaxLength(60) category!: string;
  @IsNumber() @Min(0) price!: number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @IsBoolean() available?: boolean;
  @IsOptional() @IsEnum(['kitchen', 'bar', 'other']) station?: 'kitchen' | 'bar' | 'other';
}
export class UpdateMenuItemDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsBoolean() available?: boolean;
  @IsOptional() @IsEnum(['kitchen', 'bar', 'other']) station?: 'kitchen' | 'bar' | 'other';
}

export class OrderItemDto {
  @IsOptional() @IsUUID() menuItemId?: string;
  @IsString() @MaxLength(120) name!: string;
  @IsInt() @Min(1) qty!: number;
  @IsNumber() @Min(0) price!: number;
  @IsOptional() @IsEnum(['kitchen', 'bar', 'other']) station?: 'kitchen' | 'bar' | 'other';
}
export class CreateOrderDto {
  @IsString() @MaxLength(40) roomNumber!: string;
  @IsOptional() @IsEnum(['room', 'table']) locationType?: 'room' | 'table';
  @IsOptional() @IsString() @MaxLength(120) guestName?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => OrderItemDto) items!: OrderItemDto[];
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
export class UpdateOrderStatusDto {
  @IsEnum(['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED'])
  status!: 'PENDING' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';
}

export class CreateServiceRequestDto {
  @IsString() @MaxLength(40) roomNumber!: string;
  @IsString() @MaxLength(40) kind!: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
export class UpdateServiceRequestStatusDto {
  @IsEnum(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
  status!: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
}
