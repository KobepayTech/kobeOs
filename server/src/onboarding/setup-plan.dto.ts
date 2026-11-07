import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min,
  ValidateNested,
} from 'class-validator';

/**
 * The interview answers the plan is built from. Sent with the request rather
 * than read from storage, so the plan can be previewed while the owner is
 * still answering and before anything has been saved.
 */
export class SetupAnswersDto {
  @IsString() @MaxLength(40) businessType!: string;
  @IsOptional() @IsString() @MaxLength(120) businessName?: string;
  @IsOptional() @IsString() @MaxLength(80) timezone?: string;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1000000) employeeCount?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true })
  @MaxLength(60, { each: true }) services?: string[];
}

export class ProvisionSetupDto {
  @ValidateNested() @Type(() => SetupAnswersDto) answers!: SetupAnswersDto;
  /** Exactly what the owner ticked. Omitted means nothing, not everything. */
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true })
  @MaxLength(40, { each: true }) bundleIds?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true })
  @MaxLength(60, { each: true }) automationKeys?: string[];
}
