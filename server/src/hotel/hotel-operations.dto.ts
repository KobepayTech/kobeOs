import { IsArray, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { HotelDepartment } from './hotel-operations.entity';

export class HotelRequisitionLineDto {
  @IsOptional() @IsUUID() inventoryId?: string;
  @IsString() name!: string;
  @IsNumber() @Min(0.01) quantity!: number;
  @IsOptional() @IsNumber() @Min(0) approvedQuantity?: number;
  @IsString() unit!: string;
  @IsOptional() @IsNumber() @Min(0) unitCost?: number;
}

export class CreateHotelRequisitionDto {
  @IsEnum(['bar', 'kitchen', 'cleaning', 'room-amenities']) department!: HotelDepartment;
  @IsArray() @ValidateNested({ each: true }) @Type(() => HotelRequisitionLineDto) lines!: HotelRequisitionLineDto[];
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsUUID() hotelId?: string;
}

export class ReviewHotelRequisitionDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => HotelRequisitionLineDto) lines!: HotelRequisitionLineDto[];
  @IsOptional() @IsString() reviewedBy?: string;
}

export class CreatePayrollDto {
  @IsString() employeeName!: string;
  @IsOptional() @IsUUID() staffId?: string;
  @IsString() period!: string;
  @IsNumber() @Min(0) baseSalary!: number;
  @IsOptional() @IsNumber() @Min(0) overtime?: number;
  @IsOptional() @IsNumber() @Min(0) allowances?: number;
  @IsOptional() @IsNumber() @Min(0) deductions?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsUUID() hotelId?: string;
}

export class CreatePettyCashDto {
  @IsEnum(['expense', 'top_up']) kind!: 'expense' | 'top_up';
  @IsString() category!: string;
  @IsNumber() @Min(0.01) amount!: number;
  @IsString() description!: string;
  @IsOptional() @IsString() paidTo?: string;
  @IsOptional() @IsString() reference?: string;
  @IsDateString() entryDate!: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsUUID() hotelId?: string;
}

export class CreateAssetDto {
  @IsOptional() @IsString() assetCode?: string;
  @IsString() name!: string;
  @IsOptional() @IsString() category?: string;
  @IsDateString() acquisitionDate!: string;
  @IsNumber() @Min(0) acquisitionCost!: number;
  @IsOptional() @IsNumber() @Min(0) residualValue?: number;
  @IsInt() @Min(1) usefulLifeMonths!: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsUUID() hotelId?: string;
}
