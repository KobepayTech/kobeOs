import { IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CompanyStatus } from '../company.entity';

export class CreateCompanyDto {
  @IsString() @MaxLength(200) name!: string;
  @IsEmail() email!: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() phone?: string;
}

export class UpdateCompanyDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEnum(['Active', 'Trial', 'Suspended', 'Cancelled']) status?: CompanyStatus;
}
