/**
 * Analytics — match statistics from the AI vision pipeline.
 *
 * Data source priority:
 *   1. WebSocket 'match:state' snapshots (live, from VisionIngestService)
 *   2. DB analytics via REST (for completed/paused matches)
 *   3. Demo data (offline fallback)
 */
import { useEffect, useState } from 'react';
import { matchesApi, analyticsApi, type Match, type Analytics, type MatchStats } from '../api';
import { useSportsSocket, type MatchStateSnapshot, type MatchEvent } from '../useSportsSocket';

// ── Sub-components ────────────────────────────────────────────────────────────

function StatBar({ label, home, away, homeColor = 'bg-blue-500', awayColor = 'bg-orange-500' }: {
  label: string; home: number; away: number; homeColor?: string; awayColor?: string;
}) {
  const total = home + away || 1;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-blue-400 font-semibold">{home}</span>
        <span className="text-gray-400">{label}</span>
        <span className="text-orange-400 font-semibold">{away}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden flex bg-gray-700">
        <div className={`${homeColor} h-full transition-all duration-500`} style={{ width: `${(home / total) * 100}%` }} />
        <div className={`${awayColor} h-full transition-all duration-500`} style={{ width: `${(away / total) * 100}%` }} />
      </div>
    </div>
  );
}

function XgTimeline({ home, away }: { home: number[]; away: number[] }) {
  const pts = Math.max(home.length, away.length, 2);
  const maxVal = Math.max(...home, ...away, 0.5);
  const W = 400; const H = 80;
  const px = (i: number) => (i / (pts - 1)) * W;
  const py = (v: number) => H - (v / maxVal) * H;
  const toPath = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20" preserveAspectRatio="none">
        <defs>
          <linearGradient id="xg-h" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" /><stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="xg-a" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.3" /><stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${toPath(home)} L${px(home.length - 1)},${H} L0,${H} Z`} fill="url(#xg-h)" />
        <path d={`${toPath(away)} L${px(away.length - 1)},${H} L0,${H} Z`} fill="url(#xg-a)" />
        <path d={toPath(home)} fill="none" stroke="#3b82f6" strokeWidth="2" />
        <path d={toPath(away)} fill="none" stroke="#f97316" strokeWidth="2" />
      </svg>
      <div className="flex gap-4 mt-1 text-xs">
        <span className="flex items-center gap-1 text-blue-400"><span className="w-3 h-0.5 bg-blue-500 inline-block rounded" /> xG {home.at(-1)?.toFixed(2) ?? '0.00'}</span>
        <span className="flex items-center gap-1 text-orange-400"><span className="w-3 h-0.5 bg-orange-500 inline-block rounded" /> xG {away.at(-1)?.toFixed(2) ?? '0.00'}</span>
      </div>
    </div>
  );
}

function PitchHeatmap({ data, label, color }: { data: number[][]; label: string; color: string }) {
  const rows = data.length; const cols = data[0]?.length ?? 1;
  const max = Math.max(...data.flat(), 1);
  return (
    <div>
      <p className={`text-xs font-medium mb-1.5 ${color}`}>{label}</p>
      <div className="relative rounded overflow-hidden border border-green-900/40" style={{ background: '#0a2e0a' }}>
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 65" preserveAspectRatio="none">
          <g stroke="#1a4a1a" strokeWidth="0.5" fill="none">
            <rect x="1" y="1" width="98" height="63" />
            <line x1="50" y1="1" x2="50" y2="64" />
            <circle cx="50" cy="32.5" r="9.15" />
            <rect x="1" y="20" width="16.5" height="25" />
            <rect x="82.5" y="20" width="16.5" height="25" />
          </g>
        </svg>
        <div className="relative grid gap-0" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {data.flat().map((v, i) => {
            const intensity = v / max;
            const isBlue = color === 'text-blue-400';
            return (
              <div key={i} style={{
                paddingBottom: `${(65 / rows / (100 / cols))}%`,
                backgroundColor: `rgba(${isBlue ? '59,130,246' : '249,115,22'},${(intensity * 0.75).toFixed(2)})`,
              }} />
            );
          })}
        </div>
      </div>
    </div>
  );
}

const EVENT_ICONS: Record<string, string> = {
  GOAL: '⚽', YELLOW_CARD: '🟨', RED_CARD: '🟥', SUBSTITUTION: '🔄',
  OFFSIDE: '🚩', VAR: '📺', PENALTY: '🎯', OWN_GOAL: '😬', SHOT: '🎯', PASS: '→', FOUL: '⚠️',
};

function EventTimeline({ events }: { events: MatchEvent[] }) {
  const significant = events.filter((e) =>
    ['GOAL', 'YELLOW_CARD', 'RED_CARD', 'PENALTY', 'OFFSIDE', 'VAR', 'SUBSTITUTION', 'OWN_GOAL'].includes(e.type)
  );
  return (
    <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
      {significant.length === 0 && <p className="text-xs text-gray-500 text-center py-6">No events yet</p>}
      {significant.map((e, i) => (
        <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-gray-800/50">
          <span className="text-gray-500 w-8 text-right shrink-0">{e.minute}'</span>
          <span>{EVENT_ICONS[e.type] ?? '•'}</span>
          <span className={`font-medium ${e.team === 'home' ? 'text-blue-300' : e.team === 'away' ? 'text-orange-300' : 'text-gray-300'}`}>
            {e.type.replace('_', ' ')}
            {e.jerseyNumber ? ` #${e.jerseyNumber}` : ''}
          </span>
          {e.xg != null && <span className="ml-auto text-gray-500 text-[10px]">xG {e.xg.toFixed(2)}</span>}
        </div>
      ))}
    </div>
  );
}

// ── Shape guards for API payloads ─────────────────────────────────────────────
// Sports analytics fields are typed as Record<string, …>, so the shape may
// drift. These guards return the fallback whenever home/away are missing or
// the wrong type, preventing render-time crashes from partial payloads.

const isNumber = (v: unknown): v is number => typeof v === 'number';
const isString = (v: unknown): v is string => typeof v === 'string';
const isNumberArray = (v: unknown): v is number[] => Array.isArray(v) && v.every(isNumber);
const isMatrix = (v: unknown): v is number[][] => Array.isArray(v) && v.every(isNumberArray);

function pickPair<T>(
  o: unknown,
  is: (v: unknown) => v is T,
  fallback: { home: T; away: T },
): { home: T; away: T } {
  if (!o || typeof o !== 'object') return fallback;
  const rec = o as Record<string, unknown>;
  if (is(rec.home) && is(rec.away)) return { home: rec.home, away: rec.away };
  return fallback;
}

// ── Demo fallback data ────────────────────────────────────────────────────────

const DEMO_STATS = {
  possession: { home: 58, away: 42 }, shots: { home: 14, away: 8 },
  shotsOnTarget: { home: 6, away: 3 }, corners: { home: 7, away: 4 },
  fouls: { home: 11, away: 14 }, yellowCards: { home: 1, away: 2 },
  redCards: { home: 0, away: 0 }, xg: { home: 1.84, away: 0.92 },
} satisfies MatchStats;

const DEMO_HEATMAPS = {
  home: Array.from({ length: 10 }, (_, r) => Array.from({ length: 13 }, (_, c) =>
    Math.round(Math.max(0, 20 * Math.exp(-(((c / 12) - 0.7) ** 2 + ((r / 9) - 0.5) ** 2) / 0.08) + 10 * Math.random()))
  )),
  away: Array.from({ length: 10 }, (_, r) => Array.from({ length: 13 }, (_, c) =>
    Math.round(Math.max(0, 20 * Math.exp(-(((c / 12) - 0.3) ** 2 + ((r / 9) - 0.5) ** 2) / 0.08) + 10 * Math.random()))
  )),
};

const DEMO_MATCHES: Match[] = [
  { id: '1', sport: 'football', homeTeam: 'Simba SC', awayTeam: 'Young Africans', kickoff: new Date().toISOString(), status: 'LIVE', homeScore: 2, awayScore: 1, competition: 'Tanzania Premier League' },
  { id: '2', sport: 'football', homeTeam: 'Arsenal', awayTeam: 'Chelsea', kickoff: new Date().toISOString(), status: 'HT', homeScore: 1, awayScore: 1, competition: 'Premier League' },
];

// ── Main ──────────────────────────────────────────────────────────────────────

interface AnalyticsProps {
  matchId?: string;
}

export default function Analytics({ matchId: propMatchId }: AnalyticsProps) {
  const [matches, setMatches] = useState<Match[]>(DEMO_MATCHES);
  const [selectedId, setSelectedId] = useState(propMatchId ?? '1');

  // Sync when parent changes selected match
  useEffect(() => {
    if (propMatchId) setSelectedId(propMatchId);
  }, [propMatchId]);
  const [dbAnalytics, setDbAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState<'report' | 'commentary' | null>(null);
  const [activeSection, setActiveSection] = useState<'stats' | 'heatmap' | 'xg' | 'events' | 'ai'>('stats');

  // WebSocket live state
  const { connected, matchState } = useSportsSocket(selectedId);

  const selectedMatch = matches.find((m) => m.id === selectedId);

  // Merge: prefer live WebSocket data, fall back to DB analytics, then demo.
  // `dbAnalytics` fields are typed as Records and may arrive with missing
  // home/away keys; pick<>() returns the fallback whenever the shape drifts
  // so we never read .home/.away on undefined.
  const possession = matchState?.possession ?? pickPair(dbAnalytics?.possession, isNumber, DEMO_STATS.possession);
  const xgTimeline = matchState?.xgTimeline
    ?? pickPair(dbAnalytics?.xgData, isNumberArray, { home: [0, 0.3, 0.8, 1.2, 1.84], away: [0, 0.1, 0.4, 0.7, 0.92] });
  const xg = matchState?.xg ?? { home: xgTimeline.home.at(-1) ?? 0, away: xgTimeline.away.at(-1) ?? 0 };
  const heatmaps = matchState?.heatmaps ?? pickPair(dbAnalytics?.heatmaps, isMatrix, DEMO_HEATMAPS);
  const formations = matchState?.formations ?? pickPair(dbAnalytics?.formations, isString, { home: '4-3-3', away: '4-4-2' });
  const events: MatchEvent[] = matchState?.events ?? [];

  useEffect(() => {
    matchesApi.list(1, 50).then((r) => { if (r.data.length) { setMatches(r.data); setSelectedId(r.data[0].id); } }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    analyticsApi.forMatch(selectedId).then(setDbAnalytics).catch(() => setDbAnalytics(null)).finally(() => setLoading(false));
  }, [selectedId]);

  const handleTacticalReport = async () => {
    if (!selectedId) return;
    setGenerating('report');
    try { const r = await analyticsApi.tacticalReport(selectedId); setDbAnalytics((a) => a ? { ...a, aiTacticalReport: r.report } : a); } catch { /* demo */ }
    setGenerating(null);
  };

  const handleCommentary = async () => {
    if (!selectedId) return;
    setGenerating('commentary');
    try { const r = await analyticsApi.commentary(selectedId); setDbAnalytics((a) => a ? { ...a, aiCommentary: r.commentary } : a); } catch { /* demo */ }
    setGenerating(null);
  };

  const sections = [
    { id: 'stats', label: 'Stats' }, { id: 'heatmap', label: 'Heatmap' },
    { id: 'xg', label: 'xG' }, { id: 'events', label: 'Events' }, { id: 'ai', label: 'AI Report' },
  ] as const;

  return (
    <div className="flex flex-col h-full">
      {/* Match selector + status */}
      <div className="p-3 border-b border-gray-800 shrink-0 flex items-center gap-3">
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
          {matches.map((m) => <option key={m.id} value={m.id}>{m.homeTeam} vs {m.awayTeam}</option>)}
        </select>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 flex items-center gap-1 ${
          connected ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-400'
        }`}>
          {connected && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
          {connected ? 'Live AI' : 'DB / Demo'}
        </span>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 px-3 pt-2 border-b border-gray-800 shrink-0 overflow-x-auto">
        {sections.map((s) => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-t-lg whitespace-nowrap transition-colors ${
              activeSection === s.id ? 'bg-gray-950 text-white border-t border-x border-gray-700' : 'text-gray-400 hover:text-gray-200'
            }`}>{s.label}</button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-gray-900 animate-pulse" />)}</div>
        ) : (
          <>
            {activeSection === 'stats' && (
              <div className="space-y-4 max-w-2xl">
                {selectedMatch && (
                  <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 text-center">
                    <p className="text-xs text-gray-500 mb-2">{selectedMatch.competition}</p>
                    <div className="flex items-center justify-center gap-6">
                      <span className="text-lg font-bold text-white">{selectedMatch.homeTeam}</span>
                      <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-xl">
                        <span className="text-3xl font-black text-white">{selectedMatch.homeScore}</span>
                        <span className="text-gray-500">–</span>
                        <span className="text-3xl font-black text-white">{selectedMatch.awayScore}</span>
                      </div>
                      <span className="text-lg font-bold text-white">{selectedMatch.awayTeam}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">{formations.home} vs {formations.away}</p>
                  </div>
                )}
                <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 space-y-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span className="text-blue-400 font-semibold">{selectedMatch?.homeTeam ?? 'Home'}</span>
                    <span className="font-medium">Match Statistics</span>
                    <span className="text-orange-400 font-semibold">{selectedMatch?.awayTeam ?? 'Away'}</span>
                  </div>
                  {possession && <StatBar label="Possession %" home={possession.home} away={possession.away} />}
                  {DEMO_STATS.shots && <StatBar label="Shots" home={DEMO_STATS.shots.home} away={DEMO_STATS.shots.away} />}
                  {DEMO_STATS.shotsOnTarget && <StatBar label="Shots on Target" home={DEMO_STATS.shotsOnTarget.home} away={DEMO_STATS.shotsOnTarget.away} />}
                  {DEMO_STATS.corners && <StatBar label="Corners" home={DEMO_STATS.corners.home} away={DEMO_STATS.corners.away} />}
                  {DEMO_STATS.fouls && <StatBar label="Fouls" home={DEMO_STATS.fouls.home} away={DEMO_STATS.fouls.away} homeColor="bg-orange-500" awayColor="bg-blue-500" />}
                  <StatBar label="xG" home={Math.round((xg?.home ?? 0) * 10)} away={Math.round((xg?.away ?? 0) * 10)} />
                </div>
                {xg && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-blue-900/20 border border-blue-800/30 p-3 text-center">
                      <p className="text-xs text-blue-400 mb-1">Home xG</p>
                      <p className="text-3xl font-black text-blue-300">{xg.home.toFixed(2)}</p>
                    </div>
                    <div className="rounded-xl bg-orange-900/20 border border-orange-800/30 p-3 text-center">
                      <p className="text-xs text-orange-400 mb-1">Away xG</p>
                      <p className="text-3xl font-black text-orange-300">{xg.away.toFixed(2)}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeSection === 'heatmap' && heatmaps && (
              <div className="space-y-4 max-w-2xl">
                <PitchHeatmap data={heatmaps.home} label={`${selectedMatch?.homeTeam ?? 'Home'} — Activity Heatmap`} color="text-blue-400" />
                <PitchHeatmap data={heatmaps.away} label={`${selectedMatch?.awayTeam ?? 'Away'} — Activity Heatmap`} color="text-orange-400" />
                <p className="text-[11px] text-gray-600 text-center">
                  {connected ? 'Live data from AI vision pipeline' : 'Accumulated from vision pipeline frames · brighter = higher activity'}
                </p>
              </div>
            )}

            {activeSection === 'xg' && (
              <div className="space-y-4 max-w-2xl">
                <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Expected Goals Timeline</h3>
                  <XgTimeline home={xgTimeline.home} away={xgTimeline.away} />
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    { label: 'Home xG', value: xgTimeline.home.at(-1)?.toFixed(2), color: 'text-blue-400' },
                    { label: 'xG Diff', value: ((xgTimeline.home.at(-1) ?? 0) - (xgTimeline.away.at(-1) ?? 0)).toFixed(2), color: 'text-white' },
                    { label: 'Away xG', value: xgTimeline.away.at(-1)?.toFixed(2), color: 'text-orange-400' },
                  ].map((c) => (
                    <div key={c.label} className="rounded-xl bg-gray-900 border border-gray-800 p-3">
                      <p className="text-[11px] text-gray-500 mb-1">{c.label}</p>
                      <p className={`text-2xl font-black ${c.color}`}>{c.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeSection === 'events' && (
              <div className="max-w-lg">
                <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Match Events</h3>
                    {connected && <span className="text-[10px] text-green-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />Live</span>}
                  </div>
                  <EventTimeline events={events} />
                </div>
              </div>
            )}

            {activeSection === 'ai' && (
              <div className="space-y-4 max-w-2xl">
                <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">AI Commentary</h3>
                    <button onClick={handleCommentary} disabled={generating !== null}
                      className="text-xs px-3 py-1 rounded-lg bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white font-medium transition-colors">
                      {generating === 'commentary' ? 'Generating…' : '✨ Regenerate'}
                    </button>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed">{dbAnalytics?.aiCommentary ?? 'No commentary yet. Click Regenerate to generate AI commentary for this match.'}</p>
                </div>
                <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tactical Report</h3>
                    <button onClick={handleTacticalReport} disabled={generating !== null}
                      className="text-xs px-3 py-1 rounded-lg bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white font-medium transition-colors">
                      {generating === 'report' ? 'Generating…' : '📋 Generate'}
                    </button>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{dbAnalytics?.aiTacticalReport ?? 'No tactical report yet.'}</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
