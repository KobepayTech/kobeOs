import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, RefreshCw, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import { api, apiArray } from '@/lib/api';

interface DiscountRequest {
  id: string;
  productName?: string | null;
  sellerName?: string | null;
  customerName?: string | null;
  quantity: number;
  standardPrice: number | string;
  unitCost: number | string;
  requestedPrice: number | string;
  currency: string;
  reason?: string | null;
  photoUrl?: string | null;
  status: 'PENDING' | 'COUNTERED';
  expiresAt?: string | null;
}

const money = (value: number, currency = 'TZS') =>
  `${currency} ${Math.round(value).toLocaleString()}`;

export default function MobileDiscountApprovals() {
  const [requests, setRequests] = useState<DiscountRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState('');
  const [counterId, setCounterId] = useState('');
  const [counterPrice, setCounterPrice] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await api<unknown>('/discounts/requests/pending', {
        offlineFallback: false,
      });
      setRequests(apiArray<DiscountRequest>(response, ['requests']));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load discount requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const pendingValue = useMemo(
    () => requests.reduce((sum, request) =>
      sum + (Number(request.standardPrice) - Number(request.requestedPrice)) * Number(request.quantity), 0),
    [requests],
  );

  const act = async (
    request: DiscountRequest,
    action: 'approve' | 'counter' | 'reject',
    value?: number,
  ) => {
    setActingId(request.id);
    setError('');
    setNotice('');
    try {
      const body = action === 'approve'
        ? { approvedPrice: value ?? Number(request.requestedPrice) }
        : action === 'counter'
          ? { counterPrice: value }
          : { note: 'Rejected from KobeOS mobile approvals' };
      await api(`/discounts/requests/${encodeURIComponent(request.id)}/${action}`, {
        method: 'POST',
        body: JSON.stringify(body),
        offlineFallback: false,
      });
      setNotice(
        action === 'approve'
          ? `${request.productName || 'Discount'} approved.`
          : action === 'counter'
            ? 'Counter price sent to the seller.'
            : 'Discount request rejected.',
      );
      setCounterId('');
      setCounterPrice('');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update the request.');
    } finally {
      setActingId('');
    }
  };

  return (
    <div className="space-y-4 p-4 pb-24">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold text-slate-900">Discount approvals</h2>
          <p className="text-[11px] text-slate-500">
            {requests.length} waiting · {money(pendingValue)} requested savings
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600"
          aria-label="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {notice && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">{notice}</p>}
      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}

      {loading ? (
        <div className="grid h-52 place-items-center text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <Check className="mx-auto h-8 w-8 text-emerald-500" />
          <p className="mt-2 text-sm font-extrabold text-slate-800">All caught up</p>
          <p className="text-xs text-slate-400">New cashier requests appear here automatically.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => {
            const standard = Number(request.standardPrice);
            const requested = Number(request.requestedPrice);
            const cost = Number(request.unitCost);
            const discountPct = standard > 0 ? ((standard - requested) / standard) * 100 : 0;
            const marginPct = requested > 0 ? ((requested - cost) / requested) * 100 : 0;
            const acting = actingId === request.id;
            return (
              <article key={request.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex gap-3 p-4">
                  {request.photoUrl ? (
                    <img src={request.photoUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl bg-slate-100 object-cover" />
                  ) : (
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-slate-100 text-[10px] font-black text-slate-400">
                      {request.quantity}×
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-extrabold text-slate-900">{request.productName || 'Product discount'}</h3>
                    <p className="text-[10px] text-slate-500">
                      {request.sellerName || 'Cashier'}{request.customerName ? ` · ${request.customerName}` : ''}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-extrabold text-rose-700">
                        {discountPct.toFixed(1)}% off
                      </span>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-extrabold ${
                        marginPct >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {marginPct.toFixed(1)}% margin
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 border-y border-slate-100 bg-slate-50 text-center">
                  <div className="p-2">
                    <p className="text-[9px] uppercase font-bold text-slate-400">Standard</p>
                    <p className="text-xs font-extrabold text-slate-700">{money(standard, request.currency)}</p>
                  </div>
                  <div className="border-l border-slate-200 p-2">
                    <p className="text-[9px] uppercase font-bold text-slate-400">Requested</p>
                    <p className="text-xs font-extrabold text-indigo-700">{money(requested, request.currency)}</p>
                  </div>
                </div>

                {request.reason && <p className="px-4 pt-3 text-[11px] italic text-slate-500">“{request.reason}”</p>}

                {counterId === request.id ? (
                  <div className="space-y-2 p-3">
                    <label className="block text-[10px] font-bold uppercase text-slate-500">
                      Counter unit price
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max={standard}
                        value={counterPrice}
                        onChange={(event) => setCounterPrice(event.target.value)}
                        className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-base font-bold"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setCounterId('')} className="h-10 rounded-xl border border-slate-200 text-xs font-bold text-slate-600">Cancel</button>
                      <button
                        onClick={() => void act(request, 'counter', Number(counterPrice))}
                        disabled={!Number.isFinite(Number(counterPrice)) || Number(counterPrice) <= 0 || acting}
                        className="h-10 rounded-xl bg-amber-500 text-xs font-extrabold text-white disabled:opacity-40"
                      >
                        Send counter
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 p-3">
                    <button
                      onClick={() => void act(request, 'reject')}
                      disabled={acting}
                      className="inline-flex h-10 items-center justify-center gap-1 rounded-xl bg-rose-50 text-xs font-extrabold text-rose-700 disabled:opacity-40"
                    >
                      <X className="h-3.5 w-3.5" /> Reject
                    </button>
                    <button
                      onClick={() => { setCounterId(request.id); setCounterPrice(String(request.requestedPrice)); }}
                      disabled={acting}
                      className="inline-flex h-10 items-center justify-center gap-1 rounded-xl bg-amber-50 text-xs font-extrabold text-amber-700 disabled:opacity-40"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" /> Counter
                    </button>
                    <button
                      onClick={() => void act(request, 'approve')}
                      disabled={acting}
                      className="inline-flex h-10 items-center justify-center gap-1 rounded-xl bg-emerald-600 text-xs font-extrabold text-white disabled:opacity-40"
                    >
                      {acting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Approve
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
