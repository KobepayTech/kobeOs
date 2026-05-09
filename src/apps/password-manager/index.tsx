import { useState, useEffect } from 'react';
import {
  Key, Lock, Unlock, Eye, EyeOff, Copy, Check, Plus, Trash2, Search,
  RefreshCw, Shield, Globe, X, SlidersHorizontal
} from 'lucide-react';

interface PasswordEntry {
  id: string;
  site: string;
  url: string;
  username: string;
  password: string;
  notes: string;
  category: string;
}

const STORAGE_KEY = 'kobe_passwords';
const MASTER_KEY = 'kobe_password_master';

const CATEGORIES = ['Work', 'Personal', 'Finance', 'Social', 'Other'];

const DEMO_ENTRIES: PasswordEntry[] = [
  { id: 'p1', site: 'GitHub', url: 'https://github.com', username: 'dev_kobe', password: 'Gh$9xK2mP@qL', notes: 'Personal dev account', category: 'Work' },
  { id: 'p2', site: 'Gmail', url: 'https://gmail.com', username: 'user@gmail.com', password: 'Gm#7vN4wR!tY', notes: 'Main email', category: 'Personal' },
  { id: 'p3', site: 'Bank of America', url: 'https://bankofamerica.com', username: 'john_doe_42', password: 'Bk$3fH8jK#mN', notes: 'Checking account', category: 'Finance' },
  { id: 'p4', site: 'Twitter / X', url: 'https://x.com', username: '@kobe_dev', password: 'Tw&5pL9nB^xZ', notes: 'Dev updates account', category: 'Social' },
  { id: 'p5', site: 'AWS Console', url: 'https://aws.amazon.com', username: 'admin@company.com', password: 'Aw#1qW6eR$tU', notes: 'Production access', category: 'Work' },
  { id: 'p6', site: 'Netflix', url: 'https://netflix.com', username: 'family@home.net', password: 'Nf*8sD2gH@jK', notes: 'Family plan', category: 'Personal' },
];

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

function loadEntries(master: string): PasswordEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEMO_ENTRIES;
    const encrypted = JSON.parse(raw);
    if (!Array.isArray(encrypted)) return DEMO_ENTRIES;
    return encrypted.map((e: PasswordEntry) => ({
      ...e,
      username: xorDecrypt(e.username, master),
      password: xorDecrypt(e.password, master),
    }));
  } catch {
    return DEMO_ENTRIES;
  }
}

function saveEntries(entries: PasswordEntry[], master: string) {
  const encrypted = entries.map(e => ({
    ...e,
    username: xorEncrypt(e.username, master),
    password: xorEncrypt(e.password, master),
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(encrypted));
}

function loadMasterHash(): string | null {
  return localStorage.getItem(MASTER_KEY);
}

function saveMasterHash(hash: string) {
  localStorage.setItem(MASTER_KEY, hash);
}

function simpleHash(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) - h + text.charCodeAt(i)) | 0;
  }
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
  for (let i = 0; i < length; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
}

export default function PasswordManagerApp(_props: { windowId: string; data?: any }) {
  const [master, setMaster] = useState('');
  const [masterInput, setMasterInput] = useState('');
  const [entries, setEntries] = useState<PasswordEntry[]>([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('All');
  const [showAdd, setShowAdd] = useState(false);
  const [visiblePwds, setVisiblePwds] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const [genLen, setGenLen] = useState(16);
  const [genUpper, setGenUpper] = useState(true);
  const [genLower, setGenLower] = useState(true);
  const [genNums, setGenNums] = useState(true);
  const [genSyms, setGenSyms] = useState(true);


  const [form, setForm] = useState<Partial<PasswordEntry>>({ category: 'Work' });

  const masterHash = loadMasterHash();
  const isUnlocked = !!master;

  useEffect(() => {
    if (master) {
      setEntries(loadEntries(master));
    }
  }, [master]);

  useEffect(() => {
    if (master) {
      saveEntries(entries, master);
    }
  }, [entries, master]);

  const unlock = () => {
    if (!masterInput.trim()) return;
    const hash = simpleHash(masterInput);
    if (masterHash) {
      if (hash === masterHash) {
        setMaster(masterInput);
      } else {
        alert('Incorrect master password');
      }
    } else {
      saveMasterHash(hash);
      setMaster(masterInput);
    }
    setMasterInput('');
  };

  const lock = () => {
    setMaster('');
    setEntries([]);
    setVisiblePwds({});
  };

  const addEntry = () => {
    if (!form.site?.trim() || !form.username?.trim() || !form.password?.trim()) return;
    const entry: PasswordEntry = {
      id: `p_${Date.now()}`,
      site: form.site || '',
      url: form.url || '',
      username: form.username || '',
      password: form.password || '',
      notes: form.notes || '',
      category: form.category || 'Other',
    };
    setEntries(prev => [...prev, entry]);
    setShowAdd(false);
    setForm({ category: 'Work' });
  };

  const deleteEntry = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  const filtered = entries.filter(e => {
    const q = search.toLowerCase();
    const matchesSearch = !q || e.site.toLowerCase().includes(q) || e.username.toLowerCase().includes(q);
    const matchesCat = filterCat === 'All' || e.category === filterCat;
    return matchesSearch && matchesCat;
  });

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
            onChange={e => setMasterInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') unlock(); }}
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
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-slate-900 text-slate-100 overflow-hidden">
      {/* Sidebar */}
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

      {/* Main */}
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
      </div>

      {/* Add Entry Modal */}
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
                    onClick={() => {
                      const pwd = generatePassword(genLen, genUpper, genLower, genNums, genSyms);
                      setForm({ ...form, password: pwd });
                      
                    }}
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
