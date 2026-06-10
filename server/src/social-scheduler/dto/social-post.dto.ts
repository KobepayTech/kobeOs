import { IsArray, IsEnum, IsISO8601, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

/** Valid platforms for social media publishing */
export const SUPPORTED_PLATFORMS = [
  'instagram',
  'twitter',
  'facebook',
  'linkedin',
  'youtube',
  'tiktok',
  'pinterest',
  'threads',
  'bluesky',
  'mastodon',
] as const;

export type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];

export const POST_STATUSES = ['draft', 'scheduled', 'publishing', 'published', 'failed'] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const ACCOUNT_STATUSES = ['connected', 'expired', 'disconnected'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/* ─────────────── Social Post DTOs ─────────────── */

export class CreateSocialPostDto {
  @IsString() @MaxLength(2000)
  content!: string;

  @IsArray() @IsString({ each: true })
  platforms!: string[];

  @IsOptional() @IsArray() @IsString({ each: true })
  mediaUrls?: string[];

  @IsOptional() @IsISO8601()
  scheduledAt?: string;

  @IsOptional() @IsEnum(POST_STATUSES)
  status?: PostStatus;
}

export class UpdateSocialPostDto {
  @IsOptional() @IsString() @MaxLength(2000)
  content?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  platforms?: string[];

  @IsOptional() @IsArray() @IsString({ each: true })
  mediaUrls?: string[];

  @IsOptional() @IsISO8601()
  scheduledAt?: string;

  @IsOptional() @IsEnum(POST_STATUSES)
  status?: PostStatus;
}

export class PostFiltersDto {
  @IsOptional() @IsEnum(POST_STATUSES)
  status?: PostStatus;

  @IsOptional() @IsString()
  platform?: string;

  @IsOptional() @IsISO8601()
  from?: string;

  @IsOptional() @IsISO8601()
  to?: string;

  @IsOptional() @IsString()
  page?: string;

  @IsOptional() @IsString()
  limit?: string;
}

/* ─────────────── Social Account DTOs ─────────────── */

export class CreateSocialAccountDto {
  @IsString()
  platform!: string;

  @IsString()
  accountName!: string;

  @IsString()
  accountHandle!: string;

  @IsString()
  accessToken!: string;

  @IsOptional() @IsString()
  refreshToken?: string;

  @IsOptional() @IsISO8601()
  tokenExpiresAt?: string;

  @IsOptional() @IsString()
  accountAvatar?: string;

  @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

/* ─────────────── Analytics DTO ─────────────── */

export class AnalyticsFiltersDto {
  @IsOptional() @IsString()
  platform?: string;

  @IsOptional() @IsISO8601()
  from?: string;

  @IsOptional() @IsISO8601()
  to?: string;
}
