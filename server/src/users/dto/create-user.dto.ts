import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const USER_ROLES = ['user', 'admin', 'government_viewer', 'settlement_officer', 'compliance_officer', 'traffic_enforcement'] as const;
export type UserRole = typeof USER_ROLES[number];

/** Admin creates a real login and assigns the platform role it needs. */
export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @IsIn(USER_ROLES)
  role?: UserRole;
}
