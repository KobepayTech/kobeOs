/**
 * Player Tracking & Ratings
 *
 * Shows a live football pitch with player positions, movement trails,
 * and per-player performance ratings. Data comes from the AI vision
 * pipeline (playerTracking field in MatchAnalytics) or demo data.
 */
import { useState, useEffect, useRef } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlayerPosition {
  id: string;
  name: string;
  number: number;
  team: 'home' | 'away';
  x: number; // 0–100 (% of pitch width)
  y: number; // 0–100 (% of pitch height)
  speed: number; // km/h
  trail: Array<{ x: number; y: number }>;
}

interface PlayerRating {
  id: string;
  name: string;
  number: number;
  team: 'home' | 'away';
  position: string;
  overall: number;
  passing: number;
  defending: number;
  attacking: number;
  workRate: number;
  stats: {
    passes: number;
    passAcc: number;
    tackles: number;
    shots: number;
    distance: number;
    sprints: number;
  };
}

// ── Demo data generators ──────────────────────────────────────────────────────

function makeHomeLineup(): PlayerPosition[] {
  // 4-3-3 formation
  const positions: Array<[number, number, string, number]> = [
    [50, 92, 'Aishi Manula', 1],
    [15, 72, 'Joao Boccolini', 3], [35, 75, 'Nonda', 5], [65, 75, 'Léo Rodrigues', 4], [85, 72, 'Shomari Kapombe', 2],
    [25, 52, 'Clatous Chama', 8], [50, 48, 'Saimon Msuva', 6], [75, 52, 'Luis Miquissone', 10],
    [20, 28, 'Meddie Kagere', 11], [50, 22, 'Chris Mugalu', 9], [80, 28, 'Jonas Mkude', 7],
  ];
  return positions.map(([x, y, name, number]) => ({
    id: `h${number}`, name, number, team: 'home', x, y, speed: Math.random() * 28,
    trail: Array.from({ length: 5 }, (_, i) => ({ x: x + (Math.random() - 0.5) * 4 * i, y: y + (Math.random() - 0.5) * 4 * i })),
  }));
}

function makeAwayLineup(): PlayerPosition[] {
  // 4-4-2 formation (mirrored)
  const positions: Array<[number, number, string, number]> = [
    [50, 8, 'Metacha Mnata', 1],
    [15, 28, 'Feisal Salum', 2], [35, 25, 'Gnamien Yao', 5], [65, 25, 'Dickson Job', 4], [85, 28, 'Kelvin John', 3],
    [15, 48, 'Fiston Mayele', 7], [38, 52, 'Tresor Mputu', 8], [62, 52, 'Farid Mussa', 6], [85, 48, 'Haruna Niyonzima', 11],
    [35, 72, 'Yusuph Mwamnyeto', 10], [65, 72, 'Juma Balinya', 9],
  ];
  return positions.map(([x, y, name, number]) => ({
    id: `a${number}`, name, number, team: 'away', x, y, speed: Math.random() * 28,
    trail: Array.from({ length: 5 }, (_, i) => ({ x: x + (Math.random() - 0.5) * 4 * i, y: y + (Math.random() - 0.5) * 4 * i })),
  }));
}

function makeRatings(players: PlayerPosition[]): PlayerRating[] {
  const positions = ['GK', 'RB', 'CB', 'CB', 'LB', 'CM', 'CDM', 'CAM', 'RW', 'ST', 'LW'];
  return players.map((p, i) => {
    const base = 60 + Math.random() * 30;
    return {
      id: p.id, name: p.name, number: p.number, team: p.team,
      position: positions[i] ?? 'MF',
      overall: Math.round(base),
      passing: Math.round(base + (Math.random() - 0.5) * 20),
      defending: Math.round(base + (Math.random() - 0.5) * 20),
      attacking: Math.round(base + (Math.random() - 0.5) * 20),
      workRate: Math.round(base + (Math.random() - 0.5) * 20),
      stats: {
        passes: Math.round(20 + Math.random() * 60),
        passAcc: Math.round(70 + Math.random() * 25),
        tackles: Math.round(Math.random() * 8),
        shots: Math.round(Math.random() * 5),
        distance: parseFloat((5 + Math.random() * 7).toFixed(1)),
        sprints: Math.round(10 + Math.random() * 30),
      },
    };
  });
}

// ── Pitch SVG ─────────────────────────────────────────────────────────────────

function FootballPitch({ players, selectedId, onSelect }: {
  players: PlayerPosition[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const W = 100; const H = 65;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl border border-green-900/40" style={{ background: 'linear-gradient(180deg, #0d3b0d 0%, #0a2e0a 100%)' }}>
      {/* Pitch markings */}
      <g stroke="#1e5c1e" strokeWidth="0.4" fill="none">
        <rect x="1" y="1" width="98" height="63" />
        <line x1="50" y1="1" x2="50" y2="64" />
        <circle cx="50" cy="32.5" r="9.15" />
        <circle cx="50" cy="32.5" r="0.5" fill="#1e5c1e" />
        {/* Left penalty area */}
        <rect x="1" y="19.5" width="16.5" height="26" />
        <rect x="1" y="26.5" width="5.5" height="12" />
        <circle cx="11" cy="32.5" r="0.5" fill="#1e5c1e" />
        {/* Right penalty area */}
        <rect x="82.5" y="19.5" width="16.5" height="26" />
        <rect x="93.5" y="26.5" width="5.5" height="12" />
        <circle cx="89" cy="32.5" r="0.5" fill="#1e5c1e" />
        {/* Goals */}
        <rect x="0" y="29" width="1" height="7" stroke="#ffffff" strokeWidth="0.4" />
        <rect x="99" y="29" width="1" height="7" stroke="#ffffff" strokeWidth="0.4" />
        {/* Corner arcs */}
        <path d="M1,3 A2,2 0 0,1 3,1" />
        <path d="M97,1 A2,2 0 0,1 99,3" />
        <path d="M99,62 A2,2 0 0,1 97,64" />
        <path d="M3,64 A2,2 0 0,1 1,62" />
      </g>

      {/* Movement trails */}
      {players.map((p) => (
        <polyline
          key={`trail-${p.id}`}
          points={p.trail.map((t) => `${t.x},${t.y}`).join(' ')}
          fill="none"
          stroke={p.team === 'home' ? '#3b82f6' : '#f97316'}
          strokeWidth="0.3"
          strokeOpacity="0.4"
          strokeDasharray="0.5,0.5"
        />
      ))}

      {/* Players */}
      {players.map((p) => {
        const isSelected = p.id === selectedId;
        const color = p.team === 'home' ? '#3b82f6' : '#f97316';
        const isSprinting = p.speed > 20;
        return (
          <g key={p.id} onClick={() => onSelect(p.id)} style={{ cursor: 'pointer' }}>
            {/* Sprint pulse ring */}
            {isSprinting && (
              <circle cx={p.x} cy={p.y} r="3.5" fill="none" stroke={color} strokeWidth="0.4" strokeOpacity="0.4" />
            )}
            {/* Selection ring */}
            {isSelected && (
              <circle cx={p.x} cy={p.y} r="4" fill="none" stroke="#ffffff" strokeWidth="0.6" />
            )}
            {/* Player dot */}
            <circle cx={p.x} cy={p.y} r="2.5" fill={color} stroke="#000" strokeWidth="0.3" />
            {/* Jersey number */}
            <text x={p.x} y={p.y + 0.9} textAnchor="middle" fontSize="1.8" fill="white" fontWeight="bold">{p.number}</text>
            {/* Name label */}
            <text x={p.x} y={p.y + 5} textAnchor="middle" fontSize="1.6" fill={color} fontWeight="500">
              {p.name.split(' ').at(-1)}
            </text>
            {/* Speed badge */}
            {isSprinting && (
              <text x={p.x + 3} y={p.y - 2} fontSize="1.4" fill="#fbbf24">{p.speed.toFixed(0)}km/h</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Rating bar ────────────────────────────────────────────────────────────────

function RatingBar({ label, value }: { label: string; value: number }) {
  const clamped = Math.min(100, Math.max(0, value));
  const color = clamped >= 80 ? 'bg-green-500' : clamped >= 65 ? 'bg-blue-500' : clamped >= 50 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-gray-400 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="text-[11px] font-bold text-white w-6 text-right">{clamped}</span>
    </div>
  );
}

function RatingBadge({ value }: { value: number }) {
  const color = value >= 80 ? 'text-green-400 bg-green-900/40 border-green-700/40'
    : value >= 70 ? 'text-blue-400 bg-blue-900/40 border-blue-700/40'
    : value >= 60 ? 'text-yellow-400 bg-yellow-900/40 border-yellow-700/40'
    : 'text-red-400 bg-red-900/40 border-red-700/40';
  return (
    <span className={`text-2xl font-black px-3 py-1 rounded-xl border ${color}`}>{value}</span>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Tracking() {
  const [homePlayers] = useState<PlayerPosition[]>(makeHomeLineup);
  const [awayPlayers] = useState<PlayerPosition[]>(makeAwayLineup);
  const [allPlayers, setAllPlayers] = useState<PlayerPosition[]>([]);
  const [ratings, setRatings] = useState<PlayerRating[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<'pitch' | 'ratings'>('pitch');
  const [teamFilter, setTeamFilter] = useState<'all' | 'home' | 'away'>('all');
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const combined = [...homePlayers, ...awayPlayers];
    setAllPlayers(combined);
    setRatings(makeRatings(combined));
  }, [homePlayers, awayPlayers]);

  // Simulate live position updates
  useEffect(() => {
    animRef.current = setInterval(() => {
      setAllPlayers((prev) => prev.map((p) => {
        const dx = (Math.random() - 0.5) * 1.5;
        const dy = (Math.random() - 0.5) * 1.5;
        const nx = Math.max(2, Math.min(98, p.x + dx));
        const ny = Math.max(2, Math.min(63, p.y + dy));
        return {
          ...p, x: nx, y: ny,
          speed: Math.max(0, Math.min(32, p.speed + (Math.random() - 0.5) * 4)),
          trail: [{ x: p.x, y: p.y }, ...p.trail.slice(0, 4)],
        };
      }));
    }, 2000);
    return () => { if (animRef.current) clearInterval(animRef.current); };
  }, []);

  const selectedPlayer = allPlayers.find((p) => p.id === selectedId);
  const selectedRating = ratings.find((r) => r.id === selectedId);
  const visibleRatings = ratings.filter((r) => teamFilter === 'all' || r.team === teamFilter);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-800 shrink-0">
        <div className="flex gap-1">
          {(['pitch', 'ratings'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${view === v ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              {v === 'pitch' ? '🏟 Pitch View' : '⭐ Ratings'}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto">
          {(['all', 'home', 'away'] as const).map((t) => (
            <button key={t} onClick={() => setTeamFilter(t)}
              className={`px-2.5 py-1 rounded-lg text-xs capitalize transition-colors ${
                teamFilter === t ? (t === 'home' ? 'bg-blue-600 text-white' : t === 'away' ? 'bg-orange-600 text-white' : 'bg-gray-600 text-white') : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}>{t}</button>
          ))}
        </div>
        <span className="flex items-center gap-1 text-[11px] text-green-400 ml-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Live
        </span>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3">
        {view === 'pitch' && (
          <>
            <FootballPitch
              players={teamFilter === 'all' ? allPlayers : allPlayers.filter((p) => p.team === teamFilter)}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId((prev) => prev === id ? null : id)}
            />

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Home</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-500 inline-block" /> Away</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" /> Sprinting (&gt;20 km/h)</span>
              <span className="ml-auto">Click a player for details</span>
            </div>

            {/* Selected player card */}
            {selectedPlayer && selectedRating && (
              <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black ${selectedPlayer.team === 'home' ? 'bg-blue-900/50 text-blue-300' : 'bg-orange-900/50 text-orange-300'}`}>
                      {selectedPlayer.number}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{selectedPlayer.name}</p>
                      <p className="text-xs text-gray-400">{selectedRating.position} · {selectedPlayer.team === 'home' ? 'Simba SC' : 'Young Africans'}</p>
                    </div>
                  </div>
                  <RatingBadge value={selectedRating.overall} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  {[
                    { label: 'Speed', value: `${selectedPlayer.speed.toFixed(1)} km/h` },
                    { label: 'Distance', value: `${selectedRating.stats.distance} km` },
                    { label: 'Sprints', value: selectedRating.stats.sprints },
                    { label: 'Passes', value: `${selectedRating.stats.passes} (${selectedRating.stats.passAcc}%)` },
                    { label: 'Tackles', value: selectedRating.stats.tackles },
                    { label: 'Shots', value: selectedRating.stats.shots },
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

        {view === 'ratings' && (
          <div className="space-y-2">
            {visibleRatings
              .sort((a, b) => b.overall - a.overall)
              .map((r) => (
                <div key={r.id} onClick={() => { setSelectedId(r.id); setView('pitch'); }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-600 cursor-pointer transition-colors">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0 ${r.team === 'home' ? 'bg-blue-900/50 text-blue-300' : 'bg-orange-900/50 text-orange-300'}`}>
                    {r.number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{r.name}</p>
                    <p className="text-[11px] text-gray-500">{r.position}</p>
                  </div>
                  <div className="flex gap-2 text-[11px] text-gray-500 shrink-0">
                    <span title="Passes">{r.stats.passes}p</span>
                    <span title="Distance">{r.stats.distance}km</span>
                  </div>
                  <RatingBadge value={r.overall} />
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
