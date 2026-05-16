import { useEffect, useState } from 'react';
import { matchesApi, type Match, type MatchEvent } from '../api';

const STATUS_OPTIONS = ['ALL', 'SCHEDULED', 'LIVE', 'HT', 'FT', 'POSTPONED', 'CANCELLED'];
const EVENT_ICONS: Record<string, string> = {
  GOAL: '⚽', YELLOW_CARD: '🟨', RED_CARD: '🟥', SUBSTITUTION: '🔄',
  OFFSIDE: '🚩', VAR: '📺', PENALTY: '🎯', OWN_GOAL: '😬', ASSIST: '👟', FOUL: '⚠️',
};

function EventBadge({ event }: { event: MatchEvent }) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-gray-800 text-sm">
      <span className="text-base">{EVENT_ICONS[event.type] ?? '•'}</span>
      <span className="text-gray-400 text-xs w-8 shrink-0">{event.minute}'</span>
      <span className="text-white font-medium">{event.playerName ?? event.type}</span>
      {event.team && <span className="text-gray-500 text-xs ml-auto">{event.team}</span>}
    </div>
  );
}

function MatchDetail({ match, onClose }: { match: Match; onClose: () => void }) {
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [report, setReport] = useState(match.aiReport ?? '');

  useEffect(() => {
    matchesApi.events(match.id)
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoadingEvents(false));
  }, [match.id]);

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    try {
      const r = await matchesApi.aiReport(match.id);
      setReport(r.report);
    } catch {
      setReport('AI report unavailable — ensure the backend and Ollama are running.');
    } finally {
      setGeneratingReport(false);
    }
  };

  const stats = match.stats;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div>
            <p className="text-xs text-gray-400">{match.competition ?? match.sport}</p>
            <h2 className="text-lg font-bold text-white">{match.homeTeam} vs {match.awayTeam}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl px-2">✕</button>
        </div>

        {/* Score */}
        <div className="flex items-center justify-center gap-6 py-6 bg-gray-950">
          <span className="text-xl font-bold text-white">{match.homeTeam}</span>
          <div className="flex items-center gap-3 px-6 py-3 bg-gray-800 rounded-2xl">
            <span className="text-4xl font-black text-white">{match.homeScore}</span>
            <span className="text-gray-500 text-2xl">–</span>
            <span className="text-4xl font-black text-white">{match.awayScore}</span>
          </div>
          <span className="text-xl font-bold text-white">{match.awayTeam}</span>
        </div>

        <div className="p-4 space-y-4">
          {/* Stats */}
          {stats && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Match Stats</h3>
              <div className="space-y-2">
                {stats.possession && (
                  <StatBar label="Possession" home={stats.possession.home} away={stats.possession.away} unit="%" />
                )}
                {stats.shots && (
                  <StatBar label="Shots" home={stats.shots.home} away={stats.shots.away} />
                )}
                {stats.shotsOnTarget && (
                  <StatBar label="On Target" home={stats.shotsOnTarget.home} away={stats.shotsOnTarget.away} />
                )}
                {stats.xg && (
                  <StatBar label="xG" home={stats.xg.home} away={stats.xg.away} decimals={2} />
                )}
                {stats.corners && (
                  <StatBar label="Corners" home={stats.corners.home} away={stats.corners.away} />
                )}
              </div>
            </div>
          )}

          {/* Events */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Match Events</h3>
            {loadingEvents ? (
              <div className="text-gray-500 text-sm">Loading events…</div>
            ) : events.length === 0 ? (
              <div className="text-gray-600 text-sm">No events recorded.</div>
            ) : (
              <div className="space-y-1">
                {events.map((e) => <EventBadge key={e.id} event={e} />)}
              </div>
            )}
          </div>

          {/* AI Report */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">AI Match Report</h3>
              <button
                onClick={handleGenerateReport}
                disabled={generatingReport}
                className="text-xs px-3 py-1 rounded-lg bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white font-medium transition-colors"
              >
                {generatingReport ? 'Generating…' : '✨ Generate'}
              </button>
            </div>
            {report ? (
              <div className="bg-gray-800 rounded-xl p-3 text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                {report}
              </div>
            ) : (
              <div className="bg-gray-800 rounded-xl p-3 text-sm text-gray-600 italic">
                Click Generate to create an AI-powered match report.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBar({ label, home, away, unit = '', decimals = 0 }: {
  label: string; home: number; away: number; unit?: string; decimals?: number;
}) {
  const total = home + away || 1;
  const homePct = (home / total) * 100;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-white font-semibold w-12 text-right">{home.toFixed(decimals)}{unit}</span>
      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden flex">
        <div className="bg-blue-500 h-full rounded-full transition-all" style={{ width: `${homePct}%` }} />
      </div>
      <span className="text-white font-semibold w-12">{away.toFixed(decimals)}{unit}</span>
      <span className="text-gray-500 text-xs w-20">{label}</span>
    </div>
  );
}

export default function Matches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [selected, setSelected] = useState<Match | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<Match>>({ sport: 'football', homeScore: 0, awayScore: 0, status: 'SCHEDULED' });

  const load = () => {
    setLoading(true);
    matchesApi.list(1, 50)
      .then((r) => setMatches(r.data))
      .catch(() => setMatches(DEMO_MATCHES))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    void (async () => { load(); })();
   
  }, []);

  const filtered = filter === 'ALL' ? matches : matches.filter((m) => m.status === filter);

  const handleCreate = async () => {
    try {
      await matchesApi.create(form);
      setShowForm(false);
      setForm({ sport: 'football', homeScore: 0, awayScore: 0, status: 'SCHEDULED' });
      load();
    } catch {
      // backend unavailable in demo
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === s ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="ml-auto px-3 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 text-white text-xs font-semibold transition-colors"
        >
          + New Match
        </button>
      </div>

      {/* Match list */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-gray-900 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-500 py-12">No matches found.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelected(m)}
              className="w-full text-left rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-600 p-3 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-xs text-gray-500">{m.competition ?? m.sport} · {new Date(m.kickoff).toLocaleDateString()}</p>
                  <p className="text-sm font-semibold text-white mt-0.5">{m.homeTeam} vs {m.awayTeam}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-white">{m.homeScore} – {m.awayScore}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    m.status === 'LIVE' ? 'bg-green-900/50 text-green-400' :
                    m.status === 'FT' ? 'bg-gray-800 text-gray-400' :
                    'bg-blue-900/50 text-blue-400'
                  }`}>{m.status}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selected && <MatchDetail match={selected} onClose={() => setSelected(null)} />}

      {/* Create form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">New Match</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            {(['homeTeam', 'awayTeam', 'competition', 'venue', 'season'] as const).map((field) => (
              <input
                key={field}
                placeholder={field.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                value={(form[field] as string) ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            ))}
            <input
              type="datetime-local"
              value={form.kickoff ? new Date(form.kickoff).toISOString().slice(0, 16) : ''}
              onChange={(e) => setForm((f) => ({ ...f, kickoff: new Date(e.target.value).toISOString() }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm hover:bg-gray-700">Cancel</button>
              <button onClick={handleCreate} className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const DEMO_MATCHES: Match[] = [
  { id: '1', sport: 'football', homeTeam: 'Kobe FC', awayTeam: 'City United', kickoff: new Date().toISOString(), status: 'LIVE', homeScore: 2, awayScore: 1, competition: 'Premier League', venue: 'Kobe Arena', stats: { possession: { home: 58, away: 42 }, shots: { home: 12, away: 7 }, shotsOnTarget: { home: 5, away: 3 }, xg: { home: 1.8, away: 0.9 }, corners: { home: 6, away: 2 } } },
  { id: '2', sport: 'football', homeTeam: 'Athletic Club', awayTeam: 'Rovers FC', kickoff: new Date().toISOString(), status: 'HT', homeScore: 0, awayScore: 0, competition: 'Championship' },
  { id: '3', sport: 'football', homeTeam: 'United XI', awayTeam: 'Dynamo', kickoff: new Date().toISOString(), status: 'FT', homeScore: 3, awayScore: 2, competition: 'Cup' },
  { id: '4', sport: 'football', homeTeam: 'Sporting', awayTeam: 'Wanderers', kickoff: new Date(Date.now() + 3600000).toISOString(), status: 'SCHEDULED', homeScore: 0, awayScore: 0, competition: 'League One' },
];
