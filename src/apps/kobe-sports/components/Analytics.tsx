import { useEffect, useState } from 'react';
import { matchesApi, analyticsApi, type Match, type Analytics } from '../api';

function HeatmapGrid({ data }: { data: number[][] }) {
  const max = Math.max(...data.flat(), 1);
  return (
    <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${data[0]?.length ?? 8}, 1fr)` }}>
      {data.flat().map((v, i) => {
        const intensity = v / max;
        return (
          <div
            key={i}
            className="aspect-square rounded-sm"
            style={{ backgroundColor: `rgba(59,130,246,${intensity.toFixed(2)})` }}
            title={`${v}`}
          />
        );
      })}
    </div>
  );
}

function PossessionBar({ home, away }: { home: number; away: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-400">
        <span>Home {home}%</span>
        <span>Away {away}%</span>
      </div>
      <div className="h-4 rounded-full overflow-hidden flex bg-gray-700">
        <div className="bg-blue-500 h-full transition-all" style={{ width: `${home}%` }} />
        <div className="bg-orange-500 h-full transition-all" style={{ width: `${away}%` }} />
      </div>
    </div>
  );
}

function XgChart({ home, away }: { home: number[]; away: number[] }) {
  const maxVal = Math.max(...home, ...away, 1);
  const points = Math.max(home.length, away.length);
  const w = 300;
  const h = 100;

  const toPath = (vals: number[], color: string) => {
    if (!vals.length) return null;
    const pts = vals.map((v, i) => `${(i / (points - 1)) * w},${h - (v / maxVal) * h}`).join(' L ');
    return <polyline points={pts} fill="none" stroke={color} strokeWidth="2" />;
  };

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-24">
      <line x1="0" y1={h} x2={w} y2={h} stroke="#374151" strokeWidth="1" />
      {toPath(home, '#3b82f6')}
      {toPath(away, '#f97316')}
    </svg>
  );
}

const DEMO_ANALYTICS: Analytics = {
  id: 'a1',
  matchId: '1',
  status: 'READY',
  possession: { home: 58, away: 42 },
  heatmaps: {
    home: Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => Math.floor(Math.random() * 20))),
    away: Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => Math.floor(Math.random() * 20))),
  },
  xgData: {
    home: [0, 0.2, 0.5, 0.8, 1.1, 1.4, 1.8],
    away: [0, 0.1, 0.3, 0.5, 0.7, 0.9, 0.9],
  },
  formations: { home: '4-3-3', away: '4-4-2' },
  aiCommentary: 'Kobe FC dominated possession in the first half, pressing high and winning the ball back quickly. Their 4-3-3 shape created overloads on the left flank, leading to the opening goal from a cutback. City United struggled to build through the press but created danger on the counter.',
  aiTacticalReport: 'Kobe FC\'s high press was the defining tactical element. The front three pressed in a coordinated 4-3-3 shape, forcing City United into long balls. The midfield trio controlled the tempo, with the #10 dropping deep to receive and turn. Defensively, the back four held a high line, catching City United offside 4 times.',
};

export default function Analytics() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState<'report' | 'commentary' | null>(null);

  useEffect(() => {
    void (async () => {
      matchesApi.list(1, 50)
        .then((r) => { setMatches(r.data); if (r.data[0]) setSelectedId(r.data[0].id); })
        .catch(() => { setMatches(DEMO_MATCHES); setSelectedId('1'); });
    })();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    void (async () => {
      setLoading(true);
      analyticsApi.forMatch(selectedId)
        .then(setAnalytics)
        .catch(() => setAnalytics({ ...DEMO_ANALYTICS, matchId: selectedId }))
        .finally(() => setLoading(false));
    })();
  }, [selectedId]);

  const handleTacticalReport = async () => {
    if (!selectedId) return;
    setGenerating('report');
    try {
      const r = await analyticsApi.tacticalReport(selectedId);
      setAnalytics((a) => a ? { ...a, aiTacticalReport: r.report } : a);
    } catch { /* demo */ }
    setGenerating(null);
  };

  const handleCommentary = async () => {
    if (!selectedId) return;
    setGenerating('commentary');
    try {
      const r = await analyticsApi.commentary(selectedId);
      setAnalytics((a) => a ? { ...a, aiCommentary: r.commentary } : a);
    } catch { /* demo */ }
    setGenerating(null);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Match selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-400">Match:</label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 flex-1 max-w-xs"
        >
          {matches.map((m) => (
            <option key={m.id} value={m.id}>{m.homeTeam} vs {m.awayTeam}</option>
          ))}
        </select>
        {analytics && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            analytics.status === 'READY' ? 'bg-green-900/50 text-green-400' :
            analytics.status === 'PROCESSING' ? 'bg-yellow-900/50 text-yellow-400' :
            'bg-gray-800 text-gray-400'
          }`}>{analytics.status}</span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-32 rounded-xl bg-gray-900 animate-pulse" />)}</div>
      ) : analytics ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Possession */}
          {analytics.possession && (
            <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Possession</h3>
              <PossessionBar home={analytics.possession.home} away={analytics.possession.away} />
            </div>
          )}

          {/* Formations */}
          {analytics.formations && (
            <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Formations</h3>
              <div className="flex items-center justify-around">
                <div className="text-center">
                  <p className="text-3xl font-black text-blue-400">{analytics.formations.home}</p>
                  <p className="text-xs text-gray-500 mt-1">Home</p>
                </div>
                <span className="text-gray-600 text-xl">vs</span>
                <div className="text-center">
                  <p className="text-3xl font-black text-orange-400">{analytics.formations.away}</p>
                  <p className="text-xs text-gray-500 mt-1">Away</p>
                </div>
              </div>
            </div>
          )}

          {/* xG Chart */}
          {analytics.xgData && (
            <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Expected Goals (xG)</h3>
              <XgChart home={analytics.xgData.home} away={analytics.xgData.away} />
              <div className="flex gap-4 mt-2 text-xs">
                <span className="flex items-center gap-1 text-blue-400"><span className="w-3 h-0.5 bg-blue-500 inline-block" /> Home {analytics.xgData.home.at(-1)?.toFixed(2)}</span>
                <span className="flex items-center gap-1 text-orange-400"><span className="w-3 h-0.5 bg-orange-500 inline-block" /> Away {analytics.xgData.away.at(-1)?.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Heatmaps */}
          {analytics.heatmaps && (
            <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Heatmaps</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-blue-400 mb-1">Home</p>
                  <HeatmapGrid data={analytics.heatmaps.home as number[][]} />
                </div>
                <div>
                  <p className="text-xs text-orange-400 mb-1">Away</p>
                  <HeatmapGrid data={analytics.heatmaps.away as number[][]} />
                </div>
              </div>
            </div>
          )}

          {/* AI Commentary */}
          <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 md:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">AI Commentary</h3>
              <button
                onClick={handleCommentary}
                disabled={generating !== null}
                className="text-xs px-3 py-1 rounded-lg bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white font-medium transition-colors"
              >
                {generating === 'commentary' ? 'Generating…' : '✨ Regenerate'}
              </button>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">{analytics.aiCommentary ?? 'No commentary yet.'}</p>
          </div>

          {/* AI Tactical Report */}
          <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 md:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tactical Report</h3>
              <button
                onClick={handleTacticalReport}
                disabled={generating !== null}
                className="text-xs px-3 py-1 rounded-lg bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white font-medium transition-colors"
              >
                {generating === 'report' ? 'Generating…' : '📋 Generate Report'}
              </button>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{analytics.aiTacticalReport ?? 'No tactical report yet.'}</p>
          </div>
        </div>
      ) : (
        <div className="text-center text-gray-500 py-12">Select a match to view analytics.</div>
      )}
    </div>
  );
}

const DEMO_MATCHES: Match[] = [
  { id: '1', sport: 'football', homeTeam: 'Kobe FC', awayTeam: 'City United', kickoff: new Date().toISOString(), status: 'FT', homeScore: 2, awayScore: 1, competition: 'Premier League' },
  { id: '2', sport: 'football', homeTeam: 'Athletic Club', awayTeam: 'Rovers FC', kickoff: new Date().toISOString(), status: 'FT', homeScore: 0, awayScore: 0, competition: 'Championship' },
];
