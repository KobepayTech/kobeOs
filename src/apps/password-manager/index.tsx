import { useState, useEffect, useCallback } from 'react';
import {
  Key, Lock, Unlock, Eye, EyeOff, Copy, Check, Plus, Trash2, Search,
  RefreshCw, Shield, Globe, X, SlidersHorizontal
} from 'lucide-react';
import { api } from '@/lib/api';
import { ensureSession } from '@/lib/auth';

interface ApiPasswordEntry {
  id: string;
  title: string;
  url?: string | null;
  username?: string | null;
  cipher: string;
  category: string;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PasswordEntry {
  id: string;
  site: string;
  url: string;
  username: string;
  password: string;
  notes: string;
  category: string;
}

interface CipherPayload {
  username: string;
  password: string;
  notes: string;
}

const MASTER_HASH_KEY = 'kobe_password_master';

const CATEGORIES = ['Work', 'Personal', 'Finance', 'Social', 'Other'];

function xorEncrypt(text: string, key: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(result);
}

function xorDecrypt(encoded: string, key: string): string {
  try {
    const text = atob(encoded);
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch {
    return '';
  }
}

function loadMasterHash(): string | null { try { return localStorage.getItem(MASTER_HASH_KEY); } catch { return null; } }
function saveMasterHash(hash: string) { try { localStorage.setItem(MASTER_HASH_KEY, hash); } catch { /* ignore */ } }

function simpleHash(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = ((h << 5) - h + text.charCodeAt(i)) | 0;
  return h.toString(36);
}

function generatePassword(length: number, upper: boolean, lower: boolean, nums: boolean, syms: boolean): string {
  const U = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const L = 'abcdefghijklmnopqrstuvwxyz';
  const N = '0123456789';
  const S = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  let chars = '';
  if (upper) chars += U;
  if (lower) chars += L;
  if (nums) chars += N;
  if (syms) chars += S;
  if (!chars) chars = L + N;
  let pwd = '';
  for (let i = 0; i < length; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
}

function decryptEntry(api: ApiPasswordEntry, master: string): PasswordEntry {
  const plain = xorDecrypt(api.cipher, master);
  let payload: CipherPayload = { username: '', password: '', notes: '' };
  try { payload = JSON.parse(plain) as CipherPayload; } catch { /* corrupt or wrong master */ }
  return {
    id: api.id,
    site: api.title,
    url: api.url ?? '',
    username: payload.username,
    password: payload.password,
    notes: payload.notes,
    category: api.category || 'Other',
  };
}

function encryptPayload(entry: Omit<PasswordEntry, 'id'>, master: string) {
  const payload: CipherPayload = {
    username: entry.username,
    password: entry.password,
    notes: entry.notes,
  };
  return xorEncrypt(JSON.stringify(payload), master);
}

export default function PasswordManagerApp() {
  const [master, setMaster] = useState('');
  const [masterInput, setMasterInput] = useState('');
  const [masterHash, setMasterHash] = useState<string | null>(loadMasterHash());
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [rawEntries, setRawEntries] = useState<ApiPasswordEntry[]>([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('All');
  const [showAdd, setShowAdd] = useState(false);
  const [visiblePwds, setVisiblePwds] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [genLen, setGenLen] = useState(16);
  const [genUpper, setGenUpper] = useState(true);
  const [genLower, setGenLower] = useState(true);
  const [genNums, setGenNums] = useState(true);
  const [genSyms, setGenSyms] = useState(true);

  const [form, setForm] = useState<Partial<PasswordEntry>>({ category: 'Work' });

  const isUnlocked = !!master;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureSession();
        const list = await api<ApiPasswordEntry[]>('/passwords');
        if (!cancelled) {
          setRawEntries(list);
          setReady(true);
        }
      } catch (err) {
        if (!cancelled) setBootError(err instanceof Error ? err.message : 'Failed to load');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const reload = useCallback(async () => {
    try { setRawEntries(await api<ApiPasswordEntry[]>('/passwords')); }
    catch (err) { setErrorMsg(err instanceof Error ? err.message : 'Reload failed'); }
  }, []);

  const entries: PasswordEntry[] = isUnlocked
    ? rawEntries.map((e) => decryptEntry(e, master))
    : [];

  const unlock = () => {
    if (!masterInput.trim()) return;
    const hash = simpleHash(masterInput);
    if (masterHash) {
      if (hash === masterHash) setMaster(masterInput);
      else { alert('Incorrect master password'); return; }
    } else {
      saveMasterHash(hash);
      setMasterHash(hash);
      setMaster(masterInput);
    }
    setMasterInput('');
  };

  const lock = () => {
    setMaster('');
    setVisiblePwds({});
  };

  const addEntry = async () => {
    if (!form.site?.trim() || !form.username?.trim() || !form.password?.trim()) return;
    const plain: Omit<PasswordEntry, 'id'> = {
      site: form.site,
      url: form.url ?? '',
      username: form.username,
      password: form.password,
      notes: form.notes ?? '',
      category: form.category || 'Other',
    };
    const payload = {
      title: plain.site,
      url: plain.url || undefined,
      username: plain.username,
      cipher: encryptPayload(plain, master),
      category: plain.category,
    };
    try {
      const created = await api<ApiPasswordEntry>('/passwords', {
        method: 'POST', body: JSON.stringify(payload),
      });
      setRawEntries((prev) => [created, ...prev]);
      setShowAdd(false);
      setForm({ category: 'Work' });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const deleteEntry = async (id: string) => {
    try {
      await api(`/passwords/${id}`, { method: 'DELETE' });
      setRawEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  const filtered = entries.filter((e) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || e.site.toLowerCase().includes(q) || e.username.toLowerCase().includes(q);
    const matchesCat = filterCat === 'All' || e.category === filterCat;
    return matchesSearch && matchesCat;
  });

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-900 text-sm text-slate-400">
        {bootError ?? 'Connecting…'}
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-900 text-slate-100 p-6">
        <div className="w-16 h-16 rounded-2xl bg-blue-600/20 flex items-center justify-center mb-4">
          <Shield className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-xl font-bold mb-1">Password Vault</h2>
        <p className="text-sm text-slate-400 mb-6">{masterHash ? 'Enter your master password to unlock' : 'Create a master password to secure your vault'}</p>
        <div className="w-full max-w-xs">
          <input
            type="password"
            value={masterInput}
            onChange={(e) => setMasterInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') unlock(); }}
            placeholder={masterHash ? 'Master password' : 'Create master password'}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 mb-3"
          />
          <button
            onClick={unlock}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
          >
            <Unlock className="w-4 h-4" />
            {masterHash ? 'Unlock Vault' : 'Create Vault'}
          </button>
          <button onClick={reload} className="w-full mt-2 text-[11px] text-slate-500 hover:text-slate-300">Reload from server</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-slate-900 text-slate-100 overflow-hidden">
      <div className="w-56 bg-slate-800 border-r border-slate-700 flex flex-col shrink-0">
        <div className="p-3 border-b border-slate-700 flex items-center gap-2">
          <Key className="w-5 h-5 text-blue-400" />
          <span className="font-semibold text-sm">Passwords</span>
        </div>
        <div className="p-2 space-y-0.5">
          <button
            onClick={() => setFilterCat('All')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${filterCat === 'All' ? 'bg-blue-600/20 text-blue-300 font-medium' : 'text-slate-300 hover:bg-slate-700'}`}
          >
            <Globe className="w-4 h-4" />
            All Passwords
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${filterCat === cat ? 'bg-blue-600/20 text-blue-300 font-medium' : 'text-slate-300 hover:bg-slate-700'}`}
            >
              <Shield className="w-4 h-4" />
              {cat}
            </button>
          ))}
        </div>
        <div className="mt-auto p-3 border-t border-slate-700 space-y-2">
          <button onClick={lock} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors">
            <Lock className="w-4 h-4" />
            Lock Vault
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-12 border-b border-slate-700 flex items-center justify-between px-4 shrink-0 bg-slate-800/50">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search passwords..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <Key className="w-10 h-10 mb-2" />
              <p className="text-sm">No passwords found</p>
            </div>
          )}
          <div className="space-y-2">
            {filtered.map(entry => {
              const visible = visiblePwds[entry.id] || false;
              return (
                <div key={entry.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex items-start gap-4 hover:border-slate-600 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
                    <Globe className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-200">{entry.site}</span>
                        {entry.url && (
                          <a href={entry.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:underline truncate max-w-[200px]">{entry.url}</a>
                        )}
                      </div>
                      <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded font-medium">{entry.category}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-2 bg-slate-900 rounded px-2 py-1">
                        <span className="text-xs text-slate-500">User:</span>
                        <span className="text-xs text-slate-300 font-mono">{entry.username}</span>
                        <button onClick={() => copyText(entry.username, `user_${entry.id}`)} className="text-slate-500 hover:text-blue-400 transition-colors">
                          {copied === `user_${entry.id}` ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <div className="flex items-center gap-2 bg-slate-900 rounded px-2 py-1">
                        <span className="text-xs text-slate-500">Pass:</span>
                        <span className="text-xs text-slate-300 font-mono">{visible ? entry.password : '•'.repeat(Math.min(entry.password.length, 12))}</span>
                        <button onClick={() => setVisiblePwds(prev => ({ ...prev, [entry.id]: !prev[entry.id] }))} className="text-slate-500 hover:text-blue-400 transition-colors">
                          {visible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                        <button onClick={() => copyText(entry.password, `pwd_${entry.id}`)} className="text-slate-500 hover:text-blue-400 transition-colors">
                          {copied === `pwd_${entry.id}` ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                    {entry.notes && <p className="text-[11px] text-slate-500 mt-2">{entry.notes}</p>}
                  </div>
                  <button onClick={() => deleteEntry(entry.id)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        {errorMsg && <div className="text-[11px] text-red-400 px-3 py-1 border-t border-slate-700">{errorMsg}</div>}
      </div>

      {showAdd && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="font-semibold text-slate-100">Add Password</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Site Name *</label>
                  <input value={form.site || ''} onChange={e => setForm({ ...form, site: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">URL</label>
                  <input value={form.url || ''} onChange={e => setForm({ ...form, url: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Username *</label>
                <input value={form.username || ''} onChange={e => setForm({ ...form, username: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Password *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.password || ''}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => setForm({ ...form, password: generatePassword(genLen, genUpper, genLower, genNums, genSyms) })}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors"
                    title="Generate password"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
                <div className="flex items-center gap-2 mb-2">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-medium text-slate-400">Password Generator</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-slate-400 w-12">Length</span>
                  <input type="range" min={8} max={32} value={genLen} onChange={e => setGenLen(Number(e.target.value))} className="flex-1 accent-blue-500" />
                  <span className="text-xs text-slate-300 w-6 text-right">{genLen}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'A-Z', checked: genUpper, set: setGenUpper },
                    { label: 'a-z', checked: genLower, set: setGenLower },
                    { label: '0-9', checked: genNums, set: setGenNums },
                    { label: '!@#', checked: genSyms, set: setGenSyms },
                  ].map(opt => (
                    <label key={opt.label} className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                      <input type="checkbox" checked={opt.checked} onChange={e => opt.set(e.target.checked)} className="accent-blue-500" />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Category</label>
                  <select
                    value={form.category || 'Work'}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Notes</label>
                  <input value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-700">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
              <button
                onClick={addEntry}
                disabled={!form.site?.trim() || !form.username?.trim() || !form.password?.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Save Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
