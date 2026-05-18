import {
  IsArray, IsEnum, IsNumber, IsOptional, IsString,
  IsUUID, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CampaignRequirement } from '../campaign.entity';

export class RequirementDto implements CampaignRequirement {
  @IsEnum(['tiktok', 'instagram', 'youtube']) platform!: 'tiktok' | 'instagram' | 'youtube';
  @IsEnum(['video', 'reel', 'story', 'post']) contentType!: 'video' | 'reel' | 'story' | 'post';
  @IsNumber() @Min(0) minViews!: number;
  @IsOptional() @IsNumber() minLikes?: number;
  @IsString() deadline!: string;
  @IsOptional() @IsString() description?: string;
}

export class CreateCampaignDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsString() niche?: string;
  @IsNumber() @Min(0) budgetTzs!: number;
  @IsOptional() @IsNumber() platformFeePercent?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => RequirementDto)
  requirements?: RequirementDto[];
  @IsOptional() @IsString() endsAt?: string;
}

export class UpdateCampaignDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsString() niche?: string;
  @IsOptional() @IsNumber() budgetTzs?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => RequirementDto)
  requirements?: RequirementDto[];
  @IsOptional() @IsString() endsAt?: string;
}

export class SendOfferDto {
  @IsUUID() creatorId!: string;
  @IsNumber() @Min(1) amountTzs!: number;
  @IsOptional() @IsString() notes?: string;
}

export class RespondOfferDto {
  @IsEnum(['accepted', 'declined', 'negotiating']) response!: 'accepted' | 'declined' | 'negotiating';
  @IsOptional() @IsString() notes?: string;
  /** Counter-offer amount when negotiating */
  @IsOptional() @IsNumber() counterAmountTzs?: number;
}

export class SubmitProofDto {
  @IsArray() @IsString({ each: true }) proofUrls!: string[];
}
