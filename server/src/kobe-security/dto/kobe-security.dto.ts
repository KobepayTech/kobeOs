import { IsArray, IsBoolean, IsIn, IsNumber, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateSecurityClientDto {
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(160) contactName?: string;
  @IsOptional() @IsString() @MaxLength(40) contactPhone?: string;
  @IsOptional() @IsString() @MaxLength(80) registrationNumber?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
export class UpdateSecurityClientDto extends CreateSecurityClientDto {}

export class CreateClientSiteDto {
  @IsUUID() clientId!: string;
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() @MaxLength(80) plan?: string;
  @IsOptional() @IsArray() zoneIds?: string[];
}
export class UpdateClientSiteDto extends CreateClientSiteDto {}

export class CreateTeamMemberDto {
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsIn(['active', 'inactive', 'suspended']) status?: 'active' | 'inactive' | 'suspended';
  @IsOptional() @IsUUID() assignedSiteId?: string;
}
export class UpdateTeamMemberDto extends CreateTeamMemberDto {}

export class CreateServiceRouteDto {
  @IsUUID() siteId!: string;
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsArray() checkpointNames?: string[];
  @IsOptional() @IsBoolean() active?: boolean;
}
export class UpdateServiceRouteDto extends CreateServiceRouteDto {}

export class CreateServiceCheckDto {
  @IsUUID() routeId!: string;
  @IsUUID() memberId!: string;
  @IsString() @MaxLength(160) checkpointName!: string;
  @IsOptional() @IsIn(['checked', 'missed', 'late']) status?: 'checked' | 'missed' | 'late';
  @IsOptional() @IsString() note?: string;
}
export class UpdateServiceCheckDto extends CreateServiceCheckDto {}

export class CreateSiteSignalDto {
  @IsOptional() @IsUUID() siteId?: string;
  @IsString() @MaxLength(160) zoneId!: string;
  @IsString() @MaxLength(160) zoneName!: string;
  @IsOptional() @IsString() @MaxLength(80) eventType?: string;
  @IsOptional() @IsIn(['info', 'warning', 'critical']) severity?: 'info' | 'warning' | 'critical';
  @IsOptional() @IsBoolean() occupied?: boolean;
  @IsOptional() @IsNumber() peopleCount?: number;
  @IsOptional() @IsNumber() confidence?: number;
  @IsOptional() @IsObject() raw?: Record<string, unknown>;
}
export class UpdateSiteSignalDto extends CreateSiteSignalDto {}

export class CreateWorkItemDto {
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsUUID() siteId?: string;
  @IsString() @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(40) priority?: string;
  @IsOptional() @IsString() @MaxLength(40) state?: string;
  @IsOptional() @IsString() details?: string;
}
export class UpdateWorkItemDto extends CreateWorkItemDto {}
