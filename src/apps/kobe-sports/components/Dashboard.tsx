import { useEffect, useState, useCallback } from 'react';
import { matchesApi, camerasApi, type Match, type Camera, type ScoreUpdate, type LineupPlayer } from '../api';
import { useLiveMatches } from '../useLiveMatches';

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="rounded-xl p-4 bg-gray-900 border border-gray-800">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

const STATUS_COLOR: Record<string, string> = {
  LIVE: 'text-green-400 bg-green-900/40',
  HT: 'text-yellow-400 bg-yellow-900/40',
  FT: 'text-gray-400 bg-gray-800',
  SCHEDULED: 'text-blue-400 bg-blue-900/40',
  POSTPONED: 'text-orange-400 bg-orange-900/40',
  CANCELLED: 'text-red-400 bg-red-900/40',
};

function ScoreModal({ match, onClose, onSave }: {
  match: Match; onClose: () => void; onSave: (u: ScoreUpdate) => Promise<void>;
}) {
  const [home, setHome] = useState(match.homeScore);
  const [away, setAway] = useState(match.awayScore);
  const [team, setTeam] = useState<'home' | 'away'>('home');
  const [playerName, setPlayerName] = useState('');
  const [minute, setMinute] = useState(1);
  const [type, setType] = useState<'GOAL' | 'OWN_GOAL' | 'PENALTY'>('GOAL');
  const [recordGoal, setRecordGoal] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave({ homeScore: home, awayScore: away, ...(recordGoal ? { goalEvent: { team, playerName: playerName || undefined, minute, type } } : {}) });
    setSaving(false); onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-80 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-white">Update Score</h3>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs text-gray-400 mb-1 truncate">{match.homeTeam}</p>
            <input type="number" min={0} value={home} onChange={(e) => setHome(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-center text-xl font-bold" />
          </div>
          <span className="text-gray-500 text-lg mt-4">–</span>
          <div className="flex-1">
            <p className="text-xs text-gray-400 mb-1 truncate">{match.awayTeam}</p>
            <input type="number" min={0} value={away} onChange={(e) => setAway(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-center text-xl font-bold" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
          <input type="checkbox" checked={recordGoal} onChange={(e) => setRecordGoal(e.target.checked)} className="accent-green-500" />
          Record goal event
        </label>
        {recordGoal && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <select value={team} onChange={(e) => setTeam(e.target.value as 'home' | 'away')}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white">
                <option value="home">{match.homeTeam}</option>
                <option value="away">{match.awayTeam}</option>
              </select>
              <select value={type} onChange={(e) => setType(e.target.value as typeof type)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white">
                <option value="GOAL">Goal</option>
                <option value="PENALTY">Penalty</option>
                <option value="OWN_GOAL">Own Goal</option>
              </select>
            </div>
            <input placeholder="Player name (optional)" value={playerName} onChange={(e) => setPlayerName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500" />
            <input type="number" min={1} max={120} value={minute} onChange={(e) => setMinute(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white" placeholder="Minute" />
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-gray-800 text-xs text-gray-300 hover:bg-gray-700">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-xs text-white font-semibold disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

const POSITIONS = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'];

function LineupModal({ match, onClose, onSave }: {
  match: Match; onClose: () => void; onSave: (h: LineupPlayer[], a: LineupPlayer[]) => Promise<void>;
}) {
  const mk = (i: number): LineupPlayer => ({ jerseyNumber: i + 1, name: '', position: i === 0 ? 'GK' : 'CM', starting: true });
  const [home, setHome] = useState<LineupPlayer[]>(() => Array.from({ length: 11 }, (_, i) => mk(i)));
  const [away, setAway] = useState<LineupPlayer[]>(() => Array.from({ length: 11 }, (_, i) => mk(i)));
  const [saving, setSaving] = useState(false);

  const upd = (side: 'home' | 'away', idx: number, field: keyof LineupPlayer, val: string | number | boolean) => {
    (side === 'home' ? setHome : setAway)((prev) => prev.map((p, i) => i === idx ? { ...p, [field]: val } : p));
  };

  const Row = ({ p, i, side }: { p: LineupPlayer; i: number; side: 'home' | 'away' }) => (
    <div className="flex items-center gap-1">
      <input type="number" min={1} max={99} value={p.jerseyNumber || ''} onChange={(e) => upd(side, i, 'jerseyNumber', Number(e.target.value))}
        className="w-9 bg-gray-800 border border-gray-700 rounded px-1 py-1 text-xs text-white text-center" placeholder="#" />
      <input value={p.name} onChange={(e) => upd(side, i, 'name', e.target.value)}
        className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white placeholder-gray-500 min-w-0" placeholder="Name" />
      <select value={p.position} onChange={(e) => upd(side, i, 'position', e.target.value)}
        className="w-14 bg-gray-800 border border-gray-700 rounded px-1 py-1 text-xs text-white">
        {POSITIONS.map((pos) => <option key={pos}>{pos}</option>)}
      </select>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-white">Set Lineups</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-blue-400 mb-2">{match.homeTeam}</p>
            <div className="space-y-1.5">{home.map((p, i) => <Row key={i} p={p} i={i} side="home" />)}</div>
          </div>
          <div>
            <p className="text-xs font-semibold text-red-400 mb-2">{match.awayTeam}</p>
            <div className="space-y-1.5">{away.map((p, i) => <Row key={i} p={p} i={i} side="away" />)}</div>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-gray-800 text-xs text-gray-300 hover:bg-gray-700">Cancel</button>
          <button onClick={async () => { setSaving(true); await onSave(home, away); setSaving(false); onClose(); }} disabled={saving}
            className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs text-white font-semibold disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Lineups'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MatchControlCard({ match, onRefresh }: { match: Match & { currentMinute?: number; trackingActive?: boolean }; onRefresh: () => void }) {
  const [busy, setBusy] = useState(false);
  const [showScore, setShowScore] = useState(false);
  const [showLineup, setShowLineup] = useState(false);
  const [err, setErr] = useState('');

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr('');
    try { await fn(); onRefresh(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const canStart = ['SCHEDULED', 'HT'].includes(match.status);
  const canHT = match.status === 'LIVE';
  const canEnd = ['LIVE', 'HT'].includes(match.status);

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 truncate">{match.competition ?? match.sport}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {match.status === 'LIVE' && match.currentMinute && (
            <span className="text-xs text-green-400">{match.currentMinute}'</span>
          )}
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[match.status] ?? 'text-gray-400 bg-gray-800'}`}>
            {match.status}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-white flex-1 text-right truncate">{match.homeTeam}</span>
        <button onClick={() => setShowScore(true)} className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0">
          <span className="text-xl font-bold text-white">{match.homeScore}</span>
          <span className="text-gray-500">–</span>
          <span className="text-xl font-bold text-white">{match.awayScore}</span>
        </button>
        <span className="text-sm font-semibold text-white flex-1 truncate">{match.awayTeam}</span>
      </div>
      {match.trackingActive && (
        <div className="flex items-center gap-1.5 text-xs text-purple-400">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
          Vision tracking active
        </div>
      )}
      {err && <p className="text-xs text-red-400">{err}</p>}
      <div className="flex flex-wrap gap-1.5">
        {canStart && (
          <button onClick={() => act(() => matchesApi.start(match.id))} disabled={busy}
            className="px-3 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 text-xs text-white font-medium disabled:opacity-50">
            {match.status === 'HT' ? '▶ 2nd Half' : '▶ Kick Off'}
          </button>
        )}
        {canHT && (
          <button onClick={() => act(() => matchesApi.halftime(match.id))} disabled={busy}
            className="px-3 py-1.5 rounded-lg bg-yellow-700 hover:bg-yellow-600 text-xs text-white font-medium disabled:opacity-50">
            ⏸ Half Time
          </button>
        )}
        {canEnd && (
          <button onClick={() => act(() => matchesApi.end(match.id))} disabled={busy}
            className="px-3 py-1.5 rounded-lg bg-red-800 hover:bg-red-700 text-xs text-white font-medium disabled:opacity-50">
            ■ Full Time
          </button>
        )}
        {match.status === 'LIVE' && (
          <button onClick={() => act(() => matchesApi.setTracking(match.id, !match.trackingActive))} disabled={busy}
            className={`px-3 py-1.5 rounded-lg text-xs text-white font-medium disabled:opacity-50 ${match.trackingActive ? 'bg-purple-800 hover:bg-purple-700' : 'bg-gray-700 hover:bg-gray-600'}`}>
            {match.trackingActive ? '📷 Stop Track' : '📷 Start Track'}
          </button>
        )}
        <button onClick={() => setShowLineup(true)}
          className="px-3 py-1.5 rounded-lg bg-blue-800 hover:bg-blue-700 text-xs text-white font-medium">
          👥 Lineup
        </button>
      </div>
      {showScore && <ScoreModal match={match} onClose={() => setShowScore(false)} onSave={(u) => act(() => matchesApi.updateScore(match.id, u))} />}
      {showLineup && <LineupModal match={match} onClose={() => setShowLineup(false)} onSave={(h, a) => act(() => matchesApi.setLineup(match.id, { home: h, away: a }))} />}
    </div>
  );
}

function CameraPanel() {
  const [status, setStatus] = useState<{ total: number; online: number; offline: number; error: number; cameras: Camera[] } | null>(null);

  useEffect(() => {
    camerasApi.status().then(setStatus).catch(() => null);
    const t = setInterval(() => camerasApi.status().then(setStatus).catch(() => null), 10_000);
    return () => clearInterval(t);
  }, []);

  if (!status) return null;

  const dot = (s: Camera['status']) =>
    s === 'ONLINE' ? 'bg-green-400 animate-pulse' : s === 'ERROR' ? 'bg-red-400' : 'bg-gray-600';
  const txt = (s: Camera['status']) =>
    s === 'ONLINE' ? 'text-green-400' : s === 'ERROR' ? 'text-red-400' : s === 'OFFLINE' ? 'text-gray-500' : 'text-yellow-400';

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Cameras</h3>
        <div className="flex gap-3 text-xs">
          <span className="text-green-400">{status.online} online</span>
          {status.offline > 0 && <span className="text-gray-500">{status.offline} offline</span>}
          {status.error > 0 && <span className="text-red-400">{status.error} error</span>}
        </div>
      </div>
      {status.cameras.length === 0 ? (
        <p className="text-xs text-gray-500">No cameras registered.</p>
      ) : (
        <div className="space-y-1.5">
          {status.cameras.map((cam) => (
            <div key={cam.id} className="flex items-center gap-2 text-xs">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot(cam.status)}`} />
              <span className="text-gray-300 flex-1 truncate">{cam.label}</span>
              <span className="text-gray-500">{cam.role}</span>
              {cam.fps > 0 && <span className="text-gray-400">{Number(cam.fps).toFixed(0)} fps</span>}
              <span className={txt(cam.status)}>{cam.status}</span>
              {!cam.calibrated && <span className="text-yellow-500">⚠ uncal</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type DashboardMatch = Match & { currentMinute?: number; currentHalf?: number; trackingActive?: boolean };

export default function Dashboard() {
  const [matches, setMatches] = useState<DashboardMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const { liveMatches, connected } = useLiveMatches();

  const load = useCallback(() => {
    matchesApi.list(1, 20)
      .then((r) => setMatches(r.data as DashboardMatch[]))
      .catch(() => setMatches(DEMO_MATCHES))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const all: DashboardMatch[] = liveMatches.length > 0
    ? [...liveMatches as DashboardMatch[], ...matches.filter((m) => !liveMatches.find((l) => l.homeTeam === m.homeTeam && l.awayTeam === m.awayTeam))]
    : matches;

  const live = all.filter((m) => m.status === 'LIVE').length;
  const tracking = all.filter((m) => m.trackingActive).length;
  const today = all.filter((m) => new Date(m.kickoff).toDateString() === new Date().toDateString()).length;
  const ft = all.filter((m) => m.status === 'FT').length;

  return (
    <div className="p-4 space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Live Now" value={live} sub="in progress" color="text-green-400" />
        <StatCard label="Tracking" value={tracking} sub="vision active" color="text-purple-400" />
        <StatCard label="Today" value={today} sub="scheduled" color="text-blue-400" />
        <StatCard label="Completed" value={ft} sub="full time" color="text-gray-300" />
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Match Control</h2>
          {connected && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live feed
            </span>
          )}
        </div>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => <div key={i} className="rounded-xl bg-gray-900 border border-gray-800 p-4 animate-pulse h-32" />)}
          </div>
        ) : all.length === 0 ? (
          <div className="rounded-xl bg-gray-900 border border-gray-800 p-6 text-center">
            <p className="text-sm text-gray-400">No matches yet. Create one from the Matches tab.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {all.slice(0, 6).map((m) => <MatchControlCard key={m.id} match={m} onRefresh={load} />)}
          </div>
        )}
      </div>

      <CameraPanel />

      <div className="rounded-xl bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-800/40 p-4">
        <h3 className="text-sm font-semibold text-blue-300 mb-1">AI Analytics Ready</h3>
        <p className="text-xs text-gray-400">
          Select any match to generate AI commentary, tactical reports, xG analysis, heatmaps, and formation predictions.
        </p>
      </div>
    </div>
  );
}

const DEMO_MATCHES: DashboardMatch[] = [
  { id: '1', sport: 'football', homeTeam: 'Kobe FC', awayTeam: 'City United', kickoff: new Date().toISOString(), status: 'LIVE', homeScore: 2, awayScore: 1, competition: 'Premier League', currentMinute: 67, trackingActive: true },
  { id: '2', sport: 'football', homeTeam: 'Athletic Club', awayTeam: 'Rovers FC', kickoff: new Date().toISOString(), status: 'HT', homeScore: 0, awayScore: 0, competition: 'Championship', trackingActive: false },
  { id: '3', sport: 'football', homeTeam: 'United XI', awayTeam: 'Dynamo', kickoff: new Date().toISOString(), status: 'FT', homeScore: 3, awayScore: 2, competition: 'Cup' },
  { id: '4', sport: 'football', homeTeam: 'Sporting', awayTeam: 'Wanderers', kickoff: new Date(Date.now() + 3600000).toISOString(), status: 'SCHEDULED', homeScore: 0, awayScore: 0, competition: 'League One' },
];
