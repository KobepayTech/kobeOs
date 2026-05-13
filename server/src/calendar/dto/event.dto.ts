import { IsBoolean, IsDateString, IsHexColor, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateEventDto {
  @IsString() @MaxLength(200) title!: string;
  @IsOptional() @IsString() description?: string;
  @IsDateString() startAt!: string;
  @IsDateString() endAt!: string;
  @IsOptional() @IsBoolean() allDay?: boolean;
  @IsOptional() @IsHexColor() color?: string;
  @IsOptional() @IsString() @MaxLength(200) location?: string;
}
export class UpdateEventDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsDateString() startAt?: string;
  @IsOptional() @IsDateString() endAt?: string;
  @IsOptional() @IsBoolean() allDay?: boolean;
  @IsOptional() @IsHexColor() color?: string;
  @IsOptional() @IsString() @MaxLength(200) location?: string;
}
