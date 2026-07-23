import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { AgentApprovalMode, AgentFrequency } from '../scheduled-agent.entity';

const FREQUENCIES: AgentFrequency[] = ['HOURLY', 'DAILY', 'WEEKLY'];
const APPROVAL_MODES: AgentApprovalMode[] = ['AUTOMATIC', 'APPROVAL_REQUIRED', 'DRAFT_ONLY'];
const OUTPUTS = ['KOBEOS_INBOX', 'SMS_OWNER', 'DRAFT_ONLY'] as const;

export class CreateScheduledAgentDto {
  @IsString() @MaxLength(120) name!: string;
  @IsString() @MaxLength(3000) objective!: string;
  @IsEnum(FREQUENCIES) frequency!: AgentFrequency;
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) timeOfDay?: string;
  @IsOptional() @IsInt() @Min(1) @Max(168) intervalHours?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(7) @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) daysOfWeek?: number[];
  @IsString() @MaxLength(80) timezone!: string;
  @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) allowedModules!: string[];
  @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) allowedTools!: string[];
  @IsEnum(APPROVAL_MODES) approvalMode!: AgentApprovalMode;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) inputSources?: string[];
  @IsIn(OUTPUTS) outputDestination!: (typeof OUTPUTS)[number];
  @IsOptional() @IsBoolean() enabled?: boolean;
}

export class UpdateScheduledAgentDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(3000) objective?: string;
  @IsOptional() @IsEnum(FREQUENCIES) frequency?: AgentFrequency;
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) timeOfDay?: string;
  @IsOptional() @IsInt() @Min(1) @Max(168) intervalHours?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(7) @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) daysOfWeek?: number[];
  @IsOptional() @IsString() @MaxLength(80) timezone?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) allowedModules?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) allowedTools?: string[];
  @IsOptional() @IsEnum(APPROVAL_MODES) approvalMode?: AgentApprovalMode;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) inputSources?: string[];
  @IsOptional() @IsIn(OUTPUTS) outputDestination?: (typeof OUTPUTS)[number];
  @IsOptional() @IsBoolean() enabled?: boolean;
}

export class TestScheduledAgentDto {
  @IsOptional() @IsBoolean() executeAutomaticAction?: boolean;
}
