const BASE = '/api';

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('access_token');
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
  addEvent: (id: string, body: Partial<MatchEvent>) => req<MatchEvent>(`/sports/matches/${id}/events`, { method: 'POST', body: JSON.stringify(body) }),
  aiReport: (id: string) => req<{ report: string }>(`/sports/matches/${id}/ai-report`, { method: 'POST' }),
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
  leagueTable: (competition: string) => req<Team[]>(`/sports/teams/league-table/${encodeURIComponent(competition)}`),
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

export const analyticsApi = {
  forMatch: (matchId: string) => req<Analytics>(`/sports/analytics/${matchId}`),
  update: (matchId: string, body: Partial<Analytics>) =>
    req<Analytics>(`/sports/analytics/${matchId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  tacticalReport: (matchId: string) => req<{ report: string }>(`/sports/analytics/${matchId}/tactical-report`, { method: 'POST' }),
  commentary: (matchId: string) => req<{ commentary: string }>(`/sports/analytics/${matchId}/commentary`, { method: 'POST' }),
};

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
