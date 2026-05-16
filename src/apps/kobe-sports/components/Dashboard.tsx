import { useEffect, useState } from 'react';
import { matchesApi, type Match } from '../api';
import { useLiveMatches } from '../useLiveMatches';

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className={`rounded-xl p-4 bg-gray-900 border border-gray-800`}>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function MatchCard({ match }: { match: Match }) {
  const statusColor: Record<string, string> = {
    LIVE: 'text-green-400 bg-green-900/40',
    HT: 'text-yellow-400 bg-yellow-900/40',
    FT: 'text-gray-400 bg-gray-800',
    SCHEDULED: 'text-blue-400 bg-blue-900/40',
    POSTPONED: 'text-orange-400 bg-orange-900/40',
    CANCELLED: 'text-red-400 bg-red-900/40',
  };
  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 hover:border-gray-600 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500">{match.competition ?? match.sport}</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor[match.status] ?? 'text-gray-400 bg-gray-800'}`}>
          {match.status}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-white flex-1 text-right">{match.homeTeam}</span>
        <div className="flex items-center gap-2 px-3 py-1 bg-gray-800 rounded-lg">
          <span className="text-lg font-bold text-white">{match.homeScore}</span>
          <span className="text-gray-500">–</span>
          <span className="text-lg font-bold text-white">{match.awayScore}</span>
        </div>
        <span className="text-sm font-semibold text-white flex-1">{match.awayTeam}</span>
      </div>
      {match.venue && <p className="text-xs text-gray-500 text-center mt-2">📍 {match.venue}</p>}
    </div>
  );
}

export default function Dashboard() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const { liveMatches, connected } = useLiveMatches();

  useEffect(() => {
    matchesApi.list(1, 10)
      .then((r) => setMatches(r.data))
      .catch(() => setMatches(DEMO_MATCHES))
      .finally(() => setLoading(false));
  }, []);

  // Merge live WebSocket matches on top of DB matches
  const allMatches = liveMatches.length > 0
    ? [...liveMatches, ...matches.filter((m) => !liveMatches.find((l) => l.homeTeam === m.homeTeam && l.awayTeam === m.awayTeam))]
    : matches;

  const live = allMatches.filter((m) => m.status === 'LIVE').length;
  const today = allMatches.filter((m) => {
    const d = new Date(m.kickoff);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;
  const ft = allMatches.filter((m) => m.status === 'FT').length;

  return (
    <div className="p-4 space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Live Now" value={live} sub="matches in progress" color="text-green-400" />
        <StatCard label="Today" value={today} sub="scheduled today" color="text-blue-400" />
        <StatCard label="Completed" value={ft} sub="full time" color="text-gray-300" />
        <StatCard label="Total" value={allMatches.length} sub="in database" color="text-purple-400" />
      </div>

      {/* Recent matches */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Recent Matches</h2>
          {connected && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live feed
            </span>
          )}
        </div>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl bg-gray-900 border border-gray-800 p-4 animate-pulse h-24" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {allMatches.slice(0, 6).map((m) => <MatchCard key={m.id} match={m} />)}
          </div>
        )}
      </div>

      {/* Quick stats banner */}
      <div className="rounded-xl bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-800/40 p-4">
        <h3 className="text-sm font-semibold text-blue-300 mb-2">AI Analytics Ready</h3>
        <p className="text-xs text-gray-400">
          Select any match to generate AI commentary, tactical reports, xG analysis, heatmaps, and formation predictions powered by your local Kobe AI model.
        </p>
      </div>
    </div>
  );
}

// Demo data shown when backend is unavailable
const DEMO_MATCHES: Match[] = [
  { id: '1', sport: 'football', homeTeam: 'Kobe FC', awayTeam: 'City United', kickoff: new Date().toISOString(), status: 'LIVE', homeScore: 2, awayScore: 1, competition: 'Premier League', venue: 'Kobe Arena' },
  { id: '2', sport: 'football', homeTeam: 'Athletic Club', awayTeam: 'Rovers FC', kickoff: new Date().toISOString(), status: 'HT', homeScore: 0, awayScore: 0, competition: 'Championship', venue: 'Riverside Stadium' },
  { id: '3', sport: 'football', homeTeam: 'United XI', awayTeam: 'Dynamo', kickoff: new Date().toISOString(), status: 'FT', homeScore: 3, awayScore: 2, competition: 'Cup', venue: 'National Stadium' },
  { id: '4', sport: 'football', homeTeam: 'Sporting', awayTeam: 'Wanderers', kickoff: new Date(Date.now() + 3600000).toISOString(), status: 'SCHEDULED', homeScore: 0, awayScore: 0, competition: 'League One' },
];
