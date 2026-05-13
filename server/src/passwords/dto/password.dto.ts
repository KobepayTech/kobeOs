import { IsBoolean, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreatePasswordDto {
  @IsString() @MaxLength(200) title!: string;
  @IsOptional() @IsUrl() url?: string;
  @IsOptional() @IsString() @MaxLength(200) username?: string;
  @IsString() cipher!: string;
  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsOptional() @IsBoolean() favorite?: boolean;
}

export class UpdatePasswordDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsUrl() url?: string;
  @IsOptional() @IsString() @MaxLength(200) username?: string;
  @IsOptional() @IsString() cipher?: string;
  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsOptional() @IsBoolean() favorite?: boolean;
}
