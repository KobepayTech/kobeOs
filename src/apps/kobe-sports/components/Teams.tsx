import { useEffect, useState } from 'react';
import { teamsApi, type Team } from '../api';

const DEMO_TEAMS: Team[] = [
  { id: '1', name: 'Kobe FC', shortName: 'KFC', competition: 'Premier League', country: 'England', stadium: 'Kobe Arena', played: 28, won: 18, drawn: 6, lost: 4, goalsFor: 58, goalsAgainst: 24, points: 60 },
  { id: '2', name: 'City United', shortName: 'CU', competition: 'Premier League', country: 'England', stadium: 'City Ground', played: 28, won: 16, drawn: 5, lost: 7, goalsFor: 52, goalsAgainst: 31, points: 53 },
  { id: '3', name: 'Athletic Club', shortName: 'ATH', competition: 'Premier League', country: 'England', stadium: 'Athletic Park', played: 28, won: 14, drawn: 8, lost: 6, goalsFor: 44, goalsAgainst: 28, points: 50 },
  { id: '4', name: 'Rovers FC', shortName: 'ROV', competition: 'Premier League', country: 'England', stadium: 'Rovers Lane', played: 28, won: 12, drawn: 7, lost: 9, goalsFor: 38, goalsAgainst: 35, points: 43 },
  { id: '5', name: 'United XI', shortName: 'UXI', competition: 'Premier League', country: 'England', stadium: 'United Park', played: 28, won: 10, drawn: 9, lost: 9, goalsFor: 35, goalsAgainst: 36, points: 39 },
  { id: '6', name: 'Dynamo', shortName: 'DYN', competition: 'Premier League', country: 'England', stadium: 'Dynamo Bowl', played: 28, won: 8, drawn: 6, lost: 14, goalsFor: 28, goalsAgainst: 48, points: 30 },
];

export default function Teams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [competition, setCompetition] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<Team>>({});

  const load = () => {
    setLoading(true);
    teamsApi.list(1, 100)
      .then((r) => setTeams(r.data))
      .catch(() => setTeams(DEMO_TEAMS))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    void (async () => { load(); })();
  }, []);  

  const competitions = [...new Set(teams.map((t) => t.competition).filter(Boolean))] as string[];
  const filtered = competition ? teams.filter((t) => t.competition === competition) : teams;
  const sorted = [...filtered].sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst));

  const handleCreate = async () => {
    try {
      await teamsApi.create(form);
      setShowForm(false);
      setForm({});
      load();
    } catch { /* demo */ }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={competition}
          onChange={(e) => setCompetition(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
        >
          <option value="">All Competitions</option>
          {competitions.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={() => setShowForm(true)}
          className="ml-auto px-3 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 text-white text-xs font-semibold transition-colors"
        >
          + Add Team
        </button>
      </div>

      {/* League table */}
      {loading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-gray-900 animate-pulse" />)}</div>
      ) : (
        <div className="rounded-xl overflow-hidden border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                <th className="px-3 py-2 text-left w-8">#</th>
                <th className="px-3 py-2 text-left">Team</th>
                <th className="px-3 py-2 text-center">P</th>
                <th className="px-3 py-2 text-center">W</th>
                <th className="px-3 py-2 text-center">D</th>
                <th className="px-3 py-2 text-center">L</th>
                <th className="px-3 py-2 text-center">GF</th>
                <th className="px-3 py-2 text-center">GA</th>
                <th className="px-3 py-2 text-center">GD</th>
                <th className="px-3 py-2 text-center font-bold text-white">Pts</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((team, i) => (
                <tr key={team.id} className={`border-t border-gray-800 hover:bg-gray-800/50 transition-colors ${i < 4 ? 'border-l-2 border-l-blue-500' : i >= sorted.length - 3 ? 'border-l-2 border-l-red-500' : ''}`}>
                  <td className="px-3 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-3 py-2.5">
                    <div>
                      <p className="text-white font-semibold">{team.name}</p>
                      {team.stadium && <p className="text-gray-500 text-xs">{team.stadium}</p>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center text-gray-300">{team.played}</td>
                  <td className="px-3 py-2.5 text-center text-green-400">{team.won}</td>
                  <td className="px-3 py-2.5 text-center text-yellow-400">{team.drawn}</td>
                  <td className="px-3 py-2.5 text-center text-red-400">{team.lost}</td>
                  <td className="px-3 py-2.5 text-center text-gray-300">{team.goalsFor}</td>
                  <td className="px-3 py-2.5 text-center text-gray-300">{team.goalsAgainst}</td>
                  <td className="px-3 py-2.5 text-center text-gray-300">{team.goalsFor - team.goalsAgainst > 0 ? '+' : ''}{team.goalsFor - team.goalsAgainst}</td>
                  <td className="px-3 py-2.5 text-center font-bold text-white">{team.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded-sm" /> Champions League</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-sm" /> Relegation</span>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Add Team</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            {(['name', 'shortName', 'competition', 'stadium', 'country'] as const).map((field) => (
              <input
                key={field}
                placeholder={field.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                value={(form[field] as string) ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            ))}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm hover:bg-gray-700">Cancel</button>
              <button onClick={handleCreate} className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500">Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
