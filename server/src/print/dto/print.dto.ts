import {
  IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min,
} from 'class-validator';

/* ---------------- products ---------------- */
export class CreatePrintProductDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsNumber() basePrice!: number;
  @IsOptional() @IsString() @MaxLength(60) method?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() @MaxLength(40) icon?: string;
}
export class UpdatePrintProductDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsOptional() @IsNumber() basePrice?: number;
  @IsOptional() @IsString() @MaxLength(60) method?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() @MaxLength(40) icon?: string;
}

/* ---------------- jobs ---------------- */
const PRIORITIES = ['High', 'Medium', 'Low'] as const;
const JOB_STATUSES = ['Pending', 'Printing', 'Finishing', 'Completed'] as const;

export class CreatePrintJobDto {
  @IsString() @MaxLength(200) product!: string;
  @IsOptional() @IsString() @MaxLength(120) customer?: string;
  @IsOptional() @IsString() @MaxLength(60) method?: string;
  @IsOptional() @IsInt() @Min(1) qty?: number;
  @IsOptional() @IsEnum(PRIORITIES) priority?: 'High' | 'Medium' | 'Low';
  @IsOptional() @IsEnum(JOB_STATUSES) status?: 'Pending' | 'Printing' | 'Finishing' | 'Completed';
  @IsOptional() @IsString() @MaxLength(60) dueDate?: string;
}
export class UpdatePrintJobDto {
  @IsOptional() @IsString() @MaxLength(200) product?: string;
  @IsOptional() @IsString() @MaxLength(120) customer?: string;
  @IsOptional() @IsString() @MaxLength(60) method?: string;
  @IsOptional() @IsInt() @Min(1) qty?: number;
  @IsOptional() @IsEnum(PRIORITIES) priority?: 'High' | 'Medium' | 'Low';
  @IsOptional() @IsEnum(JOB_STATUSES) status?: 'Pending' | 'Printing' | 'Finishing' | 'Completed';
  @IsOptional() @IsString() @MaxLength(60) dueDate?: string;
}

/* ---------------- materials ---------------- */
export class CreatePrintMaterialDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(60) type?: string;
  @IsOptional() @IsNumber() @Min(0) stock?: number;
  @IsOptional() @IsString() @MaxLength(20) unit?: string;
  @IsOptional() @IsNumber() @Min(0) minThreshold?: number;
  @IsOptional() @IsString() @MaxLength(20) color?: string;
}
export class UpdatePrintMaterialDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(60) type?: string;
  @IsOptional() @IsNumber() @Min(0) stock?: number;
  @IsOptional() @IsString() @MaxLength(20) unit?: string;
  @IsOptional() @IsNumber() @Min(0) minThreshold?: number;
  @IsOptional() @IsString() @MaxLength(20) color?: string;
}

/* ---------------- customers ---------------- */
export class CreatePrintCustomerDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(120) contact?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(160) email?: string;
  @IsOptional() @IsString() @MaxLength(20) status?: string;
  @IsOptional() @IsInt() @Min(0) orders?: number;
  @IsOptional() @IsNumber() @Min(0) totalSpent?: number;
}
export class UpdatePrintCustomerDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(120) contact?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(160) email?: string;
  @IsOptional() @IsString() @MaxLength(20) status?: string;
  @IsOptional() @IsInt() @Min(0) orders?: number;
  @IsOptional() @IsNumber() @Min(0) totalSpent?: number;
}
