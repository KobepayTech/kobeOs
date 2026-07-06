import { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';
import { Sparkles, Send, Loader2, User, CheckCircle2 } from 'lucide-react';

interface PendingAction { tool: string; summary: string; args: Record<string, unknown> }
interface Msg { role: 'user' | 'assistant'; content: string; data?: unknown; pending?: PendingAction | null }

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
  'property': ['How many tenants haven’t paid rent?', 'Project my rent income', 'Message all tenants who owe rent', 'Add a new tenant'],
  'kobe-hotel': ['What’s my hotel occupancy right now?', 'This month’s hotel revenue and profit', 'Set a room to maintenance'],
  'erp-warehouse': ['Show me low-stock warehouse items', 'What’s my total stock value?', 'Set stock for an item'],
  'erp-warehouse-ops': ['Show me low-stock warehouse items', 'What’s my total stock value?'],
  'cargo': ['How many parcels are in transit?', 'How many parcels were delivered?'],
  'erp-shop': ['Which items do customers like most?', 'Show me low-stock products', 'Write a promo for a jersey sale'],
  'erp-store-editor': ['Which items do customers like most?', 'Write a promo for a sale'],
  'kobe-pay': ['What are today’s sales?', 'How much did I spend this month?'],
  'erp-dashboard': ['What are today’s sales?', 'How much did I spend this month?', 'How many tenants haven’t paid rent?'],
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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, busy]);

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
        <div><div className="text-sm font-semibold">Ask Kobe</div><div className="text-[10px] text-white/40">{contextLabel ? `Working in ${contextLabel} · local AI` : 'Chat with your business · runs on your local AI'}</div></div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-white/40 mb-2">Try asking:</p>
            {suggestions.map((s) => (
              <button key={s} onClick={() => send(s)} className="block w-full text-left text-sm px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:border-indigo-500/40 hover:bg-white/[0.06] transition-colors">{s}</button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : ''}`}>
            {m.role === 'assistant' && <div className="w-6 h-6 rounded-md bg-indigo-500/20 grid place-items-center shrink-0"><Sparkles className="w-3.5 h-3.5 text-indigo-300" /></div>}
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white/[0.05] border border-white/[0.06]'}`}>
              <div className="whitespace-pre-wrap leading-snug">{m.content}</div>
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
            </div>
            {m.role === 'user' && <div className="w-6 h-6 rounded-md bg-white/10 grid place-items-center shrink-0"><User className="w-3.5 h-3.5" /></div>}
          </div>
        ))}
        {busy && <div className="flex gap-2"><div className="w-6 h-6 rounded-md bg-indigo-500/20 grid place-items-center"><Sparkles className="w-3.5 h-3.5 text-indigo-300" /></div><div className="rounded-2xl px-3 py-2 bg-white/[0.05] border border-white/[0.06]"><Loader2 className="w-4 h-4 animate-spin text-white/50" /></div></div>}
      </div>

      <form className="shrink-0 p-3 border-t border-white/[0.06] flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about sales, tenants, stock…" className="flex-1 h-10 px-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder:text-white/30 outline-none focus:border-indigo-500/50" />
        <button type="submit" disabled={busy || !input.trim()} className="h-10 w-10 grid place-items-center rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40"><Send className="w-4 h-4" /></button>
      </form>
    </div>
  );
}
