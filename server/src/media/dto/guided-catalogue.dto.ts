import { GuidedVehicleDto } from './guided-vehicle.dto';
import { PropertyListingDto } from '../../property/dto/property-listing.dto';
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class GuidedVariantDto {
  @IsOptional() @IsString() @MaxLength(60) color?: string;
  @IsString() @MaxLength(60) size!: string;
  @IsNumber() @Min(0) @Max(1e12) price!: number;
  @IsInt() @Min(0) @Max(10000000) stock!: number;
}
class GuidedPurchaseCostDto {
  @IsNumber() @Min(0) @Max(1e12) unitPrice!: number;
  @Matches(/^[A-Z]{3}$/) currency!: string;
  @IsNumber() @Min(0.000001) @Max(1e9) exchangeRate!: number;
  @IsNumber() @Min(0) @Max(1e12) transportPerUnit!: number;
}

export class GuidedCatalogueDto {
  @IsOptional() @ValidateNested() @Type(() => GuidedPurchaseCostDto) purchaseCost?: GuidedPurchaseCostDto;
  @IsIn(["shop", "hotel", "restaurant", "dealership", "property"]) businessType!:
    "shop" | "hotel" | "restaurant" | "dealership" | "property";
  @IsOptional() @IsUUID() relatedEntityId?: string;
  @IsOptional() @Matches(/^[A-Z]{3}$/) currency?: string;
  @IsOptional() @ValidateNested() @Type(() => GuidedVehicleDto) vehicle?: GuidedVehicleDto;
  @IsOptional() @ValidateNested() @Type(() => PropertyListingDto) property?: PropertyListingDto;
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(60) color?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(1e12) discountPrice?: number;
  @IsString() @MaxLength(60) category!: string;
  @IsNumber() @Min(0) @Max(1e12) price!: number;
  @IsInt() @Min(0) @Max(10000000) stock!: number;
  @IsString() @MaxLength(60) size!: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => GuidedVariantDto)
  variants?: GuidedVariantDto[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  roomNumbers?: string[];
  @IsOptional() @IsInt() @Min(1) @Max(100) capacity?: number;
}
