import { useEffect, useState } from 'react';
import { playersApi, type Player } from '../api';

const POSITIONS = ['ALL', 'GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'];
const DEMO_PLAYERS: Player[] = [
  { id: '1', name: 'Marcus Kane', teamName: 'Kobe FC', position: 'ST', nationality: 'England', jerseyNumber: 9, rating: 88, stats: { goals: 22, assists: 8, matches: 28 } },
  { id: '2', name: 'Luca Bianchi', teamName: 'Kobe FC', position: 'CAM', nationality: 'Italy', jerseyNumber: 10, rating: 86, stats: { goals: 12, assists: 18, matches: 27 } },
  { id: '3', name: 'Diogo Ferreira', teamName: 'City United', position: 'CM', nationality: 'Portugal', jerseyNumber: 8, rating: 84, stats: { goals: 6, assists: 11, matches: 28 } },
  { id: '4', name: 'Yusuf Al-Rashid', teamName: 'Athletic Club', position: 'GK', nationality: 'Morocco', jerseyNumber: 1, rating: 85, stats: { cleanSheets: 12, saves: 78, matches: 28 } },
  { id: '5', name: 'James Okafor', teamName: 'Rovers FC', position: 'CB', nationality: 'Nigeria', jerseyNumber: 5, rating: 82, stats: { tackles: 68, interceptions: 42, matches: 26 } },
  { id: '6', name: 'Tomás Herrera', teamName: 'United XI', position: 'LW', nationality: 'Argentina', jerseyNumber: 11, rating: 83, stats: { goals: 14, assists: 9, matches: 25 } },
];

function RatingBadge({ rating }: { rating: number }) {
  const color = rating >= 87 ? 'text-yellow-400 bg-yellow-900/40' : rating >= 83 ? 'text-green-400 bg-green-900/40' : 'text-blue-400 bg-blue-900/40';
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{rating}</span>;
}

export default function Players() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [posFilter, setPosFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<Player>>({ rating: 75 });

  const load = () => {
    setLoading(true);
    playersApi.list(1, 100)
      .then((r) => setPlayers(r.data))
      .catch(() => setPlayers(DEMO_PLAYERS))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    void (async () => { load(); })();
  }, []);  

  const filtered = players.filter((p) => {
    const matchPos = posFilter === 'ALL' || p.position === posFilter;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.teamName?.toLowerCase().includes(search.toLowerCase());
    return matchPos && matchSearch;
  });

  const handleCreate = async () => {
    try {
      await playersApi.create(form);
      setShowForm(false);
      setForm({ rating: 75 });
      load();
    } catch { /* demo */ }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          placeholder="Search players or teams…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-48"
        />
        <div className="flex gap-1 flex-wrap">
          {POSITIONS.map((p) => (
            <button
              key={p}
              onClick={() => setPosFilter(p)}
              className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                posFilter === p ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="ml-auto px-3 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 text-white text-xs font-semibold transition-colors"
        >
          + Add Player
        </button>
      </div>

      {/* Player grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-gray-900 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-500 py-12">No players found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((p) => (
            <div key={p.id} className="rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-600 p-4 transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-lg font-bold text-gray-300 shrink-0">
                  {p.jerseyNumber ?? p.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-semibold truncate">{p.name}</p>
                    <RatingBadge rating={p.rating} />
                  </div>
                  <p className="text-xs text-gray-400">{p.teamName} · {p.position} · {p.nationality}</p>
                  {p.stats && (
                    <div className="flex gap-3 mt-2">
                      {Object.entries(p.stats).slice(0, 3).map(([k, v]) => (
                        <div key={k} className="text-center">
                          <p className="text-sm font-bold text-white">{v}</p>
                          <p className="text-xs text-gray-500 capitalize">{k}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Add Player</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            {(['name', 'teamName', 'nationality'] as const).map((field) => (
              <input
                key={field}
                placeholder={field.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                value={(form[field] as string) ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            ))}
            <div className="grid grid-cols-2 gap-2">
              <select
                value={form.position ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Position</option>
                {POSITIONS.filter((p) => p !== 'ALL').map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <input
                type="number"
                placeholder="Jersey #"
                value={form.jerseyNumber ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, jerseyNumber: parseInt(e.target.value) }))}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Rating: {form.rating}</label>
              <input
                type="range" min={40} max={99}
                value={form.rating ?? 75}
                onChange={(e) => setForm((f) => ({ ...f, rating: parseInt(e.target.value) }))}
                className="w-full accent-blue-500"
              />
            </div>
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
