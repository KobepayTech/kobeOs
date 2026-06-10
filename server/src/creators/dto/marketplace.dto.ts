import {
  IsString, IsNumber, IsOptional, IsArray, IsEnum, IsUUID, Min, Max,
} from 'class-validator';

export class AddReviewDto {
  @IsUUID() creatorId!: string;
  @IsString() brandName!: string;
  @IsNumber() @Min(1) @Max(5) rating!: number;
  @IsString() comment!: string;
  @IsOptional() @IsString() campaignName?: string;
}

export class SetPackagesDto {
  @IsArray() packages!: Array<{
    tier: 'Basic' | 'Standard' | 'Premium';
    platform: string;
    deliverables: string;
    price: number;
    deliveryDays: number;
    revisions: number;
  }>;
}

export class CampaignAnalyticsDto {
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
}
