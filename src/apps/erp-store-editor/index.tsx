import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Globe2, Loader2, Package, Plus, RefreshCw, Save, Search, Store, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';

type StoreSettings = {
  storeName: string;
  tagline: string;
  customDomain: string | null;
  domainSlug: string;
  bannerHeadline: string;
  bannerSubtext: string;
  bannerCta: string;
  primaryColor: string;
  accentColor: string;
  showStock: boolean;
  showCategoryBadge: boolean;
  showQuickAdd: boolean;
  showSearch: boolean;
  showCategoryNav: boolean;
  showCartIcon: boolean;
  footerText: string;
  template: 'generic' | 'jerseys' | 'site';
  isPublished: boolean;
  publishedUrl: string | null;
  publishedAt: string | null;
};

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  category?: string | null;
  brand?: string | null;
  price: number | string;
  currency: string;
  stock: number;
  imageUrl?: string | null;
  active?: boolean;
  featured?: boolean;
};

type Readiness = { ready?: boolean; mode?: string; missing?: string[]; checks?: Record<string, boolean> };
type Tab = 'store' | 'products' | 'publish';

const blankSettings: StoreSettings = {
  storeName: '', tagline: '', customDomain: null, domainSlug: '', bannerHeadline: '', bannerSubtext: '', bannerCta: 'Shop Now',
  primaryColor: '#6366f1', accentColor: '#8b5cf6', showStock: true, showCategoryBadge: true, showQuickAdd: true,
  showSearch: true, showCategoryNav: true, showCartIcon: true, footerText: '', template: 'generic', isPublished: false,
  publishedUrl: null, publishedAt: null,
};

export default function StoreEditor() {
  const [tab, setTab] = useState<Tab>('store');
  const [settings, setSettings] = useState<StoreSettings>(blankSettings);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [settingsRow, productRows, readinessRow] = await Promise.all([
        api<StoreSettings>('/store-settings', { offlineFallback: false }),
        api<ProductRow[]>('/pos/products', { offlineFallback: false }),
        api<Readiness>('/store-settings/publish-readiness', { offlineFallback: false }).catch(() => null),
      ]);
      setSettings({ ...blankSettings, ...(settingsRow || {}) });
      setProducts(Array.isArray(productRows) ? productRows : []);
      setReadiness(readinessRow);
    } catch (cause) {
      setError((cause as Error).message || 'Store editor could not load live data.');
      setProducts([]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const update = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) => setSettings((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true); setError(''); setNotice('');
    try {
      const saved = await api<StoreSettings>('/store-settings', {
        method: 'PUT', offlineFallback: false,
        body: JSON.stringify({
          storeName: settings.storeName.trim(), tagline: settings.tagline.trim(), customDomain: settings.customDomain || null,
          bannerHeadline: settings.bannerHeadline.trim(), bannerSubtext: settings.bannerSubtext.trim(), bannerCta: settings.bannerCta.trim(),
          primaryColor: settings.primaryColor, accentColor: settings.accentColor, showStock: settings.showStock,
          showCategoryBadge: settings.showCategoryBadge, showQuickAdd: settings.showQuickAdd, showSearch: settings.showSearch,
          showCategoryNav: settings.showCategoryNav, showCartIcon: settings.showCartIcon, footerText: settings.footerText.trim(), template: settings.template,
        }),
      });
      setSettings({ ...blankSettings, ...saved });
      setNotice('Store settings saved.');
    } catch (cause) { setError((cause as Error).message || 'Could not save store settings.'); }
    finally { setSaving(false); }
  };

  const publish = async () => {
    setSaving(true); setError(''); setNotice('');
    try {
      const row = await api<StoreSettings>('/store-settings/publish', { method: 'POST', offlineFallback: false });
      setSettings({ ...blankSettings, ...row });
      setNotice('Store published successfully.');
      const next = await api<Readiness>('/store-settings/publish-readiness', { offlineFallback: false }).catch(() => null);
      setReadiness(next);
    } catch (cause) { setError((cause as Error).message || 'Publishing failed.'); }
    finally { setSaving(false); }
  };

  const unpublish = async () => {
    setSaving(true); setError(''); setNotice('');
    try {
      const row = await api<StoreSettings>('/store-settings/publish', { method: 'DELETE', offlineFallback: false });
      setSettings({ ...blankSettings, ...row });
      setNotice('Store unpublished.');
    } catch (cause) { setError((cause as Error).message || 'Could not unpublish store.'); }
    finally { setSaving(false); }
  };

  const patchProduct = async (row: ProductRow, data: Partial<ProductRow>) => {
    try { await api(`/pos/products/${row.id}`, { method: 'PATCH', offlineFallback: false, body: JSON.stringify(data) }); await load(); }
    catch (cause) { setError((cause as Error).message || 'Could not update product.'); }
  };

  const removeProduct = async (row: ProductRow) => {
    if (!window.confirm(`Delete ${row.name}?`)) return;
    try { await api(`/pos/products/${row.id}`, { method: 'DELETE', offlineFallback: false }); await load(); }
    catch (cause) { setError((cause as Error).message || 'Could not delete product.'); }
  };

  const filtered = products.filter((row) => !query.trim() || `${row.sku} ${row.name} ${row.category ?? ''} ${row.brand ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-950 text-white">
      <header className="shrink-0 border-b border-white/10 bg-slate-900/90">
        <div className="flex h-16 items-center gap-3 px-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/15 text-indigo-300"><Store className="h-5 w-5" /></div>
          <div><h1 className="font-black">Store Editor</h1><p className="text-[11px] text-slate-500">Live storefront settings, catalogue and publishing</p></div>
          <button onClick={() => void load()} disabled={loading} className="ml-auto grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-slate-400"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
        <nav className="flex px-3">{(['store', 'products', 'publish'] as Tab[]).map((id) => <button key={id} onClick={() => setTab(id)} className={`h-11 border-b-2 px-3 text-xs font-black capitalize ${tab === id ? 'border-indigo-300 text-indigo-300' : 'border-transparent text-slate-500'}`}>{id}</button>)}</nav>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto p-4">
        {error && <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div>}
        {notice && <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{notice}</div>}
        {loading ? <div className="grid place-items-center py-24 text-slate-500"><Loader2 className="h-6 w-6 animate-spin" /></div> : tab === 'store' ? (
          <div className="mx-auto max-w-4xl space-y-4">
            <Section title="Store identity"><div className="grid gap-3 md:grid-cols-2"><Field label="Store name" value={settings.storeName} onChange={(value) => update('storeName', value)} /><Field label="Tagline" value={settings.tagline} onChange={(value) => update('tagline', value)} /><Field label="Custom domain (optional)" value={settings.customDomain || ''} onChange={(value) => update('customDomain', value || null)} /><Select label="Template" value={settings.template} onChange={(value) => update('template', value as StoreSettings['template'])} options={[['generic', 'Commerce'], ['jerseys', 'Jersey shop'], ['site', 'Business site']]} /></div></Section>
            <Section title="Hero"><div className="grid gap-3 md:grid-cols-2"><Field label="Headline" value={settings.bannerHeadline} onChange={(value) => update('bannerHeadline', value)} /><Field label="Call to action" value={settings.bannerCta} onChange={(value) => update('bannerCta', value)} /><div className="md:col-span-2"><Field label="Subtext" value={settings.bannerSubtext} onChange={(value) => update('bannerSubtext', value)} /></div></div></Section>
            <Section title="Theme & storefront options"><div className="grid gap-4 md:grid-cols-2"><Color label="Primary color" value={settings.primaryColor} onChange={(value) => update('primaryColor', value)} /><Color label="Accent color" value={settings.accentColor} onChange={(value) => update('accentColor', value)} /><div className="md:col-span-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{([['showStock', 'Show stock'], ['showCategoryBadge', 'Category badges'], ['showQuickAdd', 'Quick add button'], ['showSearch', 'Search'], ['showCategoryNav', 'Category navigation'], ['showCartIcon', 'Cart icon']] as Array<[keyof StoreSettings, string]>).map(([key, label]) => <Toggle key={String(key)} label={label} checked={Boolean(settings[key])} onChange={(value) => update(key as 'showStock', value)} />)}</div><div className="md:col-span-2"><Field label="Footer text" value={settings.footerText} onChange={(value) => update('footerText', value)} /></div></div></Section>
            <button onClick={() => void save()} disabled={saving || !settings.storeName.trim()} className="inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 font-black disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save store</button>
          </div>
        ) : tab === 'products' ? (
          <div className="mx-auto max-w-6xl space-y-4"><div className="flex gap-2"><div className="relative max-w-xl flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search real catalogue" className="h-10 w-full rounded-xl border border-white/10 bg-slate-900 pl-9 pr-3 text-sm" /></div><button onClick={() => setCreateOpen(true)} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-indigo-600 px-3 text-xs font-black"><Plus className="h-4 w-4" />Quick add product</button></div><div className="rounded-2xl border border-white/10 bg-slate-900 px-4">{filtered.map((row) => <div key={row.id} className="flex flex-wrap items-center gap-3 border-b border-white/10 py-3"><div className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl bg-white/5">{row.imageUrl ? <img src={row.imageUrl} alt="" className="h-full w-full object-cover" /> : <Package className="h-5 w-5 text-slate-500" />}</div><div className="min-w-0 flex-1"><b className="block truncate">{row.name}</b><span className="text-xs text-slate-500">{row.sku} · {row.category || 'Uncategorised'} · stock {row.stock}</span></div><b>{row.currency || 'TZS'} {Number(row.price || 0).toLocaleString()}</b><button onClick={() => void patchProduct(row, { active: row.active === false })} className={`h-8 rounded-lg border px-2 text-xs font-black ${row.active === false ? 'border-slate-700 text-slate-500' : 'border-emerald-500/30 text-emerald-300'}`}>{row.active === false ? 'Inactive' : 'Active'}</button><button onClick={() => void removeProduct(row)} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-rose-300"><Trash2 className="h-4 w-4" /></button></div>)}{!filtered.length && <Empty body="No products found. Add your first real product; KobeOS will not insert placeholders." />}</div></div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-4"><Section title="Publishing status"><div className="space-y-3"><div className="flex items-center gap-3"><Globe2 className={`h-6 w-6 ${settings.isPublished ? 'text-emerald-300' : 'text-slate-500'}`} /><div><b>{settings.isPublished ? 'Published' : 'Not published'}</b><p className="text-xs text-slate-500">{settings.publishedUrl || (settings.domainSlug ? `https://${settings.domainSlug}.kobeapptz.com` : 'Save a store name to generate a subdomain.')}</p></div>{settings.publishedUrl && <a href={settings.publishedUrl} target="_blank" rel="noreferrer" className="ml-auto inline-flex h-9 items-center gap-1 rounded-lg border border-white/10 px-3 text-xs font-black"><ExternalLink className="h-3.5 w-3.5" />Open</a>}</div>{readiness && <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-slate-400"><div className="font-black text-white">Publish readiness: {readiness.ready ? 'Ready' : 'Needs setup'}</div>{readiness.mode && <div className="mt-1">Mode: {readiness.mode}</div>}{readiness.missing?.length ? <div className="mt-1 text-amber-300">Missing: {readiness.missing.join(', ')}</div> : null}</div>}<div className="flex gap-2">{settings.isPublished ? <button onClick={() => void unpublish()} disabled={saving} className="h-11 rounded-xl border border-rose-500/30 px-4 font-black text-rose-300">Unpublish</button> : <button onClick={() => void publish()} disabled={saving || !settings.domainSlug} className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 font-black disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Publish now</button>}</div></div></Section></div>
        )}
      </main>
      {createOpen && <CreateProductDialog onClose={() => setCreateOpen(false)} onSaved={async () => { setCreateOpen(false); await load(); }} />}
    </div>
  );
}

function CreateProductDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({ sku: '', name: '', category: '', price: '', stock: '0', currency: 'TZS', imageUrl: '', description: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const save = async () => {
    setBusy(true); setError('');
    try {
      await api('/pos/products', { method: 'POST', offlineFallback: false, body: JSON.stringify({ sku: form.sku.trim(), name: form.name.trim(), category: form.category.trim() || undefined, price: Number(form.price), stock: Number(form.stock || 0), currency: form.currency.trim() || 'TZS', imageUrl: form.imageUrl.trim() || undefined, description: form.description.trim() || undefined, active: true, sourceType: 'QUICK_ADD_IMPORT' }) });
      await onSaved();
    } catch (cause) { setError((cause as Error).message || 'Could not create product.'); }
    finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-[10000] grid place-items-center bg-black/70 p-4"><div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-4"><div className="flex items-center"><h2 className="text-lg font-black">Quick add product</h2><button onClick={onClose} className="ml-auto grid h-8 w-8 place-items-center rounded-lg border border-white/10"><X className="h-4 w-4" /></button></div><div className="mt-4 space-y-3"><Field label="SKU" value={form.sku} onChange={(value) => set('sku', value)} /><Field label="Product name" value={form.name} onChange={(value) => set('name', value)} /><Field label="Category" value={form.category} onChange={(value) => set('category', value)} /><div className="grid grid-cols-2 gap-3"><Field label="Price" type="number" value={form.price} onChange={(value) => set('price', value)} /><Field label="Stock" type="number" value={form.stock} onChange={(value) => set('stock', value)} /></div><Field label="Image URL" value={form.imageUrl} onChange={(value) => set('imageUrl', value)} /><Field label="Description" value={form.description} onChange={(value) => set('description', value)} />{error && <p className="text-sm text-rose-300">{error}</p>}<button onClick={() => void save()} disabled={busy || !form.sku.trim() || !form.name.trim() || !form.price} className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-indigo-600 font-black disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create product'}</button></div></div></div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-white/10 bg-slate-900 p-4"><h2 className="mb-4 font-black">{title}</h2>{children}</section>; }
function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label className="grid gap-1 text-xs text-slate-400">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white" /></label>; }
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) { return <label className="grid gap-1 text-xs text-slate-400">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white">{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>; }
function Color({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="grid gap-1 text-xs text-slate-400">{label}<div className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-2"><input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-7 w-9 bg-transparent" /><input value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none" /></div></label>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex h-10 items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 text-xs font-bold text-slate-300">{label}<input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>; }
function Empty({ body }: { body: string }) { return <div className="py-12 text-center text-sm text-slate-500">{body}</div>; }
