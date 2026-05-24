import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateUserRoleDto {
  @IsEnum(['user', 'admin'])
  role!: 'user' | 'admin';
}

export class UpdateCompanyStatusDto {
  @IsEnum(['Active', 'Trial', 'Suspended', 'Cancelled'])
  status!: string;
}

export class CreateCompanyAdminDto {
  @IsString() name!: string;
  @IsString() email!: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() ownerId?: string;
}
