import { useEffect, useState } from 'react';
import { playersApi, seasonStatsApi, matchesApi, type Player, type PlayerSeasonStats, type MatchPlayerStat } from '../api';

// ── Helpers ───────────────────────────────────────────────────────────────────

function RatingBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = pct >= 75 ? 'bg-green-500' : pct >= 55 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-300 w-7 text-right">{Math.round(value)}</span>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center bg-gray-800 rounded-lg px-3 py-2 min-w-[52px]">
      <span className="text-sm font-bold text-white">{value}</span>
      <span className="text-[10px] text-gray-400 mt-0.5">{label}</span>
    </div>
  );
}

const POSITION_COLOR: Record<string, string> = {
  GK: 'bg-yellow-700 text-yellow-200',
  CB: 'bg-blue-800 text-blue-200',
  LB: 'bg-blue-700 text-blue-200',
  RB: 'bg-blue-700 text-blue-200',
  CDM: 'bg-green-800 text-green-200',
  CM: 'bg-green-700 text-green-200',
  CAM: 'bg-orange-700 text-orange-200',
  LW: 'bg-red-700 text-red-200',
  RW: 'bg-red-700 text-red-200',
  ST: 'bg-red-600 text-red-100',
};

// ── Player Card (list view) ───────────────────────────────────────────────────

function PlayerCard({ player, onClick }: { player: Player; onClick: () => void }) {
  const posColor = POSITION_COLOR[player.position ?? ''] ?? 'bg-gray-700 text-gray-200';
  return (
    <button onClick={onClick}
      className="w-full text-left rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-600 p-4 transition-colors space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-300 flex-shrink-0">
            {player.jerseyNumber ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{player.name}</p>
            <p className="text-xs text-gray-400 truncate">{player.teamName ?? 'No team'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {player.position && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${posColor}`}>{player.position}</span>
          )}
          <span className="text-sm font-bold text-white">{player.rating.toFixed(0)}</span>
        </div>
      </div>
      <RatingBar value={player.rating} />
    </button>
  );
}

// ── Season Stats Summary ──────────────────────────────────────────────────────

function SeasonStatsPanel({ stats }: { stats: PlayerSeasonStats }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Season {stats.season}</span>
        {stats.competition && <span className="text-xs text-gray-500">{stats.competition}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        <StatPill label="Apps" value={stats.matchesPlayed} />
        <StatPill label="Goals" value={stats.goals} />
        <StatPill label="Assists" value={stats.assists} />
        <StatPill label="xG" value={Number(stats.xgTotal).toFixed(2)} />
        <StatPill label="Dist km" value={Number(stats.distanceKm).toFixed(0)} />
        <StatPill label="Sprints" value={stats.sprints} />
        <StatPill label="Mins" value={stats.minutesPlayed} />
        <StatPill label="YC" value={stats.yellowCards} />
        {stats.redCards > 0 && <StatPill label="RC" value={stats.redCards} />}
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-400">Avg Rating</span>
          <span className="text-xs text-gray-300">{Number(stats.avgRating).toFixed(1)}</span>
        </div>
        <RatingBar value={Number(stats.avgRating)} />
      </div>
    </div>
  );
}

// ── Match History ─────────────────────────────────────────────────────────────

function MatchHistoryPanel({ history }: { history: NonNullable<PlayerSeasonStats['matchHistory']> }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Match History</p>
      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
        {history.length === 0 && <p className="text-xs text-gray-500">No match history yet.</p>}
        {history.map((m, i) => (
          <div key={i} className="flex items-center gap-2 text-xs bg-gray-800 rounded-lg px-3 py-2">
            <span className="text-gray-500 w-20 flex-shrink-0 truncate">
              {new Date(m.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
            </span>
            <span className="text-gray-300 flex-1 truncate">{m.homeTeam} vs {m.awayTeam}</span>
            <div className="flex items-center gap-2 flex-shrink-0">
              {m.goals > 0 && <span className="text-green-400">⚽ {m.goals}</span>}
              {m.assists > 0 && <span className="text-blue-400">🅰 {m.assists}</span>}
              <span className="text-gray-400">{m.minutesPlayed}'</span>
              <span className={`font-bold ${m.rating >= 70 ? 'text-green-400' : m.rating >= 55 ? 'text-yellow-400' : 'text-red-400'}`}>
                {m.rating}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Live Match Stats ──────────────────────────────────────────────────────────

function LiveStatsPanel({ stats }: { stats: MatchPlayerStat[] }) {
  if (stats.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Live Match Stats</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 border-b border-gray-800">
              <th className="text-left py-1.5 pr-2">Player</th>
              <th className="text-center px-1">Pos</th>
              <th className="text-center px-1">Dist</th>
              <th className="text-center px-1">Spr</th>
              <th className="text-center px-1">xG</th>
              <th className="text-center px-1">G</th>
              <th className="text-right pl-1">Rtg</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s, i) => (
              <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="py-1.5 pr-2">
                  <span className="text-gray-300">{s.name}</span>
                  <span className={`ml-1.5 text-[10px] px-1 rounded ${s.team === 'home' ? 'bg-blue-900 text-blue-300' : 'bg-red-900 text-red-300'}`}>
                    {s.jerseyNumber}
                  </span>
                </td>
                <td className="text-center px-1 text-gray-400">{s.team === 'home' ? 'H' : 'A'}</td>
                <td className="text-center px-1 text-gray-300">{s.distanceKm.toFixed(1)}</td>
                <td className="text-center px-1 text-gray-300">{s.sprints}</td>
                <td className="text-center px-1 text-gray-300">{s.xg.toFixed(2)}</td>
                <td className="text-center px-1 text-green-400 font-bold">{s.goals || '–'}</td>
                <td className="text-right pl-1">
                  <span className={`font-bold ${s.rating >= 70 ? 'text-green-400' : s.rating >= 55 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {s.rating}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Player Detail Panel ───────────────────────────────────────────────────────

function PlayerDetail({ player, onBack }: { player: Player; onBack: () => void }) {
  const [seasonStats, setSeasonStats] = useState<PlayerSeasonStats[]>([]);
  const [liveStats, setLiveStats] = useState<MatchPlayerStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      seasonStatsApi.forPlayer(player.id).catch(() => [] as PlayerSeasonStats[]),
      // Try to find a live match this player is in
      matchesApi.getLive().then(async (matches) => {
        for (const m of matches.slice(0, 3)) {
          const stats = await matchesApi.playerStats(m.id).catch(() => [] as MatchPlayerStat[]);
          const found = stats.find((s) => s.name === player.name);
          if (found) return stats;
        }
        return [] as MatchPlayerStat[];
      }).catch(() => [] as MatchPlayerStat[]),
    ]).then(([ss, ls]) => {
      setSeasonStats(ss);
      setLiveStats(ls);
    }).finally(() => setLoading(false));
  }, [player.id, player.name]);

  const posColor = POSITION_COLOR[player.position ?? ''] ?? 'bg-gray-700 text-gray-200';
  const latestSeason = seasonStats[0];

  return (
    <div className="space-y-4">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-400 hover:text-white text-xs flex items-center gap-1">
          ← Back
        </button>
      </div>

      {/* Profile card */}
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gray-700 flex items-center justify-center text-2xl font-bold text-gray-300 flex-shrink-0">
            {player.jerseyNumber ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-white truncate">{player.name}</h2>
            <p className="text-sm text-gray-400">{player.teamName ?? 'No team'}</p>
            <div className="flex items-center gap-2 mt-1">
              {player.position && (
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${posColor}`}>{player.position}</span>
              )}
              {player.nationality && (
                <span className="text-xs text-gray-500">{player.nationality}</span>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-3xl font-bold text-white">{player.rating.toFixed(0)}</p>
            <p className="text-xs text-gray-400">Rating</p>
          </div>
        </div>
        <div className="mt-3">
          <RatingBar value={player.rating} />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-gray-900 border border-gray-800 animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Live stats if available */}
          {liveStats.length > 0 && (
            <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
              <LiveStatsPanel stats={liveStats} />
            </div>
          )}

          {/* Season stats */}
          {latestSeason ? (
            <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 space-y-4">
              <SeasonStatsPanel stats={latestSeason} />
              {latestSeason.matchHistory && latestSeason.matchHistory.length > 0 && (
                <MatchHistoryPanel history={latestSeason.matchHistory} />
              )}
            </div>
          ) : (
            <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
              <p className="text-xs text-gray-500">No season stats yet. Stats accumulate after matches end.</p>
            </div>
          )}

          {/* All seasons */}
          {seasonStats.length > 1 && (
            <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">All Seasons</p>
              {seasonStats.map((s) => (
                <div key={s.id} className="border-t border-gray-800 pt-3 first:border-0 first:pt-0">
                  <SeasonStatsPanel stats={s} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Players Component ────────────────────────────────────────────────────

export default function Players() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [posFilter, setPosFilter] = useState('');
  const [selected, setSelected] = useState<Player | null>(null);

  useEffect(() => {
    playersApi.list(1, 100)
      .then((r) => setPlayers(r.data))
      .catch(() => setPlayers(DEMO_PLAYERS))
      .finally(() => setLoading(false));
  }, []);

  const filtered = players.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.teamName?.toLowerCase().includes(search.toLowerCase());
    const matchPos = !posFilter || p.position === posFilter;
    return matchSearch && matchPos;
  });

  const positions = [...new Set(players.map((p) => p.position).filter(Boolean))] as string[];

  if (selected) {
    return (
      <div className="p-4">
        <PlayerDetail player={selected} onBack={() => setSelected(null)} />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Filters */}
      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search players…"
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
        />
        <select
          value={posFilter}
          onChange={(e) => setPosFilter(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
        >
          <option value="">All positions</option>
          {positions.map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-gray-900 border border-gray-800 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-6 text-center">
          <p className="text-sm text-gray-400">{search || posFilter ? 'No players match your filters.' : 'No players yet. Add players via the API.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((p) => (
            <PlayerCard key={p.id} player={p} onClick={() => setSelected(p)} />
          ))}
        </div>
      )}
    </div>
  );
}

const DEMO_PLAYERS: Player[] = [
  { id: '1', name: 'James Omondi', teamName: 'Kobe FC', position: 'ST', jerseyNumber: 9, rating: 82, nationality: 'Kenya' },
  { id: '2', name: 'Ali Hassan', teamName: 'Kobe FC', position: 'CM', jerseyNumber: 8, rating: 76, nationality: 'Tanzania' },
  { id: '3', name: 'Peter Mwangi', teamName: 'Kobe FC', position: 'GK', jerseyNumber: 1, rating: 74, nationality: 'Kenya' },
  { id: '4', name: 'David Kimani', teamName: 'City United', position: 'CB', jerseyNumber: 5, rating: 71, nationality: 'Kenya' },
  { id: '5', name: 'Samuel Otieno', teamName: 'City United', position: 'LW', jerseyNumber: 11, rating: 79, nationality: 'Uganda' },
  { id: '6', name: 'Moses Banda', teamName: 'Athletic Club', position: 'CAM', jerseyNumber: 10, rating: 85, nationality: 'Zambia' },
];
