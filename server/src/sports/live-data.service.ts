import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import * as https from 'https';
import * as http from 'http';

/**
 * LiveDataService
 *
 * Fetches live football data from football-data.org (free tier) and
 * api-football.com (RapidAPI, paid) and normalises it into the KobeOS
 * sports schema.
 *
 * Configuration (server/.env):
 *   FOOTBALL_DATA_API_KEY   — football-data.org API key (free at football-data.org)
 *   API_FOOTBALL_KEY        — api-football.com RapidAPI key (optional, richer data)
 *   LIVE_DATA_POLL_INTERVAL — cron expression (default: every 60s during matches)
 *
 * Free tier limits (football-data.org):
 *   - 10 requests/minute
 *   - Premier League, Championship, Champions League, World Cup, Euros
 *   - Scores, lineups, events (goals, cards, substitutions)
 */

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
  stats?: LiveStats;
}

export interface LiveEvent {
  minute: number;
  type: 'GOAL' | 'YELLOW_CARD' | 'RED_CARD' | 'SUBSTITUTION' | 'VAR' | 'PENALTY' | 'OWN_GOAL';
  playerName?: string;
  team: 'home' | 'away';
  description?: string;
}

export interface LiveStats {
  possession?: { home: number; away: number };
  shots?: { home: number; away: number };
  shotsOnTarget?: { home: number; away: number };
  corners?: { home: number; away: number };
  fouls?: { home: number; away: number };
  yellowCards?: { home: number; away: number };
  redCards?: { home: number; away: number };
  xg?: { home: number; away: number };
}

@Injectable()
export class LiveDataService {
  private readonly logger = new Logger(LiveDataService.name);
  private readonly fdApiKey: string | undefined;
  private readonly afApiKey: string | undefined;

  // In-memory cache of latest live matches — consumed by SportsGateway
  private liveMatches: Map<string, LiveMatch> = new Map();
  private listeners: Array<(matches: LiveMatch[]) => void> = [];

  constructor(private readonly config: ConfigService) {
    this.fdApiKey = config.get<string>('FOOTBALL_DATA_API_KEY');
    this.afApiKey = config.get<string>('API_FOOTBALL_KEY');
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  getLiveMatches(): LiveMatch[] {
    return [...this.liveMatches.values()];
  }

  onUpdate(cb: (matches: LiveMatch[]) => void) {
    this.listeners.push(cb);
  }

  // ── Scheduled polling ──────────────────────────────────────────────────────

  /** Poll every minute during typical match hours (UTC 12:00–23:00). */
  @Cron('0 * 12-23 * * *')
  async pollLiveMatches() {
    if (!this.fdApiKey && !this.afApiKey) {
      return; // No API keys configured — skip silently
    }

    try {
      let matches: LiveMatch[] = [];

      if (this.fdApiKey) {
        const fdMatches = await this.fetchFootballData();
        matches = [...matches, ...fdMatches];
      }

      if (this.afApiKey) {
        const afMatches = await this.fetchApiFootball();
        // Merge — prefer api-football data for matches already seen from fd
        for (const m of afMatches) {
          if (!matches.find((x) => x.homeTeam === m.homeTeam && x.awayTeam === m.awayTeam)) {
            matches.push(m);
          }
        }
      }

      // Update cache
      this.liveMatches.clear();
      for (const m of matches) {
        this.liveMatches.set(m.externalId, m);
      }

      if (matches.length > 0) {
        this.logger.log(`Live data: ${matches.length} matches (${matches.filter((m) => m.status === 'LIVE').length} live)`);
        this.listeners.forEach((cb) => cb(matches));
      }
    } catch (err) {
      this.logger.warn(`Live data poll failed: ${(err as Error).message}`);
    }
  }

  // ── football-data.org ──────────────────────────────────────────────────────

  private async fetchFootballData(): Promise<LiveMatch[]> {
    // Fetch today's matches across all competitions on the free tier
    const today = new Date().toISOString().slice(0, 10);
    const data = await this.get<FootballDataResponse>(
      `https://api.football-data.org/v4/matches?dateFrom=${today}&dateTo=${today}`,
      { 'X-Auth-Token': this.fdApiKey! },
    );

    return (data.matches ?? []).map((m) => this.normaliseFD(m));
  }

  private normaliseFD(m: FDMatch): LiveMatch {
    const statusMap: Record<string, LiveMatch['status']> = {
      SCHEDULED: 'SCHEDULED', TIMED: 'SCHEDULED', IN_PLAY: 'LIVE',
      PAUSED: 'HT', FINISHED: 'FT', POSTPONED: 'POSTPONED', CANCELLED: 'CANCELLED',
    };

    const events: LiveEvent[] = (m.goals ?? []).map((g) => ({
      minute: g.minute,
      type: g.type === 'OWN_GOAL' ? 'OWN_GOAL' : g.type === 'PENALTY' ? 'PENALTY' : 'GOAL',
      playerName: g.scorer?.name,
      team: g.team?.id === m.homeTeam.id ? 'home' : 'away',
      description: g.type,
    }));

    const bookings: LiveEvent[] = (m.bookings ?? []).map((b) => ({
      minute: b.minute,
      type: b.card === 'RED_CARD' ? 'RED_CARD' : 'YELLOW_CARD',
      playerName: b.player?.name,
      team: b.team?.id === m.homeTeam.id ? 'home' : 'away',
    }));

    const substitutions: LiveEvent[] = (m.substitutions ?? []).map((s) => ({
      minute: s.minute,
      type: 'SUBSTITUTION' as const,
      playerName: s.playerIn?.name,
      team: s.team?.id === m.homeTeam.id ? 'home' : 'away',
      description: `${s.playerOut?.name ?? '?'} → ${s.playerIn?.name ?? '?'}`,
    }));

    return {
      externalId: `fd-${m.id}`,
      source: 'football-data',
      homeTeam: m.homeTeam.name,
      awayTeam: m.awayTeam.name,
      homeScore: m.score?.fullTime?.home ?? m.score?.halfTime?.home ?? 0,
      awayScore: m.score?.fullTime?.away ?? m.score?.halfTime?.away ?? 0,
      status: statusMap[m.status] ?? 'SCHEDULED',
      kickoff: m.utcDate,
      competition: m.competition?.name ?? '',
      season: m.season?.startDate?.slice(0, 4) ?? '',
      venue: m.venue,
      minute: m.minute,
      events: [...events, ...bookings, ...substitutions].sort((a, b) => a.minute - b.minute),
    };
  }

  // ── api-football.com ───────────────────────────────────────────────────────

  private async fetchApiFootball(): Promise<LiveMatch[]> {
    const today = new Date().toISOString().slice(0, 10);
    const data = await this.get<ApiFootballResponse>(
      `https://v3.football.api-sports.io/fixtures?date=${today}&live=all`,
      {
        'x-rapidapi-key': this.afApiKey!,
        'x-rapidapi-host': 'v3.football.api-sports.io',
      },
    );

    return (data.response ?? []).map((f) => this.normaliseAF(f));
  }

  private normaliseAF(f: AFFixture): LiveMatch {
    const statusMap: Record<string, LiveMatch['status']> = {
      'NS': 'SCHEDULED', '1H': 'LIVE', 'HT': 'HT', '2H': 'LIVE',
      'ET': 'LIVE', 'P': 'LIVE', 'FT': 'FT', 'AET': 'FT', 'PEN': 'FT',
      'PST': 'POSTPONED', 'CANC': 'CANCELLED', 'SUSP': 'POSTPONED',
    };

    const events: LiveEvent[] = (f.events ?? []).map((e) => {
      const typeMap: Record<string, LiveEvent['type']> = {
        Goal: 'GOAL', Card: e.detail?.includes('Red') ? 'RED_CARD' : 'YELLOW_CARD',
        subst: 'SUBSTITUTION', Var: 'VAR',
      };
      return {
        minute: e.time?.elapsed ?? 0,
        type: typeMap[e.type] ?? 'GOAL',
        playerName: e.player?.name,
        team: e.team?.id === f.teams?.home?.id ? 'home' : 'away',
        description: e.detail,
      };
    });

    const stats = f.statistics ?? [];
    const homeStats = stats.find((s: AFStat) => s.team?.id === f.teams?.home?.id)?.statistics ?? [];
    const awayStats = stats.find((s: AFStat) => s.team?.id === f.teams?.away?.id)?.statistics ?? [];

    const getStat = (arr: AFStatItem[], label: string) =>
      arr.find((s) => s.type === label)?.value ?? 0;

    const liveStats: LiveStats = {
      possession: {
        home: parseInt(String(getStat(homeStats, 'Ball Possession')).replace('%', '') || '0', 10),
        away: parseInt(String(getStat(awayStats, 'Ball Possession')).replace('%', '') || '0', 10),
      },
      shots: { home: getStat(homeStats, 'Total Shots') as number, away: getStat(awayStats, 'Total Shots') as number },
      shotsOnTarget: { home: getStat(homeStats, 'Shots on Goal') as number, away: getStat(awayStats, 'Shots on Goal') as number },
      corners: { home: getStat(homeStats, 'Corner Kicks') as number, away: getStat(awayStats, 'Corner Kicks') as number },
      fouls: { home: getStat(homeStats, 'Fouls') as number, away: getStat(awayStats, 'Fouls') as number },
      yellowCards: { home: getStat(homeStats, 'Yellow Cards') as number, away: getStat(awayStats, 'Yellow Cards') as number },
      redCards: { home: getStat(homeStats, 'Red Cards') as number, away: getStat(awayStats, 'Red Cards') as number },
    };

    return {
      externalId: `af-${f.fixture?.id}`,
      source: 'api-football',
      homeTeam: f.teams?.home?.name ?? '',
      awayTeam: f.teams?.away?.name ?? '',
      homeScore: f.goals?.home ?? 0,
      awayScore: f.goals?.away ?? 0,
      status: statusMap[f.fixture?.status?.short ?? 'NS'] ?? 'SCHEDULED',
      kickoff: f.fixture?.date ?? '',
      competition: f.league?.name ?? '',
      season: String(f.league?.season ?? ''),
      venue: f.fixture?.venue?.name,
      minute: f.fixture?.status?.elapsed,
      events,
      stats: liveStats,
    };
  }

  // ── HTTP helper ────────────────────────────────────────────────────────────

  private get<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      protocol.get(url, { headers }, (res) => {
        let data = '';
        res.on('data', (c: string) => (data += c));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode} from ${url}`));
          } else {
            try { resolve(JSON.parse(data)); }
            catch (e) { reject(e); }
          }
        });
      }).on('error', reject);
    });
  }
}

// ── football-data.org types (partial) ────────────────────────────────────────

interface FootballDataResponse { matches: FDMatch[]; }
interface FDMatch {
  id: number; status: string; utcDate: string; minute?: number; venue?: string;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  competition?: { name: string };
  season?: { startDate: string };
  score?: { fullTime?: { home: number; away: number }; halfTime?: { home: number; away: number } };
  goals?: Array<{ minute: number; type: string; scorer?: { name: string }; team?: { id: number } }>;
  bookings?: Array<{ minute: number; card: string; player?: { name: string }; team?: { id: number } }>;
  substitutions?: Array<{ minute: number; playerIn?: { name: string }; playerOut?: { name: string }; team?: { id: number } }>;
}

// ── api-football.com types (partial) ─────────────────────────────────────────

interface ApiFootballResponse { response: AFFixture[]; }
interface AFFixture {
  fixture?: { id: number; date: string; status?: { short: string; elapsed?: number }; venue?: { name: string } };
  league?: { name: string; season: number };
  teams?: { home?: { id: number; name: string }; away?: { id: number; name: string } };
  goals?: { home: number; away: number };
  events?: Array<{ time?: { elapsed: number }; type: string; detail?: string; player?: { name: string }; team?: { id: number } }>;
  statistics?: AFStat[];
}
interface AFStat { team?: { id: number }; statistics: AFStatItem[]; }
interface AFStatItem { type: string; value: number | string | null; }
