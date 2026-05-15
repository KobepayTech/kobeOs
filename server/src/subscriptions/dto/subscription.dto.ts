import {
  IsArray, IsBoolean, IsDateString, IsEnum, IsNumber,
  IsOptional, IsString, IsUUID, Min,
} from 'class-validator';
import { SubscriptionPlan, SubscriptionStatus } from '../subscription.entity';

const PLANS: SubscriptionPlan[] = ['Basic', 'Pro', 'Enterprise'];
const STATUSES: SubscriptionStatus[] = ['Trial', 'Active', 'Expired', 'Cancelled'];

export class CreateSubscriptionDto {
  @IsUUID() companyId!: string;
  @IsEnum(PLANS) plan!: SubscriptionPlan;
  @IsNumber() @Min(0) price!: number;
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
  @IsOptional() @IsBoolean() autoRenew?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) enabledModules?: string[];
}

export class UpdateSubscriptionDto {
  @IsOptional() @IsEnum(PLANS) plan?: SubscriptionPlan;
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsEnum(STATUSES) status?: SubscriptionStatus;
  @IsOptional() @IsBoolean() autoRenew?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) enabledModules?: string[];
}
