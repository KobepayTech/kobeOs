import { useState } from 'react';
import { api } from '@/lib/api';
type Issue = { id: string; name: string; photoRepair: { unresolved: string[] } };
export default function PhotoRepairReport() {
  const [items, setItems] = useState<Issue[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true);
    try { setItems(await api<Issue[]>('/pos/products/photo-issues', { offlineFallback: false })); setMessage('Saved results from catalog checks. Replace missing photos in ERP, or retry after restoring an asset.'); }
    catch { setMessage('Could not load the photo repair report.'); }
    finally { setBusy(false); }
  };
  const retry = async (id: string) => {
    setBusy(true);
    try { await api(`/pos/products/${id}/retry-photo`, { method: 'POST', body: '{}', offlineFallback: false }); await load(); }
    catch { setMessage('Photo repair could not finish. Please retry.'); }
    finally { setBusy(false); }
  };
  return <details className="rounded-xl border border-slate-800 p-4 text-xs">
    <summary className="cursor-pointer font-bold">Product photo repair report</summary>
    <button className="my-2 text-fuchsia-300 underline" disabled={busy} onClick={() => void load()}>{busy ? 'Checking…' : 'Load report'}</button>
    <p role="status">{message}</p>
    {message && !items.length && <p>No saved unresolved photo references.</p>}
    {items.map(item => <div key={item.id} className="flex justify-between border-t border-slate-800 py-2"><span>{item.name} · {item.photoRepair.unresolved.length} unresolved references</span><button disabled={busy} className="text-fuchsia-300" onClick={() => void retry(item.id)}>Retry repair</button></div>)}
  </details>;
}
