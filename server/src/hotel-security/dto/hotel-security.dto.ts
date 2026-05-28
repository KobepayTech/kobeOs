import { IsBoolean, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateHotelRoomSignalLinkDto {
  @IsUUID() roomId!: string;
  @IsString() @MaxLength(40) roomNumber!: string;
  @IsString() @MaxLength(160) zoneId!: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
export class UpdateHotelRoomSignalLinkDto extends CreateHotelRoomSignalLinkDto {}

export class CreateHotelRoomReviewDto {
  @IsUUID() roomId!: string;
  @IsString() @MaxLength(40) roomNumber!: string;
  @IsOptional() @IsString() @MaxLength(40) risk?: 'normal' | 'watch' | 'high' | 'critical';
  @IsOptional() @IsString() @MaxLength(40) state?: 'open' | 'reviewing' | 'resolved' | 'closed';
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() summary?: string;
  @IsOptional() @IsObject() snapshot?: Record<string, unknown>;
}
export class UpdateHotelRoomReviewDto extends CreateHotelRoomReviewDto {}
