import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const QUICK_ADD_SOURCE_TYPES = [
  'QUICK_ADD_PHOTO',
  'QUICK_ADD_SCREENSHOT',
  'QUICK_ADD_MESSAGE',
  'QUICK_ADD_IMPORT',
] as const;

export class MediaItemOverrideDto {
  @IsUUID() itemId!: string;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

export class ProcessMediaInboxDto {
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(250)
  @IsUUID('4', { each: true })
  itemIds!: string[];

  @IsString() @MaxLength(60)
  moduleId!: string;

  @IsString() @MaxLength(80)
  entityType!: string;

  @IsOptional() @IsUUID()
  entityId?: string;

  @IsOptional() @IsString() @MaxLength(120)
  category?: string;

  @IsOptional() @IsString() @MaxLength(120)
  subcategory?: string;

  @IsOptional() @IsObject()
  defaults?: Record<string, unknown>;

  @IsOptional() @IsArray() @ArrayMaxSize(250)
  @ValidateNested({ each: true }) @Type(() => MediaItemOverrideDto)
  overrides?: MediaItemOverrideDto[];

  @IsOptional() @IsBoolean()
  createEntities?: boolean;

  /** PO is intentionally not accepted here; PO products enter through
   * receiving, while every media-inbox product is a Quick Add product. */
  @IsOptional() @IsEnum(QUICK_ADD_SOURCE_TYPES)
  sourceType?: (typeof QUICK_ADD_SOURCE_TYPES)[number];
}

export class ImportUrlsDto {
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(200)
  @IsString({ each: true }) @MaxLength(2048, { each: true })
  urls!: string[];
}

export class UpdateMediaInboxItemDto {
  @IsOptional() @IsString() @MaxLength(120) category?: string;
  @IsOptional() @IsString() @MaxLength(120) subcategory?: string;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

export class SuggestMediaMetadataDto {
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(25)
  @IsUUID('4', { each: true })
  itemIds!: string[];

  @IsOptional() @IsString() @MaxLength(60)
  moduleId?: string;

  @IsOptional() @IsString() @MaxLength(120)
  categoryHint?: string;
}

export class ProductDefaultsDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(80) sku?: string;
  @IsOptional() @IsString() @MaxLength(80) barcode?: string;
  @IsOptional() @IsString() @MaxLength(120) category?: string;
  @IsOptional() @IsString() @MaxLength(120) subcategory?: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsNumber() @Min(0) cost?: number;
  @IsOptional() @IsNumber() @Min(0) stock?: number;
  @IsOptional() @IsNumber() @Min(0) taxRate?: number;
  @IsOptional() @IsString() @MaxLength(80) supplier?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) sizes?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) colours?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}
