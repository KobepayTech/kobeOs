import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Sparkles, Send, Loader2, User, CheckCircle2, Printer, Mic, Volume2, VolumeX, Paperclip } from 'lucide-react';

/** Strip emoji/markdown so the spoken reply sounds natural. */
function speakable(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, '')
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface PendingAction { tool: string; summary: string; args: Record<string, unknown> }
interface BriefingAlert { severity: 'info' | 'warning'; text: string; action?: { label: string; tool?: string; args?: Record<string, unknown>; endpoint?: string; method?: 'POST' | 'PUT' } }
interface Msg { role: 'user' | 'assistant'; content: string; data?: unknown; pending?: PendingAction | null; alerts?: BriefingAlert[] }

/** Find the first array-of-objects inside a tool result, for printing as a table. */
function firstRows(data: unknown): Record<string, unknown>[] | null {
  if (!data || typeof data !== 'object') return null;
  for (const v of Object.values(data as Record<string, unknown>)) {
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && v[0] !== null) {
      return v as Record<string, unknown>[];
    }
  }
  return null;
}

/** Open a clean printable table (works in Electron + browser). */
function printReport(rows: Record<string, unknown>[], title: string) {
  const cols = Object.keys(rows[0]);
  const esc = (s: unknown) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
  const html =
    `<html><head><title>${esc(title)}</title><style>` +
    `body{font-family:system-ui,sans-serif;padding:28px;color:#111}h1{font-size:18px;margin:0 0 4px}` +
    `.ts{color:#666;font-size:12px;margin:0 0 16px}table{border-collapse:collapse;width:100%;font-size:13px}` +
    `th,td{border:1px solid #ccc;padding:6px 10px;text-align:left}th{background:#f3f3f3}` +
    `</style></head><body><h1>${esc(title)}</h1><p class="ts">KobeOS · ${esc(new Date().toLocaleString())}</p>` +
    `<table><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>` +
    `<tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td>${esc(r[c])}</td>`).join('')}</tr>`).join('')}</tbody></table>` +
    `</body></html>`;
  const w = window.open('', '_blank', 'width=820,height=640');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}

const DEFAULT_SUGGESTIONS = [
  'What are today’s sales?',
  'Which items do customers like most?',
  'How many tenants haven’t paid rent?',
  'How much did I spend this month?',
  'How many parcels are in transit?',
];

// Suggestions tailored to the module the co-pilot was opened from, so the
// prompts are relevant to what the user is doing right now.
const PROMPTS_BY_APP: Record<string, string[]> = {
  'erp-pos': ['What are today’s sales?', 'Which items sell the most?', 'Show me low-stock products', 'Add a new product'],
  'posys': ['What are today’s sales?', 'Which items sell the most?', 'Show me low-stock products'],
  'pos-kds': ['What are today’s sales?', 'Which items sell the most?'],
  'property': ['How many tenants haven’t paid rent?', 'Remind tenants about rent automatically', 'Send me a daily report every morning', 'Record a rent payment'],
  'kobe-hotel': ['What’s my hotel occupancy right now?', 'This month’s hotel revenue and profit', 'Book a room for a guest', 'Set a room to maintenance'],
  'erp-warehouse': ['Show me low-stock warehouse items', 'What’s my total stock value?', 'Set stock for an item'],
  'erp-warehouse-ops': ['Show me low-stock warehouse items', 'What’s my total stock value?'],
  'cargo': ['How many parcels are in transit?', 'How many parcels were delivered?'],
  'erp-shop': ['Which items do customers like most?', 'Find products like “cheap kids kit”', 'Show me low-stock products', 'Write a promo for a jersey sale'],
  'erp-store-editor': ['Which items do customers like most?', 'Write a promo for a sale'],
  'kobe-pay': ['What are today’s sales?', 'How much did I spend this month?'],
  'erp-dashboard': ['What are today’s sales?', 'Project this month’s sales', 'How much did I spend this month?', 'How many tenants haven’t paid rent?'],
  'erp-summary': ['What are today’s sales?', 'How much did I spend this month?'],
  'erp-reports': ['What are today’s sales?', 'How much did I spend this month?'],
  'erp-eod': ['What are today’s sales?', 'How much did I spend this month?'],
  'erp-accounting': ['How much did I spend this month?', 'What are today’s sales?'],
};

export default function KobeAssistant({ contextLabel, appId }: { contextLabel?: string; appId?: string } = {}) {
  const suggestions = (appId && PROMPTS_BY_APP[appId]) || DEFAULT_SUGGESTIONS;
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  // Voice mode: read Kobe's replies aloud, and auto-send after dictation (hands-free).
  const [voice, setVoice] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recogRef = useRef<{ stop: () => void } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const spokenRef = useRef(-1);        // index of the last message read aloud
  const voiceRef = useRef(false);      // latest `voice` for use inside recognition callbacks
  voiceRef.current = voice;

  const TTS = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const speak = useCallback((text: string) => {
    if (!TTS) return;
    const clean = speakable(text);
    if (!clean) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(clean.slice(0, 500));
      u.lang = navigator.language || 'en-US';
      window.speechSynthesis.speak(u);
    } catch { /* TTS best-effort */ }
  }, [TTS]);

  // Voice input via the Web Speech API (works in Electron/Chromium + Chrome/Edge
  // PWA). Dictates into the input; the user reviews and sends.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SR = typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;
  const toggleVoice = () => {
    if (!SR) return;
    if (listening) { recogRef.current?.stop(); return; }
    const r = new SR();
    r.lang = navigator.language || 'en-US';
    r.interimResults = true;
    r.continuous = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let heard = '';
    r.onresult = (e: any) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      heard = text;
      setInput(text);
    };
    // Hands-free: when voice mode is on, send what was dictated as soon as the
    // user stops speaking, so they never have to touch the keyboard.
    r.onend = () => { setListening(false); if (voiceRef.current && heard.trim()) send(heard); };
    r.onerror = () => setListening(false);
    recogRef.current = r;
    setListening(true);
    r.start();
  };

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, busy]);

  // Read the newest assistant reply aloud when voice mode is on.
  useEffect(() => {
    if (!voice) return;
    const last = messages.length - 1;
    if (last < 0 || last === spokenRef.current) return;
    const m = messages[last];
    if (m.role === 'assistant' && m.content) { spokenRef.current = last; speak(m.content); }
  }, [messages, voice, speak]);

  // Stop any speech when voice mode is switched off.
  useEffect(() => { if (!voice && TTS) window.speechSynthesis.cancel(); }, [voice, TTS]);

  // Proactive daily briefing: greet the user with their business status + alerts
  // when the assistant opens. Deterministic on the backend, so it works even
  // when the AI model is offline.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const b = await api<{ summary: string; alerts: BriefingAlert[] }>('/ai/briefing');
        if (cancelled || !b) return;
        setMessages((p) => (p.length ? p : [{ role: 'assistant', content: `👋 ${b.summary}`, alerts: b.alerts ?? [] }]));
      } catch { /* briefing is best-effort */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    // Give the model the module the user is currently in (co-pilot context),
    // without cluttering the visible chat.
    const ctx = contextLabel
      ? [{ role: 'user' as const, content: `[context] The user is currently working in the "${contextLabel}" module.` }]
      : [];
    setMessages((p) => [...p, { role: 'user', content: q }]);
    setInput('');
    setBusy(true);
    try {
      const r = await api<{ reply: string; data?: unknown; pendingAction?: PendingAction | null }>('/ai/assistant', {
        method: 'POST',
        body: JSON.stringify({ message: q, history: [...ctx, ...history] }),
      });
      setMessages((p) => [...p, { role: 'assistant', content: r.reply, data: r.data, pending: r.pendingAction ?? null }]);
    } catch (e) {
      setMessages((p) => [...p, { role: 'assistant', content: `Couldn’t reach the assistant: ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  };

  // Read a File as a base64 string (no data: prefix) for the vision endpoint.
  const readAsBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).replace(/^data:[^;]+;base64,/, ''));
    fr.onerror = () => reject(new Error('Could not read the file.'));
    fr.readAsDataURL(file);
  });

  // Attach a photo (→ vision skill) or a document (→ chat-with-documents).
  const onAttach = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true);
    try {
      if (file.type.startsWith('image/')) {
        setMessages((p) => [...p, { role: 'user', content: `📷 ${file.name}` }]);
        const b64 = await readAsBase64(file);
        const r = await api<{ content: string }>('/ai/vision/describe', {
          method: 'POST',
          body: JSON.stringify({ image: b64, prompt: 'Describe this for a business owner. If it is a product, suggest a name, category and short selling description.' }),
        });
        setMessages((p) => [...p, { role: 'assistant', content: r.content || 'I could not read that image.' }]);
      } else if (/\.(txt|md|csv|json|log|tsv|html?)$/i.test(file.name) || file.type.startsWith('text/')) {
        const text = await file.text();
        if (!text.trim()) throw new Error('That file looks empty.');
        setMessages((p) => [...p, { role: 'user', content: `📄 ${file.name}` }]);
        const doc = await api<{ title: string; chunkCount: number }>('/ai/docs', {
          method: 'POST',
          body: JSON.stringify({ title: file.name.replace(/\.[^.]+$/, ''), text, source: file.name }),
        });
        setMessages((p) => [...p, { role: 'assistant', content: `📚 Learned from “${doc.title}” (${doc.chunkCount} passage${doc.chunkCount === 1 ? '' : 's'}). Ask me anything about it.` }]);
      } else {
        setMessages((p) => [...p, { role: 'assistant', content: 'I can read photos and text files (.txt, .md, .csv). For a PDF, paste its text or export it as text and attach that.' }]);
      }
    } catch (e) {
      setMessages((p) => [...p, { role: 'assistant', content: `Attachment failed: ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  };

  // Run a briefing alert's action: either an assistant tool or a direct endpoint.
  const runAlertAction = async (a: NonNullable<BriefingAlert['action']>, idx: number) => {
    if (a.endpoint) {
      setBusy(true);
      // Drop the alert so it can't be double-run.
      setMessages((p) => p.map((m, i) => (i === idx ? { ...m, alerts: (m.alerts ?? []).filter((x) => x.action !== a) } : m)));
      try {
        const r = await api<{ ok?: boolean; message?: string }>(a.endpoint, { method: a.method ?? 'POST' });
        setMessages((p) => [...p, { role: 'assistant', content: '✅ ' + (r?.message ?? 'Done.') }]);
      } catch (e) {
        setMessages((p) => [...p, { role: 'assistant', content: `Action failed: ${(e as Error).message}` }]);
      } finally { setBusy(false); }
      return;
    }
    if (a.tool) confirmAction({ tool: a.tool, summary: a.label, args: a.args ?? {} }, idx);
  };

  const confirmAction = async (action: PendingAction, idx: number) => {
    setBusy(true);
    setMessages((p) => p.map((m, i) => (i === idx ? { ...m, pending: null } : m))); // prevent double-run
    try {
      const r = await api<{ ok: boolean; message: string }>('/ai/assistant/execute', {
        method: 'POST',
        body: JSON.stringify({ tool: action.tool, args: action.args }),
      });
      setMessages((p) => [...p, { role: 'assistant', content: (r.ok ? '✅ ' : '⚠ ') + r.message }]);
    } catch (e) {
      setMessages((p) => [...p, { role: 'assistant', content: `Action failed: ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0c0c1a] text-white/90">
      <div className="shrink-0 px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 grid place-items-center"><Sparkles className="w-4 h-4" /></div>
        <div className="flex-1"><div className="text-sm font-semibold">Ask Kobe</div><div className="text-[10px] text-white/40">{contextLabel ? `Working in ${contextLabel} · local AI` : 'Chat with your business · runs on your local AI'}</div></div>
        {TTS && (
          <button
            type="button"
            onClick={() => setVoice((v) => !v)}
            title={voice ? 'Voice mode on — Kobe speaks replies and auto-sends dictation' : 'Turn on voice mode'}
            className={`h-8 w-8 grid place-items-center rounded-lg ${voice ? 'bg-indigo-600 text-white' : 'bg-white/[0.05] border border-white/[0.08] text-white/60 hover:text-white'}`}
          >
            {voice ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : ''}`}>
            {m.role === 'assistant' && <div className="w-6 h-6 rounded-md bg-indigo-500/20 grid place-items-center shrink-0"><Sparkles className="w-3.5 h-3.5 text-indigo-300" /></div>}
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white/[0.05] border border-white/[0.06]'}`}>
              <div className="whitespace-pre-wrap leading-snug">{m.content}</div>
              {m.alerts && m.alerts.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {m.alerts.map((a, ai) => (
                    <div key={ai} className={`rounded-lg border p-2 ${a.severity === 'warning' ? 'border-amber-500/30 bg-amber-500/10' : 'border-white/10 bg-white/[0.04]'}`}>
                      <div className={`text-[11px] ${a.severity === 'warning' ? 'text-amber-200/90' : 'text-white/70'}`}>{a.severity === 'warning' ? '⚠ ' : 'ℹ '}{a.text}</div>
                      {a.action && (
                        <button
                          className="mt-1.5 text-[11px] font-bold px-3 py-1.5 rounded bg-amber-500 text-black inline-flex items-center gap-1 disabled:opacity-50"
                          disabled={busy}
                          onClick={() => runAlertAction(a.action!, i)}
                        >
                          <CheckCircle2 className="w-3 h-3" /> {a.action.label}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {m.pending && (
                <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2">
                  <div className="text-[11px] text-amber-200/90 mb-1.5">⚠ {m.pending.summary}</div>
                  <button className="text-[11px] font-bold px-3 py-1.5 rounded bg-amber-500 text-black inline-flex items-center gap-1 disabled:opacity-50"
                    disabled={busy}
                    onClick={() => m.pending && confirmAction(m.pending, i)}>
                    <CheckCircle2 className="w-3 h-3" /> Confirm
                  </button>
                </div>
              )}
              {m.role === 'assistant' && (() => {
                const rows = firstRows(m.data);
                return rows ? (
                  <button
                    onClick={() => printReport(rows, 'KobeOS Report')}
                    className="mt-2 text-[11px] font-semibold px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white/80 inline-flex items-center gap-1"
                  >
                    <Printer className="w-3 h-3" /> Print list
                  </button>
                ) : null;
              })()}
            </div>
            {m.role === 'user' && <div className="w-6 h-6 rounded-md bg-white/10 grid place-items-center shrink-0"><User className="w-3.5 h-3.5" /></div>}
          </div>
        ))}
        {!messages.some((m) => m.role === 'user') && !busy && (
          <div className="space-y-2 pt-1">
            <p className="text-xs text-white/40 mb-1">Try asking:</p>
            {suggestions.map((s) => (
              <button key={s} onClick={() => send(s)} className="block w-full text-left text-sm px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:border-indigo-500/40 hover:bg-white/[0.06] transition-colors">{s}</button>
            ))}
          </div>
        )}
        {busy && <div className="flex gap-2"><div className="w-6 h-6 rounded-md bg-indigo-500/20 grid place-items-center"><Sparkles className="w-3.5 h-3.5 text-indigo-300" /></div><div className="rounded-2xl px-3 py-2 bg-white/[0.05] border border-white/[0.06]"><Loader2 className="w-4 h-4 animate-spin text-white/50" /></div></div>}
      </div>

      <form className="shrink-0 p-3 border-t border-white/[0.06] flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.txt,.md,.csv,.json,.log,.tsv,.html,text/*"
          className="hidden"
          onChange={(e) => { onAttach(e.target.files?.[0]); e.target.value = ''; }}
        />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} title="Attach a photo or document" className="h-10 w-10 grid place-items-center rounded-lg bg-white/[0.05] border border-white/[0.08] text-white/70 hover:text-white disabled:opacity-40"><Paperclip className="w-4 h-4" /></button>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={listening ? 'Listening…' : 'Ask, or attach a photo / document…'} className="flex-1 h-10 px-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder:text-white/30 outline-none focus:border-indigo-500/50" />
        {SR && (
          <button type="button" onClick={toggleVoice} title="Speak" className={`h-10 w-10 grid place-items-center rounded-lg ${listening ? 'bg-red-600 animate-pulse text-white' : 'bg-white/[0.05] border border-white/[0.08] text-white/70 hover:text-white'}`}><Mic className="w-4 h-4" /></button>
        )}
        <button type="submit" disabled={busy || !input.trim()} className="h-10 w-10 grid place-items-center rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40"><Send className="w-4 h-4" /></button>
      </form>
    </div>
  );
}
