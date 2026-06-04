import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, HelpCircle, Inbox, Plus, RefreshCw, Shield, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { ensureSession } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Status = 'linked' | 'supplier_missing' | 'needs_review' | 'po_missing' | 'unallocated' | 'expense';

interface Receipt {
  id: string;
  providerId: string | null;
  kobepayReceiptId: string;
  kobepayBusinessName: string;
  customerPhone: string;
  customerName: string;
  supplierPhone: string;
  supplierName: string;
  supplierId: string | null;
  sentAmount: string | number;
  sentCurrency: string;
  supplierReceivedAmount: string | number;
  supplierCurrency: string;
  supplierCity: string;
  allocationStatus: Status;
  reviewReason: string;
  createdAt: string;
}

interface Provider {
  id: string;
  name: string;
  apiKey: string;
  active: boolean;
  contactEmail: string;
  createdAt: string;
}

interface ErpSupplier { id: string; name: string; phone: string; country: string; }

const STATUS_BADGE: Record<Status, string> = {
  linked:           'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  supplier_missing: 'bg-rose-500/15 text-rose-400 border-rose-500/20',
  needs_review:     'bg-amber-500/15 text-amber-400 border-amber-500/20',
  po_missing:       'bg-orange-500/15 text-orange-400 border-orange-500/20',
  unallocated:      'bg-slate-500/15 text-slate-300 border-slate-500/20',
  expense:          'bg-blue-500/15 text-blue-400 border-blue-500/20',
};

const STATUS_LABEL: Record<Status, string> = {
  linked: 'Linked',
  supplier_missing: 'Supplier missing',
  needs_review: 'Needs review',
  po_missing: 'PO missing',
  unallocated: 'Unallocated',
  expense: 'Expense',
};

export default function ErpKobepayInboxApp() {
  const [rows, setRows] = useState<Receipt[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<Status | 'all'>('all');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [suppliers, setSuppliers] = useState<ErpSupplier[]>([]);
  const [tab, setTab] = useState<'inbox' | 'providers'>('inbox');
  const [error, setError] = useState<string | null>(null);

  // Provider creation
  const [showProviderForm, setShowProviderForm] = useState(false);
  const [newProviderName, setNewProviderName] = useState('');
  const [newProviderEmail, setNewProviderEmail] = useState('');
  const [revealKey, setRevealKey] = useState<Provider | null>(null);

  // Resolve dialog
  const [resolveOpen, setResolveOpen] = useState<Receipt | null>(null);
  const [chosenSupplier, setChosenSupplier] = useState('');

  const reload = useCallback(async () => {
    try {
      const [r, s, p, sup] = await Promise.all([
        api<Receipt[]>(filter === 'all' ? '/erp/kobepay-inbox' : `/erp/kobepay-inbox?status=${filter}`),
        api<Record<string, number>>('/erp/kobepay-inbox/summary'),
        api<Provider[]>('/erp/kobepay-inbox/providers'),
        api<ErpSupplier[]>('/erp/sourcing/suppliers'),
      ]);
      setRows(r); setSummary(s); setProviders(p); setSuppliers(sup);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [filter]);

  useEffect(() => {
    (async () => { try { await ensureSession(); } catch { /* offline */ } await reload(); })();
  }, [reload]);

  const handleCreateProvider = async () => {
    if (!newProviderName.trim()) return;
    try {
      const p = await api<Provider>('/erp/kobepay-inbox/providers', {
        method: 'POST',
        body: JSON.stringify({ name: newProviderName.trim(), contactEmail: newProviderEmail }),
      });
      setNewProviderName(''); setNewProviderEmail('');
      setShowProviderForm(false);
      setRevealKey(p);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleToggleProvider = async (p: Provider) => {
    try {
      await api(`/erp/kobepay-inbox/providers/${p.id}`, {
        method: 'PATCH', body: JSON.stringify({ active: !p.active }),
      });
      await reload();
    } catch { /* */ }
  };

  const handleDeleteProvider = async (p: Provider) => {
    try {
      await api(`/erp/kobepay-inbox/providers/${p.id}`, { method: 'DELETE' });
      await reload();
    } catch { /* */ }
  };

  const handleResolveAttach = async () => {
    if (!resolveOpen || !chosenSupplier) return;
    try {
      await api(`/erp/kobepay-inbox/${resolveOpen.id}/attach-supplier`, {
        method: 'PATCH', body: JSON.stringify({ supplierId: chosenSupplier }),
      });
      setResolveOpen(null); setChosenSupplier('');
      await reload();
    } catch { /* */ }
  };
  const handleResolveCreate = async () => {
    if (!resolveOpen) return;
    try {
      await api(`/erp/kobepay-inbox/${resolveOpen.id}/create-supplier`, {
        method: 'POST',
        body: JSON.stringify({ name: resolveOpen.supplierName || `Supplier ${resolveOpen.supplierPhone}` }),
      });
      setResolveOpen(null);
      await reload();
    } catch { /* */ }
  };
  const handleResolveExpense = async () => {
    if (!resolveOpen) return;
    try {
      await api(`/erp/kobepay-inbox/${resolveOpen.id}/expense`, { method: 'PATCH', body: JSON.stringify({}) });
      setResolveOpen(null);
      await reload();
    } catch { /* */ }
  };
  const handleResolveDefer = async () => {
    if (!resolveOpen) return;
    try {
      await api(`/erp/kobepay-inbox/${resolveOpen.id}/defer`, { method: 'PATCH' });
      setResolveOpen(null);
      await reload();
    } catch { /* */ }
  };

  const filteredRows = useMemo(() => rows, [rows]);

  return (
    <div className="flex h-full w-full flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
        <div className="flex items-center gap-3">
          <Inbox className="h-5 w-5 text-orange-400" />
          <div>
            <h1 className="text-base font-semibold">KobePay Inbox</h1>
            <p className="text-xs text-slate-400">Trade-finance receipts pushed by your KobePay providers · matched only within your account</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={reload}>
            <RefreshCw className="h-4 w-4" /><span className="ml-1.5 text-xs">Refresh</span>
          </Button>
        </div>
      </header>

      <div className="flex gap-1 border-b border-slate-800 px-5 pt-2">
        {(['inbox', 'providers'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm rounded-t-md ${tab === t ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-white'}`}>
            {t === 'inbox' ? 'Inbox' : 'KobePay Providers'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-5">
        {error && (
          <div className="mb-3 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</div>
        )}

        {tab === 'inbox' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                <button key={s} onClick={() => setFilter(s)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    filter === s ? 'border-orange-500/40 bg-orange-500/10' : 'border-slate-800 bg-[#13131f] hover:border-slate-700'
                  }`}>
                  <p className="text-xs text-slate-400">{STATUS_LABEL[s]}</p>
                  <p className="text-2xl font-bold text-white mt-1">{summary[s] ?? 0}</p>
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <Button size="sm" variant={filter === 'all' ? 'default' : 'ghost'} onClick={() => setFilter('all')}
                className={filter === 'all' ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'text-slate-300'}>
                Show all
              </Button>
              <p className="text-xs text-slate-500">
                Supplier match always runs scoped to your account. KobePay never sees your supplier list.
              </p>
            </div>
            <Card className="bg-[#13131f] border-slate-800">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-xs text-slate-400 border-b border-slate-800">
                      <th className="text-left py-3 px-4">Receipt</th>
                      <th className="text-left">From provider</th>
                      <th className="text-left">Supplier</th>
                      <th className="text-left">City</th>
                      <th className="text-right">Sent</th>
                      <th className="text-right">Supplier got</th>
                      <th className="text-left">Status</th>
                      <th className="text-right pr-4">Action</th>
                    </tr></thead>
                    <tbody>
                      {filteredRows.length === 0 && (
                        <tr><td colSpan={8} className="py-8 text-center text-slate-500">No receipts {filter !== 'all' ? `with status ${STATUS_LABEL[filter as Status]}` : 'yet'}.</td></tr>
                      )}
                      {filteredRows.map((r) => (
                        <tr key={r.id} className="border-b border-slate-800/50">
                          <td className="py-3 px-4">
                            <div className="font-mono text-xs text-slate-300">{r.kobepayReceiptId}</div>
                            <div className="text-[10px] text-slate-500">{new Date(r.createdAt).toLocaleString()}</div>
                          </td>
                          <td className="text-slate-300">{r.kobepayBusinessName || '-'}</td>
                          <td>
                            <div className="text-white text-sm">{r.supplierName || '-'}</div>
                            <div className="font-mono text-[11px] text-slate-400">{r.supplierPhone}</div>
                          </td>
                          <td className="text-slate-300">{r.supplierCity || '-'}</td>
                          <td className="text-right text-slate-200 font-mono">{Number(r.sentAmount).toLocaleString()} {r.sentCurrency}</td>
                          <td className="text-right text-slate-200 font-mono">{Number(r.supplierReceivedAmount).toLocaleString()} {r.supplierCurrency}</td>
                          <td>
                            <Badge variant="outline" className={STATUS_BADGE[r.allocationStatus]}>
                              {(r.allocationStatus === 'supplier_missing' || r.allocationStatus === 'needs_review') ? (
                                <span className="inline-flex items-center"><HelpCircle className="w-3 h-3 mr-1" />{STATUS_LABEL[r.allocationStatus]}</span>
                              ) : STATUS_LABEL[r.allocationStatus]}
                            </Badge>
                            {r.reviewReason && (
                              <div className="text-[10px] text-slate-500 mt-1 max-w-xs">{r.reviewReason}</div>
                            )}
                          </td>
                          <td className="text-right pr-4">
                            {(r.allocationStatus === 'supplier_missing' || r.allocationStatus === 'needs_review' || r.allocationStatus === 'po_missing') && (
                              <Button size="sm" onClick={() => { setResolveOpen(r); setChosenSupplier(''); }}
                                className="bg-orange-600 hover:bg-orange-700 text-white">
                                Resolve
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {tab === 'providers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">
                Generate one apiKey per KobePay business you work with. Share the key out-of-band. Revoking the key blocks further inbound receipts.
              </p>
              <Button onClick={() => setShowProviderForm(true)} className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white">
                <Plus className="h-4 w-4 mr-1" /> New provider
              </Button>
            </div>
            <Card className="bg-[#13131f] border-slate-800">
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead><tr className="text-xs text-slate-400 border-b border-slate-800">
                    <th className="text-left py-3 px-4">Name</th>
                    <th className="text-left">Contact</th>
                    <th className="text-left">API key</th>
                    <th className="text-center">Active</th>
                    <th className="text-right pr-4">Actions</th>
                  </tr></thead>
                  <tbody>
                    {providers.length === 0 && (
                      <tr><td colSpan={5} className="py-8 text-center text-slate-500">No KobePay providers yet.</td></tr>
                    )}
                    {providers.map((p) => (
                      <tr key={p.id} className="border-b border-slate-800/50">
                        <td className="py-3 px-4 text-white">{p.name}</td>
                        <td className="text-slate-300">{p.contactEmail || '-'}</td>
                        <td className="font-mono text-[11px] text-slate-400">
                          {p.apiKey.slice(0, 14)}…
                          <button onClick={() => { navigator.clipboard?.writeText(p.apiKey); }} className="ml-2 text-slate-500 hover:text-white" title="Copy full key">
                            <Copy className="inline w-3 h-3" />
                          </button>
                        </td>
                        <td className="text-center">
                          <button onClick={() => handleToggleProvider(p)}
                            className={`w-10 h-5 rounded-full transition-colors relative ${p.active ? 'bg-emerald-500/40' : 'bg-slate-600'}`}>
                            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${p.active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                          </button>
                        </td>
                        <td className="text-right pr-4">
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteProvider(p)} className="text-rose-300 hover:bg-rose-500/10">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Dialog open={showProviderForm} onOpenChange={setShowProviderForm}>
        <DialogContent className="bg-[#13131f] border-slate-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-fuchsia-400" />Authorise a KobePay provider</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Provider business name</label>
              <Input value={newProviderName} onChange={(e) => setNewProviderName(e.target.value)} className="bg-slate-950 border-slate-700 text-white" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Contact email (optional)</label>
              <Input value={newProviderEmail} onChange={(e) => setNewProviderEmail(e.target.value)} className="bg-slate-950 border-slate-700 text-white" />
            </div>
            <Button onClick={handleCreateProvider} className="w-full bg-fuchsia-600 hover:bg-fuchsia-700">
              Generate key
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!revealKey} onOpenChange={(o) => !o && setRevealKey(null)}>
        <DialogContent className="bg-[#13131f] border-slate-800 text-white max-w-lg">
          <DialogHeader><DialogTitle>Provider key generated — copy now</DialogTitle></DialogHeader>
          {revealKey && (
            <div className="space-y-3 pt-2">
              <p className="text-xs text-slate-400">Share this key with <span className="text-white">{revealKey.name}</span> out-of-band. You won't see it again in full after closing.</p>
              <pre className="rounded-md border border-slate-800 bg-slate-950 p-3 font-mono text-[12px] text-amber-300 break-all">{revealKey.apiKey}</pre>
              <Button onClick={() => navigator.clipboard?.writeText(revealKey.apiKey)} className="w-full bg-emerald-600 hover:bg-emerald-700">
                <Copy className="w-4 h-4 mr-1" /> Copy to clipboard
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!resolveOpen} onOpenChange={(o) => !o && setResolveOpen(null)}>
        <DialogContent className="bg-[#13131f] border-slate-800 text-white max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><HelpCircle className="w-5 h-5 text-orange-400" />Resolve receipt</DialogTitle></DialogHeader>
          {resolveOpen && (
            <div className="space-y-4">
              <div className="rounded-md border border-slate-800 bg-slate-950 p-3 text-xs">
                <p className="text-slate-400">Receipt <span className="font-mono text-white">{resolveOpen.kobepayReceiptId}</span></p>
                <p className="text-slate-400 mt-1">From provider <span className="text-white">{resolveOpen.kobepayBusinessName}</span></p>
                <p className="text-slate-400 mt-1">Supplier phone <span className="font-mono text-white">{resolveOpen.supplierPhone}</span></p>
                {resolveOpen.reviewReason && <p className="text-amber-400 mt-2">{resolveOpen.reviewReason}</p>}
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Attach to one of your suppliers</label>
                <Select value={chosenSupplier} onValueChange={setChosenSupplier}>
                  <SelectTrigger className="bg-slate-950 border-slate-700 text-white"><SelectValue placeholder="Pick from your supplier list" /></SelectTrigger>
                  <SelectContent className="bg-[#13131f] border-slate-700">
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-white">{s.name} · {s.phone || '—'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleResolveAttach} disabled={!chosenSupplier} className="mt-2 w-full bg-emerald-600 hover:bg-emerald-700">
                  Attach
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button onClick={handleResolveCreate} variant="outline" className="border-slate-700 text-white hover:bg-slate-800">Create new</Button>
                <Button onClick={handleResolveExpense} variant="outline" className="border-slate-700 text-white hover:bg-slate-800">Mark expense</Button>
                <Button onClick={handleResolveDefer} variant="ghost" className="text-slate-400">Ignore for now</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
