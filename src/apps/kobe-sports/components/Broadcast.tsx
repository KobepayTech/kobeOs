/**
 * Broadcast Overlay Engine
 *
 * Simulates TV-style graphics overlays for live streaming:
 * - Score ticker
 * - Possession bar
 * - Player speed tracker
 * - Shot map
 * - Event notifications (goal, card, substitution)
 * - Tactical mini-map
 *
 * Designed to be exported as a standalone overlay layer for OBS/streaming.
 */
import { useState, useEffect, useRef } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OverlayMatch {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  minute: number;
  status: string;
  possession: { home: number; away: number };
  shots: { home: number; away: number };
  xg: { home: number; away: number };
  topSpeed: { name: string; speed: number; team: 'home' | 'away' };
}

interface ShotEvent {
  x: number; y: number; team: 'home' | 'away'; onTarget: boolean; xg: number;
}

interface BroadcastEvent {
  id: string;
  type: 'GOAL' | 'YELLOW_CARD' | 'RED_CARD' | 'SUBSTITUTION' | 'VAR';
  minute: number;
  playerName: string;
  team: 'home' | 'away';
}

// ── Demo data ─────────────────────────────────────────────────────────────────

const DEMO: OverlayMatch = {
  homeTeam: 'Simba SC', awayTeam: 'Young Africans',
  homeScore: 2, awayScore: 1, minute: 67, status: 'LIVE',
  possession: { home: 58, away: 42 },
  shots: { home: 14, away: 8 },
  xg: { home: 1.84, away: 0.92 },
  topSpeed: { name: 'Clatous Chama', speed: 31.4, team: 'home' },
};

const DEMO_SHOTS: ShotEvent[] = [
  { x: 78, y: 35, team: 'home', onTarget: true, xg: 0.42 },
  { x: 82, y: 28, team: 'home', onTarget: true, xg: 0.31 },
  { x: 71, y: 42, team: 'home', onTarget: false, xg: 0.08 },
  { x: 85, y: 38, team: 'home', onTarget: true, xg: 0.55 },
  { x: 75, y: 30, team: 'home', onTarget: false, xg: 0.12 },
  { x: 22, y: 32, team: 'away', onTarget: true, xg: 0.28 },
  { x: 18, y: 40, team: 'away', onTarget: false, xg: 0.06 },
  { x: 25, y: 35, team: 'away', onTarget: true, xg: 0.38 },
];

// ── Overlay components ────────────────────────────────────────────────────────

function ScoreTicker({ match }: { match: OverlayMatch }) {
  return (
    <div className="flex items-center gap-0 rounded-xl overflow-hidden border border-white/10 shadow-2xl text-sm font-bold">
      <div className="bg-blue-900/90 backdrop-blur px-4 py-2 text-white">{match.homeTeam}</div>
      <div className="bg-gray-900/95 backdrop-blur px-4 py-2 flex items-center gap-2">
        <span className="text-white text-lg">{match.homeScore}</span>
        <span className="text-gray-500">–</span>
        <span className="text-white text-lg">{match.awayScore}</span>
      </div>
      <div className="bg-orange-900/90 backdrop-blur px-4 py-2 text-white">{match.awayTeam}</div>
      <div className="bg-green-900/90 backdrop-blur px-3 py-2 flex items-center gap-1.5 text-green-300 text-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        {match.minute}'
      </div>
    </div>
  );
}

function PossessionOverlay({ possession, homeTeam, awayTeam }: {
  possession: { home: number; away: number }; homeTeam: string; awayTeam: string;
}) {
  return (
    <div className="bg-gray-900/90 backdrop-blur rounded-xl border border-white/10 p-3 min-w-[220px]">
      <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2 text-center">Possession</p>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-blue-400 font-bold">{possession.home}%</span>
        <span className="text-orange-400 font-bold">{possession.away}%</span>
      </div>
      <div className="h-3 rounded-full overflow-hidden flex bg-gray-700">
        <div className="bg-blue-500 h-full transition-all" style={{ width: `${possession.home}%` }} />
        <div className="bg-orange-500 h-full transition-all" style={{ width: `${possession.away}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-gray-500 mt-1">
        <span>{homeTeam.split(' ')[0]}</span>
        <span>{awayTeam.split(' ')[0]}</span>
      </div>
    </div>
  );
}

function SpeedTracker({ topSpeed }: { topSpeed: OverlayMatch['topSpeed'] }) {
  return (
    <div className="bg-gray-900/90 backdrop-blur rounded-xl border border-white/10 p-3">
      <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Top Speed</p>
      <div className="flex items-end gap-2">
        <span className={`text-3xl font-black ${topSpeed.team === 'home' ? 'text-blue-400' : 'text-orange-400'}`}>
          {topSpeed.speed.toFixed(1)}
        </span>
        <span className="text-gray-400 text-xs mb-1">km/h</span>
      </div>
      <p className="text-xs text-white font-medium">{topSpeed.name}</p>
    </div>
  );
}

function XgOverlay({ xg }: { xg: { home: number; away: number } }) {
  return (
    <div className="bg-gray-900/90 backdrop-blur rounded-xl border border-white/10 p-3">
      <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2 text-center">Expected Goals</p>
      <div className="flex items-center justify-around">
        <div className="text-center">
          <p className="text-2xl font-black text-blue-400">{xg.home.toFixed(2)}</p>
          <p className="text-[10px] text-gray-500">Home</p>
        </div>
        <div className="text-gray-600 text-lg">vs</div>
        <div className="text-center">
          <p className="text-2xl font-black text-orange-400">{xg.away.toFixed(2)}</p>
          <p className="text-[10px] text-gray-500">Away</p>
        </div>
      </div>
    </div>
  );
}

function ShotMap({ shots }: { shots: ShotEvent[] }) {
  return (
    <div className="bg-gray-900/90 backdrop-blur rounded-xl border border-white/10 p-3">
      <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Shot Map</p>
      <svg viewBox="0 0 100 65" className="w-full rounded" style={{ background: '#0a2e0a' }}>
        {/* Pitch outline */}
        <g stroke="#1e5c1e" strokeWidth="0.5" fill="none">
          <rect x="1" y="1" width="98" height="63" />
          <line x1="50" y1="1" x2="50" y2="64" />
          <circle cx="50" cy="32.5" r="9.15" />
          <rect x="1" y="19.5" width="16.5" height="26" />
          <rect x="82.5" y="19.5" width="16.5" height="26" />
          <rect x="0" y="29" width="1" height="7" stroke="#fff" strokeWidth="0.4" />
          <rect x="99" y="29" width="1" height="7" stroke="#fff" strokeWidth="0.4" />
        </g>
        {/* Shots */}
        {shots.map((s, i) => (
          <g key={i}>
            {s.onTarget && (
              <circle cx={s.x} cy={s.y} r={2 + s.xg * 4} fill={s.team === 'home' ? '#3b82f6' : '#f97316'} fillOpacity="0.2" />
            )}
            <circle cx={s.x} cy={s.y} r="1.5"
              fill={s.onTarget ? (s.team === 'home' ? '#3b82f6' : '#f97316') : 'none'}
              stroke={s.team === 'home' ? '#3b82f6' : '#f97316'}
              strokeWidth="0.5"
            />
          </g>
        ))}
      </svg>
      <div className="flex gap-3 mt-1.5 text-[10px]">
        <span className="flex items-center gap-1 text-blue-400"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> On target</span>
        <span className="flex items-center gap-1 text-gray-400"><span className="w-2 h-2 rounded-full border border-gray-500 inline-block" /> Off target</span>
      </div>
    </div>
  );
}

function EventNotification({ event, onDismiss }: { event: BroadcastEvent; onDismiss: () => void }) {
  const icons: Record<string, string> = { GOAL: '⚽', YELLOW_CARD: '🟨', RED_CARD: '🟥', SUBSTITUTION: '🔄', VAR: '📺' };
  const colors: Record<string, string> = {
    GOAL: 'border-green-500/50 bg-green-900/80',
    YELLOW_CARD: 'border-yellow-500/50 bg-yellow-900/80',
    RED_CARD: 'border-red-500/50 bg-red-900/80',
    SUBSTITUTION: 'border-blue-500/50 bg-blue-900/80',
    VAR: 'border-purple-500/50 bg-purple-900/80',
  };
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur shadow-2xl ${colors[event.type] ?? 'border-gray-700 bg-gray-900/80'}`}>
      <span className="text-2xl">{icons[event.type]}</span>
      <div>
        <p className="text-xs text-gray-300 font-medium">{event.minute}' — {event.type.replace('_', ' ')}</p>
        <p className="text-sm text-white font-bold">{event.playerName}</p>
      </div>
      <button onClick={onDismiss} className="ml-2 text-gray-400 hover:text-white text-xs">✕</button>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Broadcast() {
  const [match, setMatch] = useState<OverlayMatch>(DEMO);
  const [events, setEvents] = useState<BroadcastEvent[]>([]);
  const [previewMode, setPreviewMode] = useState<'overlay' | 'builder'>('overlay');
  const [visibleWidgets, setVisibleWidgets] = useState({
    score: true, possession: true, speed: true, xg: true, shotmap: true,
  });
  const eventIdRef = useRef(0);

  // Simulate live updates
  useEffect(() => {
    const t = setInterval(() => {
      setMatch((m) => ({
        ...m,
        minute: Math.min(90, m.minute + 1),
        possession: {
          home: Math.max(30, Math.min(70, m.possession.home + (Math.random() - 0.5) * 3)),
          away: 0,
        },
        topSpeed: { ...m.topSpeed, speed: Math.max(20, Math.min(34, m.topSpeed.speed + (Math.random() - 0.5) * 2)) },
      }));
      setMatch((m) => ({ ...m, possession: { home: m.possession.home, away: 100 - m.possession.home } }));
    }, 3000);
    return () => clearInterval(t);
  }, []);

  const fireEvent = (type: BroadcastEvent['type']) => {
    const names = ['Clatous Chama', 'Luis Miquissone', 'Fiston Mayele', 'Gnamien Yao'];
    const ev: BroadcastEvent = {
      id: String(++eventIdRef.current),
      type, minute: match.minute,
      playerName: names[Math.floor(Math.random() * names.length)],
      team: Math.random() > 0.5 ? 'home' : 'away',
    };
    setEvents((prev) => [ev, ...prev.slice(0, 2)]);
    if (type === 'GOAL') {
      setMatch((m) => ({
        ...m,
        homeScore: ev.team === 'home' ? m.homeScore + 1 : m.homeScore,
        awayScore: ev.team === 'away' ? m.awayScore + 1 : m.awayScore,
      }));
    }
  };

  const toggleWidget = (key: keyof typeof visibleWidgets) => {
    setVisibleWidgets((v) => ({ ...v, [key]: !v[key] }));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-800 shrink-0 flex-wrap">
        <div className="flex gap-1">
          {(['overlay', 'builder'] as const).map((v) => (
            <button key={v} onClick={() => setPreviewMode(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${previewMode === v ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              {v === 'overlay' ? '📺 Preview' : '🔧 Builder'}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto flex-wrap">
          <span className="text-xs text-gray-500 self-center mr-1">Fire event:</span>
          {(['GOAL', 'YELLOW_CARD', 'RED_CARD', 'SUBSTITUTION', 'VAR'] as const).map((t) => (
            <button key={t} onClick={() => fireEvent(t)}
              className="px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 transition-colors">
              {t === 'GOAL' ? '⚽' : t === 'YELLOW_CARD' ? '🟨' : t === 'RED_CARD' ? '🟥' : t === 'SUBSTITUTION' ? '🔄' : '📺'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {previewMode === 'overlay' && (
          <>
            {/* Simulated broadcast frame */}
            <div className="relative rounded-xl overflow-hidden border border-gray-700" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2137 100%)', minHeight: 320 }}>
              {/* Fake pitch background */}
              <div className="absolute inset-0 opacity-20">
                <svg viewBox="0 0 100 65" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
                  <rect width="100" height="65" fill="#0a2e0a" />
                  <g stroke="#1e5c1e" strokeWidth="0.4" fill="none">
                    <rect x="1" y="1" width="98" height="63" />
                    <line x1="50" y1="1" x2="50" y2="64" />
                    <circle cx="50" cy="32.5" r="9.15" />
                  </g>
                </svg>
              </div>

              {/* Overlay widgets */}
              <div className="relative p-4 space-y-3">
                {/* Score ticker — top center */}
                {visibleWidgets.score && (
                  <div className="flex justify-center">
                    <ScoreTicker match={match} />
                  </div>
                )}

                {/* Bottom row */}
                <div className="flex gap-3 flex-wrap mt-8">
                  {visibleWidgets.possession && (
                    <PossessionOverlay possession={match.possession} homeTeam={match.homeTeam} awayTeam={match.awayTeam} />
                  )}
                  {visibleWidgets.speed && <SpeedTracker topSpeed={match.topSpeed} />}
                  {visibleWidgets.xg && <XgOverlay xg={match.xg} />}
                  {visibleWidgets.shotmap && (
                    <div className="w-48">
                      <ShotMap shots={DEMO_SHOTS} />
                    </div>
                  )}
                </div>

                {/* Event notifications — top right */}
                <div className="absolute top-16 right-4 space-y-2 w-64">
                  {events.map((ev) => (
                    <EventNotification key={ev.id} event={ev} onDismiss={() => setEvents((e) => e.filter((x) => x.id !== ev.id))} />
                  ))}
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-500 text-center">
              Live preview — widgets update every 3s. Use the event buttons above to simulate match events.
            </p>
          </>
        )}

        {previewMode === 'builder' && (
          <div className="space-y-4 max-w-md">
            <h3 className="text-sm font-semibold text-white">Widget Visibility</h3>
            <div className="space-y-2">
              {(Object.keys(visibleWidgets) as Array<keyof typeof visibleWidgets>).map((key) => (
                <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-gray-900 border border-gray-800">
                  <span className="text-sm text-white capitalize">{key === 'shotmap' ? 'Shot Map' : key === 'xg' ? 'xG Overlay' : key.charAt(0).toUpperCase() + key.slice(1)}</span>
                  <button onClick={() => toggleWidget(key)}
                    className={`w-10 h-5 rounded-full transition-colors ${visibleWidgets[key] ? 'bg-blue-500' : 'bg-gray-600'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-0.5 ${visibleWidgets[key] ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 space-y-2">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Export for OBS</h4>
              <p className="text-xs text-gray-500">Open this app in a browser window and use OBS Browser Source to capture the overlay layer at 1920×1080.</p>
              <div className="flex gap-2 mt-2">
                <div className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-xs text-gray-400 font-mono truncate">
                  {window.location.origin}/sports/overlay
                </div>
                <button className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs text-white transition-colors">
                  Copy
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
