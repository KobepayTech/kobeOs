import { useEffect, useState } from 'react';
import { teamsApi, matchesApi, type Team, type Match } from '../api';

// ── League Table ──────────────────────────────────────────────────────────────

function LeagueTable({ teams }: { teams: Team[] }) {
  const sorted = [...teams].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    return b.goalsFor - a.goalsFor;
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500 border-b border-gray-800">
            <th className="text-left py-2 pr-2 w-6">#</th>
            <th className="text-left py-2 pr-2">Team</th>
            <th className="text-center px-1.5">P</th>
            <th className="text-center px-1.5">W</th>
            <th className="text-center px-1.5">D</th>
            <th className="text-center px-1.5">L</th>
            <th className="text-center px-1.5">GF</th>
            <th className="text-center px-1.5">GA</th>
            <th className="text-center px-1.5">GD</th>
            <th className="text-center px-1.5 font-bold text-gray-300">Pts</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((team, i) => {
            const gd = team.goalsFor - team.goalsAgainst;
            const isTop3 = i < 3;
            const isBottom3 = i >= sorted.length - 3 && sorted.length > 6;
            return (
              <tr key={team.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                <td className="py-2 pr-2">
                  <span className={`text-xs font-bold ${isTop3 ? 'text-green-400' : isBottom3 ? 'text-red-400' : 'text-gray-500'}`}>
                    {i + 1}
                  </span>
                </td>
                <td className="py-2 pr-2">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-300 flex-shrink-0">
                      {(team.shortName ?? team.name).slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-gray-200 font-medium truncate max-w-[100px]">{team.name}</span>
                  </div>
                </td>
                <td className="text-center px-1.5 text-gray-400">{team.played}</td>
                <td className="text-center px-1.5 text-green-400">{team.won}</td>
                <td className="text-center px-1.5 text-yellow-400">{team.drawn}</td>
                <td className="text-center px-1.5 text-red-400">{team.lost}</td>
                <td className="text-center px-1.5 text-gray-300">{team.goalsFor}</td>
                <td className="text-center px-1.5 text-gray-300">{team.goalsAgainst}</td>
                <td className="text-center px-1.5 text-gray-300">{gd > 0 ? `+${gd}` : gd}</td>
                <td className="text-center px-1.5 font-bold text-white">{team.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Head-to-Head ──────────────────────────────────────────────────────────────

function HeadToHead({ teamA, teamB, matches }: { teamA: Team; teamB: Team; matches: Match[] }) {
  const h2h = matches.filter((m) =>
    (m.homeTeam === teamA.name && m.awayTeam === teamB.name) ||
    (m.homeTeam === teamB.name && m.awayTeam === teamA.name)
  ).filter((m) => m.status === 'FT');

  const aWins = h2h.filter((m) =>
    (m.homeTeam === teamA.name && m.homeScore > m.awayScore) ||
    (m.awayTeam === teamA.name && m.awayScore > m.homeScore)
  ).length;
  const bWins = h2h.filter((m) =>
    (m.homeTeam === teamB.name && m.homeScore > m.awayScore) ||
    (m.awayTeam === teamB.name && m.awayScore > m.homeScore)
  ).length;
  const draws = h2h.length - aWins - bWins;

  if (h2h.length === 0) {
    return <p className="text-xs text-gray-500 py-2">No completed head-to-head matches found.</p>;
  }

  const total = h2h.length;
  const aGoals = h2h.reduce((s, m) => s + (m.homeTeam === teamA.name ? m.homeScore : m.awayScore), 0);
  const bGoals = h2h.reduce((s, m) => s + (m.homeTeam === teamB.name ? m.homeScore : m.awayScore), 0);

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-300 w-20 text-right truncate">{teamA.shortName ?? teamA.name}</span>
        <div className="flex-1 flex h-4 rounded-full overflow-hidden">
          <div className="bg-blue-600 transition-all" style={{ width: `${(aWins / total) * 100}%` }} />
          <div className="bg-gray-600 transition-all" style={{ width: `${(draws / total) * 100}%` }} />
          <div className="bg-red-600 transition-all" style={{ width: `${(bWins / total) * 100}%` }} />
        </div>
        <span className="text-xs text-gray-300 w-20 truncate">{teamB.shortName ?? teamB.name}</span>
      </div>
      <div className="flex justify-center gap-6 text-xs">
        <span className="text-blue-400 font-bold">{aWins}W</span>
        <span className="text-gray-400">{draws}D</span>
        <span className="text-red-400 font-bold">{bWins}W</span>
      </div>
      <div className="flex justify-center gap-4 text-xs text-gray-400">
        <span>Goals: <span className="text-white">{aGoals}</span></span>
        <span>–</span>
        <span>Goals: <span className="text-white">{bGoals}</span></span>
      </div>

      {/* Recent results */}
      <div className="space-y-1.5 max-h-40 overflow-y-auto">
        {h2h.slice(-5).reverse().map((m) => (
          <div key={m.id} className="flex items-center gap-2 text-xs bg-gray-800 rounded-lg px-3 py-2">
            <span className="text-gray-500 w-16 flex-shrink-0">
              {new Date(m.kickoff).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
            </span>
            <span className="flex-1 text-right text-gray-300 truncate">{m.homeTeam}</span>
            <span className="font-bold text-white px-2">{m.homeScore}–{m.awayScore}</span>
            <span className="flex-1 text-gray-300 truncate">{m.awayTeam}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Team Detail ───────────────────────────────────────────────────────────────

function TeamDetail({ team, allTeams, allMatches, onBack }: {
  team: Team; allTeams: Team[]; allMatches: Match[]; onBack: () => void;
}) {
  const [opponent, setOpponent] = useState<Team | null>(null);

  const teamMatches = allMatches.filter(
    (m) => m.homeTeam === team.name || m.awayTeam === team.name
  );
  const recent = teamMatches.filter((m) => m.status === 'FT').slice(-5).reverse();
  const gd = team.goalsFor - team.goalsAgainst;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-gray-400 hover:text-white text-xs flex items-center gap-1">
        ← Back
      </button>

      {/* Team header */}
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gray-700 flex items-center justify-center text-xl font-bold text-gray-300">
            {(team.shortName ?? team.name).slice(0, 3).toUpperCase()}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white">{team.name}</h2>
            <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
              {team.competition && <span>{team.competition}</span>}
              {team.country && <span>{team.country}</span>}
              {team.stadium && <span>📍 {team.stadium}</span>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-white">{team.points}</p>
            <p className="text-xs text-gray-400">points</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-5 gap-2 mt-4">
          {[
            { label: 'Played', value: team.played },
            { label: 'Won', value: team.won, color: 'text-green-400' },
            { label: 'Drawn', value: team.drawn, color: 'text-yellow-400' },
            { label: 'Lost', value: team.lost, color: 'text-red-400' },
            { label: 'GD', value: gd > 0 ? `+${gd}` : gd, color: gd > 0 ? 'text-green-400' : gd < 0 ? 'text-red-400' : 'text-gray-300' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex flex-col items-center bg-gray-800 rounded-lg py-2">
              <span className={`text-sm font-bold ${color ?? 'text-white'}`}>{value}</span>
              <span className="text-[10px] text-gray-400 mt-0.5">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent form */}
      {recent.length > 0 && (
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 space-y-2">
          <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Recent Form</p>
          <div className="flex gap-1.5">
            {recent.map((m) => {
              const isHome = m.homeTeam === team.name;
              const scored = isHome ? m.homeScore : m.awayScore;
              const conceded = isHome ? m.awayScore : m.homeScore;
              const result = scored > conceded ? 'W' : scored < conceded ? 'L' : 'D';
              const color = result === 'W' ? 'bg-green-600' : result === 'L' ? 'bg-red-600' : 'bg-yellow-600';
              return (
                <div key={m.id} title={`${m.homeTeam} ${m.homeScore}–${m.awayScore} ${m.awayTeam}`}
                  className={`w-7 h-7 rounded-full ${color} flex items-center justify-center text-xs font-bold text-white`}>
                  {result}
                </div>
              );
            })}
          </div>
          <div className="space-y-1 mt-2">
            {recent.map((m) => (
              <div key={m.id} className="flex items-center gap-2 text-xs">
                <span className="text-gray-500 w-16 flex-shrink-0">
                  {new Date(m.kickoff).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                </span>
                <span className="flex-1 text-right text-gray-300 truncate">{m.homeTeam}</span>
                <span className="font-bold text-white px-2">{m.homeScore}–{m.awayScore}</span>
                <span className="flex-1 text-gray-300 truncate">{m.awayTeam}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Head-to-head */}
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Head-to-Head</p>
          <select
            value={opponent?.id ?? ''}
            onChange={(e) => setOpponent(allTeams.find((t) => t.id === e.target.value) ?? null)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white"
          >
            <option value="">Select opponent…</option>
            {allTeams.filter((t) => t.id !== team.id).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        {opponent ? (
          <HeadToHead teamA={team} teamB={opponent} matches={allMatches} />
        ) : (
          <p className="text-xs text-gray-500">Select an opponent to see head-to-head stats.</p>
        )}
      </div>
    </div>
  );
}

// ── Main Teams Component ──────────────────────────────────────────────────────

export default function Teams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [competition, setCompetition] = useState('');
  const [selected, setSelected] = useState<Team | null>(null);

  useEffect(() => {
    Promise.all([
      teamsApi.list(1, 100).catch(() => ({ data: DEMO_TEAMS, total: DEMO_TEAMS.length })),
      matchesApi.list(1, 100).catch(() => ({ data: [] as Match[], total: 0 })),
    ]).then(([t, m]) => {
      setTeams(t.data);
      setMatches(m.data);
    }).finally(() => setLoading(false));
  }, []);

  const competitions = [...new Set(teams.map((t) => t.competition).filter(Boolean))] as string[];
  const filtered = competition ? teams.filter((t) => t.competition === competition) : teams;

  if (selected) {
    return (
      <div className="p-4">
        <TeamDetail team={selected} allTeams={teams} allMatches={matches} onBack={() => setSelected(null)} />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Competition filter */}
      {competitions.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setCompetition('')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${!competition ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            All
          </button>
          {competitions.map((c) => (
            <button key={c} onClick={() => setCompetition(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${competition === c ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              {c}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="h-48 rounded-xl bg-gray-900 border border-gray-800 animate-pulse" />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-6 text-center">
          <p className="text-sm text-gray-400">No teams yet. Add teams via the API.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* League table */}
          <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 space-y-3">
            <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
              {competition || 'League Table'}
            </h2>
            <LeagueTable teams={filtered} />
          </div>

          {/* Team cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((team) => {
              const gd = team.goalsFor - team.goalsAgainst;
              return (
                <button key={team.id} onClick={() => setSelected(team)}
                  className="text-left rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-600 p-4 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-300 flex-shrink-0">
                        {(team.shortName ?? team.name).slice(0, 3).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{team.name}</p>
                        <p className="text-xs text-gray-400">{team.competition ?? 'No competition'}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xl font-bold text-white">{team.points}</p>
                      <p className="text-xs text-gray-500">pts</p>
                    </div>
                  </div>
                  <div className="flex gap-4 mt-3 text-xs text-gray-400">
                    <span><span className="text-green-400 font-medium">{team.won}W</span></span>
                    <span><span className="text-yellow-400 font-medium">{team.drawn}D</span></span>
                    <span><span className="text-red-400 font-medium">{team.lost}L</span></span>
                    <span>GD: <span className={gd > 0 ? 'text-green-400' : gd < 0 ? 'text-red-400' : 'text-gray-300'}>{gd > 0 ? `+${gd}` : gd}</span></span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const DEMO_TEAMS: Team[] = [
  { id: '1', name: 'Kobe FC', shortName: 'KFC', competition: 'Premier League', country: 'Kenya', played: 10, won: 7, drawn: 2, lost: 1, goalsFor: 22, goalsAgainst: 8, points: 23 },
  { id: '2', name: 'City United', shortName: 'CU', competition: 'Premier League', country: 'Kenya', played: 10, won: 6, drawn: 1, lost: 3, goalsFor: 18, goalsAgainst: 12, points: 19 },
  { id: '3', name: 'Athletic Club', shortName: 'ATH', competition: 'Premier League', country: 'Kenya', played: 10, won: 5, drawn: 3, lost: 2, goalsFor: 15, goalsAgainst: 10, points: 18 },
  { id: '4', name: 'Rovers FC', shortName: 'ROV', competition: 'Premier League', country: 'Kenya', played: 10, won: 4, drawn: 2, lost: 4, goalsFor: 14, goalsAgainst: 16, points: 14 },
  { id: '5', name: 'United XI', shortName: 'UXI', competition: 'Premier League', country: 'Kenya', played: 10, won: 2, drawn: 3, lost: 5, goalsFor: 10, goalsAgainst: 18, points: 9 },
  { id: '6', name: 'Dynamo', shortName: 'DYN', competition: 'Premier League', country: 'Kenya', played: 10, won: 1, drawn: 1, lost: 8, goalsFor: 6, goalsAgainst: 21, points: 4 },
];
