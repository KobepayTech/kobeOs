import { IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateRuleDto {
  @IsString() @MaxLength(120) name!: string;
  @IsEnum(['Percentage', 'Fixed', 'BOGO']) type!: 'Percentage' | 'Fixed' | 'BOGO';
  @IsNumber() value!: number;
  @IsOptional() @IsString() productScope?: string;
  @IsOptional() @IsString() customerScope?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
}
export class UpdateRuleDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsNumber() value?: number;
  @IsOptional() @IsString() productScope?: string;
  @IsOptional() @IsString() customerScope?: string;
  @IsOptional() @IsEnum(['Active', 'Scheduled', 'Expired']) status?: 'Active' | 'Scheduled' | 'Expired';
}

export class CreateCouponDto {
  @IsString() @MaxLength(40) code!: string;
  @IsEnum(['Percentage', 'Fixed']) type!: 'Percentage' | 'Fixed';
  @IsNumber() value!: number;
  @IsOptional() @IsInt() @Min(0) usageLimit?: number;
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
export class UpdateCouponDto {
  @IsOptional() @IsNumber() value?: number;
  @IsOptional() @IsInt() @Min(0) usageLimit?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CreateCampaignDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
  @IsOptional() @IsNumber() budget?: number;
  @IsOptional() @IsEnum(['Scheduled', 'Active', 'Expired']) status?: 'Scheduled' | 'Active' | 'Expired';
}
export class UpdateCampaignDto extends CreateCampaignDto {
  @IsOptional() @IsString() declare name: string;
  @IsOptional() @IsDateString() declare startDate: string;
  @IsOptional() @IsDateString() declare endDate: string;
}
