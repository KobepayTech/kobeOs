import {
  IsDateString, IsEnum, IsInt, IsNumber, IsOptional,
  IsString, IsUUID, MaxLength, Min, IsObject,
} from 'class-validator';

export class CreateMatchDto {
  @IsString() @MaxLength(40) sport!: string;
  @IsString() @MaxLength(120) homeTeam!: string;
  @IsString() @MaxLength(120) awayTeam!: string;
  @IsDateString() kickoff!: string;
  @IsOptional() @IsString() venue?: string;
  @IsOptional() @IsString() competition?: string;
  @IsOptional() @IsString() season?: string;
}

export class UpdateMatchDto {
  @IsOptional() @IsEnum(['SCHEDULED', 'LIVE', 'HT', 'FT', 'POSTPONED', 'CANCELLED']) status?: string;
  @IsOptional() @IsInt() @Min(0) homeScore?: number;
  @IsOptional() @IsInt() @Min(0) awayScore?: number;
  @IsOptional() @IsObject() homeLineup?: Record<string, unknown>;
  @IsOptional() @IsObject() awayLineup?: Record<string, unknown>;
  @IsOptional() @IsObject() stats?: Record<string, unknown>;
}

export class CreateMatchEventDto {
  @IsUUID() matchId!: string;
  @IsEnum(['GOAL', 'YELLOW_CARD', 'RED_CARD', 'SUBSTITUTION', 'OFFSIDE', 'FOUL', 'PENALTY', 'VAR', 'KICKOFF', 'HT', 'FT'])
  type!: string;
  @IsInt() @Min(0) minute!: number;
  @IsOptional() @IsString() playerName?: string;
  @IsOptional() @IsString() team?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

export class CreatePlayerDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() teamId?: string;
  @IsOptional() @IsString() teamName?: string;
  @IsOptional() @IsString() position?: string;
  @IsOptional() @IsString() nationality?: string;
  @IsOptional() @IsInt() jerseyNumber?: number;
  @IsOptional() @IsNumber() rating?: number;
  @IsOptional() @IsObject() stats?: Record<string, unknown>;
}

export class UpdatePlayerDto {
  @IsOptional() @IsString() position?: string;
  @IsOptional() @IsNumber() rating?: number;
  @IsOptional() @IsObject() stats?: Record<string, unknown>;
  @IsOptional() @IsString() teamId?: string;
  @IsOptional() @IsString() teamName?: string;
}

export class CreateTeamDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() shortName?: string;
  @IsOptional() @IsString() competition?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() stadium?: string;
}

export class UpdateTeamDto {
  @IsOptional() @IsInt() @Min(0) played?: number;
  @IsOptional() @IsInt() @Min(0) won?: number;
  @IsOptional() @IsInt() @Min(0) drawn?: number;
  @IsOptional() @IsInt() @Min(0) lost?: number;
  @IsOptional() @IsInt() @Min(0) goalsFor?: number;
  @IsOptional() @IsInt() @Min(0) goalsAgainst?: number;
  @IsOptional() @IsInt() @Min(0) points?: number;
  @IsOptional() @IsString() logoUrl?: string;
}

export class UpdateAnalyticsDto {
  @IsOptional() @IsObject() possession?: Record<string, unknown>;
  @IsOptional() @IsObject() heatmaps?: Record<string, unknown>;
  @IsOptional() @IsObject() passingNetwork?: Record<string, unknown>;
  @IsOptional() @IsObject() playerTracking?: Record<string, unknown>;
  @IsOptional() @IsObject() xgData?: Record<string, unknown>;
  @IsOptional() @IsObject() formations?: Record<string, unknown>;
}
