import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
} from "class-validator";

export class GuidedSetupDto {
  @IsIn(["shop", "hotel", "restaurant"]) businessType!:
    "shop" | "hotel" | "restaurant";
  @IsString() @MaxLength(120) businessName!: string;
  @IsString() @MaxLength(160) location!: string;
  @IsString() @MaxLength(40) phone!: string;
  @IsIn(["English", "Kiswahili"]) language!: string;
  @Matches(/^[A-Z]{3}$/) currency!: string;
  @IsString() @MaxLength(80) timezone!: string;
  @IsOptional() @IsBoolean() completed?: boolean;
}
