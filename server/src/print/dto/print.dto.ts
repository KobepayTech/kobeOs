import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

// ── Print Job DTOs ────────────────────────────────────────────────────────────

export class CreatePrintJobDto {
  @IsString() @MaxLength(40)  jobNumber!: string;
  @IsString() @MaxLength(200) product!: string;
  @IsOptional() @IsString() @MaxLength(200) customer?: string;
  @IsOptional() @IsString() customerPhone?: string;
  @IsOptional() @IsString() customerEmail?: string;
  @IsOptional() @IsString() dueDate?: string;
  @IsOptional() @IsEnum(['High', 'Medium', 'Low']) priority?: string;
  @IsOptional() @IsNumber() @Min(1) qty?: number;
  @IsOptional() @IsString() method?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsNumber() price?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() templateId?: string;
}

export class UpdatePrintJobDto {
  @IsOptional() @IsString() product?: string;
  @IsOptional() @IsString() customer?: string;
  @IsOptional() @IsString() customerPhone?: string;
  @IsOptional() @IsString() customerEmail?: string;
  @IsOptional() @IsString() dueDate?: string;
  @IsOptional() @IsEnum(['High', 'Medium', 'Low']) priority?: string;
  @IsOptional() @IsEnum(['Pending', 'Printing', 'Finishing', 'Completed', 'Cancelled']) status?: string;
  @IsOptional() @IsNumber() @Min(1) qty?: number;
  @IsOptional() @IsString() method?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsNumber() price?: number;
  @IsOptional() @IsString() templateId?: string;
}

// ── Template DTOs ─────────────────────────────────────────────────────────────

export class CreatePrintTemplateDto {
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() method?: string;
  @IsOptional() @IsString() canvasData?: string;
  @IsOptional() @IsString() thumbnailUrl?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdatePrintTemplateDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() method?: string;
  @IsOptional() @IsString() canvasData?: string;
  @IsOptional() @IsString() thumbnailUrl?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

// ── Material DTOs ─────────────────────────────────────────────────────────────

export class CreatePrintMaterialDto {
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsNumber() @Min(0) stock?: number;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsNumber() @Min(0) minThreshold?: number;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsString() supplier?: string;
  @IsOptional() @IsNumber() @Min(0) costPerUnit?: number;
  @IsOptional() @IsString() currency?: string;
}

export class UpdatePrintMaterialDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsNumber() @Min(0) stock?: number;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsNumber() @Min(0) minThreshold?: number;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsString() supplier?: string;
  @IsOptional() @IsNumber() @Min(0) costPerUnit?: number;
}

export class AdjustStockDto {
  @IsNumber() delta!: number; // positive = add, negative = consume
  @IsOptional() @IsString() reason?: string;
}
