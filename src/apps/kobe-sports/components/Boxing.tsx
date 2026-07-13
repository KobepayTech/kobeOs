import { useCallback, useEffect, useMemo, useState } from 'react';
import { boxingApi, type BoxingFighter, type BoxingBout } from '../api';

/**
 * Boxing — the combat-sport module inside Kobe Sports. Fighters (records +
 * weight class), fight cards (main event / undercard), and live round-by-round
 * judge scoring with a running tally + result that updates fighter records.
 */
type View = 'card' | 'fighters' | 'score';

export default function Boxing() {
  const [view, setView] = useState<View>('card');
  const [scoreBoutId, setScoreBoutId] = useState<string | null>(null);

  return (
    <div className="h-full flex flex-col bg-gray-950 text-gray-100">
      <div className="flex gap-1 p-2 border-b border-gray-800 shrink-0">
        {([['card', '🥊 Fight Card'], ['fighters', '👤 Fighters'], ['score', '📋 Live Scoring']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setView(k)} className={`px-3 h-8 rounded-lg text-xs font-bold ${view === k ? 'bg-rose-600 text-white' : 'text-gray-400 hover:bg-gray-900'}`}>{label}</button>
        ))}
      </div>
      <div className="flex-1 overflow-auto">
        {view === 'card' && <FightCard onScore={(id) => { setScoreBoutId(id); setView('score'); }} />}
        {view === 'fighters' && <Fighters />}
        {view === 'score' && <Scoring boutId={scoreBoutId} onPick={() => setView('card')} />}
      </div>
    </div>
  );
}

/* ── Fighters ── */
function Fighters() {
  const [rows, setRows] = useState<BoxingFighter[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<BoxingFighter> | null>(null);

  const load = useCallback(async () => { setLoading(true); try { setRows(await boxingApi.fighters()); } catch { setRows([]); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  const save = async () => { if (!form?.name?.trim()) return; await boxingApi.createFighter(form); setForm(null); load(); };
  const del = async (id: string) => { if (confirm('Delete fighter?')) { await boxingApi.deleteFighter(id); load(); } };

  return (
    <div className="p-4 space-y-2 max-w-2xl mx-auto">
      <button onClick={() => setForm({ name: '', stance: 'orthodox' })} className="h-10 px-4 rounded-lg bg-rose-600 text-white text-sm font-bold">+ Add fighter</button>
      {loading ? <p className="text-gray-500 text-sm py-6 text-center">Loading…</p> : rows.map((f) => (
        <div key={f.id} className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex items-center justify-between">
          <div>
            <div className="font-bold">{f.name} {f.nickname && <span className="text-gray-500 font-normal">“{f.nickname}”</span>}</div>
            <div className="text-[11px] text-gray-500">{[f.weightClass, f.stance, f.country].filter(Boolean).join(' · ')}</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right"><div className="font-mono font-bold text-sm">{f.wins}-{f.losses}-{f.draws}</div><div className="text-[10px] text-gray-500">{f.kos} KO</div></div>
            <button onClick={() => del(f.id)} className="text-gray-600 hover:text-rose-400 text-xs">✕</button>
          </div>
        </div>
      ))}
      {form && (
        <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" onClick={() => setForm(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 w-full max-w-sm space-y-2" onClick={(e) => e.stopPropagation()}>
            <div className="font-bold">Add fighter</div>
            <In v={form.name ?? ''} set={(v) => setForm({ ...form, name: v })} ph="Name *" />
            <div className="grid grid-cols-2 gap-2">
              <In v={form.nickname ?? ''} set={(v) => setForm({ ...form, nickname: v })} ph="Nickname" />
              <In v={form.weightClass ?? ''} set={(v) => setForm({ ...form, weightClass: v })} ph="Weight class" />
              <select value={form.stance ?? 'orthodox'} onChange={(e) => setForm({ ...form, stance: e.target.value })} className="h-9 px-2 rounded bg-gray-800 border border-gray-700 text-sm"><option value="orthodox">Orthodox</option><option value="southpaw">Southpaw</option></select>
              <In v={form.country ?? ''} set={(v) => setForm({ ...form, country: v })} ph="Country" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              <In v={form.wins ?? ''} set={(v) => setForm({ ...form, wins: Number(v) || 0 })} ph="W" type="number" />
              <In v={form.losses ?? ''} set={(v) => setForm({ ...form, losses: Number(v) || 0 })} ph="L" type="number" />
              <In v={form.draws ?? ''} set={(v) => setForm({ ...form, draws: Number(v) || 0 })} ph="D" type="number" />
              <In v={form.kos ?? ''} set={(v) => setForm({ ...form, kos: Number(v) || 0 })} ph="KO" type="number" />
            </div>
            <button onClick={save} className="w-full h-10 rounded-lg bg-rose-600 text-white font-bold">Save fighter</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Fight card ── */
function FightCard({ onScore }: { onScore: (id: string) => void }) {
  const [bouts, setBouts] = useState<BoxingBout[]>([]);
  const [fighters, setFighters] = useState<BoxingFighter[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<{ fighterAId: string; fighterBId: string; eventName: string; title: string; scheduledRounds: number; cardPosition: 'MAIN' | 'CO_MAIN' | 'UNDERCARD' } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const [b, f] = await Promise.all([boxingApi.bouts(), boxingApi.fighters()]); setBouts(b); setFighters(f); } catch { /* */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form?.fighterAId || !form?.fighterBId) return;
    await boxingApi.createBout(form); setForm(null); load();
  };
  const label = { MAIN: 'Main Event', CO_MAIN: 'Co-Main', UNDERCARD: 'Undercard' };

  return (
    <div className="p-4 space-y-3 max-w-2xl mx-auto">
      <button onClick={() => setForm({ fighterAId: '', fighterBId: '', eventName: '', title: '', scheduledRounds: 12, cardPosition: 'UNDERCARD' })} disabled={fighters.length < 2}
        className="h-10 px-4 rounded-lg bg-rose-600 text-white text-sm font-bold disabled:opacity-40">+ Add bout {fighters.length < 2 && '(add 2 fighters first)'}</button>
      {loading ? <p className="text-gray-500 text-sm py-6 text-center">Loading…</p> : bouts.length === 0 ? <p className="text-gray-500 text-sm py-8 text-center">No bouts yet.</p> : bouts.map((b) => (
        <div key={b.id} className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-rose-400 font-bold mb-1">
            <span>{label[b.cardPosition]}{b.title ? ` · ${b.title}` : ''}</span>
            <span className={`px-2 py-0.5 rounded-full ${b.status === 'LIVE' ? 'bg-rose-500/20' : b.status === 'FINISHED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-700 text-gray-400'}`}>{b.status}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-bold">{b.fighterAName}</span>
            <span className="text-gray-500 text-xs">vs · {b.scheduledRounds}R</span>
            <span className="font-bold text-right">{b.fighterBName}</span>
          </div>
          {b.status === 'FINISHED' && b.winnerId && (
            <div className="text-center text-xs text-emerald-400 mt-1">{(b.winnerId === b.fighterAId ? b.fighterAName : b.fighterBName)} def. by {b.method}{b.endRound ? ` R${b.endRound}` : ''}</div>
          )}
          <button onClick={() => onScore(b.id)} className="w-full mt-2 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-bold">{b.status === 'FINISHED' ? 'View scorecards' : 'Score this bout'}</button>
        </div>
      ))}
      {form && (
        <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" onClick={() => setForm(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 w-full max-w-sm space-y-2" onClick={(e) => e.stopPropagation()}>
            <div className="font-bold">Add bout</div>
            <Sel v={form.fighterAId} set={(v: string) => setForm({ ...form, fighterAId: v })} rows={fighters} ph="Fighter A" />
            <Sel v={form.fighterBId} set={(v: string) => setForm({ ...form, fighterBId: v })} rows={fighters} ph="Fighter B" />
            <In v={form.eventName} set={(v) => setForm({ ...form, eventName: v })} ph="Event name" />
            <In v={form.title} set={(v) => setForm({ ...form, title: v })} ph="Title / belt (optional)" />
            <div className="grid grid-cols-2 gap-2">
              <In v={form.scheduledRounds} set={(v) => setForm({ ...form, scheduledRounds: Number(v) || 12 })} ph="Rounds" type="number" />
              <select value={form.cardPosition} onChange={(e) => setForm({ ...form, cardPosition: e.target.value as 'MAIN' | 'CO_MAIN' | 'UNDERCARD' })} className="h-9 px-2 rounded bg-gray-800 border border-gray-700 text-sm">
                <option value="UNDERCARD">Undercard</option><option value="CO_MAIN">Co-Main</option><option value="MAIN">Main Event</option>
              </select>
            </div>
            <button onClick={create} className="w-full h-10 rounded-lg bg-rose-600 text-white font-bold">Create bout</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Live scoring ── */
function Scoring({ boutId, onPick }: { boutId: string | null; onPick: () => void }) {
  const [bout, setBout] = useState<BoxingBout | null>(null);
  const [round, setRound] = useState(1);
  const [finishing, setFinishing] = useState(false);

  const load = useCallback(async () => { if (boutId) setBout(await boxingApi.bout(boutId)); }, [boutId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (bout) setRound(Math.min(bout.scheduledRounds, (bout.currentRound || 0) + 1) || 1); }, [bout?.id]); // eslint-disable-line

  if (!boutId || !bout) return <div className="p-8 text-center text-gray-500 text-sm">Pick a bout from the <button onClick={onPick} className="text-rose-400 font-semibold">Fight Card</button>.</div>;

  const score = async (judge: string, a: number, b: number) => { setBout(await boxingApi.score(bout.id, { round, judge, a, b })); };
  const finish = async (method: string, winnerId?: string) => { setBout(await boxingApi.finish(bout.id, { method, winnerId })); setFinishing(false); };
  const t = bout.tally;
  const done = bout.status === 'FINISHED';

  return (
    <div className="p-4 space-y-3 max-w-2xl mx-auto">
      <button onClick={onPick} className="text-xs text-gray-500">← Fight Card</button>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
        <div className="text-[10px] text-rose-400 uppercase font-bold">{bout.title || bout.eventName || 'Bout'} · {bout.scheduledRounds}R</div>
        <div className="flex items-center justify-center gap-4 mt-1 text-lg font-extrabold"><span>{bout.fighterAName}</span><span className="text-gray-600 text-sm">vs</span><span>{bout.fighterBName}</span></div>
        {t && <div className="text-xs text-gray-400 mt-1">Cards: {t.aCards}–{t.bCards} {t.leader !== 'EVEN' && `· ${t.leader === 'A' ? bout.fighterAName : bout.fighterBName} ahead`}</div>}
      </div>

      {/* Tally per judge */}
      {t && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-1">
          {t.perJudge.map((j) => (
            <div key={j.judge} className="flex items-center justify-between text-sm">
              <span className="text-gray-400">{j.judge}</span>
              <span className="font-mono font-bold">{j.a}–{j.bt} <span className={`text-[10px] ${j.lead === 'A' ? 'text-emerald-400' : j.lead === 'B' ? 'text-sky-400' : 'text-gray-500'}`}>{j.lead !== 'EVEN' ? j.lead : '='}</span></span>
            </div>
          ))}
        </div>
      )}

      {!done && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Round</span>
            <select value={round} onChange={(e) => setRound(Number(e.target.value))} className="h-8 px-2 rounded bg-gray-800 border border-gray-700 text-sm">
              {Array.from({ length: bout.scheduledRounds }, (_, i) => i + 1).map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            {bout.judges.map((judge) => (
              <div key={judge} className="bg-gray-900 border border-gray-800 rounded-xl p-2.5">
                <div className="text-[11px] text-gray-400 mb-1.5">{judge} · round {round}</div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button onClick={() => score(judge, 10, 9)} className="h-9 rounded-lg bg-emerald-600/20 text-emerald-300 text-xs font-bold">A 10-9</button>
                  <button onClick={() => score(judge, 10, 10)} className="h-9 rounded-lg bg-gray-700 text-gray-200 text-xs font-bold">10-10</button>
                  <button onClick={() => score(judge, 9, 10)} className="h-9 rounded-lg bg-sky-600/20 text-sky-300 text-xs font-bold">B 10-9</button>
                  <button onClick={() => score(judge, 10, 8)} className="h-8 rounded-lg bg-emerald-600/10 text-emerald-400 text-[11px]">A 10-8</button>
                  <span />
                  <button onClick={() => score(judge, 8, 10)} className="h-8 rounded-lg bg-sky-600/10 text-sky-400 text-[11px]">B 10-8</button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => setFinishing(true)} className="w-full h-11 rounded-xl bg-rose-600 text-white font-bold">Finish bout</button>
        </>
      )}
      {done && <div className="text-center text-emerald-400 font-bold">Result: {bout.winnerId ? `${bout.winnerId === bout.fighterAId ? bout.fighterAName : bout.fighterBName} — ${bout.method}` : bout.method}</div>}

      {finishing && (
        <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" onClick={() => setFinishing(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="font-bold">Finish bout</div>
            <div className="text-xs text-gray-400">Decision (uses the scorecards):</div>
            <div className="grid grid-cols-3 gap-2">
              {['UD', 'SD', 'MD'].map((m) => <button key={m} onClick={() => finish(m)} className="h-9 rounded-lg bg-gray-800 text-sm font-bold">{m}</button>)}
            </div>
            <div className="text-xs text-gray-400">Stoppage — pick winner:</div>
            {['KO', 'TKO', 'RTD'].map((m) => (
              <div key={m} className="flex gap-2">
                <button onClick={() => finish(m, bout.fighterAId)} className="flex-1 h-9 rounded-lg bg-emerald-600/20 text-emerald-300 text-xs font-bold">{bout.fighterAName} — {m}</button>
                <button onClick={() => finish(m, bout.fighterBId)} className="flex-1 h-9 rounded-lg bg-sky-600/20 text-sky-300 text-xs font-bold">{bout.fighterBName} — {m}</button>
              </div>
            ))}
            <button onClick={() => finish('DRAW')} className="w-full h-9 rounded-lg bg-gray-700 text-sm font-bold">Draw</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── bits ── */
function In({ v, set, ph, type = 'text' }: { v: string | number; set: (v: string) => void; ph: string; type?: string }) {
  return <input value={v} onChange={(e) => set(e.target.value)} placeholder={ph} type={type} className="w-full h-9 px-3 rounded bg-gray-800 border border-gray-700 text-sm" />;
}
function Sel({ v, set, rows, ph }: { v: string; set: (v: string) => void; rows: BoxingFighter[]; ph: string }) {
  return (
    <select value={v} onChange={(e) => set(e.target.value)} className="w-full h-9 px-2 rounded bg-gray-800 border border-gray-700 text-sm">
      <option value="">{ph}</option>
      {rows.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.wins}-{f.losses}-{f.draws})</option>)}
    </select>
  );
}
