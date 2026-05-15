import {
  IsBoolean, IsNumber, IsOptional, IsString, MaxLength, Min, Max,
} from 'class-validator';

export class UpsertStoreSettingsDto {
  @IsOptional() @IsString() @MaxLength(200) storeName?: string;
  @IsOptional() @IsString() @MaxLength(300) tagline?: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() faviconUrl?: string;

  /** Custom domain e.g. shop.mycompany.com — null clears it */
  @IsOptional() @IsString() @MaxLength(253) customDomain?: string | null;

  @IsOptional() @IsString() @MaxLength(200) bannerHeadline?: string;
  @IsOptional() @IsString() @MaxLength(300) bannerSubtext?: string;
  @IsOptional() @IsString() @MaxLength(100) bannerCta?: string;
  @IsOptional() @IsString() bannerBg?: string;
  @IsOptional() @IsString() bannerHeight?: string;
  @IsOptional() @IsBoolean() bannerVisible?: boolean;

  @IsOptional() @IsString() primaryColor?: string;
  @IsOptional() @IsString() accentColor?: string;
  @IsOptional() @IsString() bgStyle?: string;
  @IsOptional() @IsString() cardStyle?: string;

  @IsOptional() @IsNumber() @Min(1) @Max(6) gridColumns?: number;
  @IsOptional() @IsString() productCardStyle?: string;
  @IsOptional() @IsBoolean() showStock?: boolean;
  @IsOptional() @IsBoolean() showCategoryBadge?: boolean;
  @IsOptional() @IsBoolean() showQuickAdd?: boolean;
  @IsOptional() @IsNumber() @Min(1) @Max(100) productsPerPage?: number;

  @IsOptional() @IsString() headerStyle?: string;
  @IsOptional() @IsBoolean() showSearch?: boolean;
  @IsOptional() @IsBoolean() showCategoryNav?: boolean;
  @IsOptional() @IsBoolean() showCartIcon?: boolean;
  @IsOptional() @IsString() @MaxLength(300) footerText?: string;
  @IsOptional() @IsBoolean() enableCategoryNav?: boolean;

  @IsOptional() @IsString() headingSize?: string;
  @IsOptional() @IsString() bodySize?: string;
}
