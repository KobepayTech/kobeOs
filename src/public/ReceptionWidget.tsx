import { useEffect, useRef, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { publicApi } from './api';

/**
 * Public web chat for a business's Kobe AI Receptionist (kobeapptz.com/reception/<slug>).
 * Embeddable on any merchant site. Talks to /api/reception-public/<slug>.
 */
interface Profile { businessName: string; greeting: string; hours: string; currency: string; menu: Array<{ id: string; name: string; price: number }> }
interface Msg { role: 'customer' | 'assistant'; text: string }

export default function ReceptionWidget({ slug }: { slug: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [customer, setCustomer] = useState({ name: '', phone: '' });
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    publicApi<Profile>(`/reception-public/${slug}`)
      .then((p) => { setProfile(p); setMsgs([{ role: 'assistant', text: p.greeting }]); })
      .catch((e) => setError((e as Error).message || 'This assistant is unavailable.'));
  }, [slug]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);

  const send = async (t: string) => {
    const body = t.trim();
    if (!body || busy) return;
    setMsgs((m) => [...m, { role: 'customer', text: body }]); setText(''); setBusy(true);
    try {
      const res = await publicApi<{ sessionId: string; reply: string }>(`/reception-public/${slug}/message`, {
        method: 'POST',
        body: JSON.stringify({ sessionId, text: body, channel: 'web', customer: (customer.name || customer.phone) ? customer : undefined }),
      });
      setSessionId(res.sessionId);
      setMsgs((m) => [...m, { role: 'assistant', text: res.reply }]);
    } catch (e) { setMsgs((m) => [...m, { role: 'assistant', text: `Sorry — ${(e as Error).message}` }]); }
    finally { setBusy(false); }
  };

  if (error) return <div className="min-h-[100dvh] grid place-items-center bg-[#0b0b16] text-rose-300 text-sm px-6 text-center">{error}</div>;
  if (!profile) return <div className="min-h-[100dvh] grid place-items-center bg-[#0b0b16]"><Loader2 className="h-6 w-6 animate-spin text-white/50" /></div>;

  return (
    <div className="min-h-[100dvh] bg-[#0b0b16] text-white flex flex-col">
      <header className="border-b border-white/10 px-4 py-3">
        <div className="font-black">{profile.businessName}</div>
        <div className="text-[11px] text-white/50">AI Receptionist{profile.hours ? ` · ${profile.hours}` : ''}</div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'customer' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-sm ${m.role === 'customer' ? 'bg-indigo-600' : 'bg-white/[0.06] border border-white/10'}`}>{m.text}</div>
          </div>
        ))}
        {busy && <div className="flex justify-start"><div className="rounded-2xl bg-white/[0.06] border border-white/10 px-3.5 py-2"><Loader2 className="h-4 w-4 animate-spin text-white/50" /></div></div>}
        <div ref={endRef} />
      </div>

      <div className="border-t border-white/10 p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} placeholder="Your name (for orders)" className="h-9 rounded-lg bg-white/[0.05] border border-white/10 px-3 text-xs outline-none" />
          <input value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} placeholder="Phone" inputMode="tel" className="h-9 rounded-lg bg-white/[0.05] border border-white/10 px-3 text-xs outline-none" />
        </div>
        <form onSubmit={(e) => { e.preventDefault(); void send(text); }} className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask a question or order…" className="flex-1 h-11 rounded-xl bg-white/[0.05] border border-white/10 px-3 text-sm outline-none focus:border-indigo-500" />
          <button type="submit" disabled={busy || !text.trim()} className="h-11 w-11 rounded-xl bg-indigo-600 grid place-items-center disabled:opacity-40"><Send className="h-4 w-4" /></button>
        </form>
      </div>
    </div>
  );
}
