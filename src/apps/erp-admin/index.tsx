import { useCallback, useEffect, useMemo, useState } from 'react';
import { Edit3, Loader2, Plus, RefreshCw, Search, Shield, Trash2, UserCog, X } from 'lucide-react';
import { api } from '@/lib/api';

type UserRole = 'user' | 'admin' | 'government_viewer' | 'settlement_officer' | 'compliance_officer' | 'traffic_enforcement';
interface UserRow { id: string; email: string; phone?: string | null; displayName?: string; avatarUrl?: string | null; role: UserRole; createdAt: string }
const ROLES: UserRole[] = ['user', 'admin', 'government_viewer', 'settlement_officer', 'compliance_officer', 'traffic_enforcement'];
const roleLabel = (role: UserRole) => role.split('_').map((x) => x[0].toUpperCase() + x.slice(1)).join(' ');

export default function ERPAdmin() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<UserRow | null | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const rows = await api<UserRow[]>('/users', { offlineFallback: false });
      setUsers(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setUsers([]);
      setError((e as Error).message || 'Admin access is required to manage users.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const q = search.trim().toLowerCase();
  const filtered = users.filter((u) => !q || `${u.displayName ?? ''} ${u.email} ${u.phone ?? ''} ${u.role}`.toLowerCase().includes(q));
  const roleCounts = useMemo(() => Object.fromEntries(ROLES.map((r) => [r, users.filter((u) => u.role === r).length])) as Record<UserRole, number>, [users]);

  const remove = async (user: UserRow) => {
    if (!window.confirm(`Delete ${user.displayName || user.email}? This removes the login account.`)) return;
    try { await api(`/users/${user.id}`, { method: 'DELETE', offlineFallback: false }); await load(); }
    catch (e) { setError((e as Error).message || 'Could not delete user.'); }
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      <header className="shrink-0 h-16 px-4 flex items-center gap-3 border-b border-slate-800 bg-slate-900/80">
        <div className="h-10 w-10 rounded-xl bg-blue-500/15 text-blue-300 grid place-items-center"><Shield className="h-5 w-5" /></div>
        <div><h1 className="font-black">Administration</h1><p className="text-[11px] text-slate-500">Real KobeOS login accounts and platform roles</p></div>
        <button onClick={() => void load()} disabled={loading} className="ml-auto h-9 w-9 rounded-lg border border-slate-700 grid place-items-center text-slate-400 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
        <button onClick={() => setEditing(null)} className="h-9 px-3 rounded-lg bg-blue-600 text-white text-xs font-black inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> Add user</button>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div>}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {ROLES.map((role) => <div key={role} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><span className="text-[10px] uppercase tracking-wide text-slate-500">{roleLabel(role)}</span><b className="block text-2xl mt-1">{roleCounts[role]}</b></div>)}
        </div>
        <div className="relative max-w-lg"><Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search accounts…" className="w-full h-10 rounded-xl bg-slate-900 border border-slate-800 pl-9 pr-3 text-sm outline-none focus:border-blue-500/60" /></div>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          {loading && !users.length ? <div className="py-20 grid place-items-center text-slate-500"><Loader2 className="h-6 w-6 animate-spin" /></div> : !filtered.length ? <div className="py-16 text-center text-slate-500">No users found.</div> : <div className="divide-y divide-slate-800">{filtered.map((u) => <div key={u.id} className="px-4 py-3 flex items-center gap-3"><div className="h-10 w-10 rounded-full bg-slate-800 grid place-items-center"><UserCog className="h-4 w-4 text-slate-400" /></div><div className="min-w-0 flex-1"><b className="block truncate">{u.displayName || u.email}</b><span className="text-xs text-slate-500">{u.email}{u.phone ? ` · ${u.phone}` : ''}</span><span className="block text-[10px] text-slate-600">Created {new Date(u.createdAt).toLocaleDateString()}</span></div><span className="text-[10px] font-black px-2 py-1 rounded-full bg-blue-500/10 text-blue-300">{roleLabel(u.role)}</span><button onClick={() => setEditing(u)} className="h-8 w-8 rounded-lg border border-slate-700 grid place-items-center text-slate-400 hover:text-white"><Edit3 className="h-4 w-4" /></button><button onClick={() => void remove(u)} className="h-8 w-8 rounded-lg border border-slate-700 grid place-items-center text-slate-400 hover:text-rose-300"><Trash2 className="h-4 w-4" /></button></div>)}</div>}
        </section>
      </main>
      {editing !== undefined && <UserModal user={editing} onClose={() => setEditing(undefined)} onSaved={async () => { setEditing(undefined); await load(); }} />}
    </div>
  );
}

function UserModal({ user, onClose, onSaved }: { user: UserRow | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({ displayName: user?.displayName ?? '', email: user?.email ?? '', role: user?.role ?? 'user' as UserRole, password: '' });
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const save = async () => {
    setBusy(true); setError('');
    try {
      if (user) await api(`/users/${user.id}`, { method: 'PATCH', offlineFallback: false, body: JSON.stringify({ displayName: form.displayName.trim(), role: form.role }) });
      else await api('/users', { method: 'POST', offlineFallback: false, body: JSON.stringify({ email: form.email.trim(), password: form.password, displayName: form.displayName.trim(), role: form.role }) });
      await onSaved();
    } catch (e) { setError((e as Error).message || 'Could not save user.'); } finally { setBusy(false); }
  };
  const generate = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    const bytes = new Uint32Array(16); crypto.getRandomValues(bytes);
    setForm((f) => ({ ...f, password: Array.from(bytes, (n) => chars[n % chars.length]).join('') }));
  };
  return <div className="fixed inset-0 z-50 bg-black/55 grid place-items-center p-4" onMouseDown={onClose}><div onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-5"><div className="flex items-center"><h2 className="font-black">{user ? 'Edit account' : 'Create account'}</h2><button onClick={onClose} className="ml-auto"><X className="h-5 w-5" /></button></div><div className="mt-4 grid gap-3"><label className="grid gap-1 text-xs text-slate-400">Display name<input className="control" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></label>{!user && <label className="grid gap-1 text-xs text-slate-400">Email<input type="email" className="control" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>}<label className="grid gap-1 text-xs text-slate-400">Role<select className="control" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>{ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}</select></label>{!user && <label className="grid gap-1 text-xs text-slate-400">Initial password<div className="flex gap-2"><input className="control flex-1" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><button type="button" onClick={generate} className="px-3 rounded-xl border border-slate-700 text-xs font-black">Generate</button></div></label>}{error && <p className="text-xs text-rose-300">{error}</p>}<button onClick={() => void save()} disabled={busy || (!user && (!form.email.trim() || form.password.length < 8))} className="h-10 rounded-xl bg-blue-600 text-white font-black disabled:opacity-50">{busy ? 'Saving…' : 'Save account'}</button></div></div></div>;
}
