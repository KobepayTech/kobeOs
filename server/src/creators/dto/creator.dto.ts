import {
  IsArray, IsBoolean, IsEmail, IsEnum, IsInt, IsNumber,
  IsOptional, IsString, IsUrl, MaxLength, Min,
} from 'class-validator';

export class CreateCreatorDto {
  @IsString() @MaxLength(120) name!: string;
  @IsString() @MaxLength(80) handle!: string;
  @IsOptional() @IsString() @MaxLength(80) niche?: string;
  @IsOptional() @IsString() @MaxLength(2) country?: string;
  @IsOptional() @IsInt() @Min(0) followers?: number;
  @IsOptional() @IsNumber() engagement?: number;
  @IsOptional() @IsNumber() avgViews?: number;
  @IsOptional() @IsUrl() avatarUrl?: string;
  @IsOptional() @IsEmail() contactEmail?: string;
  @IsOptional() @IsString() @MaxLength(500) bio?: string;
  @IsOptional() @IsArray() platforms?: string[];
  @IsOptional() @IsBoolean() verified?: boolean;
  @IsOptional() @IsNumber() weeklyRateTzs?: number;
  @IsOptional() @IsEnum(['free', 'basic', 'premium', 'elite']) subscriptionTier?: string;
}

export class UpdateCreatorDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() niche?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsInt() followers?: number;
  @IsOptional() @IsNumber() engagement?: number;
  @IsOptional() @IsNumber() avgViews?: number;
  @IsOptional() @IsUrl() avatarUrl?: string;
  @IsOptional() @IsEmail() contactEmail?: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsArray() platforms?: string[];
  @IsOptional() @IsBoolean() verified?: boolean;
  @IsOptional() @IsNumber() weeklyRateTzs?: number;
  @IsOptional() @IsEnum(['free', 'basic', 'premium', 'elite']) subscriptionTier?: string;
}

export class SyncCreatorDto {
  @IsString() platform!: 'tiktok' | 'instagram' | 'youtube';
  @IsString() handle!: string;
}

export class SearchCreatorsDto {
  @IsOptional() @IsString() niche?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsInt() @Min(0) minFollowers?: number;
  @IsOptional() @IsNumber() minEngagement?: number;
  @IsOptional() @IsNumber() minAvgViews?: number;
  @IsOptional() @IsEnum(['free', 'basic', 'premium', 'elite']) tier?: string;
  @IsOptional() @IsInt() @Min(1) page?: number;
  @IsOptional() @IsInt() @Min(1) limit?: number;
}
