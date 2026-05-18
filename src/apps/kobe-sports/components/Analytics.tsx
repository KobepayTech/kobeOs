import { useEffect, useState } from 'react';
import { matchesApi, analyticsApi, type Match, type Analytics, type MatchStats } from '../api';

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
        <div className={`${homeColor} h-full transition-all`} style={{ width: `${(home / total) * 100}%` }} />
        <div className={`${awayColor} h-full transition-all`} style={{ width: `${(away / total) * 100}%` }} />
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
          <linearGradient id="xg-home" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="xg-away" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${toPath(home)} L${px(home.length - 1)},${H} L0,${H} Z`} fill="url(#xg-home)" />
        <path d={`${toPath(away)} L${px(away.length - 1)},${H} L0,${H} Z`} fill="url(#xg-away)" />
        <path d={toPath(home)} fill="none" stroke="#3b82f6" strokeWidth="2" />
        <path d={toPath(away)} fill="none" stroke="#f97316" strokeWidth="2" />
      </svg>
      <div className="flex gap-4 mt-1 text-xs">
        <span className="flex items-center gap-1 text-blue-400">
          <span className="w-3 h-0.5 bg-blue-500 inline-block rounded" /> xG {home.at(-1)?.toFixed(2) ?? '0.00'}
        </span>
        <span className="flex items-center gap-1 text-orange-400">
          <span className="w-3 h-0.5 bg-orange-500 inline-block rounded" /> xG {away.at(-1)?.toFixed(2) ?? '0.00'}
        </span>
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
      {/* Pitch outline */}
      <div className="relative rounded overflow-hidden border border-green-900/40" style={{ background: '#0a2e0a' }}>
        {/* Field markings */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 65" preserveAspectRatio="none">
          <rect x="1" y="1" width="98" height="63" fill="none" stroke="#1a4a1a" strokeWidth="0.5" />
          <line x1="50" y1="1" x2="50" y2="64" stroke="#1a4a1a" strokeWidth="0.5" />
          <circle cx="50" cy="32.5" r="9.15" fill="none" stroke="#1a4a1a" strokeWidth="0.5" />
          <rect x="1" y="20" width="16.5" height="25" fill="none" stroke="#1a4a1a" strokeWidth="0.5" />
          <rect x="82.5" y="20" width="16.5" height="25" fill="none" stroke="#1a4a1a" strokeWidth="0.5" />
          <rect x="1" y="27" width="5.5" height="11" fill="none" stroke="#1a4a1a" strokeWidth="0.5" />
          <rect x="93.5" y="27" width="5.5" height="11" fill="none" stroke="#1a4a1a" strokeWidth="0.5" />
        </svg>
        {/* Heatmap cells */}
        <div className="relative grid gap-0" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {data.flat().map((v, i) => {
            const intensity = v / max;
            return (
              <div key={i} style={{
                paddingBottom: `${(65 / rows / (100 / cols))}%`,
                backgroundColor: `rgba(${color === 'text-blue-400' ? '59,130,246' : '249,115,22'},${(intensity * 0.7).toFixed(2)})`,
              }} />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EventTimeline({ events }: { events: Array<{ minute: number; type: string; playerName?: string; team?: string }> }) {
  const icons: Record<string, string> = {
    GOAL: '⚽', YELLOW_CARD: '🟨', RED_CARD: '🟥', SUBSTITUTION: '🔄',
    OFFSIDE: '🚩', VAR: '📺', PENALTY: '🎯', OWN_GOAL: '😬', FOUL: '⚠️',
  };
  return (
    <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
      {events.length === 0 && <p className="text-xs text-gray-500 text-center py-4">No events yet</p>}
      {events.map((e, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="text-gray-500 w-8 text-right shrink-0">{e.minute}'</span>
          <span>{icons[e.type] ?? '•'}</span>
          <span className={`font-medium ${e.team === 'home' ? 'text-blue-300' : 'text-orange-300'}`}>
            {e.playerName ?? e.type}
          </span>
          {e.type === 'GOAL' && <span className="text-green-400 text-[10px] font-bold">GOAL</span>}
        </div>
      ))}
    </div>
  );
}

// ── Demo data ─────────────────────────────────────────────────────────────────

const DEMO_STATS: MatchStats = {
  possession: { home: 58, away: 42 },
  shots: { home: 14, away: 8 },
  shotsOnTarget: { home: 6, away: 3 },
  corners: { home: 7, away: 4 },
  fouls: { home: 11, away: 14 },
  yellowCards: { home: 1, away: 2 },
  redCards: { home: 0, away: 0 },
  xg: { home: 1.84, away: 0.92 },
};

const DEMO_ANALYTICS: Analytics = {
  id: 'a1', matchId: '1', status: 'READY',
  possession: { home: 58, away: 42 },
  heatmaps: {
    home: Array.from({ length: 10 }, (_, r) => Array.from({ length: 13 }, (_, c) => {
      const x = c / 12; const y = r / 9;
      return Math.round(Math.max(0, 20 * Math.exp(-((x - 0.7) ** 2 + (y - 0.5) ** 2) / 0.08) + 10 * Math.random()));
    })),
    away: Array.from({ length: 10 }, (_, r) => Array.from({ length: 13 }, (_, c) => {
      const x = c / 12; const y = r / 9;
      return Math.round(Math.max(0, 20 * Math.exp(-((x - 0.3) ** 2 + (y - 0.5) ** 2) / 0.08) + 10 * Math.random()));
    })),
  },
  xgData: { home: [0, 0.1, 0.3, 0.5, 0.8, 1.1, 1.4, 1.6, 1.84], away: [0, 0.05, 0.2, 0.35, 0.5, 0.65, 0.8, 0.92, 0.92] },
  formations: { home: '4-3-3', away: '4-4-2' },
  aiCommentary: 'Simba SC dominated possession in the first half, pressing high and winning the ball back quickly. Their 4-3-3 shape created overloads on the left flank, leading to the opening goal from a cutback. Young Africans struggled to build through the press but created danger on the counter.',
  aiTacticalReport: "Simba SC's high press was the defining tactical element. The front three pressed in a coordinated 4-3-3 shape, forcing Young Africans into long balls. The midfield trio controlled the tempo, with the #10 dropping deep to receive and turn. Defensively, the back four held a high line, catching Young Africans offside 4 times.",
};

const DEMO_EVENTS = [
  { minute: 12, type: 'GOAL', playerName: 'Clatous Chama', team: 'home' },
  { minute: 23, type: 'YELLOW_CARD', playerName: 'Fiston Mayele', team: 'away' },
  { minute: 34, type: 'OFFSIDE', playerName: 'Gnamien Yao', team: 'away' },
  { minute: 45, type: 'GOAL', playerName: 'Luis Miquissone', team: 'home' },
  { minute: 58, type: 'SUBSTITUTION', playerName: 'Tresor Mputu', team: 'away' },
  { minute: 67, type: 'VAR', playerName: 'Penalty review', team: 'home' },
  { minute: 71, type: 'YELLOW_CARD', playerName: 'Joao Boccolini', team: 'home' },
  { minute: 82, type: 'GOAL', playerName: 'Fiston Mayele', team: 'away' },
];

const DEMO_MATCHES: Match[] = [
  { id: '1', sport: 'football', homeTeam: 'Simba SC', awayTeam: 'Young Africans', kickoff: new Date().toISOString(), status: 'LIVE', homeScore: 2, awayScore: 1, competition: 'Tanzania Premier League' },
  { id: '2', sport: 'football', homeTeam: 'Arsenal', awayTeam: 'Chelsea', kickoff: new Date().toISOString(), status: 'HT', homeScore: 1, awayScore: 1, competition: 'Premier League' },
];

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Analytics() {
  const [matches, setMatches] = useState<Match[]>(DEMO_MATCHES);
  const [selectedId, setSelectedId] = useState('1');
  const [analytics, setAnalytics] = useState<Analytics | null>(DEMO_ANALYTICS);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState<'report' | 'commentary' | null>(null);
  const [activeSection, setActiveSection] = useState<'stats' | 'heatmap' | 'xg' | 'events' | 'ai'>('stats');

  const selectedMatch = matches.find((m) => m.id === selectedId);
  const stats: MatchStats = selectedMatch?.stats ?? DEMO_STATS;

  useEffect(() => {
    matchesApi.list(1, 50)
      .then((r) => { if (r.data.length) { setMatches(r.data); setSelectedId(r.data[0].id); } })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    analyticsApi.forMatch(selectedId)
      .then(setAnalytics)
      .catch(() => setAnalytics({ ...DEMO_ANALYTICS, matchId: selectedId }))
      .finally(() => setLoading(false));
  }, [selectedId]);

  const handleTacticalReport = async () => {
    if (!selectedId) return;
    setGenerating('report');
    try { const r = await analyticsApi.tacticalReport(selectedId); setAnalytics((a) => a ? { ...a, aiTacticalReport: r.report } : a); } catch { /* demo */ }
    setGenerating(null);
  };

  const handleCommentary = async () => {
    if (!selectedId) return;
    setGenerating('commentary');
    try { const r = await analyticsApi.commentary(selectedId); setAnalytics((a) => a ? { ...a, aiCommentary: r.commentary } : a); } catch { /* demo */ }
    setGenerating(null);
  };

  const sections = [
    { id: 'stats', label: 'Stats' },
    { id: 'heatmap', label: 'Heatmap' },
    { id: 'xg', label: 'xG' },
    { id: 'events', label: 'Events' },
    { id: 'ai', label: 'AI Report' },
  ] as const;

  return (
    <div className="flex flex-col h-full">
      {/* Match selector */}
      <div className="p-3 border-b border-gray-800 shrink-0 flex items-center gap-3">
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
          {matches.map((m) => <option key={m.id} value={m.id}>{m.homeTeam} vs {m.awayTeam}</option>)}
        </select>
        {analytics && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
            analytics.status === 'READY' ? 'bg-green-900/50 text-green-400' :
            analytics.status === 'PROCESSING' ? 'bg-yellow-900/50 text-yellow-400' : 'bg-gray-800 text-gray-400'
          }`}>{analytics.status}</span>
        )}
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

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-gray-900 animate-pulse" />)}</div>
        ) : (
          <>
            {/* ── Stats ── */}
            {activeSection === 'stats' && (
              <div className="space-y-4 max-w-2xl">
                {/* Score header */}
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
                    {analytics?.formations && (
                      <p className="text-xs text-gray-500 mt-2">{analytics.formations.home} vs {analytics.formations.away}</p>
                    )}
                  </div>
                )}

                {/* Stat bars */}
                <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 space-y-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span className="text-blue-400 font-semibold">{selectedMatch?.homeTeam ?? 'Home'}</span>
                    <span className="font-medium">Match Statistics</span>
                    <span className="text-orange-400 font-semibold">{selectedMatch?.awayTeam ?? 'Away'}</span>
                  </div>
                  {stats.possession && <StatBar label="Possession %" home={stats.possession.home} away={stats.possession.away} />}
                  {stats.shots && <StatBar label="Shots" home={stats.shots.home} away={stats.shots.away} />}
                  {stats.shotsOnTarget && <StatBar label="Shots on Target" home={stats.shotsOnTarget.home} away={stats.shotsOnTarget.away} />}
                  {stats.corners && <StatBar label="Corners" home={stats.corners.home} away={stats.corners.away} />}
                  {stats.fouls && <StatBar label="Fouls" home={stats.fouls.home} away={stats.fouls.away} homeColor="bg-orange-500" awayColor="bg-blue-500" />}
                  {stats.yellowCards && <StatBar label="Yellow Cards" home={stats.yellowCards.home} away={stats.yellowCards.away} homeColor="bg-yellow-500" awayColor="bg-yellow-500" />}
                  {stats.xg && <StatBar label="Expected Goals (xG)" home={stats.xg.home * 10} away={stats.xg.away * 10} />}
                </div>

                {/* xG summary cards */}
                {stats.xg && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-blue-900/20 border border-blue-800/30 p-3 text-center">
                      <p className="text-xs text-blue-400 mb-1">Home xG</p>
                      <p className="text-3xl font-black text-blue-300">{stats.xg.home.toFixed(2)}</p>
                    </div>
                    <div className="rounded-xl bg-orange-900/20 border border-orange-800/30 p-3 text-center">
                      <p className="text-xs text-orange-400 mb-1">Away xG</p>
                      <p className="text-3xl font-black text-orange-300">{stats.xg.away.toFixed(2)}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Heatmap ── */}
            {activeSection === 'heatmap' && analytics?.heatmaps && (
              <div className="space-y-4 max-w-2xl">
                <PitchHeatmap data={analytics.heatmaps.home as number[][]} label={`${selectedMatch?.homeTeam ?? 'Home'} — Possession Heatmap`} color="text-blue-400" />
                <PitchHeatmap data={analytics.heatmaps.away as number[][]} label={`${selectedMatch?.awayTeam ?? 'Away'} — Possession Heatmap`} color="text-orange-400" />
                <p className="text-[11px] text-gray-600 text-center">Brighter zones = higher activity. Data from AI vision tracking.</p>
              </div>
            )}

            {/* ── xG Timeline ── */}
            {activeSection === 'xg' && analytics?.xgData && (
              <div className="space-y-4 max-w-2xl">
                <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Expected Goals Timeline</h3>
                  <XgTimeline home={analytics.xgData.home as number[]} away={analytics.xgData.away as number[]} />
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    { label: 'Home xG', value: (analytics.xgData.home as number[]).at(-1)?.toFixed(2), color: 'text-blue-400' },
                    { label: 'xG Diff', value: ((analytics.xgData.home as number[]).at(-1)! - (analytics.xgData.away as number[]).at(-1)!).toFixed(2), color: 'text-white' },
                    { label: 'Away xG', value: (analytics.xgData.away as number[]).at(-1)?.toFixed(2), color: 'text-orange-400' },
                  ].map((c) => (
                    <div key={c.label} className="rounded-xl bg-gray-900 border border-gray-800 p-3">
                      <p className="text-[11px] text-gray-500 mb-1">{c.label}</p>
                      <p className={`text-2xl font-black ${c.color}`}>{c.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Events ── */}
            {activeSection === 'events' && (
              <div className="max-w-lg">
                <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Match Events</h3>
                  <EventTimeline events={DEMO_EVENTS} />
                </div>
              </div>
            )}

            {/* ── AI Report ── */}
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
                  <p className="text-sm text-gray-300 leading-relaxed">{analytics?.aiCommentary ?? 'No commentary yet.'}</p>
                </div>
                <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tactical Report</h3>
                    <button onClick={handleTacticalReport} disabled={generating !== null}
                      className="text-xs px-3 py-1 rounded-lg bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white font-medium transition-colors">
                      {generating === 'report' ? 'Generating…' : '📋 Generate'}
                    </button>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{analytics?.aiTacticalReport ?? 'No tactical report yet.'}</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
