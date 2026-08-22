import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminUpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @IsEnum(['user', 'admin', 'government_viewer', 'settlement_officer', 'compliance_officer', 'traffic_enforcement'])
  role?: 'user' | 'admin' | 'government_viewer' | 'settlement_officer' | 'compliance_officer' | 'traffic_enforcement';
}
