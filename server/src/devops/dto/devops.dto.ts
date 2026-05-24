import {
  IsArray, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const COMMIT_STATUS = ['Merged', 'Open', 'Pending'] as const;
const FLAG_STATUS = ['Enabled', 'Disabled'] as const;
const ENVIRONMENT = ['Dev', 'Staging', 'Production'] as const;
const DEPLOY_STATUS = ['Deployed', 'Deploying', 'Failed', 'Pending'] as const;
const PRIORITY = ['Critical', 'High', 'Medium', 'Low'] as const;
const ISSUE_STATUS = ['Open', 'In Progress', 'Resolved', 'Closed'] as const;

/* ---------------- commits ---------------- */
export class CreateCommitDto {
  @IsString() @MaxLength(280) message!: string;
  @IsOptional() @IsString() @MaxLength(120) author?: string;
  @IsOptional() @IsString() @MaxLength(80) module?: string;
  @IsOptional() @IsString() @MaxLength(120) branch?: string;
  @IsOptional() @IsEnum(COMMIT_STATUS) status?: 'Merged' | 'Open' | 'Pending';
  @IsOptional() @IsString() @MaxLength(40) date?: string;
}
export class UpdateCommitDto {
  @IsOptional() @IsString() @MaxLength(280) message?: string;
  @IsOptional() @IsString() @MaxLength(120) author?: string;
  @IsOptional() @IsString() @MaxLength(80) module?: string;
  @IsOptional() @IsString() @MaxLength(120) branch?: string;
  @IsOptional() @IsEnum(COMMIT_STATUS) status?: 'Merged' | 'Open' | 'Pending';
  @IsOptional() @IsString() @MaxLength(40) date?: string;
}

/* ---------------- feature flags ---------------- */
export class CreateFeatureFlagDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(80) module?: string;
  @IsOptional() @IsString() @MaxLength(280) description?: string;
  @IsOptional() @IsEnum(FLAG_STATUS) status?: 'Enabled' | 'Disabled';
  @IsOptional() @IsInt() @Min(0) companiesAffected?: number;
  @IsOptional() @IsString() @MaxLength(120) createdBy?: string;
  @IsOptional() @IsInt() @Min(0) rolloutPercent?: number;
}
export class UpdateFeatureFlagDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(80) module?: string;
  @IsOptional() @IsString() @MaxLength(280) description?: string;
  @IsOptional() @IsEnum(FLAG_STATUS) status?: 'Enabled' | 'Disabled';
  @IsOptional() @IsInt() @Min(0) companiesAffected?: number;
  @IsOptional() @IsString() @MaxLength(120) createdBy?: string;
  @IsOptional() @IsInt() @Min(0) rolloutPercent?: number;
}

/* ---------------- deployments ---------------- */
export class CreateDeploymentDto {
  @IsString() @MaxLength(80) module!: string;
  @IsOptional() @IsEnum(ENVIRONMENT) environment?: 'Dev' | 'Staging' | 'Production';
  @IsOptional() @IsEnum(DEPLOY_STATUS) status?: 'Deployed' | 'Deploying' | 'Failed' | 'Pending';
  @IsOptional() @IsString() @MaxLength(40) timestamp?: string;
  @IsOptional() @IsString() @MaxLength(40) duration?: string;
}
export class UpdateDeploymentDto {
  @IsOptional() @IsString() @MaxLength(80) module?: string;
  @IsOptional() @IsEnum(ENVIRONMENT) environment?: 'Dev' | 'Staging' | 'Production';
  @IsOptional() @IsEnum(DEPLOY_STATUS) status?: 'Deployed' | 'Deploying' | 'Failed' | 'Pending';
  @IsOptional() @IsString() @MaxLength(40) timestamp?: string;
  @IsOptional() @IsString() @MaxLength(40) duration?: string;
}

/* ---------------- issues ---------------- */
export class IssueCommentDto {
  @IsString() @MaxLength(120) author!: string;
  @IsString() @MaxLength(2000) text!: string;
  @IsString() @MaxLength(40) date!: string;
}
export class CreateIssueDto {
  @IsString() @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(80) module?: string;
  @IsOptional() @IsEnum(PRIORITY) priority?: 'Critical' | 'High' | 'Medium' | 'Low';
  @IsOptional() @IsEnum(ISSUE_STATUS) status?: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  @IsOptional() @IsString() @MaxLength(120) assignee?: string;
  @IsOptional() @IsString() @MaxLength(40) created?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => IssueCommentDto)
  comments?: IssueCommentDto[];
}
export class UpdateIssueDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(80) module?: string;
  @IsOptional() @IsEnum(PRIORITY) priority?: 'Critical' | 'High' | 'Medium' | 'Low';
  @IsOptional() @IsEnum(ISSUE_STATUS) status?: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  @IsOptional() @IsString() @MaxLength(120) assignee?: string;
  @IsOptional() @IsString() @MaxLength(40) created?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => IssueCommentDto)
  comments?: IssueCommentDto[];
}
