/**
 * Broadcast — TV-style overlay engine.
 *
 * Data source: WebSocket 'match:state' + 'match:event' + 'frame' from SportsGateway.
 * Falls back to demo data when offline.
 */
import { useState, useEffect, useRef } from 'react';
import { useSportsSocket, type MatchEvent } from '../useSportsSocket';
import { matchesApi, type Match } from '../api';

// ── Demo fallback ─────────────────────────────────────────────────────────────

const DEMO_MATCHES: Match[] = [
  { id: '1', sport: 'football', homeTeam: 'Simba SC', awayTeam: 'Young Africans', kickoff: new Date().toISOString(), status: 'LIVE', homeScore: 2, awayScore: 1, competition: 'Tanzania Premier League' },
];

// ── Overlay widgets ───────────────────────────────────────────────────────────

function ScoreTicker({ homeTeam, awayTeam, homeScore, awayScore, minute, half, connected }: {
  homeTeam: string; awayTeam: string; homeScore: number; awayScore: number;
  minute: number; half: number; connected: boolean;
}) {
  return (
    <div className="flex items-center gap-0 rounded-xl overflow-hidden border border-white/10 shadow-2xl text-sm font-bold">
      <div className="bg-blue-900/90 backdrop-blur px-4 py-2 text-white">{homeTeam}</div>
      <div className="bg-gray-900/95 backdrop-blur px-4 py-2 flex items-center gap-2">
        <span className="text-white text-lg">{homeScore}</span>
        <span className="text-gray-500">–</span>
        <span className="text-white text-lg">{awayScore}</span>
      </div>
      <div className="bg-orange-900/90 backdrop-blur px-4 py-2 text-white">{awayTeam}</div>
      <div className="bg-gray-900/90 backdrop-blur px-3 py-2 flex items-center gap-1.5 text-xs">
        {connected ? (
          <span className="flex items-center gap-1 text-green-300">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            {half === 1 ? '1st' : '2nd'} {minute}'
          </span>
        ) : (
          <span className="text-gray-400">DEMO</span>
        )}
      </div>
    </div>
  );
}

function PossessionBar({ home, away, homeTeam, awayTeam }: {
  home: number; away: number; homeTeam: string; awayTeam: string;
}) {
  return (
    <div className="bg-gray-900/90 backdrop-blur rounded-xl border border-white/10 p-3 min-w-[220px]">
      <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2 text-center">Possession</p>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-blue-400 font-bold">{home}%</span>
        <span className="text-orange-400 font-bold">{away}%</span>
      </div>
      <div className="h-3 rounded-full overflow-hidden flex bg-gray-700">
        <div className="bg-blue-500 h-full transition-all duration-1000" style={{ width: `${home}%` }} />
        <div className="bg-orange-500 h-full transition-all duration-1000" style={{ width: `${away}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-gray-500 mt-1">
        <span>{homeTeam.split(' ')[0]}</span><span>{awayTeam.split(' ')[0]}</span>
      </div>
    </div>
  );
}

function XgWidget({ home, away }: { home: number; away: number }) {
  return (
    <div className="bg-gray-900/90 backdrop-blur rounded-xl border border-white/10 p-3">
      <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2 text-center">Expected Goals</p>
      <div className="flex items-center justify-around">
        <div className="text-center"><p className="text-2xl font-black text-blue-400">{home.toFixed(2)}</p><p className="text-[10px] text-gray-500">Home</p></div>
        <div className="text-gray-600 text-lg">vs</div>
        <div className="text-center"><p className="text-2xl font-black text-orange-400">{away.toFixed(2)}</p><p className="text-[10px] text-gray-500">Away</p></div>
      </div>
    </div>
  );
}

function SpeedWidget({ speed, jerseyNumber, team }: { speed: number; jerseyNumber?: number; team: 'home' | 'away' }) {
  return (
    <div className="bg-gray-900/90 backdrop-blur rounded-xl border border-white/10 p-3">
      <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Top Speed</p>
      <div className="flex items-end gap-2">
        <span className={`text-3xl font-black ${team === 'home' ? 'text-blue-400' : 'text-orange-400'}`}>{speed.toFixed(1)}</span>
        <span className="text-gray-400 text-xs mb-1">km/h</span>
      </div>
      {jerseyNumber && <p className="text-xs text-white font-medium">#{jerseyNumber}</p>}
    </div>
  );
}

function EventBanner({ event, onDismiss }: { event: MatchEvent; onDismiss: () => void }) {
  const icons: Record<string, string> = { GOAL: '⚽', YELLOW_CARD: '🟨', RED_CARD: '🟥', SUBSTITUTION: '🔄', VAR: '📺', OFFSIDE: '🚩', PENALTY: '🎯' };
  const colors: Record<string, string> = {
    GOAL: 'border-green-500/50 bg-green-900/80', YELLOW_CARD: 'border-yellow-500/50 bg-yellow-900/80',
    RED_CARD: 'border-red-500/50 bg-red-900/80', SUBSTITUTION: 'border-blue-500/50 bg-blue-900/80',
    VAR: 'border-purple-500/50 bg-purple-900/80', OFFSIDE: 'border-red-500/50 bg-red-900/80',
    PENALTY: 'border-yellow-500/50 bg-yellow-900/80',
  };
  useEffect(() => { const t = setTimeout(onDismiss, 6000); return () => clearTimeout(t); }, [onDismiss]);
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur shadow-2xl animate-in slide-in-from-right ${colors[event.type] ?? 'border-gray-700 bg-gray-900/80'}`}>
      <span className="text-2xl">{icons[event.type] ?? '•'}</span>
      <div>
        <p className="text-xs text-gray-300 font-medium">{event.minute}' — {event.type.replace('_', ' ')}</p>
        <p className="text-sm text-white font-bold">
          {event.jerseyNumber ? `#${event.jerseyNumber}` : event.team === 'home' ? 'Home' : 'Away'}
          {event.xg != null ? ` · xG ${event.xg.toFixed(2)}` : ''}
        </p>
      </div>
      <button onClick={onDismiss} className="ml-2 text-gray-400 hover:text-white text-xs">✕</button>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface BroadcastProps {
  matchId?: string;
}

export default function Broadcast({ matchId: propMatchId }: BroadcastProps) {
  const [matches, setMatches] = useState<Match[]>(DEMO_MATCHES);
  const [selectedId, setSelectedId] = useState(propMatchId ?? '1');

  useEffect(() => {
    if (propMatchId) setSelectedId(propMatchId);
  }, [propMatchId]);
  const [view, setView] = useState<'preview' | 'builder'>('preview');
  const [widgets, setWidgets] = useState({ score: true, possession: true, xg: true, speed: true });
  const [banners, setBanners] = useState<Array<MatchEvent & { uid: string }>>([]);
  const bannerIdRef = useRef(0);

  const { connected, frame, matchState, latestEvent } = useSportsSocket(selectedId);

  const selectedMatch = matches.find((m) => m.id === selectedId) ?? DEMO_MATCHES[0];

  // Derive display values — prefer live WebSocket, fall back to match record
  const possession = matchState?.possession ?? { home: 58, away: 42 };
  const xg = matchState?.xg ?? { home: 1.84, away: 0.92 };
  const minute = frame ? Math.floor(frame.matchClock / 60) : 67;
  const half = frame?.half ?? 1;

  // Top speed from current frame
  const topSpeedPlayer = frame?.players.reduce((best, p) =>
    (p.speed ?? 0) > (best?.speed ?? 0) ? p : best, frame.players[0]);

  // Push new events as banners
  useEffect(() => {
    if (!latestEvent) return;
    const significant = ['GOAL', 'YELLOW_CARD', 'RED_CARD', 'PENALTY', 'VAR', 'OFFSIDE', 'SUBSTITUTION'];
    if (!significant.includes(latestEvent.type)) return;
    const uid = String(++bannerIdRef.current);
    setBanners((b) => [{ ...latestEvent, uid }, ...b.slice(0, 2)]);
  }, [latestEvent]);

  const dismissBanner = (uid: string) => setBanners((b) => b.filter((x) => x.uid !== uid));

  useEffect(() => {
    matchesApi.list(1, 50).then((r) => { if (r.data.length) { setMatches(r.data); setSelectedId(r.data[0].id); } }).catch(() => {});
  }, []);

  const toggle = (k: keyof typeof widgets) => setWidgets((v) => ({ ...v, [k]: !v[k] }));

  const obsUrl = `${window.location.origin}/sports/overlay?match=${selectedId}`;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-800 shrink-0 flex-wrap">
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
          {matches.map((m) => <option key={m.id} value={m.id}>{m.homeTeam} vs {m.awayTeam}</option>)}
        </select>
        <div className="flex gap-1">
          {(['preview', 'builder'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${view === v ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              {v === 'preview' ? '📺 Preview' : '🔧 Builder'}
            </button>
          ))}
        </div>
        <span className={`ml-auto text-xs flex items-center gap-1 ${connected ? 'text-green-400' : 'text-yellow-500'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-yellow-500'}`} />
          {connected ? 'Live AI data' : 'Demo mode'}
        </span>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {view === 'preview' && (
          <>
            {/* Broadcast frame */}
            <div className="relative rounded-xl overflow-hidden border border-gray-700" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2137 100%)', minHeight: 340 }}>
              {/* Pitch background */}
              <div className="absolute inset-0 opacity-15">
                <svg viewBox="0 0 100 65" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
                  <rect width="100" height="65" fill="#0a2e0a" />
                  <g stroke="#1e5c1e" strokeWidth="0.4" fill="none">
                    <rect x="1" y="1" width="98" height="63" />
                    <line x1="50" y1="1" x2="50" y2="64" />
                    <circle cx="50" cy="32.5" r="9.15" />
                    <rect x="1" y="19.5" width="16.5" height="26" />
                    <rect x="82.5" y="19.5" width="16.5" height="26" />
                  </g>
                  {/* Live player dots */}
                  {frame?.players.map((p) => (
                    <circle key={p.trackId} cx={p.x} cy={p.y * 0.65} r="1.2"
                      fill={p.class.includes('home') ? '#3b82f6' : '#f97316'} fillOpacity="0.8" />
                  ))}
                  {frame?.ball && <circle cx={frame.ball.x} cy={frame.ball.y * 0.65} r="1.5" fill="white" />}
                </svg>
              </div>

              <div className="relative p-4 space-y-3">
                {/* Score ticker — top center */}
                {widgets.score && (
                  <div className="flex justify-center">
                    <ScoreTicker
                      homeTeam={selectedMatch.homeTeam} awayTeam={selectedMatch.awayTeam}
                      homeScore={selectedMatch.homeScore} awayScore={selectedMatch.awayScore}
                      minute={minute} half={half} connected={connected}
                    />
                  </div>
                )}

                {/* Bottom widgets */}
                <div className="flex gap-3 flex-wrap mt-6">
                  {widgets.possession && (
                    <PossessionBar home={possession.home} away={possession.away}
                      homeTeam={selectedMatch.homeTeam} awayTeam={selectedMatch.awayTeam} />
                  )}
                  {widgets.xg && <XgWidget home={xg.home} away={xg.away} />}
                  {widgets.speed && topSpeedPlayer && (
                    <SpeedWidget speed={topSpeedPlayer.speed} jerseyNumber={topSpeedPlayer.jerseyNumber}
                      team={topSpeedPlayer.class.includes('home') ? 'home' : 'away'} />
                  )}
                  {widgets.speed && !topSpeedPlayer && (
                    <SpeedWidget speed={31.4} jerseyNumber={10} team="home" />
                  )}
                </div>

                {/* Event banners — top right */}
                <div className="absolute top-16 right-4 space-y-2 w-64">
                  {banners.map((ev) => (
                    <EventBanner key={ev.uid} event={ev} onDismiss={() => dismissBanner(ev.uid)} />
                  ))}
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 text-center">
              {connected ? 'Live AI vision data · player dots update every frame' : 'Demo mode · connect the AI pipeline to see live data'}
            </p>
          </>
        )}

        {view === 'builder' && (
          <div className="space-y-4 max-w-md">
            <h3 className="text-sm font-semibold text-white">Widget Visibility</h3>
            <div className="space-y-2">
              {(Object.keys(widgets) as Array<keyof typeof widgets>).map((key) => (
                <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-gray-900 border border-gray-800">
                  <span className="text-sm text-white capitalize">{key === 'xg' ? 'xG Overlay' : key.charAt(0).toUpperCase() + key.slice(1)}</span>
                  <button onClick={() => toggle(key)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${widgets[key] ? 'bg-blue-500' : 'bg-gray-600'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${widgets[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              ))}
            </div>

            {/* OBS export */}
            <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 space-y-3">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">OBS Browser Source</h4>
              <p className="text-xs text-gray-500">Add this URL as a Browser Source in OBS at 1920×1080 with transparent background.</p>
              <div className="flex gap-2">
                <div className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-xs text-gray-400 font-mono truncate">{obsUrl}</div>
                <button
                  onClick={() => navigator.clipboard.writeText(obsUrl).catch(() => {})}
                  className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs text-white transition-colors shrink-0">
                  Copy
                </button>
              </div>
              <div className="rounded-lg bg-gray-800 p-3 text-xs text-gray-400 space-y-1">
                <p className="font-medium text-gray-300">OBS settings:</p>
                <p>Width: 1920 · Height: 1080</p>
                <p>✓ Shutdown source when not visible</p>
                <p>✓ Refresh browser when scene becomes active</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
