import { getToken } from '@/lib/api';

const BASE = '/api';

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// ── Matches ──────────────────────────────────────────────────────────────────

export interface Match {
  id: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  status: 'SCHEDULED' | 'LIVE' | 'HT' | 'FT' | 'POSTPONED' | 'CANCELLED';
  homeScore: number;
  awayScore: number;
  venue?: string;
  competition?: string;
  season?: string;
  homeLineup?: string[];
  awayLineup?: string[];
  stats?: MatchStats;
  aiReport?: string;
}

export interface MatchStats {
  possession?: { home: number; away: number };
  shots?: { home: number; away: number };
  shotsOnTarget?: { home: number; away: number };
  corners?: { home: number; away: number };
  fouls?: { home: number; away: number };
  yellowCards?: { home: number; away: number };
  redCards?: { home: number; away: number };
  xg?: { home: number; away: number };
}

export interface MatchEvent {
  id: string;
  matchId: string;
  type: 'GOAL' | 'YELLOW_CARD' | 'RED_CARD' | 'SUBSTITUTION' | 'OFFSIDE' | 'VAR' | 'PENALTY' | 'OWN_GOAL' | 'ASSIST' | 'FOUL';
  minute: number;
  playerName?: string;
  team?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export const matchesApi = {
  list: (page = 1, limit = 20) => req<{ data: Match[]; total: number }>(`/sports/matches?page=${page}&limit=${limit}`),
  get: (id: string) => req<Match>(`/sports/matches/${id}`),
  create: (body: Partial<Match>) => req<Match>('/sports/matches', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<Match>) => req<Match>(`/sports/matches/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (id: string) => req<void>(`/sports/matches/${id}`, { method: 'DELETE' }),
  events: (id: string) => req<MatchEvent[]>(`/sports/matches/${id}/events`),
  addEvent: (body: Partial<MatchEvent>) => req<MatchEvent>('/sports/events', { method: 'POST', body: JSON.stringify(body) }),
  aiReport: (id: string) => req<{ report: string }>(`/sports/matches/${id}/ai-report`, { method: 'POST' }),
  // Lifecycle
  start: (id: string) => req<Match>(`/sports/matches/${id}/start`, { method: 'POST' }),
  halftime: (id: string) => req<Match>(`/sports/matches/${id}/halftime`, { method: 'POST' }),
  end: (id: string) => req<Match>(`/sports/matches/${id}/end`, { method: 'POST' }),
  postpone: (id: string) => req<Match>(`/sports/matches/${id}/postpone`, { method: 'POST' }),
  updateScore: (id: string, body: ScoreUpdate) => req<Match>(`/sports/matches/${id}/score`, { method: 'POST', body: JSON.stringify(body) }),
  setLineup: (id: string, body: MatchLineup) => req<Match>(`/sports/matches/${id}/lineup`, { method: 'POST', body: JSON.stringify(body) }),
  getLineup: (id: string) => req<MatchLineup>(`/sports/matches/${id}/lineup`),
  setTracking: (id: string, active: boolean) => req<Match>(`/sports/matches/${id}/tracking`, { method: 'POST', body: JSON.stringify({ active }) }),
  getLive: () => req<Match[]>('/sports/matches/live'),
  playerStats: (id: string) => req<MatchPlayerStat[]>(`/sports/matches/${id}/player-stats`),
};

export interface ScoreUpdate {
  homeScore: number;
  awayScore: number;
  goalEvent?: {
    team: 'home' | 'away';
    playerName?: string;
    minute: number;
    type: 'GOAL' | 'OWN_GOAL' | 'PENALTY';
  };
}

export interface LineupPlayer {
  playerId?: string;
  jerseyNumber: number;
  name: string;
  position: string;
  starting: boolean;
}

export interface MatchLineup {
  home: LineupPlayer[];
  away: LineupPlayer[];
}

export interface MatchPlayerStat {
  playerId: string;
  jerseyNumber: number;
  name: string;
  team: 'home' | 'away';
  minutesPlayed: number;
  distanceKm: number;
  sprints: number;
  topSpeedKmh: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  xg: number;
  rating: number;
}

export interface PlayerSeasonStats {
  id: string;
  playerId: string;
  season: string;
  competition?: string;
  matchesPlayed: number;
  minutesPlayed: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  xgTotal: number;
  distanceKm: number;
  sprints: number;
  avgRating: number;
  matchHistory?: Array<{
    matchId: string;
    date: string;
    homeTeam: string;
    awayTeam: string;
    rating: number;
    goals: number;
    assists: number;
    distanceKm: number;
    sprints: number;
    minutesPlayed: number;
    xg: number;
  }>;
}

export interface Camera {
  id: string;
  label: string;
  role: string;
  streamUrl: string;
  status: 'ONLINE' | 'OFFLINE' | 'ERROR' | 'STANDBY';
  fps: number;
  resolution?: string;
  lastHeartbeat?: string;
  activeMatchId?: string;
  calibrated: boolean;
}

export const camerasApi = {
  list: () => req<Camera[]>('/sports/cameras'),
  status: () => req<{ total: number; online: number; offline: number; error: number; uncalibrated: number; cameras: Camera[] }>('/sports/cameras/status'),
  register: (body: { label: string; role: string; streamUrl: string; resolution?: string }) => req<Camera>('/sports/cameras', { method: 'POST', body: JSON.stringify(body) }),
  assign: (cameraId: string, matchId: string) => req<Camera>(`/sports/cameras/${cameraId}/assign/${matchId}`, { method: 'POST' }),
  release: (cameraId: string) => req<Camera>(`/sports/cameras/${cameraId}/release`, { method: 'POST' }),
  remove: (id: string) => req<void>(`/sports/cameras/${id}`, { method: 'DELETE' }),
};

export const seasonStatsApi = {
  forPlayer: (playerId: string, season?: string) =>
    req<PlayerSeasonStats[]>(`/sports/players/${playerId}/season-stats${season ? `?season=${season}` : ''}`),
  top: (season: string, limit = 20) =>
    req<PlayerSeasonStats[]>(`/sports/season-stats/top?season=${season}&limit=${limit}`),
};

// ── Teams ─────────────────────────────────────────────────────────────────────

export interface Team {
  id: string;
  name: string;
  shortName?: string;
  competition?: string;
  logoUrl?: string;
  stadium?: string;
  country?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export const teamsApi = {
  list: (page = 1, limit = 50) => req<{ data: Team[]; total: number }>(`/sports/teams?page=${page}&limit=${limit}`),
  get: (id: string) => req<Team>(`/sports/teams/${id}`),
  create: (body: Partial<Team>) => req<Team>('/sports/teams', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<Team>) => req<Team>(`/sports/teams/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (id: string) => req<void>(`/sports/teams/${id}`, { method: 'DELETE' }),
  leagueTable: (competition: string) => req<Team[]>(`/sports/teams/table/${encodeURIComponent(competition)}`),
};

// ── Players ───────────────────────────────────────────────────────────────────

export interface Player {
  id: string;
  name: string;
  teamId?: string;
  teamName?: string;
  position?: string;
  nationality?: string;
  jerseyNumber?: number;
  rating: number;
  stats?: Record<string, number>;
  avatarUrl?: string;
}

export const playersApi = {
  list: (page = 1, limit = 50) => req<{ data: Player[]; total: number }>(`/sports/players?page=${page}&limit=${limit}`),
  get: (id: string) => req<Player>(`/sports/players/${id}`),
  create: (body: Partial<Player>) => req<Player>('/sports/players', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<Player>) => req<Player>(`/sports/players/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (id: string) => req<void>(`/sports/players/${id}`, { method: 'DELETE' }),
};

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface Analytics {
  id: string;
  matchId: string;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
  possession?: { home: number; away: number };
  heatmaps?: Record<string, number[][]>;
  passingNetwork?: Record<string, unknown>;
  playerTracking?: Record<string, unknown>;
  xgData?: { home: number[]; away: number[] };
  formations?: { home: string; away: string };
  aiCommentary?: string;
  aiTacticalReport?: string;
}

export interface HighlightMarker {
  frameNumber: number;
  matchClock: number;
  minute: number;
  type: string;
  team: string | null;
  description: string;
}

export const analyticsApi = {
  forMatch: (matchId: string) => req<Analytics>(`/sports/analytics/${matchId}`),
  update: (matchId: string, body: Partial<Analytics>) =>
    req<Analytics>(`/sports/analytics/${matchId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  tacticalReport: (matchId: string) => req<{ report: string }>(`/sports/analytics/${matchId}/tactical-report`, { method: 'POST' }),
  commentary: (matchId: string) => req<{ commentary: string }>(`/sports/analytics/${matchId}/commentary`, { method: 'POST' }),
  highlights: (matchId: string) => req<HighlightMarker[]>(`/sports/analytics/${matchId}/highlights`),
};

// ── Live data (external API bridge) ──────────────────────────────────────────

export interface LiveMatch {
  externalId: string;
  source: 'football-data' | 'api-football';
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: 'SCHEDULED' | 'LIVE' | 'HT' | 'FT' | 'POSTPONED' | 'CANCELLED';
  kickoff: string;
  competition: string;
  season: string;
  venue?: string;
  minute?: number;
  events: LiveEvent[];
  stats?: MatchStats;
}

export interface LiveEvent {
  minute: number;
  type: 'GOAL' | 'YELLOW_CARD' | 'RED_CARD' | 'SUBSTITUTION' | 'VAR' | 'PENALTY' | 'OWN_GOAL';
  playerName?: string;
  team: 'home' | 'away';
  description?: string;
}

export const liveApi = {
  matches: () => req<LiveMatch[]>('/sports/live'),
  refresh: () => req<{ ok: boolean; count: number }>('/sports/live/refresh', { method: 'POST' }),
  leagues: () => req<{ name: string; count: number }[]>('/sports/live/leagues'),
};

// ── Extended player stats for ratings ────────────────────────────────────────

export interface PlayerRating {
  playerId: string;
  name: string;
  team: 'home' | 'away';
  position: string;
  jerseyNumber: number;
  overallRating: number;
  passingScore: number;
  defensiveScore: number;
  attackingScore: number;
  workRateScore: number;
  stats: {
    passes: number;
    passAccuracy: number;
    tackles: number;
    interceptions: number;
    shots: number;
    shotsOnTarget: number;
    dribbles: number;
    distanceCovered: number; // km
    sprints: number;
    foulsCommitted: number;
    foulsSuffered: number;
    minutesPlayed: number;
  };
}

// ── AI ────────────────────────────────────────────────────────────────────────

export const aiSportsApi = {
  commentary: (body: { matchId: string; events: MatchEvent[]; stats: MatchStats }) =>
    req<{ commentary: string }>('/ai/sports/commentary', { method: 'POST', body: JSON.stringify(body) }),
  analyse: (body: { matchId: string; stats: MatchStats }) =>
    req<{ analysis: string }>('/ai/sports/analyse', { method: 'POST', body: JSON.stringify(body) }),
  report: (body: { matchId: string; homeTeam: string; awayTeam: string; events: MatchEvent[]; stats: MatchStats }) =>
    req<{ report: string }>('/ai/sports/report', { method: 'POST', body: JSON.stringify(body) }),
  formation: (body: { team: string; players: string[]; opposition: string }) =>
    req<{ formation: string; reasoning: string }>('/ai/sports/formation', { method: 'POST', body: JSON.stringify(body) }),
};

// ── Boxing ───────────────────────────────────────────────────────────────────
export interface BoxingFighter {
  id: string; name: string; nickname?: string; weightClass?: string; stance?: string;
  country?: string; reachCm?: number | null; heightCm?: number | null;
  wins: number; losses: number; draws: number; kos: number; ranking?: number | null; avatarUrl?: string;
}
export interface RoundScore { round: number; judge: string; a: number; b: number }
export interface BoutTally { perJudge: { judge: string; a: number; bt: number; rounds: number; lead: string }[]; aCards: number; bCards: number; leader: string }
export interface BoxingBout {
  id: string; eventName: string; date?: string | null; venue?: string;
  fighterAId: string; fighterAName: string; fighterBId: string; fighterBName: string;
  weightClass?: string; title?: string; scheduledRounds: number; cardPosition: 'MAIN' | 'CO_MAIN' | 'UNDERCARD';
  status: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'CANCELLED'; currentRound: number;
  judges: string[]; roundScores: RoundScore[]; method: string; winnerId?: string | null; endRound?: number | null;
  tally?: BoutTally;
}
export const boxingApi = {
  fighters: () => req<BoxingFighter[]>('/sports/boxing/fighters'),
  createFighter: (b: Partial<BoxingFighter>) => req<BoxingFighter>('/sports/boxing/fighters', { method: 'POST', body: JSON.stringify(b) }),
  updateFighter: (id: string, b: Partial<BoxingFighter>) => req<BoxingFighter>(`/sports/boxing/fighters/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
  deleteFighter: (id: string) => req<void>(`/sports/boxing/fighters/${id}`, { method: 'DELETE' }),
  bouts: (params = '') => req<BoxingBout[]>(`/sports/boxing/bouts${params}`),
  bout: (id: string) => req<BoxingBout>(`/sports/boxing/bouts/${id}`),
  createBout: (b: Partial<BoxingBout> & { fighterAId: string; fighterBId: string }) => req<BoxingBout>('/sports/boxing/bouts', { method: 'POST', body: JSON.stringify(b) }),
  deleteBout: (id: string) => req<void>(`/sports/boxing/bouts/${id}`, { method: 'DELETE' }),
  score: (id: string, b: { round: number; judge: string; a: number; b: number }) => req<BoxingBout>(`/sports/boxing/bouts/${id}/score`, { method: 'POST', body: JSON.stringify(b) }),
  finish: (id: string, b: { method: string; winnerId?: string; endRound?: number }) => req<BoxingBout>(`/sports/boxing/bouts/${id}/finish`, { method: 'POST', body: JSON.stringify(b) }),
};

// ── Sport registry ───────────────────────────────────────────────────────────
export interface SportModule { id: string; label: string; icon: string }
export interface SportDescriptor {
  id: string; name: string; icon: string; kind: string; live: boolean;
  competitor: { singular: string; plural: string; sideA: string; sideB: string };
  modules: SportModule[]; eventTypes: string[];
  scoring: { type: string; description: string }; statuses: string[];
  overlay: 'match' | 'bout' | null; apiBase: string;
}
export const registryApi = {
  get: () => req<{ sports: SportDescriptor[]; liveCount: number; total: number }>('/sports/registry'),
};
