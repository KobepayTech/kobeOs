import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateContactDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(120) company?: string;
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(40) group?: string;
  @IsOptional() @IsBoolean() favorite?: boolean;
  @IsOptional() @IsString() notes?: string;
}
export class UpdateContactDto extends CreateContactDto {
  @IsOptional() @IsString() @MaxLength(120) declare name: string;
}
