import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class GuidedVehicleDto {
  @IsString() @MaxLength(60) make!: string;
  @IsString() @MaxLength(80) model!: string;
  @IsOptional() @IsString() @MaxLength(80) trim?: string;
  @IsInt() @Min(1886) @Max(2100) year!: number;
  @IsInt() @Min(0) @Max(10000000) mileage!: number;
  @IsIn(['NEW', 'USED', 'IMPORTED']) condition!: 'NEW' | 'USED' | 'IMPORTED';
  @IsIn(['AVAILABLE', 'IN_TRANSIT', 'COMING_SOON']) availability!: 'AVAILABLE' | 'IN_TRANSIT' | 'COMING_SOON';
  @IsString() @MaxLength(60) transmission!: string;
  @IsString() @MaxLength(60) fuel!: string;
  @IsString() @MaxLength(60) color!: string;
  @IsOptional() @IsString() @MaxLength(60) driveType?: string;
  @IsOptional() @IsString() @MaxLength(80) engine?: string;
  @IsOptional() @IsString() @MaxLength(60) bodyType?: string;
  @IsString() @MaxLength(160) location!: string;
  @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(100, { each: true }) features!: string[];
  @IsString() @MaxLength(4000) description!: string;
  @IsBoolean() financingAvailable!: boolean;
  @IsBoolean() negotiable!: boolean;
  @IsBoolean() published!: boolean;
}
