import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertModuleSiteSettingsDto {
  @IsOptional() @IsString() @MaxLength(200)
  name?: string;

  @IsOptional() @IsString() @MaxLength(300)
  tagline?: string;

  @IsOptional() @IsString() @MaxLength(1000)
  logoUrl?: string;

  @IsOptional() @IsString() @MaxLength(1000)
  faviconUrl?: string;

  @IsOptional() @IsString() @MaxLength(40)
  primaryColor?: string;

  @IsOptional() @IsString() @MaxLength(40)
  accentColor?: string;

  @IsOptional() @IsString() @MaxLength(63)
  domainSlug?: string;

  @IsOptional() @IsString() @MaxLength(253)
  customDomain?: string | null;

  @IsOptional() @IsObject()
  config?: Record<string, unknown>;

  @IsOptional() @IsObject()
  seo?: Record<string, unknown>;
}
