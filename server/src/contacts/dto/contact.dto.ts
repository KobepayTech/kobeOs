import { IsArray, IsBoolean, IsEmail, IsHexColor, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateContactDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(120) company?: string;
  @IsOptional() @IsString() @MaxLength(120) jobTitle?: string;
  @IsOptional() @IsString() @MaxLength(240) address?: string;
  @IsOptional() @IsArray() groups?: string[];
  @IsOptional() @IsBoolean() favorite?: boolean;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsHexColor() color?: string;
}

export class UpdateContactDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(120) company?: string;
  @IsOptional() @IsString() @MaxLength(120) jobTitle?: string;
  @IsOptional() @IsString() @MaxLength(240) address?: string;
  @IsOptional() @IsArray() groups?: string[];
  @IsOptional() @IsBoolean() favorite?: boolean;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsHexColor() color?: string;
}
