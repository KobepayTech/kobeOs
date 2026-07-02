import {
  IsArray, IsBoolean, IsIn, IsNumber, IsObject, IsOptional, IsString,
  MaxLength, Min, Max, ArrayMaxSize, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Nested types for jerseyConfig — each field has a length cap so an
 *  operator (or anyone who got write access) can't blow up the storefront
 *  JSON with megabyte strings, and arrays are bounded so they can't be
 *  used to exhaust memory. */

class TopPromoDto {
  @IsOptional() @IsString() @MaxLength(200) text?: string;
  @IsOptional() @IsString() @MaxLength(80)  ctaText?: string;
  @IsOptional() @IsString() @MaxLength(40)  bgColor?: string;
}

class HeroDto {
  @IsOptional() @IsString() @MaxLength(200) headline?: string;
  @IsOptional() @IsString() @MaxLength(400) subtext?: string;
  @IsOptional() @IsString() @MaxLength(80)  cta?: string;
  @IsOptional() @IsString() @MaxLength(500) imageUrl?: string;
  @IsOptional() @IsString() @MaxLength(40)  gradientFrom?: string;
  @IsOptional() @IsString() @MaxLength(40)  gradientTo?: string;
}

class TrustStripItemDto {
  @IsIn(['truck', 'shield', 'rotate', 'star']) icon!: 'truck' | 'shield' | 'rotate' | 'star';
  @IsString() @MaxLength(80)  title!: string;
  @IsString() @MaxLength(200) desc!: string;
}

class FooterLinkDto {
  @IsString() @MaxLength(80)  label!: string;
  @IsOptional() @IsString() @MaxLength(500) href?: string;
}

class FooterColumnDto {
  @IsString() @MaxLength(80) title!: string;
  @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => FooterLinkDto)
  items!: FooterLinkDto[];
}

class TierDto {
  @IsString() @MaxLength(80) slug!: string;
  @IsString() @MaxLength(80) label!: string;
  @IsOptional() @IsString() @MaxLength(80)  parentSlug?: string;
  @IsOptional() @IsString() @MaxLength(500) href?: string;
}

class LanguageDto {
  @IsString() @MaxLength(10)  code!: string;
  @IsString() @MaxLength(60)  label!: string;
}

class TrustpilotDto {
  @IsOptional() @IsString() @MaxLength(80) businessUnitId?: string;
  @IsOptional() @IsString() @MaxLength(80) templateId?: string;
}

export class JerseyConfigDto {
  @IsOptional() @ValidateNested() @Type(() => TopPromoDto) topPromo?: TopPromoDto;
  @IsOptional() @ValidateNested() @Type(() => HeroDto)     hero?: HeroDto;

  @IsOptional() @IsArray() @ArrayMaxSize(8) @ValidateNested({ each: true }) @Type(() => TrustStripItemDto)
  trustStrip?: TrustStripItemDto[];

  @IsOptional() @IsArray() @ArrayMaxSize(8) @ValidateNested({ each: true }) @Type(() => FooterColumnDto)
  footerColumns?: FooterColumnDto[];

  @IsOptional() @IsString() @MaxLength(400) newsletterPitch?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => TierDto)
  tiers?: TierDto[];

  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => LanguageDto)
  languages?: LanguageDto[];

  @IsOptional() @ValidateNested() @Type(() => TrustpilotDto) trustpilot?: TrustpilotDto;

  @IsOptional() @IsArray() @ArrayMaxSize(16)
  @IsString({ each: true })
  paymentLogos?: string[];
}

export class UpsertStoreSettingsDto {
  @IsOptional() @IsString() @MaxLength(200) storeName?: string;
  @IsOptional() @IsString() @MaxLength(300) tagline?: string;
  @IsOptional() @IsString() @MaxLength(1000) logoUrl?: string;
  @IsOptional() @IsString() @MaxLength(1000) faviconUrl?: string;

  /** Custom domain e.g. shop.mycompany.com — null clears it */
  @IsOptional() @IsString() @MaxLength(253) customDomain?: string | null;

  @IsOptional() @IsString() @MaxLength(200) bannerHeadline?: string;
  @IsOptional() @IsString() @MaxLength(300) bannerSubtext?: string;
  @IsOptional() @IsString() @MaxLength(100) bannerCta?: string;
  @IsOptional() @IsString() @MaxLength(80)  bannerBg?: string;
  @IsOptional() @IsString() @MaxLength(40)  bannerHeight?: string;
  @IsOptional() @IsBoolean() bannerVisible?: boolean;

  @IsOptional() @IsString() @MaxLength(40) primaryColor?: string;
  @IsOptional() @IsString() @MaxLength(40) accentColor?: string;
  @IsOptional() @IsString() @MaxLength(40) bgStyle?: string;
  @IsOptional() @IsString() @MaxLength(40) cardStyle?: string;

  @IsOptional() @IsNumber() @Min(1) @Max(6) gridColumns?: number;
  @IsOptional() @IsString() @MaxLength(40) productCardStyle?: string;
  @IsOptional() @IsBoolean() showStock?: boolean;
  @IsOptional() @IsBoolean() showCategoryBadge?: boolean;
  @IsOptional() @IsBoolean() showQuickAdd?: boolean;
  @IsOptional() @IsNumber() @Min(1) @Max(100) productsPerPage?: number;

  @IsOptional() @IsString() @MaxLength(40) headerStyle?: string;
  @IsOptional() @IsBoolean() showSearch?: boolean;
  @IsOptional() @IsBoolean() showCategoryNav?: boolean;
  @IsOptional() @IsBoolean() showCartIcon?: boolean;
  @IsOptional() @IsString() @MaxLength(300) footerText?: string;
  @IsOptional() @IsBoolean() enableCategoryNav?: boolean;

  @IsOptional() @IsString() @MaxLength(40) headingSize?: string;
  @IsOptional() @IsString() @MaxLength(40) bodySize?: string;

  /** Storefront design config — fully validated (see JerseyConfigDto). */
  @IsOptional() @IsObject() @ValidateNested() @Type(() => JerseyConfigDto)
  jerseyConfig?: JerseyConfigDto;

  /** Storefront preview template — 'generic' or 'jerseys'. Controls which
   *  live-preview layout the store editor renders on the right panel. */
  @IsOptional() @IsString() @IsIn(['generic', 'jerseys']) @MaxLength(40)
  template?: 'generic' | 'jerseys';
}
