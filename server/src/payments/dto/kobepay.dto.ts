import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';
import type { DepositStatus, DepositTxnType, PayoutStatus } from '../kobepay.entity';

export class UpsertCustomerDto {
  @IsString() @MaxLength(120) name!: string;
  @IsString() @MaxLength(40)  phone!: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() idNumber?: string;
  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateCustomerDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() idNumber?: string;
  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpsertSupplierDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() contact?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEnum(['Active', 'Inactive']) status?: 'Active' | 'Inactive';
}

export class UpdateSupplierDto extends UpsertSupplierDto {
  @IsOptional() @IsString() declare name: string;
}

class DepositSupplierLineDto {
  @IsString() supplierNumber!: string;
  @IsString() supplierName!: string;
  @IsNumber() @Min(0) amount!: number;
}

export class CreateDepositDto {
  @IsUUID() customerId!: string;
  @IsNumber() @Min(0.0001) amount!: number;
  @IsOptional() @IsString() currency?: string;
  @IsString() method!: string;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsEnum(['Pending', 'Confirmed']) status?: DepositStatus;
  @IsOptional() @IsEnum(['Deposit', 'Goods on Delivery']) txnType?: DepositTxnType;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => DepositSupplierLineDto)
  suppliers?: DepositSupplierLineDto[];
}

export class ConfirmDepositDto {
  @IsEnum(['Pending', 'Confirmed']) status!: DepositStatus;
}

export class CreatePayoutDto {
  @IsUUID() supplierId!: string;
  @IsNumber() @Min(0.0001) amount!: number;
  @IsOptional() @IsString() currency?: string;
  @IsString() method!: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() initiatedBy?: string;
}

export class UpdatePayoutStatusDto {
  @IsEnum(['INITIATED', 'SENT', 'CONFIRMED', 'PAID', 'REJECTED']) status!: PayoutStatus;
  @IsOptional() @IsString() confirmedBy?: string;
  @IsOptional() @IsString() notes?: string;
}

export class CreateAllocationDto {
  @IsUUID() customerId!: string;
  @IsUUID() supplierId!: string;
  @IsNumber() @Min(0.0001) amount!: number;
  @IsString() orderRef!: string;
  @IsOptional() @IsEnum(['Deposit', 'Full']) type?: 'Deposit' | 'Full';
}
