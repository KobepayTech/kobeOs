import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import type { RiskGrade } from '../credit.entity';

export class UpsertCreditProfileDto {
  @IsString() @MaxLength(40) customerPhone!: string;
  @IsOptional() @IsString() @MaxLength(120) customerName?: string;
  @IsNumber() @Min(0) creditLimit!: number;
  @IsOptional() @IsEnum(['A+', 'A', 'B', 'C', 'D']) riskGrade?: RiskGrade;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class RecordPaymentDto {
  @IsNumber() @Min(0.0001) amount!: number;
  @IsOptional() @IsString() reference?: string;
}

export class CheckCreditDto {
  @IsString() customerPhone!: string;
  @IsNumber() @Min(0) amount!: number;
  @IsOptional() @IsInt() @Min(1) installmentMonths?: number;
}
