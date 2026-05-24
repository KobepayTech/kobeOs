import {
  IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min,
} from 'class-validator';

const PLANS = ['Basic', 'Pro', 'Enterprise'] as const;
const COMPANY_STATUS = ['Active', 'Trial', 'Expired', 'Suspended'] as const;
const SUB_STATUS = ['Active', 'Trial', 'Expired', 'Cancelled'] as const;
const INVOICE_STATUS = ['Paid', 'Pending', 'Failed', 'Overdue'] as const;
const TICKET_STATUS = ['Open', 'In Progress', 'Resolved'] as const;
const PRIORITY = ['Low', 'Medium', 'High', 'Critical'] as const;

/* ---------------- companies ---------------- */
export class CreateCompanyDto {
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(160) email?: string;
  @IsOptional() @IsString() @MaxLength(80) country?: string;
  @IsOptional() @IsEnum(PLANS) plan?: 'Basic' | 'Pro' | 'Enterprise';
  @IsOptional() @IsInt() @Min(0) users?: number;
  @IsOptional() @IsInt() @Min(0) modules?: number;
  @IsOptional() @IsEnum(COMPANY_STATUS) status?: 'Active' | 'Trial' | 'Expired' | 'Suspended';
  @IsOptional() @IsNumber() revenue?: number;
  @IsOptional() @IsString() @MaxLength(40) joined?: string;
}
export class UpdateCompanyDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MaxLength(160) email?: string;
  @IsOptional() @IsString() @MaxLength(80) country?: string;
  @IsOptional() @IsEnum(PLANS) plan?: 'Basic' | 'Pro' | 'Enterprise';
  @IsOptional() @IsInt() @Min(0) users?: number;
  @IsOptional() @IsInt() @Min(0) modules?: number;
  @IsOptional() @IsEnum(COMPANY_STATUS) status?: 'Active' | 'Trial' | 'Expired' | 'Suspended';
  @IsOptional() @IsNumber() revenue?: number;
  @IsOptional() @IsString() @MaxLength(40) joined?: string;
}

/* ---------------- subscriptions ---------------- */
export class CreateSubscriptionDto {
  @IsString() @MaxLength(160) company!: string;
  @IsOptional() @IsEnum(PLANS) plan?: 'Basic' | 'Pro' | 'Enterprise';
  @IsOptional() @IsNumber() price?: number;
  @IsOptional() @IsString() @MaxLength(40) startDate?: string;
  @IsOptional() @IsString() @MaxLength(40) endDate?: string;
  @IsOptional() @IsEnum(SUB_STATUS) status?: 'Active' | 'Trial' | 'Expired' | 'Cancelled';
  @IsOptional() @IsBoolean() autoRenew?: boolean;
}
export class UpdateSubscriptionDto {
  @IsOptional() @IsString() @MaxLength(160) company?: string;
  @IsOptional() @IsEnum(PLANS) plan?: 'Basic' | 'Pro' | 'Enterprise';
  @IsOptional() @IsNumber() price?: number;
  @IsOptional() @IsString() @MaxLength(40) startDate?: string;
  @IsOptional() @IsString() @MaxLength(40) endDate?: string;
  @IsOptional() @IsEnum(SUB_STATUS) status?: 'Active' | 'Trial' | 'Expired' | 'Cancelled';
  @IsOptional() @IsBoolean() autoRenew?: boolean;
}

/* ---------------- invoices ---------------- */
export class CreateInvoiceDto {
  @IsString() @MaxLength(160) company!: string;
  @IsOptional() @IsNumber() amount?: number;
  @IsOptional() @IsString() @MaxLength(40) date?: string;
  @IsOptional() @IsString() @MaxLength(40) dueDate?: string;
  @IsOptional() @IsEnum(INVOICE_STATUS) status?: 'Paid' | 'Pending' | 'Failed' | 'Overdue';
}
export class UpdateInvoiceDto {
  @IsOptional() @IsString() @MaxLength(160) company?: string;
  @IsOptional() @IsNumber() amount?: number;
  @IsOptional() @IsString() @MaxLength(40) date?: string;
  @IsOptional() @IsString() @MaxLength(40) dueDate?: string;
  @IsOptional() @IsEnum(INVOICE_STATUS) status?: 'Paid' | 'Pending' | 'Failed' | 'Overdue';
}

/* ---------------- roles ---------------- */
export class CreateRoleDto {
  @IsString() @MaxLength(80) name!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) permissions?: string[];
  @IsOptional() @IsInt() @Min(0) userCount?: number;
  @IsOptional() @IsBoolean() builtIn?: boolean;
}
export class UpdateRoleDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) permissions?: string[];
  @IsOptional() @IsInt() @Min(0) userCount?: number;
  @IsOptional() @IsBoolean() builtIn?: boolean;
}

/* ---------------- tickets ---------------- */
export class CreateTicketDto {
  @IsString() @MaxLength(160) company!: string;
  @IsString() @MaxLength(200) subject!: string;
  @IsOptional() @IsEnum(TICKET_STATUS) status?: 'Open' | 'In Progress' | 'Resolved';
  @IsOptional() @IsEnum(PRIORITY) priority?: 'Low' | 'Medium' | 'High' | 'Critical';
  @IsOptional() @IsString() @MaxLength(40) created?: string;
}
export class UpdateTicketDto {
  @IsOptional() @IsString() @MaxLength(160) company?: string;
  @IsOptional() @IsString() @MaxLength(200) subject?: string;
  @IsOptional() @IsEnum(TICKET_STATUS) status?: 'Open' | 'In Progress' | 'Resolved';
  @IsOptional() @IsEnum(PRIORITY) priority?: 'Low' | 'Medium' | 'High' | 'Critical';
  @IsOptional() @IsString() @MaxLength(40) created?: string;
}
