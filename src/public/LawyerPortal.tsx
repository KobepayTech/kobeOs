import { useEffect, useState } from 'react';
import { publicApi } from './api';
import { Scale, Loader2, Search, AlertCircle, Printer } from 'lucide-react';

/**
 * Public lawyer/contract portal (#8). A landlord shares a token with their
 * lawyer, who enters it here to pull the tenant + property + rent terms in
 * real time, then drafts and prints a tenancy agreement. Same access model as
 * the bank page (@Public, rate-limited token endpoints).
 */

interface Contract {
  tenant: { name: string; phone: string; leaseStart: string | null; leaseEnd: string | null };
  unit: { label: string; rent: number };
  property: { name: string; address: string };
  annualRent: number;
  currency: string;
}

const fmtMoney = (n: number, ccy = 'TZS') => `${ccy} ${Math.round(n).toLocaleString()}`;
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB') : '________________');

export default function LawyerPortal({ code: initialCode = '' }: { code?: string }) {
  const [code, setCode] = useState(initialCode);
  const [data, setData] = useState<Contract | null>(null);
  const [landlord, setLandlord] = useState('');
  const [phase, setPhase] = useState<'idle' | 'loading' | 'draft'>('idle');
  const [err, setErr] = useState<string | null>(null);

  const load = async (raw: string) => {
    const c = raw.trim().toUpperCase();
    setErr(null);
    if (!/^[A-Z0-9]{8}$/.test(c)) { setErr('Enter the 8-character tenant token.'); return; }
    setPhase('loading');
    try {
      const d = await publicApi<Contract>(`/property/tokens/${encodeURIComponent(c)}/contract`);
      setData(d);
      setPhase('draft');
    } catch (e) {
      const m = e instanceof Error ? e.message : '';
      setErr(/404/.test(m) ? 'Token not found.' : 'Could not load contract data. Try again.');
      setPhase('idle');
    }
  };

  useEffect(() => {
    if (initialCode && /^[A-Z0-9]{8}$/i.test(initialCode)) void load(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-[100dvh] bg-slate-100" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="bg-slate-900 text-white rounded-2xl px-5 py-4 flex items-center gap-3 print:hidden">
          <div className="w-10 h-10 rounded-xl bg-white/10 grid place-items-center"><Scale className="w-5 h-5" /></div>
          <div>
            <div className="text-sm font-bold leading-none">Contract Portal</div>
            <div className="text-[11px] text-slate-300 mt-0.5">Draft &amp; print tenancy agreements</div>
          </div>
        </div>

        {phase !== 'draft' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 print:hidden">
            <label className="block">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Tenant token</span>
              <div className="mt-1 flex gap-2">
                <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && load(code)}
                  maxLength={8} placeholder="e.g. D8487KXS"
                  className="flex-1 h-12 px-3 rounded-lg border border-slate-300 text-lg font-mono tracking-widest text-slate-900 focus:outline-none focus:border-blue-500" />
                <button onClick={() => load(code)} disabled={phase === 'loading'} className="px-4 h-12 rounded-lg bg-blue-600 text-white font-bold text-sm hover:bg-blue-500 disabled:opacity-50 inline-flex items-center gap-2">
                  {phase === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Load
                </button>
              </div>
            </label>
            {err && <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{err}</div>}
          </div>
        )}

        {phase === 'draft' && data && (
          <>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center gap-3 print:hidden">
              <label className="flex-1 min-w-[180px]">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Landlord name (for the agreement)</span>
                <input value={landlord} onChange={(e) => setLandlord(e.target.value)} placeholder="Full landlord name"
                  className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500" />
              </label>
              <button onClick={() => window.print()} className="h-10 px-4 rounded-lg bg-slate-900 text-white text-sm font-bold inline-flex items-center gap-2 self-end"><Printer className="w-4 h-4" /> Print</button>
              <button onClick={() => { setPhase('idle'); setData(null); setCode(''); }} className="h-10 px-4 rounded-lg border border-slate-300 text-slate-600 text-sm font-semibold self-end">New</button>
            </div>

            {/* Printable agreement */}
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-[13px] leading-relaxed text-slate-800 print:border-0 print:shadow-none">
              <h1 className="text-center text-lg font-bold uppercase tracking-wide mb-1">Tenancy Agreement</h1>
              <p className="text-center text-slate-500 text-xs mb-6">Draft — review before execution</p>

              <p className="mb-4">
                THIS AGREEMENT is made between <strong>{landlord || '________________'}</strong> (“the Landlord”)
                and <strong>{data.tenant.name || '________________'}</strong> (“the Tenant”), phone {data.tenant.phone || '____________'}.
              </p>

              <ol className="list-decimal pl-5 space-y-2">
                <li><strong>Premises.</strong> {data.property.name || 'The property'}{data.property.address ? `, ${data.property.address}` : ''}, Unit <strong>{data.unit.label || '____'}</strong>.</li>
                <li><strong>Term.</strong> From <strong>{fmtDate(data.tenant.leaseStart)}</strong> to <strong>{fmtDate(data.tenant.leaseEnd)}</strong>.</li>
                <li><strong>Rent.</strong> The Tenant shall pay <strong>{fmtMoney(data.unit.rent, data.currency)}</strong> per month
                  (annual: <strong>{fmtMoney(data.annualRent, data.currency)}</strong>), payable via the KobeOS rent token issued for each period.</li>
                <li><strong>Deposit.</strong> A security deposit of ________________ is payable on signing.</li>
                <li><strong>Use.</strong> The premises shall be used for residential purposes only unless otherwise agreed in writing.</li>
                <li><strong>Maintenance.</strong> The Tenant shall keep the premises in good condition and report faults to the property manager.</li>
                <li><strong>Termination.</strong> Either party may terminate on one (1) month written notice, subject to the term above.</li>
              </ol>

              <div className="grid grid-cols-2 gap-8 mt-10">
                <div><div className="border-t border-slate-400 pt-1">Landlord signature</div><div className="text-xs text-slate-500 mt-6">Date: ____________</div></div>
                <div><div className="border-t border-slate-400 pt-1">Tenant signature</div><div className="text-xs text-slate-500 mt-6">Date: ____________</div></div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
