import { useEffect, useState } from 'react';
import { publicApi } from './api';
import { Home, Loader2, CheckCircle2, AlertCircle, Search, Phone, MessageCircle, Wrench, Building2, ShieldCheck } from 'lucide-react';

/**
 * Public tenant portal (#11). A tenant scans the estate QR and lands here.
 *  - No token → a generic site: what the estate offers + a token prompt.
 *  - Valid token → their rent status for the period PLUS the landlord's
 *    team/technician contacts (#10) and property list.
 *
 * Talks only to the @Public /property/tokens endpoints (rate-limited).
 */

interface Portal {
  tenant: { name: string; unitLabel: string; status: string; expected: number; paid: number; remaining: number; currency: string; fullyPaid: boolean };
  staff: Array<{ name: string; role: string; phone: string }>;
  properties: Array<{ name: string; address: string }>;
  site?: { businessName?: string; tagline?: string; primaryColor?: string };
}

const ROLE_LABEL: Record<string, string> = {
  manager: 'Property manager', security: 'Guard / security', plumber: 'Plumber',
  electrician: 'Electrician', cleaning: 'Cleaner', handyman: 'Handyman',
  landscaping: 'Landscaping', hvac: 'HVAC / AC', general: 'Contact',
};

export default function PropertyPortal({ code: initialCode = '' }: { code?: string }) {
  const [code, setCode] = useState(initialCode);
  const [portal, setPortal] = useState<Portal | null>(null);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'shown'>('idle');
  const [err, setErr] = useState<string | null>(null);

  const money = (n: number, ccy = portal?.tenant.currency ?? 'TZS') => `${ccy} ${Math.round(n).toLocaleString()}`;

  const open = async (raw: string) => {
    const c = raw.trim().toUpperCase();
    setErr(null);
    if (!/^[A-Z0-9]{8}$/.test(c)) { setErr('Enter the 8-character token from your rent receipt.'); return; }
    setPhase('loading');
    try {
      const p = await publicApi<Portal>(`/property/tokens/${encodeURIComponent(c)}/portal`);
      setPortal(p);
      setPhase('shown');
    } catch (e) {
      const m = e instanceof Error ? e.message : '';
      setErr(/404/.test(m) ? 'That token was not found. Check the code on your receipt.' : 'Could not load your portal. Try again.');
      setPhase('idle');
    }
  };

  useEffect(() => {
    if (initialCode && /^[A-Z0-9]{8}$/i.test(initialCode)) void open(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wa = (phone: string) => `https://wa.me/${phone.replace(/\D/g, '').replace(/^0/, '255')}`;

  return (
    <div className="min-h-[100dvh] bg-slate-100" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Header — branded from the owner's site builder when available */}
        <div className="rounded-2xl px-5 py-4 flex items-center gap-3 text-white" style={{ backgroundColor: portal?.site?.primaryColor || '#0f172a' }}>
          <div className="w-10 h-10 rounded-xl bg-white/15 grid place-items-center font-black">
            {portal?.site?.businessName ? portal.site.businessName.charAt(0).toUpperCase() : <Home className="w-5 h-5" />}
          </div>
          <div>
            <div className="text-sm font-bold leading-none">{portal?.site?.businessName || 'Tenant Portal'}</div>
            <div className="text-[11px] text-white/70 mt-0.5">{portal?.site?.tagline || 'Rent status & property contacts'}</div>
          </div>
        </div>

        {phase !== 'shown' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <label className="block">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Your rent token</span>
              <div className="mt-1 flex gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && open(code)}
                  maxLength={8}
                  placeholder="e.g. D8487KXS"
                  className="flex-1 h-12 px-3 rounded-lg border border-slate-300 text-lg font-mono tracking-widest text-slate-900 focus:outline-none focus:border-blue-500"
                />
                <button onClick={() => open(code)} disabled={phase === 'loading'} className="px-4 h-12 rounded-lg bg-blue-600 text-white font-bold text-sm hover:bg-blue-500 disabled:opacity-50 inline-flex items-center gap-2">
                  {phase === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} View
                </button>
              </div>
            </label>
            {err && <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{err}</div>}
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-center">
              <ShieldCheck className="w-6 h-6 text-slate-400 mx-auto mb-1" />
              <p className="text-xs text-slate-600">Enter your token to see your balance and reach the property team. No token? Ask the office for your rent receipt.</p>
            </div>
          </div>
        )}

        {phase === 'shown' && portal && (
          <>
            {/* Rent status */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="text-[11px] text-slate-500 uppercase font-bold tracking-wide">Rent status</div>
              <div className="text-lg font-bold text-slate-900">{portal.tenant.name}{portal.tenant.unitLabel ? ` · Unit ${portal.tenant.unitLabel}` : ''}</div>
              <div className={`mt-3 rounded-xl p-4 ${portal.tenant.fullyPaid ? 'bg-emerald-50 border border-emerald-100' : 'bg-amber-50 border border-amber-100'}`}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-5 h-5 ${portal.tenant.fullyPaid ? 'text-emerald-600' : 'text-amber-600'}`} />
                  <span className={`font-bold ${portal.tenant.fullyPaid ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {portal.tenant.fullyPaid ? 'Paid in full' : `${money(portal.tenant.remaining)} pending`}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div><div className="text-[9px] text-slate-500 uppercase font-bold">Expected</div><div className="text-[11px] font-bold text-slate-900">{money(portal.tenant.expected)}</div></div>
                  <div><div className="text-[9px] text-slate-500 uppercase font-bold">Paid</div><div className="text-[11px] font-bold text-slate-900">{money(portal.tenant.paid)}</div></div>
                  <div><div className="text-[9px] text-slate-500 uppercase font-bold">Remaining</div><div className="text-[11px] font-bold text-amber-700">{money(portal.tenant.remaining)}</div></div>
                </div>
              </div>
              {!portal.tenant.fullyPaid && (
                <a href={`/pay/${code}`} className="mt-3 block text-center h-10 leading-10 rounded-lg bg-slate-900 text-white text-sm font-bold">Pay now</a>
              )}
            </div>

            {/* Contacts / team */}
            {portal.staff.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-3"><Wrench className="w-4 h-4 text-slate-500" /><h3 className="text-sm font-bold text-slate-900">Property team &amp; contacts</h3></div>
                <div className="space-y-2">
                  {portal.staff.map((s, i) => (
                    <div key={i} className="flex items-center justify-between border-b border-slate-100 last:border-0 pb-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate">{s.name}</div>
                        <div className="text-[11px] text-blue-600">{ROLE_LABEL[s.role] ?? s.role}</div>
                      </div>
                      {s.phone && (
                        <div className="flex gap-1.5 shrink-0">
                          <a href={`tel:${s.phone}`} className="w-8 h-8 rounded-lg border border-slate-200 grid place-items-center text-slate-600 hover:bg-slate-50"><Phone className="w-4 h-4" /></a>
                          <a href={wa(s.phone)} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg bg-emerald-600 grid place-items-center text-white"><MessageCircle className="w-4 h-4" /></a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Properties */}
            {portal.properties.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-3"><Building2 className="w-4 h-4 text-slate-500" /><h3 className="text-sm font-bold text-slate-900">Properties</h3></div>
                <ul className="space-y-1.5">
                  {portal.properties.map((p, i) => (
                    <li key={i} className="text-sm text-slate-800 border-b border-slate-100 last:border-0 pb-1.5">{p.name}<span className="text-slate-400"> · {p.address || '—'}</span></li>
                  ))}
                </ul>
              </div>
            )}

            <button onClick={() => { setPhase('idle'); setPortal(null); setCode(''); }} className="w-full h-10 rounded-lg border border-slate-300 text-slate-600 text-sm font-semibold bg-white">Use another token</button>
          </>
        )}
      </div>
    </div>
  );
}
