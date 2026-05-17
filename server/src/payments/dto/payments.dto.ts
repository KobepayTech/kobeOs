import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateWalletDto {
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
}

export class TransactionDto {
  @IsUUID() walletId!: string;
  @IsEnum(['CREDIT', 'DEBIT']) type!: 'CREDIT' | 'DEBIT';
  @IsNumber() @Min(0.01) amount!: number;
  @IsOptional() @IsString() counterparty?: string;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() idempotencyKey?: string;
}

export class TransferDto {
  @IsUUID() fromWalletId!: string;
  @IsUUID() toWalletId!: string;
  @IsNumber() @Min(0.01) amount!: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() idempotencyKey?: string;
}

export class CreateLoanDto {
  @IsNumber() @Min(0) principal!: number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @IsNumber() interestRate?: number;
  @IsOptional() @IsInt() termMonths?: number;
  @IsDateString() disbursedAt!: string;
}

export class UpdateLoanDto {
  @IsOptional() @IsEnum(['PENDING', 'ACTIVE', 'PAID', 'DEFAULT']) status?: 'PENDING' | 'ACTIVE' | 'PAID' | 'DEFAULT';
  @IsOptional() @IsNumber() outstanding?: number;
}
