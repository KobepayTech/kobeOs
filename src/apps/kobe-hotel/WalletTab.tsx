import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  Wallet, ArrowDownToLine, ArrowUpFromLine, Loader2, Clock, CheckCircle2, XCircle,
  TrendingUp, Percent, Send, Building2, Smartphone, Banknote,
} from 'lucide-react';

/**
 * Hotel Wallet — the central-platform settlement view. Guests pay for rooms
 * through the shared merchant; the money is credited here (net of platform
 * commission) as each booking is confirmed. The hotel sees its balance,
 * full ledger, and can request a payout to its own mobile-money/bank.
 */
interface WalletRow {
  balance: number | string; currency: string;
  totalEarned: number | string; totalCommission: number | string; totalPaidOut: number | string;
  commissionRatePct?: number | null;
}
interface Txn {
  id: string; type: 'CREDIT' | 'COMMISSION' | 'PAYOUT' | 'REVERSAL';
  amount: number | string; direction: 'credit' | 'debit'; currency: string;
  balanceAfter: number | string; description: string; createdAt: string;
}
interface Payout {
  id: string; amount: number | string; currency: string; method: string; destination: string;
  status: 'PENDING' | 'PAID' | 'FAILED'; reference: string; createdAt: string; processedAt?: string | null;
}
interface Summary { wallet: WalletRow; recentTxns: Txn[]; pendingPayouts: Payout[]; defaultCommissionPct: number }

const money = (n: number | string, c = 'TZS') => `${c === 'TZS' ? 'TSh ' : c === 'CNY' ? '¥' : `${c} `}${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function WalletTab({ darkMode = true }: { darkMode?: boolean }) {
  const [sum, setSum] = useState<Summary | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'MobileMoney' | 'Bank' | 'Cash'>('MobileMoney');
  const [destination, setDestination] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const card = darkMode ? 'bg-[#12122a] border-white/10' : 'bg-white border-gray-200';
  const sub = darkMode ? 'text-white/50' : 'text-gray-500';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        api<Summary>('/hotel/wallet'),
        api<Payout[]>('/hotel/wallet/payouts').catch(() => [] as Payout[]),
      ]);
      setSum(s); setPayouts(Array.isArray(p) ? p : []);
    } catch { /* offline */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const requestPayout = async () => {
    setError(null);
    const amt = Number(amount);
    if (!amt || amt <= 0) { setError('Enter an amount.'); return; }
    setBusy(true);
    try {
      await api('/hotel/wallet/payouts', { method: 'POST', body: JSON.stringify({ amount: amt, method, destination }) });
      setToast('Payout requested'); setTimeout(() => setToast(null), 3000);
      setAmount(''); setDestination('');
      await load();
    } catch (e) { setError((e as Error).message || 'Payout failed'); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="grid place-items-center h-full"><Loader2 className="w-6 h-6 animate-spin text-white/40" /></div>;
  const w = sum?.wallet;
  const cur = w?.currency ?? 'TZS';
  const commissionPct = w?.commissionRatePct ?? sum?.defaultCommissionPct ?? 0;

  return (
    <div className="p-4 space-y-4 overflow-auto h-full">
      <div className="flex items-center gap-2">
        <Wallet className="w-5 h-5 text-emerald-400" />
        <h2 className="text-lg font-bold">Wallet & Payouts</h2>
      </div>

      {/* Balance + stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={`rounded-xl border p-4 ${card} col-span-2 lg:col-span-1`}>
          <div className={`text-[11px] uppercase tracking-wide ${sub}`}>Available balance</div>
          <div className="text-2xl font-extrabold text-emerald-400 mt-1">{money(w?.balance ?? 0, cur)}</div>
        </div>
        <Stat card={card} sub={sub} Icon={TrendingUp} label="Total earned" value={money(w?.totalEarned ?? 0, cur)} />
        <Stat card={card} sub={sub} Icon={Percent} label={`Commission (${commissionPct}%)`} value={money(w?.totalCommission ?? 0, cur)} />
        <Stat card={card} sub={sub} Icon={ArrowUpFromLine} label="Paid out" value={money(w?.totalPaidOut ?? 0, cur)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Request payout */}
        <div className={`rounded-xl border p-4 ${card} space-y-3`}>
          <div className="font-bold flex items-center gap-2"><Send className="w-4 h-4 text-emerald-400" /> Request payout</div>
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal"
            placeholder={`Amount (max ${money(w?.balance ?? 0, cur)})`} className={`w-full h-10 px-3 rounded-lg border text-sm ${darkMode ? 'bg-black/30 border-white/10' : 'bg-gray-50 border-gray-200'}`} />
          <div className="grid grid-cols-3 gap-2">
            {([['MobileMoney', Smartphone], ['Bank', Building2], ['Cash', Banknote]] as const).map(([m, Icon]) => (
              <button key={m} onClick={() => setMethod(m)} className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-[11px] font-semibold ${method === m ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300' : darkMode ? 'border-white/10 text-white/60' : 'border-gray-200 text-gray-500'}`}>
                <Icon className="w-4 h-4" /> {m === 'MobileMoney' ? 'Mobile' : m}
              </button>
            ))}
          </div>
          <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder={method === 'Bank' ? 'Account number' : 'Phone number'} className={`w-full h-10 px-3 rounded-lg border text-sm ${darkMode ? 'bg-black/30 border-white/10' : 'bg-gray-50 border-gray-200'}`} />
          {error && <div className="text-xs text-rose-400">{error}</div>}
          {toast && <div className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {toast}</div>}
          <button onClick={requestPayout} disabled={busy} className="w-full h-11 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpFromLine className="w-4 h-4" />} Request payout
          </button>
          <p className={`text-[11px] ${sub}`}>Funds are reserved immediately. The platform marks it Paid once disbursed to your account.</p>
        </div>

        {/* Ledger */}
        <div className={`rounded-xl border p-4 ${card} lg:col-span-2`}>
          <div className="font-bold mb-2">Recent activity</div>
          {(sum?.recentTxns.length ?? 0) === 0 ? (
            <div className={`text-sm ${sub} py-8 text-center`}>No wallet activity yet. Balances appear here as guests pay for rooms online.</div>
          ) : (
            <div className="divide-y divide-white/5 max-h-[320px] overflow-auto">
              {sum!.recentTxns.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    {t.direction === 'credit' ? <ArrowDownToLine className="w-4 h-4 text-emerald-400 shrink-0" /> : <ArrowUpFromLine className="w-4 h-4 text-rose-400 shrink-0" />}
                    <div className="min-w-0">
                      <div className="truncate">{t.description}</div>
                      <div className={`text-[10px] ${sub}`}>{new Date(t.createdAt).toLocaleString()} · {t.type}</div>
                    </div>
                  </div>
                  <div className={`font-bold shrink-0 pl-2 ${t.direction === 'credit' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {t.direction === 'credit' ? '+' : '−'}{money(t.amount, t.currency)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Payout history */}
      <div className={`rounded-xl border p-4 ${card}`}>
        <div className="font-bold mb-2">Payouts</div>
        {payouts.length === 0 ? (
          <div className={`text-sm ${sub} py-6 text-center`}>No payouts yet.</div>
        ) : (
          <div className="space-y-2">
            {payouts.map((p) => (
              <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg border ${darkMode ? 'border-white/10' : 'border-gray-200'}`}>
                <div>
                  <div className="font-bold">{money(p.amount, p.currency)}</div>
                  <div className={`text-[11px] ${sub}`}>{p.method}{p.destination ? ` · ${p.destination}` : ''} · {new Date(p.createdAt).toLocaleDateString()}</div>
                </div>
                <StatusBadge status={p.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ card, sub, Icon, label, value }: { card: string; sub: string; Icon: typeof TrendingUp; label: string; value: string }) {
  return (
    <div className={`rounded-xl border p-4 ${card}`}>
      <div className={`text-[11px] uppercase tracking-wide flex items-center gap-1 ${sub}`}><Icon className="w-3 h-3" /> {label}</div>
      <div className="text-lg font-bold mt-1">{value}</div>
    </div>
  );
}
function StatusBadge({ status }: { status: 'PENDING' | 'PAID' | 'FAILED' }) {
  const map = {
    PENDING: { c: 'bg-amber-500/15 text-amber-400', Icon: Clock },
    PAID: { c: 'bg-emerald-500/15 text-emerald-400', Icon: CheckCircle2 },
    FAILED: { c: 'bg-rose-500/15 text-rose-400', Icon: XCircle },
  }[status];
  const Icon = map.Icon;
  return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${map.c}`}><Icon className="w-3 h-3" /> {status}</span>;
}
