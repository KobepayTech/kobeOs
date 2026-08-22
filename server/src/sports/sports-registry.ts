/**
 * Sport registry — the single source of truth for which sports the platform
 * supports and how each behaves. The generic engine (accounts, AI, overlay,
 * notifications, API) is shared; each sport declares its own data modules,
 * event types, scoring model, lifecycle statuses and overlay kind here. Adding
 * a new sport = add a descriptor (and its module) — the UI, sport switcher and
 * capabilities are all driven from this list.
 */

export type SportKind = 'team' | 'combat' | 'individual';
export type ScoringType = 'score' | 'scorecard' | 'points' | 'time';
export type OverlayKind = 'match' | 'bout' | null;

export interface SportModule {
  id: string;        // 'fixtures', 'fighters', 'scoring'…
  label: string;
  icon: string;      // emoji
}

export interface SportDescriptor {
  id: string;                 // 'football' | 'boxing' | …
  name: string;
  icon: string;               // emoji
  kind: SportKind;
  live: boolean;              // true = fully implemented, false = roadmap
  /** Competitor nouns for generic UI copy. */
  competitor: { singular: string; plural: string; sideA: string; sideB: string };
  modules: SportModule[];     // sport-specific screens
  eventTypes: string[];       // timeline event vocabulary
  scoring: { type: ScoringType; description: string };
  statuses: string[];         // lifecycle
  overlay: OverlayKind;       // broadcast overlay variant
  apiBase: string;            // REST base for this sport's data
}

export const SPORTS: SportDescriptor[] = [
  {
    id: 'football',
    name: 'Football',
    icon: '⚽',
    kind: 'team',
    live: true,
    competitor: { singular: 'team', plural: 'teams', sideA: 'Home', sideB: 'Away' },
    modules: [
      { id: 'fixtures', label: 'Fixtures', icon: '📅' },
      { id: 'teams', label: 'Teams', icon: '🛡️' },
      { id: 'players', label: 'Players', icon: '👤' },
      { id: 'tracking', label: 'Tracking', icon: '🏃' },
      { id: 'table', label: 'League Table', icon: '📊' },
    ],
    eventTypes: ['GOAL', 'YELLOW_CARD', 'RED_CARD', 'SUBSTITUTION', 'OFFSIDE', 'FOUL', 'PENALTY', 'VAR'],
    scoring: { type: 'score', description: 'Goals per side over two halves' },
    statuses: ['SCHEDULED', 'LIVE', 'HT', 'FT', 'POSTPONED', 'CANCELLED'],
    overlay: 'match',
    apiBase: '/sports/matches',
  },
  {
    id: 'boxing',
    name: 'Boxing',
    icon: '🥊',
    kind: 'combat',
    live: true,
    competitor: { singular: 'fighter', plural: 'fighters', sideA: 'Red corner', sideB: 'Blue corner' },
    modules: [
      { id: 'fightcard', label: 'Fight Card', icon: '🥊' },
      { id: 'fighters', label: 'Fighters', icon: '👤' },
      { id: 'scoring', label: 'Live Scoring', icon: '📋' },
    ],
    eventTypes: ['KNOCKDOWN', 'ROUND_END', 'POINT_DEDUCTION', 'CUT', 'WARNING', 'STOPPAGE'],
    scoring: { type: 'scorecard', description: 'Round-by-round judges’ scorecards (10-point must)' },
    statuses: ['SCHEDULED', 'LIVE', 'FINISHED', 'CANCELLED'],
    overlay: 'bout',
    apiBase: '/sports/boxing',
  },
  // ── Roadmap: declared so the platform shows what's coming; each becomes
  //    `live: true` once its module ships (data-driven, no UI rewrite). ──
  roadmap('basketball', 'Basketball', '🏀', 'team', ['2POINT', '3POINT', 'FREE_THROW', 'FOUL', 'TIMEOUT'], 'Points across four quarters'),
  roadmap('volleyball', 'Volleyball', '🏐', 'team', ['POINT', 'ACE', 'BLOCK', 'TIMEOUT'], 'Sets and points'),
  roadmap('mma', 'MMA', '🥋', 'combat', ['KNOCKDOWN', 'SUBMISSION_ATTEMPT', 'TAKEDOWN', 'POINT_DEDUCTION'], 'Round-by-round scorecards'),
  roadmap('tennis', 'Tennis', '🎾', 'individual', ['ACE', 'DOUBLE_FAULT', 'BREAK', 'GAME', 'SET'], 'Games, sets and matches'),
  roadmap('cricket', 'Cricket', '🏏', 'team', ['RUN', 'WICKET', 'BOUNDARY', 'SIX', 'OVER'], 'Runs and wickets across innings'),
  roadmap('athletics', 'Athletics', '🏃', 'individual', ['SPLIT', 'FINISH', 'RECORD', 'DQ'], 'Times and distances'),
  roadmap('motorsport', 'Motorsport', '🏍', 'individual', ['LAP', 'PIT', 'OVERTAKE', 'PENALTY', 'DNF'], 'Lap times and positions'),
];

function roadmap(id: string, name: string, icon: string, kind: SportKind, eventTypes: string[], scoringDesc: string): SportDescriptor {
  return {
    id, name, icon, kind, live: false,
    competitor: kind === 'combat'
      ? { singular: 'fighter', plural: 'fighters', sideA: 'Corner A', sideB: 'Corner B' }
      : { singular: kind === 'team' ? 'team' : 'competitor', plural: kind === 'team' ? 'teams' : 'competitors', sideA: 'A', sideB: 'B' },
    modules: [],
    eventTypes,
    scoring: { type: kind === 'combat' ? 'scorecard' : 'points', description: scoringDesc },
    statuses: ['SCHEDULED', 'LIVE', 'FINISHED', 'CANCELLED'],
    overlay: null,
    apiBase: `/sports/${id}`,
  };
}

export function getRegistry() {
  return { sports: SPORTS, liveCount: SPORTS.filter((s) => s.live).length, total: SPORTS.length };
}
