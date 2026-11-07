import { getStoredAuthUser } from '@/lib/auth';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, RefreshCw, Users, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { useOSStore } from '@/os/store';

const areas = [
  { name: 'Kobe Home', description: 'Ask, find and decide.', apps: [['kobe-assistant', 'Ask Kobe'], ['tasks', 'Tasks'], ['notes', 'Notes']] },
  { name: 'Kobe Business', description: 'Your everyday operations.', apps: [['erp-shop', 'Shops'], ['kobe-hotel', 'Hotels'], ['property', 'Properties'], ['cargo', 'Cargo'], ['live-sales', 'Live sales']] },
  { name: 'Kobe Money', description: 'Payments and financial records.', apps: [['kobe-pay', 'KobePay'], ['kobe-accountant', 'Accountant'], ['erp-reports', 'Reports']] },
  { name: 'Kobe People', description: 'People and conversations.', apps: [['contacts', 'Contacts'], ['erp-messaging', 'Messaging'], ['email', 'Email'], ['chat', 'Team chat']] },
  { name: 'Kobe Intelligence', description: 'Agents, memory and approved workflows.', apps: [['kobe-agents', 'Digital employees & workflows'], ['kobe-models', 'AI models'], ['kobe-studio', 'Studio']] },
  { name: 'Kobe Network', description: 'Suppliers, stock and development.', apps: [['kobe-commerce', 'Business network'], ['erp-sourcing', 'Suppliers'], ['erp-warehouse-ops', 'Inventory'], ['app-store', 'App Store'], ['code-ide', 'App development'], ['kobe-print', 'Printers']] },
];
interface Briefing { summary: string; alerts: Array<{ severity: string; text: string }>; data: { generatedAt: string; timezone: string; pendingApprovals: number; inventory: { warehouseLow: number }; ledger: { postingsToday: number } } }
interface Conversations { messages: Array<{ id: string; channel: string; direction: string; preview: string; createdAt: string }> }
interface PhysicalState { rooms: Array<{ id: string; roomNumber: string; status: string }>; stock: Array<{ id: string; name: string; sku: string; unit: string; warehouseId: string | null; warehouseName: string; quantity: number; reorderLevel: number }>; totalRooms: number; totalStockItems: number; displayLimit: number }
interface Grant { id: string; ownerId: string; memberId: string; status: string; role: string }
const panel = 'rounded-2xl border border-slate-200 bg-white p-5';

export default function KobeHome() {
  const actor = getStoredAuthUser()?.id;
  const requestId = useRef(0);
  const launch = useOSStore(s => s.launchApp);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [conversations, setConversations] = useState<Conversations | null>(null);
  const [physical, setPhysical] = useState<PhysicalState | null>(null);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [member, setMember] = useState('');
  const [consent, setConsent] = useState(false);
  const [fromItem, setFromItem] = useState('');
  const [toItem, setToItem] = useState('');
  const [quantity, setQuantity] = useState('1');
  const transferRequest = useRef<{ signature: string; key: string } | null>(null);
  const [owner, setOwner] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    const request = ++requestId.current;
    setLoading(true); setError(''); setBriefing(null); setPhysical(null); setConversations(null);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const results = await Promise.allSettled([
      api<Briefing>(`/brain/briefing?timezone=${encodeURIComponent(timezone)}${owner ? `&ownerId=${encodeURIComponent(owner)}` : ''}`, { offlineFallback: false }),
      api<Grant[]>('/brain/workspaces', { offlineFallback: false }),
      api<Conversations>('/brain/conversations', { offlineFallback: false }),
      api<PhysicalState>(`/brain/physical-state${owner ? `?ownerId=${encodeURIComponent(owner)}` : ''}`, { offlineFallback: false }),
    ]);
    if (request !== requestId.current) return;
    if (results[0].status === 'fulfilled') setBriefing(results[0].value);
    else setError(results[0].reason instanceof Error ? results[0].reason.message : 'Business briefing is unavailable.');
    if (results[1].status === 'fulfilled') setGrants(results[1].value);
    else { setGrants([]); setError(previous => `${previous} Team access could not be loaded.`.trim()); }
    if (results[2].status === 'fulfilled') setConversations(results[2].value);
    else setError(previous => `${previous} Your recent messages could not be loaded.`.trim());
    if (results[3].status === 'fulfilled') setPhysical(results[3].value);
    else setError(previous => `${previous} Physical operations could not be loaded.`.trim());
    setLoading(false);
  }, [owner]);
  useEffect(() => { void load(); }, [load]);
  async function change(path: string, body?: object) {
    setBusy(true); setNotice('');
    try {
      await api(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined, offlineFallback: false });
      setMember(''); setConsent(false); await load(); setNotice('Team access updated.');
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not update access.'); }
    finally { setBusy(false); }
  }
  async function transferStock() {
    const signature = JSON.stringify([fromItem, toItem, quantity]);
    if (transferRequest.current?.signature !== signature) transferRequest.current = { signature, key: crypto.randomUUID() };
    setBusy(true); setNotice('');
    try {
      await api('/warehouse/transfers', { method: 'POST', body: JSON.stringify({ fromItemId: fromItem, toItemId: toItem, quantity: Number(quantity), requestKey: transferRequest.current.key }), offlineFallback: false });
      setNotice('Stock transferred. Both locations have been updated.');
      setFromItem(''); setToItem(''); transferRequest.current = null; await load();
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Transfer failed. Retrying this form uses the same request ID.'); }
    finally { setBusy(false); }
  }
  return <main className="h-full overflow-auto bg-slate-50 p-4 text-slate-900 sm:p-7">
    <header className="mb-6 flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-teal-700">Your business, connected</p><h1 className="mt-1 text-3xl font-semibold">Kobe Home</h1><p className="mt-2 text-sm text-slate-600">One place to understand today and open your work.</p></div><button aria-label="Refresh business data" disabled={loading} onClick={() => void load()} className="rounded-full border bg-white p-3"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></header>
    <section className="mb-6 rounded-2xl bg-teal-950 p-6 text-white" aria-live="polite"><div className="flex items-center gap-2 text-sm text-teal-200"><Sparkles size={16} />Your business briefing</div>
      {loading ? <p className="mt-4">Reading your business recordsâ€¦</p> : briefing ? <><p className="mt-4 text-lg leading-relaxed">{briefing.summary}</p><p className="mt-3 text-xs text-teal-200">Updated {new Date(briefing.data.generatedAt).toLocaleString()} Â· {briefing.data.timezone}</p><div className="mt-5 flex flex-wrap gap-3 text-sm"><span>{briefing.data.pendingApprovals} decisions awaiting review</span><span>Â· {briefing.data.inventory.warehouseLow} warehouse items at reorder level</span><span>Â· {briefing.data.ledger.postingsToday} journal postings today</span></div></> : <p className="mt-4">Connect to your KobeOS backend to see verified business activity.</p>}
      {error && <p role="alert" className="mt-3 text-sm text-amber-200">{error}</p>}
      {briefing?.alerts.map((alert, index) => <p key={index} className="mt-3 border-t border-white/15 pt-3 text-sm">{alert.text}</p>)}
      <button onClick={() => launch('kobe-agents')} className="mt-5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-teal-950">Review decisions</button>
    </section>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{areas.map(area => <section key={area.name} className={panel}><h2 className="font-semibold">{area.name}</h2><p className="mt-1 text-sm text-slate-500">{area.description}</p><div className="mt-4 flex flex-wrap gap-2">{area.apps.map(([id, label]) => <button key={id} onClick={() => launch(id)} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium hover:bg-teal-100">{label}<ArrowUpRight size={12} /></button>)}</div></section>)}</div>
    {conversations && <section className={`${panel} mt-6`}><h2 className="font-semibold">My recent messages</h2><p className="mt-1 text-xs text-slate-500">Your recorded email and WhatsApp messages · private to your account · up to 50 recent messages</p><div className="mt-4 space-y-2">{conversations.messages.map(message => <div key={message.id} className="rounded-xl bg-slate-50 p-3"><div className="flex justify-between gap-3 text-xs text-slate-500"><span>{message.channel} · {message.direction === 'in' ? 'received' : 'sent'}</span><time>{new Date(message.createdAt).toLocaleString()}</time></div><p className="mt-1 break-words text-sm">{message.preview || '(No subject)'}</p></div>)}{!conversations.messages.length && <p className="text-sm text-slate-500">No messages recorded yet. Set up your channels in the messaging and email applications.</p>}</div><p className="mt-3 text-xs text-slate-500">Other social channels are not included here. Recorded messages do not confirm that a provider is currently connected.</p></section>}
    {physical && <section className={`${panel} mt-6`}><h2 className="font-semibold">Physical operations</h2><p className="mt-1 text-xs text-slate-500">Current business records · refresh to update · not a sensor feed</p><h3 className="mt-4 text-sm font-semibold">Hotel rooms ({physical.rooms.length} of {physical.totalRooms})</h3><div className="mt-3 flex flex-wrap gap-2">{physical.rooms.map(room => <button key={room.id} onClick={() => launch('kobe-hotel')} className={`rounded-xl border p-3 text-left text-xs ${room.status === 'occupied' ? 'border-teal-200 bg-teal-50' : room.status === 'maintenance' ? 'border-amber-200 bg-amber-50' : 'bg-slate-50'}`}><b>Room {room.roomNumber}</b><p className="mt-1">{room.status}</p></button>)}{!physical.rooms.length && <p className="text-sm text-slate-500">No hotel rooms recorded in this workspace.</p>}</div><h3 className="mt-5 text-sm font-semibold">Inventory ({physical.stock.length} of {physical.totalStockItems})</h3><div className="mt-3 flex flex-wrap gap-2">{physical.stock.map(item => <button key={item.id} onClick={() => launch('erp-warehouse-ops')} className={`rounded-xl border p-3 text-left text-xs ${item.quantity <= item.reorderLevel ? 'border-amber-200 bg-amber-50' : 'bg-slate-50'}`}><b>{item.name}</b><p className="mt-1">{item.quantity} units · reorder at {item.reorderLevel}</p></button>)}{!physical.stock.length && <p className="text-sm text-slate-500">No warehouse items recorded in this workspace.</p>}</div><p className="mt-4 text-xs text-slate-500">Showing up to {physical.displayLimit} rooms and items. Open the full application for all records.</p></section>}
    {!owner && physical && <section className={`${panel} mt-6`}><h2 className="font-semibold">Move stock between warehouses</h2><p className="mt-1 text-sm text-slate-500">Choose matching SKU and unit records in different warehouses. Both locations update together.</p><form onSubmit={e => { e.preventDefault(); void transferStock(); }} className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm">From<select required value={fromItem} onChange={e => setFromItem(e.target.value)} className="mt-1 block w-full rounded-lg border p-2"><option value="">Choose source stock</option>{physical.stock.filter(item => item.warehouseId).map(item => <option key={item.id} value={item.id}>{item.name} · {item.warehouseName} · {item.quantity} units</option>)}</select></label><label className="text-sm">To<select required value={toItem} onChange={e => setToItem(e.target.value)} className="mt-1 block w-full rounded-lg border p-2"><option value="">Choose destination stock</option>{physical.stock.filter(item => item.warehouseId && item.id !== fromItem).map(item => <option key={item.id} value={item.id}>{item.name} · {item.warehouseName}</option>)}</select></label><label className="text-sm">Quantity<input type="number" required min="1" max="2147483647" step="1" value={quantity} onChange={e => setQuantity(e.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label><button disabled={busy || !fromItem || !toItem} className="self-end rounded-lg bg-teal-800 px-4 py-2 text-sm text-white disabled:opacity-40">Confirm stock transfer</button></form><p className="mt-2 text-xs text-slate-500">The first 100 stock records are listed. Transfers move quantities; they do not create a payment or valuation journal.</p>{notice && <p role="status" className="mt-3 text-sm">{notice}</p>}</section>}
    <section className={`${panel} mt-6`}><h2 className="flex items-center gap-2 font-semibold"><Users size={18} />Team access</h2><p className="mt-2 text-sm text-slate-600">Invite an existing KobeOS account to view your business briefing. This shares records across your whole owner workspace, not just one shop. It does not allow payments or changes. The recipient accepts the invitation here in Kobe Home; no email is sent automatically.</p>
      <form onSubmit={e => { e.preventDefault(); if (consent && member.trim()) void change('/brain/workspaces/invite', { email: member.trim(), scopeConsent: 'ALL_OWNER_ACCOUNT_RECORDS' }); }} className="mt-4 space-y-3"><label className="block text-sm">KobeOS email address<input type="email" required value={member} onChange={e => setMember(e.target.value)} className="mt-1 block w-full max-w-lg rounded-lg border p-2" /></label><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />I agree to share read-only business information across my entire workspace.</label><button disabled={!consent || !member.trim() || busy} className="rounded-lg bg-teal-800 px-4 py-2 text-sm text-white disabled:opacity-40">Create invitation</button></form>
      {notice && <p role="status" className="mt-3 text-sm">{notice}</p>}
      <div className="mt-5 space-y-3">{grants.map(grant => <div key={grant.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-xs"><div><p>Workspace: {grant.ownerId}</p><p className="mt-1">Member: {grant.memberId} Â· {grant.status.toLowerCase()}</p></div><div className="flex gap-2">{grant.status === 'INVITED' && grant.memberId === actor && <button disabled={busy} onClick={() => void change(`/brain/workspaces/${grant.id}/accept`)} className="rounded-lg border bg-white p-2">Accept invitation</button>}{grant.status === 'ACTIVE' && <button onClick={() => setOwner(grant.ownerId)} className="rounded-lg border bg-white p-2">View briefing</button>}{grant.status !== 'REVOKED' && <button disabled={busy} onClick={() => void change(`/brain/workspaces/${grant.id}/revoke`)} className="rounded-lg border bg-white p-2">Revoke / leave</button>}</div></div>)}</div>{owner && <button onClick={() => setOwner('')} className="mt-4 text-sm font-semibold text-teal-800">Return to my workspace</button>}
    </section>
  </main>;
}
