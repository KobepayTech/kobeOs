import { IsArray, IsBoolean, IsEmail, IsInt, IsNumber, IsOptional, IsString, IsUrl, MaxLength, Min } from 'class-validator';

export class CreateCreatorDto {
  @IsString() @MaxLength(120) name!: string;
  @IsString() @MaxLength(80) handle!: string;
  @IsOptional() @IsString() @MaxLength(80) niche?: string;
  @IsOptional() @IsInt() @Min(0) followers?: number;
  @IsOptional() @IsNumber() engagement?: number;
  @IsOptional() @IsUrl() avatarUrl?: string;
  @IsOptional() @IsEmail() contactEmail?: string;
  @IsOptional() @IsArray() platforms?: string[];
  @IsOptional() @IsBoolean() verified?: boolean;
}
export class UpdateCreatorDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() niche?: string;
  @IsOptional() @IsInt() followers?: number;
  @IsOptional() @IsNumber() engagement?: number;
  @IsOptional() @IsUrl() avatarUrl?: string;
  @IsOptional() @IsEmail() contactEmail?: string;
  @IsOptional() @IsArray() platforms?: string[];
  @IsOptional() @IsBoolean() verified?: boolean;
}
