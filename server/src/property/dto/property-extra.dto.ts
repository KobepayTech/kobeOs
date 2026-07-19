import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateLeaseDto {
  @IsUUID() unitId!: string;
  @IsUUID() tenantId!: string;
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
  @IsNumber() monthlyRent!: number;
  @IsOptional() @IsNumber() deposit?: number;
  @IsOptional() @IsInt() @Min(1) rentDueDay?: number;
  @IsOptional() @IsNumber() lateFee?: number;
  @IsOptional() @IsEnum(['upcoming', 'active', 'ended', 'cancelled']) status?: 'upcoming' | 'active' | 'ended' | 'cancelled';
  @IsOptional() @IsString() notes?: string;
}

export class UpdateLeaseDto {
  @IsOptional() @IsUUID() unitId?: string;
  @IsOptional() @IsUUID() tenantId?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsNumber() monthlyRent?: number;
  @IsOptional() @IsNumber() deposit?: number;
  @IsOptional() @IsInt() @Min(1) rentDueDay?: number;
  @IsOptional() @IsNumber() lateFee?: number;
  @IsOptional() @IsEnum(['upcoming', 'active', 'ended', 'cancelled']) status?: 'upcoming' | 'active' | 'ended' | 'cancelled';
  @IsOptional() @IsString() notes?: string;
}

export class GenerateChargesDto { @IsString() period!: string; }

export class CreateChargeDto {
  @IsUUID() leaseId!: string;
  @IsUUID() tenantId!: string;
  @IsUUID() unitId!: string;
  @IsString() period!: string;
  @IsDateString() dueDate!: string;
  @IsNumber() amount!: number;
  @IsOptional() @IsNumber() amountPaid?: number;
  @IsOptional() @IsEnum(['open', 'partial', 'paid', 'overdue', 'waived']) status?: 'open' | 'partial' | 'paid' | 'overdue' | 'waived';
  @IsOptional() @IsString() notes?: string;
}

export class UpdateChargeDto {
  @IsOptional() @IsNumber() amount?: number;
  @IsOptional() @IsNumber() amountPaid?: number;
  @IsOptional() @IsEnum(['open', 'partial', 'paid', 'overdue', 'waived']) status?: 'open' | 'partial' | 'paid' | 'overdue' | 'waived';
  @IsOptional() @IsString() notes?: string;
}

export class CreateVendorDto {
  @IsString() name!: string;
  @IsOptional() @IsEnum(['plumber', 'electrician', 'hvac', 'handyman', 'cleaning', 'landscaping', 'security', 'manager', 'general']) category?: 'plumber' | 'electrician' | 'hvac' | 'handyman' | 'cleaning' | 'landscaping' | 'security' | 'manager' | 'general';
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsString() notes?: string;
}
export class UpdateVendorDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(['plumber', 'electrician', 'hvac', 'handyman', 'cleaning', 'landscaping', 'security', 'manager', 'general']) category?: 'plumber' | 'electrician' | 'hvac' | 'handyman' | 'cleaning' | 'landscaping' | 'security' | 'manager' | 'general';
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsString() notes?: string;
}

export class CreateWorkOrderDto {
  @IsOptional() @IsUUID() propertyId?: string;
  @IsOptional() @IsUUID() unitId?: string;
  @IsOptional() @IsUUID() tenantId?: string;
  @IsOptional() @IsUUID() vendorId?: string;
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(['low', 'normal', 'high', 'urgent']) priority?: 'low' | 'normal' | 'high' | 'urgent';
  @IsOptional() @IsEnum(['open', 'assigned', 'in_progress', 'completed', 'cancelled']) status?: 'open' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @IsDateString() completedAt?: string;
  @IsOptional() @IsNumber() cost?: number;
  @IsOptional() @IsString() notes?: string;
}
export class UpdateWorkOrderDto {
  @IsOptional() @IsUUID() propertyId?: string;
  @IsOptional() @IsUUID() unitId?: string;
  @IsOptional() @IsUUID() tenantId?: string;
  @IsOptional() @IsUUID() vendorId?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(['low', 'normal', 'high', 'urgent']) priority?: 'low' | 'normal' | 'high' | 'urgent';
  @IsOptional() @IsEnum(['open', 'assigned', 'in_progress', 'completed', 'cancelled']) status?: 'open' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @IsDateString() completedAt?: string;
  @IsOptional() @IsNumber() cost?: number;
  @IsOptional() @IsString() notes?: string;
}

export class CreateApplicationDto {
  @IsOptional() @IsUUID() unitId?: string;
  @IsString() firstName!: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsNumber() monthlyIncome?: number;
  @IsOptional() @IsString() employer?: string;
  @IsOptional() @IsDateString() desiredMoveIn?: string;
  @IsOptional() @IsEnum(['new', 'screening', 'approved', 'declined', 'withdrawn']) status?: 'new' | 'screening' | 'approved' | 'declined' | 'withdrawn';
  @IsOptional() @IsString() notes?: string;
}
export class UpdateApplicationDto {
  @IsOptional() @IsUUID() unitId?: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsNumber() monthlyIncome?: number;
  @IsOptional() @IsString() employer?: string;
  @IsOptional() @IsDateString() desiredMoveIn?: string;
  @IsOptional() @IsEnum(['new', 'screening', 'approved', 'declined', 'withdrawn']) status?: 'new' | 'screening' | 'approved' | 'declined' | 'withdrawn';
  @IsOptional() @IsString() notes?: string;
}

export class UpdateSettingsDto {
  @IsOptional() @IsInt() defaultRentDueDay?: number;
  @IsOptional() @IsNumber() lateFeeAmount?: number;
  @IsOptional() @IsInt() lateFeeGraceDays?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() reminderChannels?: string;
  @IsOptional() @IsString() invoicePrefix?: string;
}

export class CreateExpenseDto {
  @IsOptional() @IsUUID() propertyId?: string;
  @IsOptional() @IsUUID() unitId?: string;
  @IsString() title!: string;
  @IsOptional() @IsString() category?: string;
  @IsNumber() amount!: number;
  @IsOptional() @IsString() currency?: string;
  @IsDateString() spentAt!: string;
  @IsOptional() @IsString() notes?: string;
}
export class UpdateExpenseDto {
  @IsOptional() @IsUUID() propertyId?: string;
  @IsOptional() @IsUUID() unitId?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsNumber() amount?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsDateString() spentAt?: string;
  @IsOptional() @IsString() notes?: string;
}

export class CreateRentIncreaseSimulationDto {
  @IsOptional() @IsUUID() propertyId?: string;
  @IsNumber() increasePercent!: number;
  @IsOptional() @IsString() notes?: string;
}

export class PropertySiteConfigDto {
  @IsOptional() @IsString() businessName?: string;
  @IsOptional() @IsString() tagline?: string;
  @IsOptional() @IsString() primaryColor?: string;
  @IsOptional() @IsString() heroHeadline?: string;
  @IsOptional() @IsString() heroSubtext?: string;
  @IsOptional() @IsString() about?: string;
  @IsOptional() @IsString() services?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
}
