/**
 * OverlayPage — fullscreen transparent OBS browser source overlay.
 *
 * URL: /sports/overlay?match=<matchId>
 *
 * Designed to be captured by OBS as a Browser Source at 1920×1080.
 * Background is transparent so it composites over the video feed.
 */
import { useState, useEffect, useRef } from 'react';
import { useSportsSocket, type MatchEvent } from './useSportsSocket';
import BoxingOverlay from './BoxingOverlay';

function ScoreTicker({ homeTeam, awayTeam, homeScore, awayScore, minute, half }: {
  homeTeam: string; awayTeam: string; homeScore: number; awayScore: number; minute: number; half: number;
}) {
  return (
    <div className="flex items-center gap-0 rounded-xl overflow-hidden shadow-2xl text-sm font-bold" style={{ backdropFilter: 'blur(8px)' }}>
      <div className="px-5 py-2.5 text-white" style={{ background: 'rgba(30,58,138,0.92)' }}>{homeTeam}</div>
      <div className="px-5 py-2.5 flex items-center gap-3" style={{ background: 'rgba(10,10,20,0.95)' }}>
        <span className="text-white text-2xl font-black">{homeScore}</span>
        <span className="text-gray-500">–</span>
        <span className="text-white text-2xl font-black">{awayScore}</span>
      </div>
      <div className="px-5 py-2.5 text-white" style={{ background: 'rgba(124,45,18,0.92)' }}>{awayTeam}</div>
      <div className="px-3 py-2.5 flex items-center gap-1.5 text-xs" style={{ background: 'rgba(10,10,20,0.92)' }}>
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-green-300 font-semibold">{half === 1 ? '1st' : '2nd'} {minute}'</span>
      </div>
    </div>
  );
}

function PossessionBar({ home, away }: { home: number; away: number }) {
  return (
    <div className="rounded-xl px-4 py-3 min-w-[200px]" style={{ background: 'rgba(10,10,20,0.88)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1.5 text-center">Possession</p>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-blue-400 font-bold">{home}%</span>
        <span className="text-orange-400 font-bold">{away}%</span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden flex" style={{ background: 'rgba(255,255,255,0.1)' }}>
        <div className="bg-blue-500 h-full transition-all duration-1000" style={{ width: `${home}%` }} />
        <div className="bg-orange-500 h-full transition-all duration-1000" style={{ width: `${away}%` }} />
      </div>
    </div>
  );
}

function XgWidget({ home, away }: { home: number; away: number }) {
  return (
    <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(10,10,20,0.88)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1 text-center">xG</p>
      <div className="flex items-center gap-3">
        <span className="text-xl font-black text-blue-400">{home.toFixed(2)}</span>
        <span className="text-gray-600 text-xs">vs</span>
        <span className="text-xl font-black text-orange-400">{away.toFixed(2)}</span>
      </div>
    </div>
  );
}

function EventBanner({ event, onDismiss }: { event: MatchEvent & { uid: string }; onDismiss: () => void }) {
  const icons: Record<string, string> = { GOAL: '⚽', YELLOW_CARD: '🟨', RED_CARD: '🟥', VAR: '📺', OFFSIDE: '🚩', PENALTY: '🎯' };
  const bg: Record<string, string> = {
    GOAL: 'rgba(21,128,61,0.92)', YELLOW_CARD: 'rgba(133,77,14,0.92)',
    RED_CARD: 'rgba(153,27,27,0.92)', VAR: 'rgba(88,28,135,0.92)',
    OFFSIDE: 'rgba(153,27,27,0.92)', PENALTY: 'rgba(133,77,14,0.92)',
  };
  useEffect(() => { const t = setTimeout(onDismiss, 6000); return () => clearTimeout(t); }, [onDismiss]);
  return (
    <div className="flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl"
      style={{ background: bg[event.type] ?? 'rgba(30,30,50,0.92)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)' }}>
      <span className="text-3xl">{icons[event.type] ?? '•'}</span>
      <div>
        <p className="text-xs text-white/70 font-medium">{event.minute}' — {event.type.replace('_', ' ')}</p>
        <p className="text-base text-white font-black">
          {event.jerseyNumber ? `#${event.jerseyNumber}` : event.team === 'home' ? 'Home' : 'Away'}
          {event.xg != null ? ` · xG ${event.xg.toFixed(2)}` : ''}
        </p>
      </div>
    </div>
  );
}

export default function OverlayPage() {
  // Dispatcher: ?bout=<id> → boxing scorebug; otherwise the football overlay.
  const boutId = new URLSearchParams(window.location.search).get('bout');
  if (boutId) return <BoxingOverlay boutId={boutId} />;
  return <FootballOverlay />;
}

function FootballOverlay() {
  const params = new URLSearchParams(window.location.search);
  const matchId = params.get('match') ?? '1';

  const { connected, frame, matchState, latestEvent } = useSportsSocket(matchId);

  const [homeTeam] = useState(params.get('home') ?? 'Home');
  const [awayTeam] = useState(params.get('away') ?? 'Away');
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [banners, setBanners] = useState<Array<MatchEvent & { uid: string }>>([]);
  const uidRef = useRef(0);

  const possession = matchState?.possession ?? { home: 50, away: 50 };
  const xg = matchState?.xg ?? { home: 0, away: 0 };
  const minute = frame ? Math.floor(frame.matchClock / 60) : 0;
  const half = frame?.half ?? 1;

  // Track score from GOAL events
  useEffect(() => {
    if (!latestEvent) return;
    if (latestEvent.type === 'GOAL') {
      if (latestEvent.team === 'home') setHomeScore((s) => s + 1);
      else if (latestEvent.team === 'away') setAwayScore((s) => s + 1);
    }
    const significant = ['GOAL', 'YELLOW_CARD', 'RED_CARD', 'PENALTY', 'VAR', 'OFFSIDE'];
    if (significant.includes(latestEvent.type)) {
      const uid = String(++uidRef.current);
      setBanners((b) => [{ ...latestEvent, uid }, ...b.slice(0, 2)]);
    }
  }, [latestEvent]);

  if (!connected && !frame) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'transparent' }}>
        <div className="text-white/40 text-sm">Connecting to AI pipeline…</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ background: 'transparent' }}>
      {/* Score ticker — top center */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2">
        <ScoreTicker homeTeam={homeTeam} awayTeam={awayTeam}
          homeScore={homeScore} awayScore={awayScore} minute={minute} half={half} />
      </div>

      {/* Bottom left — possession + xG */}
      <div className="absolute bottom-8 left-8 flex gap-3">
        <PossessionBar home={possession.home} away={possession.away} />
        <XgWidget home={xg.home} away={xg.away} />
      </div>

      {/* Top right — event banners */}
      <div className="absolute top-20 right-8 space-y-2 w-72">
        {banners.map((ev) => (
          <EventBanner key={ev.uid} event={ev} onDismiss={() => setBanners((b) => b.filter((x) => x.uid !== ev.uid))} />
        ))}
      </div>
    </div>
  );
}
