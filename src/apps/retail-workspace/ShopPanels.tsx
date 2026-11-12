import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';

export function retailApi<T>(path: string, slug: string, options?: RequestInit) {
  return api<T>(`/retail-workspace${path}${slug ? `?slug=${encodeURIComponent(slug)}` : ''}`, {
    ...options, offlineFallback: false, cache: 'no-store',
  });
}
export const field = 'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950';
export const action = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50';
export const tile = 'rounded-xl border border-slate-200 bg-white p-4 sm:p-5';
const money = (amount: string | number, currency: string) =>
  `${currency} ${Number(amount).toLocaleString('en-TZ', { maximumFractionDigits: 2 })}`;
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Unable to reach KobeOS Cloud.';
const cell = 'px-3 py-2.5 text-left';

interface StockRow {
  id: string;
  sku: string;
  name: string;
  price: number | string;
  currency: string;
  stock: number;
}
interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  fulfillmentStatus: string;
  total: number | string;
  currency: string;
  salesChannel: string;
}
interface TeamMember {
  id: string;
  email: string;
  displayName: string;
  role: string;
  canFulfill: boolean;
}
interface DiscountRow {
  id: string;
  productName: string;
  sellerName: string;
  quantity: number;
  requestedPrice: number | string;
  approvedPrice: number | string | null;
  unitCost?: number | string;
  currency: string;
  status: string;
  reason: string;
  expiresAt?: string;
}

function useRows<T>(path: string, slug: string) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [error, setError] = useState('');
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await retailApi<T[]>(path, slug, { signal });
      if (signal?.aborted) return;
      setRows(data);
      setError('');
    } catch (reason) {
      if (signal?.aborted) return;
      setRows(null);
      setError(errorMessage(reason));
    }
  }, [path, slug]);
  useEffect(() => {
    const request = new AbortController();
    void refresh(request.signal);
    return () => request.abort();
  }, [refresh]);
  return { rows, error, refresh };
}

function Status({ error, loading, empty }: { error: string; loading: boolean; empty: string }) {
  return <p role={error ? 'alert' : 'status'} className={`p-4 text-sm ${error ? 'text-rose-700' : 'text-slate-600'}`}>
    {error || (loading ? 'Loading shop data…' : empty)}
  </p>;
}

export function RetailStock({ slug }: { slug: string }) {
  const { rows, error } = useRows<StockRow>('/stock', slug);
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const matches = rows?.filter(row => `${row.sku} ${row.name}`.toLowerCase().includes(query));
  return <section className={tile}>
    <label className="mb-3 block max-w-sm text-sm font-semibold">Find a product
      <input className={`${field} mt-1`} type="search" placeholder="Search SKU or product name" value={search} onChange={event => setSearch(event.target.value)} />
    </label>
    {matches?.length ? <div className="overflow-x-auto"><table className="w-full min-w-[390px] text-sm">
      <thead className="bg-slate-50 text-slate-600"><tr>{['Product', 'SKU', 'Available', 'Price'].map(label => <th key={label} scope="col" className={cell}>{label}</th>)}</tr></thead>
      <tbody className="divide-y divide-slate-100">{matches.map(row => <tr key={row.id}>
        <td className={cell}>{row.name}</td><td className={cell}>{row.sku}</td>
        <td className={`${cell} ${row.stock <= 5 ? 'font-semibold text-amber-800' : ''}`}>{row.stock}</td>
        <td className={cell}>{money(row.price, row.currency)}</td>
      </tr>)}</tbody>
    </table></div> : <Status error={error} loading={!rows} empty="No matching products." />}
  </section>;
}

export function RetailOrders({ slug, canPrepare = false }: { slug: string; canPrepare?: boolean }) {
  const { rows, error, refresh } = useRows<OrderRow>('/orders', slug);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const prepare = async (id: string) => {
    setBusy(id);
    setMessage('');
    try { await retailApi(`/orders/${id}/prepare`, slug, { method: 'POST' }); await refresh(); }
    catch (reason) { setMessage(errorMessage(reason)); }
    finally { setBusy(''); }
  };
  return <section className={tile}>
    {message && <p className="mb-3 text-sm text-rose-700" role="alert">{message}</p>}
    <div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-bold">Recent orders</h2>
      <button className="text-sm font-semibold text-indigo-700" onClick={() => void refresh()}>Refresh</button>
    </div>
    {rows?.length ? <div className="overflow-x-auto"><table className="w-full min-w-[540px] text-sm">
      <thead className="bg-slate-50 text-slate-600"><tr>{['Order', 'Channel', 'Total', 'Sale status', 'Fulfillment', ...(canPrepare ? ['Action'] : [])].map(label => <th key={label} scope="col" className={cell}>{label}</th>)}</tr></thead>
      <tbody className="divide-y divide-slate-100">{rows.map(row => <tr key={row.id}>
        <td className={cell}>{row.orderNumber}</td><td className={cell}>{row.salesChannel}</td><td className={cell}>{money(row.total, row.currency)}</td>
        <td className={cell}>{row.status}</td><td className={cell}>{row.fulfillmentStatus}</td>
        {canPrepare && <td className={cell}>{row.status === 'COMPLETED' && row.fulfillmentStatus === 'NEW' && <button className="whitespace-nowrap font-semibold text-indigo-700 disabled:opacity-50" disabled={!!busy} onClick={() => void prepare(row.id)}>Start preparing</button>}</td>}
      </tr>)}</tbody>
    </table></div> : <Status error={error} loading={!rows} empty="No shop orders yet." />}
  </section>;
}

export function RetailTeam({ slug }: { slug: string }) {
  const { rows, error, refresh } = useRows<TeamMember>('/team', slug);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const update = async (path: string, options: RequestInit) => {
    setSaving(true);
    setMessage('');
    try { await retailApi(path, slug, options); await refresh(); }
    catch (reason) { setMessage(errorMessage(reason)); }
    finally { setSaving(false); }
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void update('/team', { method: 'POST', body: JSON.stringify({ email: data.get('email'), role: data.get('role'), canFulfill: data.has('canFulfill') }) });
  };
  return <div className="space-y-4">
    <form className={`${tile} space-y-3`} onSubmit={submit}>
      <h2 className="font-bold">Grant shop access</h2>
      <p className="text-sm text-slate-600">Use an existing KobeOS account. Shop staff can view stock and orders, request discounts and record cash received for their approved requests. Managers can fulfill orders. Enable fulfillment below for staff who prepare or hand over orders.</p>
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
        <label className="text-sm font-semibold">KobeOS email<input className={field} type="email" name="email" required maxLength={254} /></label>
        <label className="text-sm font-semibold">Shop role<select className={field} name="role"><option value="staff">Staff</option><option value="manager">Manager</option></select></label>
        <button className={action} disabled={saving}>Save access</button>
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="canFulfill" /> Allow order fulfillment</label>
    </form>
    <section className={tile}><h2 className="font-bold">Shop team</h2>
      {message && <p className="mt-2 text-sm text-rose-700" role="alert">{message}</p>}
      {rows?.length ? <ul className="divide-y divide-slate-100">{rows.map(row => <li className="flex flex-wrap items-center gap-3 py-3 text-sm" key={row.id}>
        <div className="mr-auto"><div className="font-semibold">{row.displayName || row.email}</div><div className="text-xs text-slate-600">{row.email}</div></div>
        <span className="capitalize">{row.role}{row.canFulfill && row.role === 'staff' ? ' · Fulfillment' : ''}</span>
        <button className="font-semibold text-rose-700 disabled:opacity-50" disabled={saving} onClick={() => {
          if (window.confirm(`Revoke shop access for ${row.email}?`)) void update(`/team/${row.id}`, { method: 'DELETE' });
        }}>Revoke</button>
      </li>)}</ul> : <Status error={error} loading={!rows} empty="No team members added." />}
    </section>
  </div>;
}

export function RetailDiscounts({ slug, owner }: { slug: string; owner: boolean }) {
  const { rows, error, refresh } = useRows<DiscountRow>('/discounts', slug);
  const [products, setProducts] = useState<StockRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (owner) return;
    const request = new AbortController();
    retailApi<StockRow[]>('/stock', slug, { signal: request.signal }).then(setProducts).catch(reason => {
      if (!request.signal.aborted) setMessage(errorMessage(reason));
    });
    return () => request.abort();
  }, [owner, slug]);
  useEffect(() => {
    const request = new AbortController();
    const timer = window.setInterval(() => void refresh(request.signal), 15_000);
    return () => { request.abort(); window.clearInterval(timer); };
  }, [refresh]);
  const update = async (path: string, data: Record<string, unknown>, success: string) => {
    setBusy(true);
    setMessage('');
    try {
      await retailApi(path, slug, { method: 'POST', body: JSON.stringify(data) });
      setMessage(success);
      await refresh();
      return true;
    } catch (reason) {
      setMessage(errorMessage(reason));
      return false;
    } finally { setBusy(false); }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (await update('/discounts', { productId: data.get('product'), quantity: Number(data.get('quantity')), requestedPrice: Number(data.get('price')), reason: data.get('reason') }, 'Request sent to the shop owner.')) form.reset();
  };
  return <div className="space-y-4">
    {!owner && <form className={`${tile} space-y-3`} onSubmit={submit}>
      <h2 className="font-bold">Request a discount</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">Product<select className={field} name="product" required defaultValue="">
          <option value="" disabled>Choose in-stock product</option>
          {products.filter(product => product.stock > 0).map(product => <option key={product.id} value={product.id}>{product.name} · {money(product.price, product.currency)}</option>)}
        </select></label>
        <label className="text-sm font-semibold">Quantity<input className={field} name="quantity" type="number" min={1} max={10000} defaultValue={1} required /></label>
        <label className="text-sm font-semibold">Requested unit price<input className={field} name="price" type="number" min="0.0001" step="0.0001" required /></label>
        <label className="text-sm font-semibold">Reason<input className={field} name="reason" maxLength={500} /></label>
      </div>
      <button className={action} disabled={busy}>Send to owner</button>
    </form>}
    <section className={tile}>
      <div className="mb-2 flex items-center justify-between"><h2 className="font-bold">{owner ? 'Shop requests' : 'My requests'}</h2>
        <button className="text-sm font-semibold text-indigo-700" onClick={() => void refresh()}>Refresh</button>
      </div>
      {message && <p className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-950" role="status">{message}</p>}
      {rows?.length ? <ul className="divide-y divide-slate-100">{rows.map(row => {
        const expired = !!row.expiresAt && Date.parse(row.expiresAt) <= Date.now();
        const approvedTotal = money(Number(row.approvedPrice) * row.quantity, row.currency);
        return <li key={row.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
          <div className="mr-auto">
            <p className="font-bold">{row.productName} × {row.quantity}</p>
            <p className="text-slate-600">{money(row.requestedPrice, row.currency)} each{row.sellerName && owner ? ` · ${row.sellerName}` : ''}</p>
            {owner && row.unitCost != null && <p className="text-xs text-slate-600">Gross margin value per unit {money(Number(row.requestedPrice) - Number(row.unitCost), row.currency)}</p>}
            {row.reason && <p className="text-xs text-slate-600">{row.reason}</p>}
          </div>
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold">{row.status}</span>
          {owner && row.status === 'PENDING' && !expired && <>
            <button className={action} disabled={busy} onClick={() => void update(`/discounts/${row.id}/approve`, {}, 'Price approved. The cashier can record the sale.')}>Approve price</button>
            <button className="text-sm font-semibold text-rose-700" disabled={busy} onClick={() => void update(`/discounts/${row.id}/reject`, {}, 'Request rejected.')}>Reject</button>
          </>}
          {!owner && row.status === 'APPROVED' && !expired && <button className={action} disabled={busy} onClick={() => {
            if (window.confirm(`Confirm you received ${approvedTotal} in cash for this sale.`)) {
              void update(`/discounts/${row.id}/cash-sale`, {}, 'Cash sale recorded.');
            }
          }}>Record {approvedTotal} cash</button>}
        </li>;
      })}</ul> : <Status error={error} loading={!rows} empty="No discount requests yet." />}
    </section>
  </div>;
}
