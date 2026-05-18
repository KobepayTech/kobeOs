/**
 * Tracking — live player positions from the AI vision pipeline.
 *
 * Data source priority:
 *   1. WebSocket 'frame' events from SportsGateway (real YOLO/ByteTrack data)
 *   2. Demo data (when no match is selected or server is offline)
 *
 * The pitch SVG uses pitch-normalised coordinates (0–100 × 0–100).
 */
import { useState, useEffect, useRef } from 'react';
import { useSportsSocket, type LivePlayer, type OffsideResult } from '../useSportsSocket';

// ── Demo data ─────────────────────────────────────────────────────────────────

function makeDemoPlayers(): LivePlayer[] {
  const home: Array<[number, number, number]> = [
    [50, 92, 1], [15, 72, 3], [35, 75, 5], [65, 75, 4], [85, 72, 2],
    [25, 52, 8], [50, 48, 6], [75, 52, 10], [20, 28, 11], [50, 22, 9], [80, 28, 7],
  ];
  const away: Array<[number, number, number]> = [
    [50, 8, 1], [15, 28, 2], [35, 25, 5], [65, 25, 4], [85, 28, 3],
    [15, 48, 7], [38, 52, 8], [62, 52, 6], [85, 48, 11], [35, 72, 10], [65, 72, 9],
  ];
  return [
    ...home.map(([x, y, n]) => ({ trackId: n, class: 'player_home', x, y, speed: Math.random() * 28, jerseyNumber: n })),
    ...away.map(([x, y, n]) => ({ trackId: n + 100, class: 'player_away', x, y, speed: Math.random() * 28, jerseyNumber: n })),
  ];
}

// ── Rating helpers ────────────────────────────────────────────────────────────

interface PlayerRating {
  trackId: number;
  jerseyNumber?: number;
  team: 'home' | 'away';
  overall: number;
  passing: number;
  defending: number;
  attacking: number;
  workRate: number;
  distanceKm: number;
  sprints: number;
  speed: number;
}

function buildRatings(players: LivePlayer[]): PlayerRating[] {
  return players.map((p) => {
    const base = 60 + Math.random() * 30;
    return {
      trackId: p.trackId,
      jerseyNumber: p.jerseyNumber,
      team: p.class.includes('home') ? 'home' : 'away',
      overall: Math.round(base),
      passing: Math.round(base + (Math.random() - 0.5) * 20),
      defending: Math.round(base + (Math.random() - 0.5) * 20),
      attacking: Math.round(base + (Math.random() - 0.5) * 20),
      workRate: Math.round(base + (Math.random() - 0.5) * 20),
      distanceKm: parseFloat((5 + Math.random() * 7).toFixed(1)),
      sprints: Math.round(10 + Math.random() * 30),
      speed: p.speed,
    };
  });
}

// ── Pitch SVG ─────────────────────────────────────────────────────────────────

function FootballPitch({
  players, ball, selectedId, offsideResult, onSelect,
}: {
  players: LivePlayer[];
  ball: { x: number; y: number } | null;
  selectedId: number | null;
  offsideResult: OffsideResult | null;
  onSelect: (id: number) => void;
}) {
  return (
    <svg
      viewBox="0 0 100 65"
      className="w-full rounded-xl border border-green-900/40"
      style={{ background: 'linear-gradient(180deg, #0d3b0d 0%, #0a2e0a 100%)' }}
    >
      {/* Field markings */}
      <g stroke="#1e5c1e" strokeWidth="0.4" fill="none">
        <rect x="1" y="1" width="98" height="63" />
        <line x1="50" y1="1" x2="50" y2="64" />
        <circle cx="50" cy="32.5" r="9.15" />
        <circle cx="50" cy="32.5" r="0.5" fill="#1e5c1e" />
        <rect x="1" y="19.5" width="16.5" height="26" />
        <rect x="1" y="26.5" width="5.5" height="12" />
        <circle cx="11" cy="32.5" r="0.5" fill="#1e5c1e" />
        <rect x="82.5" y="19.5" width="16.5" height="26" />
        <rect x="93.5" y="26.5" width="5.5" height="12" />
        <circle cx="89" cy="32.5" r="0.5" fill="#1e5c1e" />
        <rect x="0" y="29" width="1" height="7" stroke="#ffffff" strokeWidth="0.4" />
        <rect x="99" y="29" width="1" height="7" stroke="#ffffff" strokeWidth="0.4" />
        <path d="M1,3 A2,2 0 0,1 3,1" /><path d="M97,1 A2,2 0 0,1 99,3" />
        <path d="M99,62 A2,2 0 0,1 97,64" /><path d="M3,64 A2,2 0 0,1 1,62" />
      </g>

      {/* Offside line */}
      {offsideResult?.offsideLineX != null && (
        <g>
          <line
            x1={offsideResult.offsideLineX} y1="1"
            x2={offsideResult.offsideLineX} y2="64"
            stroke={offsideResult.verdict === 'OFFSIDE' ? '#ef4444' : '#22c55e'}
            strokeWidth="0.6" strokeDasharray="2,1"
          />
          <text
            x={offsideResult.offsideLineX + 0.5} y="4"
            fontSize="2" fill={offsideResult.verdict === 'OFFSIDE' ? '#ef4444' : '#22c55e'}
            fontWeight="bold"
          >
            {offsideResult.verdict}
          </text>
          {/* Attacker marker */}
          {offsideResult.attacker && (
            <circle
              cx={offsideResult.attacker.x} cy={offsideResult.attacker.y}
              r="3.5" fill="none"
              stroke={offsideResult.verdict === 'OFFSIDE' ? '#ef4444' : '#22c55e'}
              strokeWidth="0.8"
            />
          )}
        </g>
      )}

      {/* Ball */}
      {ball && (
        <g>
          <circle cx={ball.x} cy={ball.y} r="1.8" fill="#ffffff" stroke="#cccccc" strokeWidth="0.3" />
          <circle cx={ball.x} cy={ball.y} r="3" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.3" />
        </g>
      )}

      {/* Players */}
      {players.map((p) => {
        const isHome = p.class.includes('home');
        const color = isHome ? '#3b82f6' : '#f97316';
        const isSprinting = p.speed > 20;
        const isSelected = p.trackId === selectedId;
        return (
          <g key={p.trackId} onClick={() => onSelect(p.trackId)} style={{ cursor: 'pointer' }}>
            {isSprinting && (
              <circle cx={p.x} cy={p.y} r="3.8" fill="none" stroke={color} strokeWidth="0.4" strokeOpacity="0.5" />
            )}
            {isSelected && (
              <circle cx={p.x} cy={p.y} r="4.2" fill="none" stroke="#ffffff" strokeWidth="0.7" />
            )}
            <circle cx={p.x} cy={p.y} r="2.5" fill={color} stroke="#000" strokeWidth="0.3" />
            <text x={p.x} y={p.y + 0.9} textAnchor="middle" fontSize="1.8" fill="white" fontWeight="bold">
              {p.jerseyNumber ?? '?'}
            </text>
            {isSprinting && (
              <text x={p.x + 3.2} y={p.y - 1.5} fontSize="1.4" fill="#fbbf24">
                {p.speed.toFixed(0)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function RatingBar({ label, value }: { label: string; value: number }) {
  const c = value >= 80 ? 'bg-green-500' : value >= 65 ? 'bg-blue-500' : value >= 50 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-gray-400 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${c} rounded-full`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="text-[11px] font-bold text-white w-6 text-right">{value}</span>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface TrackingProps {
  matchId?: string;
}

export default function Tracking({ matchId }: TrackingProps) {
  const { connected, frame, latestOffside, offsideHistory } = useSportsSocket(matchId ?? null);

  // Demo fallback state
  const [demoPlayers, setDemoPlayers] = useState<LivePlayer[]>(makeDemoPlayers);
  const demoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animate demo players when not connected
  useEffect(() => {
    if (connected) {
      if (demoRef.current) clearInterval(demoRef.current);
      return;
    }
    demoRef.current = setInterval(() => {
      setDemoPlayers((prev) => prev.map((p) => ({
        ...p,
        x: Math.max(2, Math.min(98, p.x + (Math.random() - 0.5) * 1.5)),
        y: Math.max(2, Math.min(63, p.y + (Math.random() - 0.5) * 1.5)),
        speed: Math.max(0, Math.min(32, p.speed + (Math.random() - 0.5) * 3)),
      })));
    }, 2000);
    return () => { if (demoRef.current) clearInterval(demoRef.current); };
  }, [connected]);

  const players = frame?.players ?? demoPlayers;
  const ball = frame?.ball ?? null;
  const clock = frame?.matchClock ?? 0;
  const half = frame?.half ?? 1;
  const minute = Math.floor(clock / 60);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [view, setView] = useState<'pitch' | 'ratings' | 'offside'>('pitch');
  const [teamFilter, setTeamFilter] = useState<'all' | 'home' | 'away'>('all');

  const ratings = buildRatings(players);
  const selectedRating = ratings.find((r) => r.trackId === selectedId);
  const selectedPlayer = players.find((p) => p.trackId === selectedId);
  const visibleRatings = ratings.filter((r) => teamFilter === 'all' || r.team === teamFilter);
  const visiblePlayers = players.filter((p) => teamFilter === 'all' || p.class.includes(teamFilter));

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-800 shrink-0 flex-wrap">
        <div className="flex gap-1">
          {(['pitch', 'ratings', 'offside'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${view === v ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              {v === 'pitch' ? '🏟 Pitch' : v === 'ratings' ? '⭐ Ratings' : '🚩 Offside'}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto">
          {(['all', 'home', 'away'] as const).map((t) => (
            <button key={t} onClick={() => setTeamFilter(t)}
              className={`px-2.5 py-1 rounded-lg text-xs capitalize transition-colors ${
                teamFilter === t
                  ? t === 'home' ? 'bg-blue-600 text-white' : t === 'away' ? 'bg-orange-600 text-white' : 'bg-gray-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}>{t}</button>
          ))}
        </div>
        {/* Connection + clock */}
        <div className="flex items-center gap-2 text-xs ml-2">
          {connected ? (
            <span className="flex items-center gap-1 text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live · {half === 1 ? '1st' : '2nd'} {minute}'
            </span>
          ) : (
            <span className="flex items-center gap-1 text-yellow-500">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
              Demo
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3">
        {/* ── Pitch view ── */}
        {view === 'pitch' && (
          <>
            <FootballPitch
              players={visiblePlayers}
              ball={ball}
              selectedId={selectedId}
              offsideResult={latestOffside}
              onSelect={(id) => setSelectedId((prev) => prev === id ? null : id)}
            />
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Home</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-500 inline-block" /> Away</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-white inline-block" /> Ball</span>
              <span className="flex items-center gap-1"><span className="text-yellow-400">⚡</span> Sprinting (&gt;20 km/h)</span>
              <span className="ml-auto">Click player for details</span>
            </div>

            {/* Selected player card */}
            {selectedPlayer && selectedRating && (
              <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black ${selectedRating.team === 'home' ? 'bg-blue-900/50 text-blue-300' : 'bg-orange-900/50 text-orange-300'}`}>
                      {selectedPlayer.jerseyNumber ?? '?'}
                    </div>
                    <div>
                      <p className="font-semibold text-white">#{selectedPlayer.jerseyNumber ?? selectedPlayer.trackId}</p>
                      <p className="text-xs text-gray-400">{selectedRating.team === 'home' ? 'Home' : 'Away'} · Track {selectedPlayer.trackId}</p>
                    </div>
                  </div>
                  <span className={`text-2xl font-black px-3 py-1 rounded-xl border ${
                    selectedRating.overall >= 80 ? 'text-green-400 bg-green-900/40 border-green-700/40'
                    : selectedRating.overall >= 70 ? 'text-blue-400 bg-blue-900/40 border-blue-700/40'
                    : 'text-yellow-400 bg-yellow-900/40 border-yellow-700/40'
                  }`}>{selectedRating.overall}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  {[
                    { label: 'Speed', value: `${selectedPlayer.speed.toFixed(1)} km/h` },
                    { label: 'Distance', value: `${selectedRating.distanceKm} km` },
                    { label: 'Sprints', value: selectedRating.sprints },
                  ].map((s) => (
                    <div key={s.label} className="bg-gray-800 rounded-lg p-2">
                      <p className="text-gray-500 text-[10px]">{s.label}</p>
                      <p className="font-semibold text-white mt-0.5">{s.value}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <RatingBar label="Passing" value={selectedRating.passing} />
                  <RatingBar label="Defending" value={selectedRating.defending} />
                  <RatingBar label="Attacking" value={selectedRating.attacking} />
                  <RatingBar label="Work Rate" value={selectedRating.workRate} />
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Ratings view ── */}
        {view === 'ratings' && (
          <div className="space-y-2">
            {visibleRatings.sort((a, b) => b.overall - a.overall).map((r) => (
              <div key={r.trackId} onClick={() => { setSelectedId(r.trackId); setView('pitch'); }}
                className="flex items-center gap-3 p-3 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-600 cursor-pointer transition-colors">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0 ${r.team === 'home' ? 'bg-blue-900/50 text-blue-300' : 'bg-orange-900/50 text-orange-300'}`}>
                  {r.jerseyNumber ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">#{r.jerseyNumber ?? r.trackId}</p>
                  <p className="text-[11px] text-gray-500">{r.team === 'home' ? 'Home' : 'Away'} · {r.distanceKm} km · {r.sprints} sprints</p>
                </div>
                <span className={`text-xl font-black px-2.5 py-0.5 rounded-lg border ${
                  r.overall >= 80 ? 'text-green-400 bg-green-900/40 border-green-700/40'
                  : r.overall >= 70 ? 'text-blue-400 bg-blue-900/40 border-blue-700/40'
                  : 'text-yellow-400 bg-yellow-900/40 border-yellow-700/40'
                }`}>{r.overall}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Offside view ── */}
        {view === 'offside' && (
          <div className="space-y-3 max-w-2xl">
            {latestOffside && (
              <div className={`rounded-xl border p-4 ${
                latestOffside.verdict === 'OFFSIDE' ? 'border-red-500/40 bg-red-900/10'
                : latestOffside.verdict === 'ONSIDE' ? 'border-green-500/40 bg-green-900/10'
                : 'border-gray-700 bg-gray-900'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white">Latest VAR Check</h3>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    latestOffside.verdict === 'OFFSIDE' ? 'bg-red-600 text-white'
                    : latestOffside.verdict === 'ONSIDE' ? 'bg-green-600 text-white'
                    : 'bg-gray-600 text-white'
                  }`}>{latestOffside.verdict}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><p className="text-gray-500">Time</p><p className="text-white font-medium">{latestOffside.minuteStr}</p></div>
                  <div><p className="text-gray-500">Attacker</p><p className="text-white font-medium">#{latestOffside.attacker.jerseyNumber ?? latestOffside.attacker.trackId}</p></div>
                  {latestOffside.marginX != null && (
                    <div><p className="text-gray-500">Margin</p><p className={`font-bold ${latestOffside.verdict === 'OFFSIDE' ? 'text-red-400' : 'text-green-400'}`}>{latestOffside.marginX.toFixed(2)} units</p></div>
                  )}
                  {latestOffside.lastDefender && (
                    <div><p className="text-gray-500">Last Defender</p><p className="text-white font-medium">Track #{latestOffside.lastDefender.trackId}</p></div>
                  )}
                </div>
              </div>
            )}

            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Offside History</h3>
            {offsideHistory.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No offside checks yet</p>
            ) : (
              offsideHistory.map((o, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-900 border border-gray-800 text-xs">
                  <span className={`font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    o.verdict === 'OFFSIDE' ? 'bg-red-600 text-white' : o.verdict === 'ONSIDE' ? 'bg-green-600 text-white' : 'bg-gray-600 text-white'
                  }`}>{o.verdict}</span>
                  <span className="text-gray-400">{o.minuteStr}</span>
                  <span className="text-white">Attacker #{o.attacker.jerseyNumber ?? o.attacker.trackId}</span>
                  {o.marginX != null && <span className="ml-auto text-gray-500">±{o.marginX.toFixed(2)}</span>}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
