import { useState } from 'react';
import { ChefHat, Plus, Save, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { HotelOrder, HotelServiceRequest } from './useHotelLive';
import type { InventoryRow, MenuRow, PropertyRow, StaffRow } from './production-types';
import { inputClass, money, primaryButton } from './production-types';
import { Empty, Field, Modal, Panel, SmallButton, Status } from './ProductionHotelUi';

export function MenuManager({ property, rows, onChanged, flash }: { property: PropertyRow; rows: MenuRow[]; onChanged: () => Promise<void>; flash: (message: string) => void }) {
  const blank = { name: '', category: '', price: '', station: 'kitchen', imageUrl: '' };
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<MenuRow | null>(null);
  const [busy, setBusy] = useState(false);

  const current = editing
    ? { name: editing.name, category: editing.category, price: String(editing.price), station: editing.station, imageUrl: editing.imageUrl || '' }
    : form;

  const change = (patch: Partial<typeof blank>) => {
    if (editing) {
      setEditing({
        ...editing,
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.category !== undefined ? { category: patch.category } : {}),
        ...(patch.price !== undefined ? { price: Number(patch.price) || 0 } : {}),
        ...(patch.station !== undefined ? { station: patch.station as MenuRow['station'] } : {}),
        ...(patch.imageUrl !== undefined ? { imageUrl: patch.imageUrl || null } : {}),
      });
    } else {
      setForm({ ...form, ...patch });
    }
  };

  const save = async () => {
    if (!current.name.trim() || !current.category.trim() || !current.price) return;
    setBusy(true);
    try {
      await api(editing ? `/hotel/menu-items/${editing.id}` : '/hotel/menu-items', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify({
          name: current.name.trim(),
          category: current.category.trim(),
          price: Number(current.price),
          currency: property.currency || 'TZS',
          station: current.station,
          available: editing?.available ?? true,
          imageUrl: current.imageUrl || undefined,
          hotelId: property.id,
        }),
        offlineFallback: false,
      });
      setEditing(null);
      setForm(blank);
      await onChanged();
      flash('Menu item saved.');
    } catch (reason) {
      window.alert(reason instanceof Error ? reason.message : 'Could not save menu item.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: MenuRow) => {
    if (!window.confirm(`Delete ${row.name}?`)) return;
    try {
      await api(`/hotel/menu-items/${row.id}`, { method: 'DELETE', offlineFallback: false });
      await onChanged();
      flash('Menu item removed.');
    } catch (reason) {
      window.alert(reason instanceof Error ? reason.message : 'Could not remove menu item.');
    }
  };

  const toggle = async (row: MenuRow) => {
    try {
      await api(`/hotel/menu-items/${row.id}`, { method: 'PATCH', body: JSON.stringify({ available: !row.available }), offlineFallback: false });
      await onChanged();
      flash(row.available ? 'Menu item disabled.' : 'Menu item enabled.');
    } catch (reason) {
      window.alert(reason instanceof Error ? reason.message : 'Could not update menu item.');
    }
  };

  return <div className="space-y-4">
    <div><h1 className="text-2xl font-black">Food & beverage menu</h1><p className="text-sm text-slate-500">One live catalogue feeds guest ordering and staff orders.</p></div>
    <Panel title={editing ? 'Edit menu item' : 'Add menu item'}>
      <div className="grid sm:grid-cols-5 gap-2">
        <Field label="Name" value={current.name} onChange={(value) => change({ name: value })} />
        <Field label="Category" value={current.category} onChange={(value) => change({ category: value })} />
        <Field label="Price" type="number" value={current.price} onChange={(value) => change({ price: value })} />
        <label className="text-xs font-bold">Station<select className={inputClass} value={current.station} onChange={(event) => change({ station: event.target.value })}><option value="kitchen">Kitchen</option><option value="bar">Bar</option><option value="other">Other</option></select></label>
        <Field label="Image URL" value={current.imageUrl} onChange={(value) => change({ imageUrl: value })} />
      </div>
      <div className="flex gap-2"><button disabled={busy} onClick={() => void save()} className={primaryButton}><Save className="h-4 w-4" />{editing ? 'Update' : 'Add item'}</button>{editing && <button onClick={() => setEditing(null)} className="mt-4 h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black">Cancel</button>}</div>
    </Panel>
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
      {rows.map((row) => <div key={row.id} className="rounded-2xl border bg-white p-4 flex gap-3">
        {row.imageUrl ? <img src={row.imageUrl} className="h-16 w-16 rounded-xl object-cover" alt="" /> : <div className="h-16 w-16 rounded-xl bg-slate-100 grid place-items-center"><ChefHat className="h-6 w-6 text-slate-300" /></div>}
        <div className="min-w-0 flex-1"><div className="font-black truncate">{row.name}</div><div className="text-xs text-slate-400">{row.category} · {row.station}</div><div className="mt-1 font-bold">{money(row.price, row.currency)}</div><div className="mt-2 flex flex-wrap gap-1"><SmallButton onClick={() => setEditing(row)}>Edit</SmallButton><SmallButton onClick={() => void toggle(row)}>{row.available ? 'Disable' : 'Enable'}</SmallButton><SmallButton danger onClick={() => void remove(row)}><Trash2 className="h-3 w-3" /></SmallButton></div></div>
      </div>)}
    </div>
    {rows.length === 0 && <Empty text="No menu items yet." />}
  </div>;
}

export function OrdersBoard({ property, menu, orders, advance, flash }: { property: PropertyRow; menu: MenuRow[]; orders: HotelOrder[]; advance: (id: string, status: HotelOrder['status']) => Promise<void>; flash: (message: string) => void }) {
  const [showNew, setShowNew] = useState(false);
  const [location, setLocation] = useState({ type: 'table', number: '', guestName: '' });
  const [cart, setCart] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const next: Record<HotelOrder['status'], HotelOrder['status'] | null> = { PENDING: 'ACCEPTED', ACCEPTED: 'PREPARING', PREPARING: 'READY', READY: 'DELIVERED', DELIVERED: null, CANCELLED: null };
  const active = orders.filter((order) => !['DELIVERED', 'CANCELLED'].includes(order.status));

  const create = async () => {
    const selected = menu.filter((item) => (cart[item.id] || 0) > 0 && item.available);
    if (!location.number.trim() || selected.length === 0) return;
    setBusy(true);
    try {
      await api('/hotel/orders', {
        method: 'POST',
        body: JSON.stringify({
          hotelId: property.id,
          locationType: location.type,
          roomNumber: location.number.trim(),
          guestName: location.guestName.trim() || undefined,
          items: selected.map((item) => ({ menuItemId: item.id, name: item.name, qty: cart[item.id], price: Number(item.price), station: item.station })),
          currency: property.currency || 'TZS',
        }),
        offlineFallback: false,
      });
      setCart({}); setLocation({ type: 'table', number: '', guestName: '' }); setShowNew(false); flash('Order sent to the live KDS queue.');
    } catch (reason) {
      window.alert(reason instanceof Error ? reason.message : 'Order could not be created.');
    } finally { setBusy(false); }
  };

  const move = async (order: HotelOrder, status: HotelOrder['status']) => {
    try { await advance(order.id, status); flash(`Order moved to ${status}.`); }
    catch (reason) { window.alert(reason instanceof Error ? reason.message : 'Could not update order.'); }
  };

  return <div className="space-y-4">
    <div className="flex justify-between"><div><h1 className="text-2xl font-black">Orders / KDS</h1><p className="text-sm text-slate-500">Guest and staff orders use the same persisted queue.</p></div><button onClick={() => setShowNew(true)} className="h-10 px-4 rounded-xl bg-[#0d2135] text-white text-xs font-black inline-flex items-center gap-2"><Plus className="h-4 w-4" />New staff order</button></div>
    <div className="grid lg:grid-cols-2 gap-3">{active.map((order) => <div key={order.id} className="rounded-2xl border bg-white p-4"><div className="flex justify-between"><div><b className="capitalize">{order.locationType} {order.roomNumber}</b><div className="text-xs text-slate-400">{order.guestName || 'Guest'} · {order.items.length} items</div></div><Status value={order.status} /></div><div className="my-3 space-y-1">{order.items.map((item, index) => <div key={`${order.id}-${index}`} className="flex justify-between text-xs"><span>{item.qty} × {item.name} <small className="text-slate-400">· {item.station || 'kitchen'}</small></span><b>{money(Number(item.price) * item.qty, order.currency)}</b></div>)}</div><div className="flex items-center justify-between"><b>{money(order.total, order.currency)}</b><div className="flex gap-1">{next[order.status] && <SmallButton onClick={() => void move(order, next[order.status]!)}>{next[order.status]}</SmallButton>}{['PENDING', 'ACCEPTED', 'PREPARING'].includes(order.status) && <SmallButton danger onClick={() => void move(order, 'CANCELLED')}>Cancel</SmallButton>}</div></div></div>)}</div>
    {active.length === 0 && <Empty text="No active orders." />}
    {showNew && <Modal title="New staff order" onClose={() => setShowNew(false)}><div className="grid sm:grid-cols-3 gap-2"><label className="text-xs font-bold">Location<select className={inputClass} value={location.type} onChange={(event) => setLocation({ ...location, type: event.target.value })}><option value="table">Table</option><option value="room">Room</option><option value="pickup">Pickup</option><option value="delivery">Delivery</option></select></label><Field label="Table / room / name" value={location.number} onChange={(value) => setLocation({ ...location, number: value })} /><Field label="Guest name" value={location.guestName} onChange={(value) => setLocation({ ...location, guestName: value })} /></div><div className="mt-4 max-h-72 overflow-auto divide-y">{menu.filter((item) => item.available).map((item) => <div key={item.id} className="py-2 flex items-center gap-2"><div className="flex-1"><b className="text-sm">{item.name}</b><div className="text-[10px] text-slate-400">{item.station} · {money(item.price, item.currency)}</div></div><button onClick={() => setCart({ ...cart, [item.id]: Math.max(0, (cart[item.id] || 0) - 1) })} className="h-8 w-8 rounded-lg bg-slate-100">−</button><span className="w-6 text-center text-sm font-black">{cart[item.id] || 0}</span><button onClick={() => setCart({ ...cart, [item.id]: (cart[item.id] || 0) + 1 })} className="h-8 w-8 rounded-lg bg-slate-100">+</button></div>)}</div><button disabled={busy} onClick={() => void create()} className={primaryButton}>Send to KDS</button></Modal>}
  </div>;
}

export function RequestsBoard({ requests, advance, flash }: { requests: HotelServiceRequest[]; advance: (id: string, status: HotelServiceRequest['status']) => Promise<void>; flash: (message: string) => void }) {
  const next: Record<HotelServiceRequest['status'], HotelServiceRequest['status'] | null> = { OPEN: 'IN_PROGRESS', IN_PROGRESS: 'COMPLETED', COMPLETED: null, CANCELLED: null };
  const active = requests.filter((request) => !['COMPLETED', 'CANCELLED'].includes(request.status));
  return <div className="space-y-4"><div><h1 className="text-2xl font-black">Guest requests</h1><p className="text-sm text-slate-500">Live requests from the room QR and staff channels.</p></div><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{active.map((request) => <div key={request.id} className="rounded-2xl border bg-white p-4"><div className="flex justify-between"><b>Room {request.roomNumber}</b><Status value={request.status} /></div><div className="mt-2 text-lg font-black">{request.kind.replace(/_/g, ' ')}</div>{request.note && <p className="mt-1 text-xs text-slate-500">{request.note}</p>}<div className="mt-3 flex gap-1">{next[request.status] && <SmallButton onClick={() => void advance(request.id, next[request.status]!).then(() => flash(`Request moved to ${next[request.status]}.`))}>{next[request.status]}</SmallButton>}{['OPEN', 'IN_PROGRESS'].includes(request.status) && <SmallButton danger onClick={() => void advance(request.id, 'CANCELLED')}>Cancel</SmallButton>}</div></div>)}</div>{active.length === 0 && <Empty text="No open guest requests." />}</div>;
}

export function InventoryBoard({ property, rows, onChanged, flash }: { property: PropertyRow; rows: InventoryRow[]; onChanged: () => Promise<void>; flash: (message: string) => void }) {
  const [form, setForm] = useState({ name: '', category: '', quantity: '', unit: 'unit', reorderLevel: '0', costPerUnit: '' });
  const [busy, setBusy] = useState(false);
  const add = async () => { if (!form.name.trim()) return; setBusy(true); try { await api('/hotel/inventory', { method: 'POST', body: JSON.stringify({ hotelId: property.id, name: form.name.trim(), category: form.category.trim(), quantity: Number(form.quantity) || 0, unit: form.unit.trim() || 'unit', reorderLevel: Number(form.reorderLevel) || 0, costPerUnit: Number(form.costPerUnit) || 0, currency: property.currency || 'TZS' }), offlineFallback: false }); setForm({ name: '', category: '', quantity: '', unit: 'unit', reorderLevel: '0', costPerUnit: '' }); await onChanged(); flash('Inventory item added.'); } catch (reason) { window.alert(reason instanceof Error ? reason.message : 'Could not add inventory item.'); } finally { setBusy(false); } };
  const setQuantity = async (row: InventoryRow, value: number) => { try { await api(`/hotel/inventory/${row.id}`, { method: 'PATCH', body: JSON.stringify({ quantity: Math.max(0, value) }), offlineFallback: false }); await onChanged(); } catch (reason) { window.alert(reason instanceof Error ? reason.message : 'Could not update inventory.'); } };
  const remove = async (row: InventoryRow) => { if (!window.confirm(`Delete ${row.name}?`)) return; try { await api(`/hotel/inventory/${row.id}`, { method: 'DELETE', offlineFallback: false }); await onChanged(); flash('Inventory item removed.'); } catch (reason) { window.alert(reason instanceof Error ? reason.message : 'Could not remove inventory item.'); } };
  return <div className="space-y-4"><div><h1 className="text-2xl font-black">Inventory</h1><p className="text-sm text-slate-500">Actual stock records and reorder levels.</p></div><Panel title="Add inventory item"><div className="grid sm:grid-cols-6 gap-2"><Field label="Item" value={form.name} onChange={(value) => setForm({ ...form, name: value })} /><Field label="Category" value={form.category} onChange={(value) => setForm({ ...form, category: value })} /><Field label="Quantity" type="number" value={form.quantity} onChange={(value) => setForm({ ...form, quantity: value })} /><Field label="Unit" value={form.unit} onChange={(value) => setForm({ ...form, unit: value })} /><Field label="Reorder at" type="number" value={form.reorderLevel} onChange={(value) => setForm({ ...form, reorderLevel: value })} /><Field label="Cost/unit" type="number" value={form.costPerUnit} onChange={(value) => setForm({ ...form, costPerUnit: value })} /></div><button disabled={busy} onClick={() => void add()} className={primaryButton}><Plus className="h-4 w-4" />Add item</button></Panel><Panel title="Stock"><div className="divide-y">{rows.map((row) => <div key={row.id} className="py-3 flex items-center gap-3"><div className="flex-1"><b className="text-sm">{row.name}</b><div className="text-[10px] text-slate-400">{row.category || 'general'} · reorder {Number(row.reorderLevel)} {row.unit}</div></div><span className={`text-xs font-black ${Number(row.quantity) <= Number(row.reorderLevel) ? 'text-red-600' : 'text-emerald-600'}`}>{Number(row.quantity)} {row.unit}</span><SmallButton onClick={() => void setQuantity(row, Number(row.quantity) - 1)}>−1</SmallButton><SmallButton onClick={() => void setQuantity(row, Number(row.quantity) + 1)}>+1</SmallButton><SmallButton danger onClick={() => void remove(row)}><Trash2 className="h-3 w-3" /></SmallButton></div>)}</div>{rows.length === 0 && <Empty text="No inventory records." />}</Panel></div>;
}

export function StaffBoard({ property, rows, onChanged, flash }: { property: PropertyRow; rows: StaffRow[]; onChanged: () => Promise<void>; flash: (message: string) => void }) {
  const [form, setForm] = useState({ name: '', role: 'receptionist', phone: '', email: '' });
  const add = async () => { if (!form.name.trim()) return; try { await api('/hotel/staff', { method: 'POST', body: JSON.stringify({ ...form, name: form.name.trim(), hotelId: property.id, status: 'active' }), offlineFallback: false }); setForm({ name: '', role: 'receptionist', phone: '', email: '' }); await onChanged(); flash('Staff member added.'); } catch (reason) { window.alert(reason instanceof Error ? reason.message : 'Could not add staff.'); } };
  const toggleDuty = async (row: StaffRow) => { try { await api(`/hotel/staff/${row.id}`, { method: 'PATCH', body: JSON.stringify({ status: row.status === 'active' ? 'off' : 'active' }), offlineFallback: false }); await onChanged(); } catch (reason) { window.alert(reason instanceof Error ? reason.message : 'Could not update staff status.'); } };
  const remove = async (row: StaffRow) => { if (!window.confirm(`Remove ${row.name}?`)) return; try { await api(`/hotel/staff/${row.id}`, { method: 'DELETE', offlineFallback: false }); await onChanged(); flash('Staff member removed.'); } catch (reason) { window.alert(reason instanceof Error ? reason.message : 'Could not remove staff member.'); } };
  return <div className="space-y-4"><div><h1 className="text-2xl font-black">Staff</h1><p className="text-sm text-slate-500">Hotel staff directory and duty state.</p></div><Panel title="Add staff"><div className="grid sm:grid-cols-4 gap-2"><Field label="Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} /><Field label="Role" value={form.role} onChange={(value) => setForm({ ...form, role: value })} /><Field label="Phone" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} /><Field label="Email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} /></div><button onClick={() => void add()} className={primaryButton}><Plus className="h-4 w-4" />Add staff</button></Panel><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{rows.map((row) => <div key={row.id} className="rounded-2xl border bg-white p-4"><div className="flex justify-between"><div><b>{row.name}</b><div className="text-xs text-slate-400">{row.role} · {row.phone}</div></div><Status value={row.status} /></div><div className="mt-3 flex gap-1"><SmallButton onClick={() => void toggleDuty(row)}>{row.status === 'active' ? 'Off duty' : 'On duty'}</SmallButton><SmallButton danger onClick={() => void remove(row)}>Remove</SmallButton></div></div>)}</div>{rows.length === 0 && <Empty text="No staff records." />}</div>;
}
