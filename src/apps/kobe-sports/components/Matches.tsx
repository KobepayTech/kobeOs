import { useEffect, useState, useCallback } from 'react';
import { matchesApi, liveApi, type Match, type LiveMatch } from '../api';

const STATUS_STYLE: Record<string, string> = {
  LIVE:      'text-green-400 bg-green-900/40 border border-green-800/50',
  HT:        'text-yellow-400 bg-yellow-900/40 border border-yellow-800/50',
  FT:        'text-gray-400 bg-gray-800 border border-gray-700',
  SCHEDULED: 'text-blue-400 bg-blue-900/40 border border-blue-800/50',
  POSTPONED: 'text-orange-400 bg-orange-900/40 border border-orange-800/50',
  CANCELLED: 'text-red-400 bg-red-900/40 border border-red-800/50',
};

function MatchCard({ match, selected, onClick }: { match: Match | LiveMatch; selected: boolean; onClick: () => void }) {
  const isLive = match.status === 'LIVE';
  const minute = 'minute' in match ? match.minute : undefined;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl p-3 border transition-all ${
        selected ? 'border-blue-500/60 bg-blue-900/20' : 'border-gray-800 bg-gray-900 hover:border-gray-600 hover:bg-gray-800/60'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-gray-500 truncate max-w-[60%]">{match.competition}</span>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${STATUS_STYLE[match.status] ?? 'text-gray-400 bg-gray-800'}`}>
          {isLive && minute ? `${minute}'` : match.status}
          {isLive && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="flex-1 text-sm font-semibold text-white text-right truncate">{match.homeTeam}</span>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-800 rounded-lg shrink-0">
          <span className={`text-base font-black ${isLive ? 'text-green-300' : 'text-white'}`}>{match.homeScore}</span>
          <span className="text-gray-600 text-xs">–</span>
          <span className={`text-base font-black ${isLive ? 'text-green-300' : 'text-white'}`}>{match.awayScore}</span>
        </div>
        <span className="flex-1 text-sm font-semibold text-white truncate">{match.awayTeam}</span>
      </div>
      {'venue' in match && match.venue && (
        <p className="text-[11px] text-gray-600 mt-1.5 truncate">{match.venue}</p>
      )}
    </button>
  );
}

const DEMO_MATCHES: Match[] = [
  { id: '1', sport: 'football', homeTeam: 'Simba SC', awayTeam: 'Young Africans', kickoff: new Date().toISOString(), status: 'LIVE', homeScore: 1, awayScore: 0, competition: 'Tanzania Premier League', venue: 'Benjamin Mkapa Stadium' },
  { id: '2', sport: 'football', homeTeam: 'Azam FC', awayTeam: 'Coastal Union', kickoff: new Date().toISOString(), status: 'LIVE', homeScore: 2, awayScore: 2, competition: 'Tanzania Premier League', venue: 'Azam Complex' },
  { id: '3', sport: 'football', homeTeam: 'Arsenal', awayTeam: 'Chelsea', kickoff: new Date().toISOString(), status: 'HT', homeScore: 1, awayScore: 1, competition: 'Premier League', venue: 'Emirates Stadium' },
  { id: '4', sport: 'football', homeTeam: 'Real Madrid', awayTeam: 'Barcelona', kickoff: new Date(Date.now() + 3_600_000).toISOString(), status: 'SCHEDULED', homeScore: 0, awayScore: 0, competition: 'La Liga', venue: 'Santiago Bernabéu' },
  { id: '5', sport: 'football', homeTeam: 'Al Ahly', awayTeam: 'Wydad AC', kickoff: new Date(Date.now() - 7_200_000).toISOString(), status: 'FT', homeScore: 3, awayScore: 1, competition: 'CAF Champions League', venue: 'Cairo International Stadium' },
  { id: '6', sport: 'football', homeTeam: 'Gor Mahia', awayTeam: 'AFC Leopards', kickoff: new Date().toISOString(), status: 'LIVE', homeScore: 0, awayScore: 1, competition: 'Kenya Premier League', venue: 'Nyayo Stadium' },
  { id: '7', sport: 'football', homeTeam: 'Mamelodi Sundowns', awayTeam: 'Orlando Pirates', kickoff: new Date().toISOString(), status: 'LIVE', homeScore: 2, awayScore: 0, competition: 'DStv Premiership', venue: 'Loftus Versfeld' },
];

interface MatchesProps {
  onSelectMatch?: (match: Match | LiveMatch) => void;
  selectedMatchId?: string;
}

export default function Matches({ onSelectMatch, selectedMatchId }: MatchesProps) {
  const [matches, setMatches] = useState<Match[]>(DEMO_MATCHES);
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [filter, setFilter] = useState<'all' | 'live' | 'scheduled' | 'finished'>('all');
  const [leagueFilter, setLeagueFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    matchesApi.list(1, 100).then((r) => { if (r.data.length) setMatches(r.data); }).catch(() => {});
    liveApi.matches().then(setLiveMatches).catch(() => {});
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await liveApi.refresh(); const live = await liveApi.matches(); setLiveMatches(live); } catch { /* offline */ }
    setRefreshing(false);
  }, []);

  const allMatches: (Match | LiveMatch)[] = [
    ...liveMatches,
    ...matches.filter((m) => !liveMatches.some((l) => l.homeTeam === m.homeTeam && l.awayTeam === m.awayTeam)),
  ];

  const leagues = ['all', ...Array.from(new Set(allMatches.map((m) => m.competition).filter(Boolean)))];

  const filtered = allMatches.filter((m) => {
    if (filter === 'live' && m.status !== 'LIVE' && m.status !== 'HT') return false;
    if (filter === 'scheduled' && m.status !== 'SCHEDULED') return false;
    if (filter === 'finished' && m.status !== 'FT') return false;
    if (leagueFilter !== 'all' && m.competition !== leagueFilter) return false;
    if (search) { const q = search.toLowerCase(); if (!m.homeTeam.toLowerCase().includes(q) && !m.awayTeam.toLowerCase().includes(q)) return false; }
    return true;
  });

  const liveCount = allMatches.filter((m) => m.status === 'LIVE' || m.status === 'HT').length;

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-800 space-y-2 shrink-0">
        <div className="flex gap-2">
          <input type="text" placeholder="Search teams…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
          <button onClick={handleRefresh} disabled={refreshing} title="Refresh live data"
            className="px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-all text-sm disabled:opacity-50">
            {refreshing ? '⟳' : '↻'}
          </button>
        </div>
        <div className="flex gap-1">
          {(['all', 'live', 'scheduled', 'finished'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              {f === 'live' ? <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />Live {liveCount > 0 && `(${liveCount})`}</span> : f}
            </button>
          ))}
        </div>
        <select value={leagueFilter} onChange={(e) => setLeagueFilter(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500">
          {leagues.map((l) => <option key={l} value={l}>{l === 'all' ? 'All Leagues' : l}</option>)}
        </select>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center text-gray-500 py-12 text-sm">No matches found</div>
        ) : filtered.map((m) => {
          const id = 'id' in m ? m.id : m.externalId;
          return <MatchCard key={id} match={m} selected={selectedMatchId === id} onClick={() => onSelectMatch?.(m)} />;
        })}
      </div>
    </div>
  );
}
