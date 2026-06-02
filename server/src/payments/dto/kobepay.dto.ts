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
  /** ERP webhook destination for receipt dispatch (Model 2). */
  @IsOptional() @IsString() erpEndpointUrl?: string;
  @IsOptional() @IsString() erpApiKey?: string;
  @IsOptional() @IsString() erpAccountId?: string;
}

export class UpdateCustomerDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() idNumber?: string;
  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() erpEndpointUrl?: string;
  @IsOptional() @IsString() erpApiKey?: string;
  @IsOptional() @IsString() erpAccountId?: string;
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
  @IsOptional() @IsString() city?: string;
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

  /* Profit-accounting inputs (optional; default sensibly). */
  @IsOptional() @IsString() targetCurrency?: string;
  @IsOptional() @IsNumber() @Min(0) targetAmount?: number;
  @IsOptional() @IsNumber() @Min(0) salesRate?: number;
  @IsOptional() @IsNumber() @Min(0) collectedTzs?: number;
  @IsOptional() @IsNumber() @Min(0) serviceFee?: number;
  @IsOptional() @IsString() cashierName?: string;

  /** Customer's USD-denominated intent (e.g. "send 10,000 USD"). When
   *  set, the service derives targetAmount = quoteUsd × USD→target rate
   *  if targetAmount wasn't already supplied, locking the supplier's
   *  CNY receipt regardless of subsequent rate moves. */
  @IsOptional() @IsNumber() @Min(0) quoteUsd?: number;
  /** Cash leg currency the customer paid with — 'USD' or 'TZS'. */
  @IsOptional() @IsString() cashCurrency?: string;
  /** Single-supplier city (multi-supplier deposits set city per line). */
  @IsOptional() @IsString() supplierCity?: string;
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

  /* Profit-accounting inputs. */
  @IsOptional() @IsUUID() depositId?: string;
  @IsOptional() @IsNumber() @Min(0) actualRate?: number;
  @IsOptional() @IsNumber() @Min(0) actualCostTzs?: number;
  @IsOptional() @IsNumber() @Min(0) transactionFees?: number;
  @IsOptional() @IsNumber() @Min(0) bankCharges?: number;
  @IsOptional() @IsNumber() @Min(0) mobileMoneyCharges?: number;
  @IsOptional() @IsNumber() @Min(0) agentCommission?: number;
}

export class UpdatePayoutStatusDto {
  @IsEnum(['INITIATED', 'SENT', 'CONFIRMED', 'PAID', 'REJECTED']) status!: PayoutStatus;
  @IsOptional() @IsString() confirmedBy?: string;
  @IsOptional() @IsString() notes?: string;
  /* Set on transition to PAID so realized profit can be calculated. */
  @IsOptional() @IsNumber() @Min(0) actualRate?: number;
  @IsOptional() @IsNumber() @Min(0) actualCostTzs?: number;
  @IsOptional() @IsNumber() @Min(0) transactionFees?: number;
  @IsOptional() @IsNumber() @Min(0) bankCharges?: number;
  @IsOptional() @IsNumber() @Min(0) mobileMoneyCharges?: number;
  @IsOptional() @IsNumber() @Min(0) agentCommission?: number;
}

export class CreateAllocationDto {
  @IsUUID() customerId!: string;
  @IsUUID() supplierId!: string;
  @IsNumber() @Min(0.0001) amount!: number;
  @IsString() orderRef!: string;
  @IsOptional() @IsEnum(['Deposit', 'Full']) type?: 'Deposit' | 'Full';
}
