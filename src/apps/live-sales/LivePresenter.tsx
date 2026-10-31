import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

type Product = { id: string; code: string; name: string; stock: number; livePrice: number; catalogPrice: number };
type Script = { script: string; aiGenerated: boolean; products: Product[]; currency: string };

/** A capturable animated presenter. Broadcast transport remains with the platform encoder. */
export function LivePresenter({ sessionId, catalogUrl, onClose }: { sessionId: string; catalogUrl: string; onClose: () => void }) {
  const [draft, setDraft] = useState<Script | null>(null);
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');
  const [stage, setStage] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  const request = useRef(0);
  const voiceRequest = useRef(0);
  const stop = () => { voiceRequest.current += 1; window.speechSynthesis?.cancel(); setSpeaking(false); };
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; voiceRequest.current += 1; window.speechSynthesis?.cancel(); };
  }, []);
  useEffect(() => {
    // Ended sessions, catalogue edits, and offline reads invalidate the prepared speech.
    let disposed = false;
    const timer = setInterval(async () => {
      if (!draft) return;
      try {
        const [session, pins] = await Promise.all([
          api<{ status: string }>(`/live-sales/${sessionId}`, { offlineFallback: false }),
          api<Product[]>(`/live-sales/${sessionId}/pins`, { offlineFallback: false }),
        ]);
        if (disposed) return;
        const changed = draft.products.some(old => {
          const next = pins.find(pin => pin.id === old.id);
          return !next || ['name', 'code', 'stock', 'livePrice', 'catalogPrice'].some(key => String(next[key as keyof Product]) !== String(old[key as keyof Product]));
        });
        if (session.status !== 'LIVE' || changed) {
          voiceRequest.current += 1;
          window.speechSynthesis?.cancel(); setSpeaking(false); setDraft(null);
          setError(session.status !== 'LIVE' ? 'This sales session has ended.' : 'Products changed. Prepare a fresh script before speaking.');
        }
      } catch {
        if (!disposed) { voiceRequest.current += 1; window.speechSynthesis?.cancel(); setSpeaking(false); setDraft(null); setError('Connection lost. Refresh the script when the store is back online.'); }
      }
    }, 4000);
    return () => { disposed = true; clearInterval(timer); };
  }, [draft, sessionId]);

  const prepare = async () => {
    stop(); setBusy(true); setError(''); setDraft(null);
    const current = ++request.current;
    try {
      const result = await api<Script>(`/live-sales/${sessionId}/presenter/script`, { method: 'POST', body: '{}', offlineFallback: false });
      if (mounted.current && current === request.current) setDraft(result);
    } catch (e) { if (mounted.current) setError((e as Error).message); }
    finally { if (mounted.current) setBusy(false); }
  };
  const speak = async () => {
    if (!draft) return;
    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') { setError('This browser does not provide a speaking voice. Open KobeOS in a supported desktop browser.'); return; }
    const currentVoice = ++voiceRequest.current;
    // Validate facts again immediately before starting audio.
    try {
      const [session, pins] = await Promise.all([
        api<{ status: string }>(`/live-sales/${sessionId}`, { offlineFallback: false }),
        api<Product[]>(`/live-sales/${sessionId}/pins`, { offlineFallback: false }),
      ]);
      if (!mounted.current || currentVoice !== voiceRequest.current) return;
      if (session.status !== 'LIVE' || draft.products.some(old => {
        const next = pins.find(pin => pin.id === old.id);
        return !next || ['name', 'code', 'stock', 'livePrice', 'catalogPrice'].some(key => String(next[key as keyof Product]) !== String(old[key as keyof Product]));
      })) { setDraft(null); setError('The session or products changed. Prepare a fresh script.'); return; }
      stop();
      const speech = new SpeechSynthesisUtterance(draft.script);
      speech.lang = 'en-US';
      speech.onend = () => { if (mounted.current) setSpeaking(false); };
      speech.onerror = () => { if (mounted.current) { setSpeaking(false); setError('The voice stopped. Check the installed voices and try again.'); } };
      setSpeaking(true); window.speechSynthesis.speak(speech);
    } catch (e) { setError((e as Error).message); }
  };
  return <div ref={container} className="fixed inset-0 z-[100] flex flex-col overflow-auto bg-slate-950 p-5 text-white">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <strong>Virtual sales presenter</strong>
      <div className="flex gap-3"><button onClick={() => { stop(); onClose(); }}>Close presenter</button><button onClick={() => { setStage(!stage); if (!stage) void container.current?.requestFullscreen?.().catch(() => {}); else if (document.fullscreenElement) void document.exitFullscreen(); }}>{stage ? 'Show controls' : 'Broadcast view'}</button></div>
    </div>
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-5 py-5 text-center">
      <div className="text-sm uppercase tracking-widest text-violet-300">Virtual presenter · KobeOS</div>
      <svg viewBox="0 0 200 200" role="img" aria-label={speaking ? 'Virtual presenter speaking' : 'Virtual presenter'} className="h-52 w-52">
        <rect x="22" y="25" width="156" height="150" rx="55" fill="#7c3aed" />
        <rect x="39" y="52" width="122" height="99" rx="30" fill="#0f172a" />
        <circle cx="72" cy="91" r="10" fill="#a5f3fc" /><circle cx="128" cy="91" r="10" fill="#a5f3fc" />
        <ellipse cx="100" cy="125" rx="23" ry="4" fill="#a5f3fc">{speaking && <animate attributeName="ry" values="4;13;5;10;4" dur="0.65s" repeatCount="indefinite" />}</ellipse>
      </svg>
      {draft?.products.map(product => <div key={product.id} className="w-full rounded-2xl border border-violet-500/40 bg-slate-900 p-4"><div className="text-2xl font-bold">{product.name}</div><div className="text-xl text-violet-300">{draft.currency} {Number(Number(product.livePrice) > 0 ? product.livePrice : product.catalogPrice).toLocaleString()}</div><div>Comment <b>{product.code}</b> · {product.stock} available</div></div>)}
      {catalogUrl && <div className="break-all text-sm">Shop: {catalogUrl}</div>}
      {error && <p role="alert" className="text-amber-300">{error}</p>}
    </div>
    {!stage && <div className="mx-auto w-full max-w-3xl space-y-3">
      <p className="text-sm text-slate-300">Prepare and review the script, then start the voice. Capture Broadcast view and this browser’s audio in OBS or your platform’s live software. Start the broadcast there.</p>
      <div className="flex flex-wrap gap-3"><button disabled={busy} onClick={() => void prepare()} className="rounded bg-violet-600 px-4 py-2 disabled:opacity-50">{busy ? 'Preparing…' : 'Prepare script'}</button><button disabled={!draft || busy || speaking} onClick={() => void speak()} className="rounded bg-emerald-700 px-4 py-2 disabled:opacity-50">Start voice</button><button onClick={stop} className="rounded bg-slate-700 px-4 py-2">Stop voice</button></div>
      {draft && <><p className="text-xs text-slate-400">{draft.aiGenerated ? 'AI introduction with catalogue product facts. Review before speaking.' : 'Catalogue script. AI is unavailable; using the standard introduction.'} Voice availability depends on this computer. Product speech is in English.</p><textarea aria-label="Presenter script" readOnly value={draft.script} rows={5} className="w-full rounded bg-slate-900 p-3 text-sm" /></>}
    </div>}
  </div>;
}
