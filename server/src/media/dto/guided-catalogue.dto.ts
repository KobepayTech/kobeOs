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
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class GuidedVariantDto {
  @IsString() @MaxLength(60) size!: string;
  @IsNumber() @Min(0) @Max(1e12) price!: number;
  @IsInt() @Min(0) @Max(10000000) stock!: number;
}
export class GuidedCatalogueDto {
  @IsIn(["shop", "hotel", "restaurant"]) businessType!:
    "shop" | "hotel" | "restaurant";
  @IsString() @MaxLength(120) name!: string;
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
