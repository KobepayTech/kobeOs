import { useEffect, useState } from 'react';

/**
 * Boxing broadcast overlay — a transparent-background scorebug for OBS.
 * Add as a Browser Source at 1920×1080: /sports/overlay?bout=<id>. Polls the
 * public bout endpoint so the round + judges' scorecards update live on stream.
 */
interface Judge { judge: string; a: number; bt: number; rounds: number; lead: string }
interface Rec { wins: number; losses: number; draws: number; kos: number; country?: string; nickname?: string }
interface Bout {
  fighterAName: string; fighterBName: string; fighterAId: string; fighterBId: string;
  weightClass?: string; title?: string; scheduledRounds: number; currentRound: number;
  status: string; method: string; winnerId?: string | null; endRound?: number | null;
  tally?: { perJudge: Judge[]; aCards: number; bCards: number; leader: string };
  fighterA?: Rec | null; fighterB?: Rec | null;
}

const API = (import.meta.env.VITE_API_BASE as string | undefined) ?? (import.meta.env.DEV ? 'http://localhost:3000/api' : '/api');

export default function BoxingOverlay({ boutId }: { boutId: string }) {
  const [b, setB] = useState<Bout | null>(null);

  useEffect(() => {
    let off = false;
    const load = async () => {
      try { const r = await fetch(`${API}/sports/boxing/public/${boutId}`); if (r.ok && !off) setB(await r.json()); } catch { /* keep last */ }
    };
    load();
    const t = setInterval(load, 3000);
    return () => { off = true; clearInterval(t); };
  }, [boutId]);

  if (!b) return <div style={{ width: '100vw', height: '100vh', background: 'transparent' }} />;

  const done = b.status === 'FINISHED';
  const winnerName = b.winnerId ? (b.winnerId === b.fighterAId ? b.fighterAName : b.fighterBName) : '';
  const rec = (r?: Rec | null) => (r ? `${r.wins}-${r.losses}-${r.draws}${r.kos ? ` (${r.kos} KO)` : ''}` : '');

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'transparent', fontFamily: 'Inter, system-ui, sans-serif', color: '#fff', position: 'relative', overflow: 'hidden' }}>
      {/* LIVE / result pill */}
      <div style={{ position: 'absolute', top: 40, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 10, alignItems: 'center' }}>
        {b.title && <span style={pill('#f59e0b', '#000')}>{b.title}</span>}
        {done
          ? <span style={pill('#10b981', '#04241a')}>RESULT</span>
          : <span style={{ ...pill('#ef4444', '#fff'), animation: 'pulse 1.4s infinite' }}>● LIVE · ROUND {b.currentRound || 1}/{b.scheduledRounds}</span>}
      </div>

      {/* Bottom scorebug */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 48, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 1400, background: 'linear-gradient(180deg, rgba(10,12,20,.86), rgba(10,12,20,.96))', borderRadius: 18, border: '1px solid rgba(255,255,255,.12)', boxShadow: '0 20px 60px rgba(0,0,0,.5)', overflow: 'hidden' }}>
          {/* Names row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr' }}>
            <Corner name={b.fighterAName} record={rec(b.fighterA)} side="left" color="#ef4444" win={done && b.winnerId === b.fighterAId} />
            <div style={{ display: 'grid', placeItems: 'center', padding: '0 26px', background: 'rgba(255,255,255,.04)' }}>
              <div style={{ fontSize: 13, letterSpacing: 2, color: '#94a3b8', fontWeight: 800 }}>{b.weightClass?.toUpperCase() || 'BOUT'}</div>
              <div style={{ fontSize: 44, fontWeight: 900, lineHeight: 1 }}>VS</div>
            </div>
            <Corner name={b.fighterBName} record={rec(b.fighterB)} side="right" color="#3b82f6" win={done && b.winnerId === b.fighterBId} />
          </div>

          {/* Scorecards */}
          {b.tally && b.tally.perJudge.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 28, padding: '12px 20px 16px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
              {b.tally.perJudge.map((j) => (
                <div key={j.judge} style={{ textAlign: 'center', minWidth: 130 }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, letterSpacing: 1 }}>{j.judge.toUpperCase()}</div>
                  <div style={{ fontSize: 26, fontWeight: 900, marginTop: 2 }}>
                    <span style={{ color: j.lead === 'A' ? '#f87171' : '#fff' }}>{j.a}</span>
                    <span style={{ color: '#64748b', margin: '0 6px' }}>–</span>
                    <span style={{ color: j.lead === 'B' ? '#60a5fa' : '#fff' }}>{j.bt}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {done && (
            <div style={{ textAlign: 'center', padding: '10px 0 16px', background: 'rgba(16,185,129,.12)', color: '#6ee7b7', fontWeight: 900, fontSize: 22 }}>
              {winnerName ? `${winnerName} def. ${winnerName === b.fighterAName ? b.fighterBName : b.fighterAName} — ${b.method}${b.endRound ? ` (R${b.endRound})` : ''}` : `${b.method}`}
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}`}</style>
    </div>
  );
}

function Corner({ name, record, side, color, win }: { name: string; record: string; side: 'left' | 'right'; color: string; win: boolean }) {
  return (
    <div style={{ padding: '18px 30px', textAlign: side === 'left' ? 'left' : 'right', borderTop: `4px solid ${color}`, position: 'relative' }}>
      {win && <div style={{ position: 'absolute', top: 10, [side]: 30, fontSize: 12, fontWeight: 900, color: '#facc15', letterSpacing: 2 } as React.CSSProperties}>WINNER ★</div>}
      <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.05 }}>{name}</div>
      {record && <div style={{ fontSize: 15, color: '#94a3b8', fontWeight: 700, marginTop: 4 }}>{record}</div>}
    </div>
  );
}
function pill(bg: string, fg: string): React.CSSProperties {
  return { background: bg, color: fg, fontWeight: 900, fontSize: 14, letterSpacing: 1, padding: '6px 14px', borderRadius: 999 };
}
