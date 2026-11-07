import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  Max,
  Min,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
} from "class-validator";

export class GuidedSetupDto {
  @IsIn(["shop", "hotel", "restaurant", "dealership", "property", "other"]) businessType!:
    "shop" | "hotel" | "restaurant" | "dealership" | "property" | "other";
  @IsString() @MaxLength(120) businessName!: string;
  @IsString() @MaxLength(160) location!: string;
  @IsString() @MaxLength(40) phone!: string;
  @IsIn(["English", "Kiswahili"]) language!: string;
  @Matches(/^[A-Z]{3}$/) currency!: string;
  @IsString() @MaxLength(80) timezone!: string;
  @IsOptional() @IsString() @MaxLength(120) displayName?: string;
  @IsOptional() @IsIn(["personal", "business", "username"]) nameKind?: "personal" | "business" | "username";
  @IsOptional() @IsString() @MaxLength(120) documentName?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1000000) employeeCount?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(60, { each: true }) services?: string[];
  @IsOptional() @IsBoolean() completed?: boolean;
}
