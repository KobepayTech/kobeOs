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

// ── Vision pipeline DTOs ──────────────────────────────────────────────────────

/** A single tracked object in a frame (player, ball, referee). */
export class TrackedObject {
  /** ByteTrack track ID */
  @IsInt() trackId!: number;

  /** 'player_home' | 'player_away' | 'ball' | 'referee' | 'goalkeeper_home' | 'goalkeeper_away' */
  @IsString() class!: string;

  /** Pitch-normalised X coordinate (0 = left goal line, 100 = right goal line) */
  @IsNumber() x!: number;

  /** Pitch-normalised Y coordinate (0 = top touchline, 100 = bottom touchline) */
  @IsNumber() y!: number;

  /** Confidence score from YOLO (0–1) */
  @IsNumber() confidence!: number;

  /** Speed in km/h (computed by ByteTrack from consecutive frames) */
  @IsOptional() @IsNumber() speed?: number;

  /** Jersey number if detected via OCR */
  @IsOptional() @IsInt() jerseyNumber?: number;

  /** Bounding box in original pixel coords [x1, y1, x2, y2] */
  @IsOptional() metadata?: number[];
}

/**
 * A single processed frame from the AI vision pipeline.
 * Posted by the Python process after every YOLO detection + ByteTrack pass.
 */
export class IngestFrameDto {
  /** Frame sequence number (monotonically increasing) */
  @IsInt() frameNumber!: number;

  /** Match clock in seconds (0 = kickoff) */
  @IsNumber() matchClock!: number;

  /** Match half: 1 or 2 */
  @IsInt() half!: number;

  /** All tracked objects in this frame */
  objects!: TrackedObject[];

  /**
   * Optional: event detected in this frame by the event-detection model.
   * e.g. { type: 'PASS', fromTrackId: 5, toTrackId: 12 }
   */
  @IsOptional() @IsObject() event?: Record<string, unknown>;

  /**
   * Optional: raw homography matrix (3×3) used to map pixel → pitch coords.
   * Stored for audit / replay.
   */
  @IsOptional() homography?: number[][];
}

/** Snapshot of player positions for offside checking. */
export class CheckOffsideDto {
  /** Frame number at the moment of the pass */
  @IsInt() frameNumber!: number;

  /** Match clock in seconds */
  @IsNumber() matchClock!: number;

  /** Track ID of the attacker to check */
  @IsInt() attackerTrackId!: number;

  /** Direction of attack: 'left_to_right' | 'right_to_left' */
  @IsString() attackDirection!: string;

  /** All player positions at this frame */
  objects!: TrackedObject[];
}
