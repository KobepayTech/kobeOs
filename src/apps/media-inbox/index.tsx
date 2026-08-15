import { DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Archive,
  Check,
  CheckSquare,
  ImagePlus,
  Images,
  Link2,
  Loader2,
  PackagePlus,
  RefreshCw,
  Search,
  Sparkles,
  Square,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { api, apiArray } from '@/lib/api';

type Status = 'UNPROCESSED' | 'PROCESSING' | 'PROCESSED' | 'FAILED';

interface MediaItem {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  status: Status;
  folder: string;
  moduleId: string;
  entityType: string;
  entityId?: string | null;
  category: string;
  subcategory: string;
  metadata: Record<string, unknown>;
  aiSuggestions: Record<string, unknown>;
  error: string;
  createdAt: string;
  processedAt?: string | null;
}

interface UploadResponse {
  item: MediaItem;
  duplicate: boolean;
}

interface ItemEdit {
  name?: string;
  sku?: string;
  category?: string;
  subcategory?: string;
  price?: string;
  cost?: string;
  stock?: string;
  sizes?: string;
  colours?: string;
  tags?: string;
  supplier?: string;
  description?: string;
}

type QuickAddSourceType = 'QUICK_ADD_PHOTO' | 'QUICK_ADD_SCREENSHOT' | 'QUICK_ADD_MESSAGE' | 'QUICK_ADD_IMPORT';

export interface MediaInboxAppProps {
  /** Product Manager embeds this as the canonical non-PO product-entry flow. */
  productMode?: boolean;
}

const input = 'h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const label = 'mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-slate-500';
const targets = [
  { moduleId: 'erp', entityType: 'product', label: 'ERP / E-commerce products' },
  { moduleId: 'hotel', entityType: 'menu-item', label: 'Hotel menu media' },
  { moduleId: 'property', entityType: 'listing', label: 'Property listing media' },
  { moduleId: 'cargo', entityType: 'proof', label: 'Cargo proof media' },
  { moduleId: 'creator', entityType: 'content', label: 'Creator media' },
];

function filenameName(filename: string) {
  return filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function list(value: string) { return value.split(',').map((item) => item.trim()).filter(Boolean); }
function mb(bytes: number) { return `${(Number(bytes || 0) / 1024 / 1024).toFixed(1)} MB`; }

export default function MediaInboxApp({ productMode = false }: MediaInboxAppProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>('UNPROCESSED');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [edits, setEdits] = useState<Record<string, ItemEdit>>({});
  const [query, setQuery] = useState('');
  const [targetKey, setTargetKey] = useState('erp:product');
  const [sourceType, setSourceType] = useState<QuickAddSourceType>('QUICK_ADD_PHOTO');
  const [defaults, setDefaults] = useState<ItemEdit>({ category: '', subcategory: '', price: '0', cost: '0', stock: '0', sizes: '', colours: '', tags: '', supplier: '', description: '' });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0, duplicates: 0 });
  const [processing, setProcessing] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showLinks, setShowLinks] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [importing, setImporting] = useState(false);
  const [linkFails, setLinkFails] = useState<Array<{ url: string; error: string }>>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await api<unknown>(`/media/inbox?status=${status}`);
      setItems(apiArray<MediaItem>(response));
      setSelected(new Set());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load media inbox.');
    }
  }, [status]);
  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return items;
    return items.filter((item) => [item.originalName, item.category, item.subcategory, item.moduleId, item.entityType].some((field) => String(field || '').toLowerCase().includes(value)));
  }, [items, query]);
  const selectedItems = useMemo(() => items.filter((item) => selected.has(item.id)), [items, selected]);
  const activeItem = selectedItems.length === 1 ? selectedItems[0] : null;
  const target = targets.find((item) => `${item.moduleId}:${item.entityType}` === targetKey) || targets[0];

  const upload = async (files: File[]) => {
    const media = files.filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'));
    if (!media.length) { setError('Select image or video files.'); return; }
    setUploading(true); setError(null); setNotice(null); setUploadProgress({ done: 0, total: media.length, duplicates: 0 });
    let duplicates = 0;
    try {
      // Batches of ten keep memory usage controlled and provide truthful batch progress.
      for (let offset = 0; offset < media.length; offset += 10) {
        const batch = media.slice(offset, offset + 10);
        const data = new FormData();
        batch.forEach((file) => data.append('files', file));
        const response = await api<unknown>('/media/inbox/upload', { method: 'POST', body: data });
        const result = apiArray<UploadResponse>(response);
        duplicates += result.filter((entry) => entry.duplicate).length;
        setUploadProgress({ done: Math.min(media.length, offset + batch.length), total: media.length, duplicates });
      }
      setNotice(`${media.length - duplicates} new file${media.length - duplicates === 1 ? '' : 's'} uploaded${duplicates ? `; ${duplicates} duplicate${duplicates === 1 ? '' : 's'} reused` : ''}.`);
      setStatus('UNPROCESSED');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Upload failed.');
    } finally { setUploading(false); }
  };

  // Bulk import from a pasted list of links. Accepts anything — one URL per
  // line, comma/space separated, or a wall of Google Drive links — and pulls
  // every http(s) token out of it.
  const importUrls = async () => {
    const urls = (linkText.match(/https?:\/\/[^\s,]+/g) || []).map((u) => u.replace(/[)>\]]+$/, ''));
    const unique = [...new Set(urls)];
    if (!unique.length) { setError('Paste at least one image link (https://…).'); return; }
    setImporting(true); setError(null); setNotice(null); setLinkFails([]);
    try {
      const response = await api<unknown>('/media/inbox/import-urls', { method: 'POST', body: JSON.stringify({ urls: unique }) });
      const results = apiArray<{ url: string; ok: boolean; duplicate: boolean; error?: string }>(response);
      const added = results.filter((r) => r.ok && !r.duplicate).length;
      const dupes = results.filter((r) => r.ok && r.duplicate).length;
      const fails = results.filter((r) => !r.ok).map((r) => ({ url: r.url, error: r.error || 'Failed' }));
      setLinkFails(fails);
      setNotice(`${added} image${added === 1 ? '' : 's'} imported${dupes ? `; ${dupes} duplicate${dupes === 1 ? '' : 's'} reused` : ''}${fails.length ? `; ${fails.length} failed` : ''}.`);
      if (!fails.length) { setLinkText(''); setShowLinks(false); }
      setStatus('UNPROCESSED');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Import failed.');
    } finally { setImporting(false); }
  };

  // One tap: turn every unprocessed image into a generic, published product.
  const [generating, setGenerating] = useState(false);
  const generateProducts = async () => {
    if (!confirm('Create a generic, published product from every unprocessed image? You can edit names, prices and categories afterwards.')) return;
    setGenerating(true); setError(null); setNotice(null);
    try {
      const res = await api<{ processed: number }>('/media/inbox/generate-products', { method: 'POST', body: JSON.stringify({ includeFailed: true, sourceType }) });
      setNotice(`${res.processed} product${res.processed === 1 ? '' : 's'} created and published from your images.`);
      setStatus('PROCESSED');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create products.');
    } finally { setGenerating(false); }
  };

  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault(); setDragging(false); void upload([...event.dataTransfer.files]);
  };
  const toggle = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const selectAll = () => setSelected(selected.size === visible.length ? new Set() : new Set(visible.map((item) => item.id)));
  const edit = (id: string, patch: ItemEdit) => setEdits((current) => ({ ...current, [id]: { ...(current[id] || {}), ...patch } }));

  const suggest = async () => {
    if (!selected.size) return;
    setSuggesting(true); setError(null);
    try {
      const response = await api<unknown>('/media/inbox/suggest', {
        method: 'POST',
        body: JSON.stringify({ itemIds: [...selected], moduleId: target.moduleId, categoryHint: defaults.category || undefined }),
      });
      const rows = apiArray<{ itemId: string; suggestions: Record<string, unknown> }>(response);
      setEdits((current) => {
        const next = { ...current };
        rows.forEach(({ itemId, suggestions }) => {
          next[itemId] = {
            ...(next[itemId] || {}),
            name: String(suggestions.name || next[itemId]?.name || ''),
            category: String(suggestions.category || next[itemId]?.category || ''),
            subcategory: String(suggestions.subcategory || next[itemId]?.subcategory || ''),
            colours: Array.isArray(suggestions.colours) ? suggestions.colours.join(', ') : String(suggestions.colour || next[itemId]?.colours || ''),
            sizes: Array.isArray(suggestions.sizes) ? suggestions.sizes.join(', ') : String(next[itemId]?.sizes || ''),
            description: String(suggestions.description || next[itemId]?.description || ''),
            tags: Array.isArray(suggestions.tags) ? suggestions.tags.join(', ') : String(next[itemId]?.tags || ''),
          };
        });
        return next;
      });
      setNotice('AI suggestions added for review. Nothing was published automatically.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not generate suggestions.'); }
    finally { setSuggesting(false); }
  };

  const process = async () => {
    if (!selected.size) return;
    setProcessing(true); setError(null); setNotice(null);
    try {
      const defaultMetadata = {
        category: defaults.category,
        subcategory: defaults.subcategory,
        price: Number(defaults.price || 0),
        cost: Number(defaults.cost || 0),
        stock: Number(defaults.stock || 0),
        sizes: list(defaults.sizes || ''),
        colours: list(defaults.colours || ''),
        tags: list(defaults.tags || ''),
        supplier: defaults.supplier,
        description: defaults.description,
      };
      const overrides = selectedItems.map((item) => {
        const row = edits[item.id] || {};
        return {
          itemId: item.id,
          metadata: {
            name: row.name || filenameName(item.originalName),
            sku: row.sku || undefined,
            category: row.category || undefined,
            subcategory: row.subcategory || undefined,
            price: row.price === undefined || row.price === '' ? undefined : Number(row.price),
            cost: row.cost === undefined || row.cost === '' ? undefined : Number(row.cost),
            stock: row.stock === undefined || row.stock === '' ? undefined : Number(row.stock),
            sizes: row.sizes ? list(row.sizes) : undefined,
            colours: row.colours ? list(row.colours) : undefined,
            tags: row.tags ? list(row.tags) : undefined,
            supplier: row.supplier || undefined,
            description: row.description || undefined,
          },
        };
      });
      const result = await api<{ processed: number }>('/media/inbox/process', {
        method: 'POST',
        body: JSON.stringify({
          itemIds: [...selected],
          moduleId: target.moduleId,
          entityType: target.entityType,
          category: defaults.category || undefined,
          subcategory: defaults.subcategory || undefined,
          defaults: defaultMetadata,
          overrides,
          createEntities: true,
          sourceType,
        }),
      });
      setNotice(`${result.processed} image${result.processed === 1 ? '' : 's'} processed and moved to processed/${target.moduleId}/${target.entityType}.`);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Processing failed. No partial product batch was saved.'); }
    finally { setProcessing(false); }
  };

  const remove = async (item: MediaItem) => {
    if (!window.confirm(`Delete ${item.originalName}?`)) return;
    try { await api(`/media/inbox/${item.id}`, { method: 'DELETE' }); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not delete image.'); }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-100 text-slate-900">
      <header className="shrink-0 border-b border-slate-200 bg-white px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 text-white"><Images className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1"><h1 className="font-extrabold">{productMode ? 'Quick Add Products' : 'Shared Media Inbox'}</h1><p className="text-[11px] text-slate-500">{productMode ? 'Add non-PO stock from photos, screenshots, messages, or imports' : 'Upload once, classify in a gallery, then attach to any KobeOS module'}</p></div>
          <button onClick={() => void load()} className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-500"><RefreshCw className="h-4 w-4" /></button>
          <button onClick={() => { setShowLinks((v) => !v); setLinkFails([]); }} className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-4 text-xs font-extrabold ${showLinks ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600'}`}><Link2 className="h-4 w-4" />Paste links</button>
          <button onClick={() => void generateProducts()} disabled={generating} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-4 text-xs font-extrabold text-emerald-700 disabled:opacity-40">{generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}Publish all as products</button>
          <button onClick={() => fileInput.current?.click()} disabled={uploading} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-extrabold text-white disabled:opacity-40"><ImagePlus className="h-4 w-4" />Upload images</button>
          <input ref={fileInput} className="hidden" type="file" accept="image/*,video/*" multiple onChange={(event) => { void upload([...(event.target.files || [])]); event.currentTarget.value = ''; }} />
        </div>
        <div className="mt-3 flex items-center gap-1"><button onClick={() => setStatus('UNPROCESSED')} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${status === 'UNPROCESSED' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Unprocessed</button><button onClick={() => setStatus('PROCESSED')} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${status === 'PROCESSED' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Processed archive</button><button onClick={() => setStatus('FAILED')} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${status === 'FAILED' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Needs attention</button></div>
      </header>

      <main className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {showLinks && (
            <div className="m-3 mb-0 rounded-2xl border border-blue-200 bg-blue-50/60 p-3">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-blue-800"><Link2 className="h-4 w-4" />Import from links</div>
              <p className="mt-1 text-[11px] text-slate-500">Paste any number of image or video links — one per line or all at once. Google Drive links must be shared as <b>“Anyone with the link”</b>.</p>
              <textarea
                value={linkText}
                onChange={(event) => setLinkText(event.target.value)}
                placeholder={'https://drive.google.com/open?id=…\nhttps://example.com/photo.jpg\n…'}
                rows={5}
                className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500">{(linkText.match(/https?:\/\/[^\s,]+/g) || []).length} link(s) detected</span>
                <div className="flex-1" />
                <button onClick={() => { setLinkText(''); setLinkFails([]); }} disabled={importing || !linkText} className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600 disabled:opacity-40">Clear</button>
                <button onClick={() => void importUrls()} disabled={importing} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-extrabold text-white disabled:opacity-40">{importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}{importing ? 'Importing…' : 'Import links'}</button>
              </div>
              {importing && <p className="mt-2 text-[10px] text-slate-500">Fetching each link server-side — this can take a moment for large batches.</p>}
              {!!linkFails.length && (
                <div className="mt-2 max-h-32 overflow-auto rounded-xl border border-rose-200 bg-white p-2">
                  <div className="mb-1 text-[10px] font-extrabold uppercase text-rose-600">{linkFails.length} link(s) failed</div>
                  {linkFails.map((f, i) => (
                    <div key={i} className="border-b border-slate-100 py-1 last:border-0">
                      <div className="truncate text-[10px] text-slate-500" title={f.url}>{f.url}</div>
                      <div className="text-[10px] font-semibold text-rose-600">{f.error}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={drop} className={`m-3 rounded-2xl border-2 border-dashed p-4 text-center transition ${dragging ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
            <UploadCloud className="mx-auto h-7 w-7 text-blue-500" /><div className="mt-1 text-sm font-extrabold">Drop product or module images here</div><div className="text-[11px] text-slate-500">Up to 100 images per batch · duplicates are detected by SHA-256</div>
            {uploading && <div className="mx-auto mt-3 max-w-md"><div className="mb-1 flex justify-between text-[10px] font-bold text-slate-500"><span>Uploading {uploadProgress.done}/{uploadProgress.total}</span><span>{uploadProgress.duplicates} duplicate(s)</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${uploadProgress.total ? (uploadProgress.done / uploadProgress.total) * 100 : 0}%` }} /></div></div>}
          </div>
          {error && <div className="mx-3 mb-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"><AlertCircle className="h-4 w-4" />{error}</div>}
          {notice && <button onClick={() => setNotice(null)} className="mx-3 mb-3 flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-xs font-semibold text-emerald-700"><span><Check className="mr-1 inline h-4 w-4" />{notice}</span><X className="h-3.5 w-3.5" /></button>}
          <div className="flex items-center gap-2 border-y border-slate-200 p-3"><button onClick={selectAll} className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 px-3 text-xs font-bold">{selected.size === visible.length && visible.length ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4" />}Select all</button><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search gallery" className="h-9 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-blue-500" /></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">{selected.size} selected</span></div>
          <div className="min-h-0 flex-1 overflow-auto p-3"><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">{visible.map((item) => { const checked = selected.has(item.id); const row = edits[item.id] || {}; return <article key={item.id} className={`group overflow-hidden rounded-xl border bg-white transition ${checked ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-300'}`}><button onClick={() => toggle(item.id)} className="relative block aspect-square w-full overflow-hidden bg-slate-100">{item.mimeType?.startsWith('video/') ? <video src={item.url} muted playsInline preload="metadata" className="h-full w-full object-cover" /> : <img src={item.url} alt={item.originalName} className="h-full w-full object-cover" />}{item.mimeType?.startsWith('video/') && <span className="absolute right-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[8px] font-bold text-white">VIDEO</span>}<span className={`absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-md border shadow ${checked ? 'border-blue-600 bg-blue-600 text-white' : 'border-white bg-white/90 text-slate-400'}`}>{checked ? <Check className="h-4 w-4" /> : <Square className="h-3.5 w-3.5" />}</span>{item.status === 'PROCESSED' && <span className="absolute bottom-2 left-2 rounded-full bg-emerald-600 px-2 py-1 text-[8px] font-bold text-white">{item.folder}</span>}</button><div className="p-2"><input value={row.name ?? String(item.metadata.name || filenameName(item.originalName))} onChange={(event) => edit(item.id, { name: event.target.value })} disabled={item.status === 'PROCESSED'} className="w-full truncate border-0 bg-transparent text-xs font-extrabold outline-none disabled:text-slate-700" title={item.originalName} /><div className="mt-1 flex items-center justify-between text-[9px] text-slate-400"><span>{mb(item.sizeBytes)}</span><button onClick={() => void remove(item)} className="text-slate-300 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button></div>{item.error && <div className="mt-1 line-clamp-2 text-[9px] text-rose-600">{item.error}</div>}</div></article>; })}</div>{!visible.length && <div className="grid h-60 place-items-center text-center text-sm text-slate-400"><div><Archive className="mx-auto mb-2 h-9 w-9 text-slate-300" />{status === 'UNPROCESSED' ? 'The intake gallery is empty. Upload images or videos to begin.' : 'Nothing in this folder.'}</div></div>}</div>
        </section>

        <aside className="min-h-0 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2"><PackagePlus className="h-5 w-5 text-blue-600" /><div><h2 className="font-extrabold">{productMode ? 'Create product batch' : 'Process selected images'}</h2><p className="text-[10px] text-slate-500">Bulk defaults apply to every selected image; individual edits override them.</p></div></div>
          {productMode ? (
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800"><b>Destination:</b> Products → Inventory → Storefront</div>
          ) : (
            <label className="mt-4 block"><span className={label}>Destination</span><select value={targetKey} onChange={(event) => setTargetKey(event.target.value)} className={input}>{targets.map((item) => <option key={`${item.moduleId}:${item.entityType}`} value={`${item.moduleId}:${item.entityType}`}>{item.label}</option>)}</select></label>
          )}
          {productMode && <label className="mt-3 block"><span className={label}>Product source</span><select value={sourceType} onChange={(event) => setSourceType(event.target.value as QuickAddSourceType)} className={input}><option value="QUICK_ADD_PHOTO">Supplier / product photos</option><option value="QUICK_ADD_SCREENSHOT">Screenshot</option><option value="QUICK_ADD_MESSAGE">Supplier message</option><option value="QUICK_ADD_IMPORT">Imported batch</option></select></label>}
          <div className="mt-4 grid grid-cols-2 gap-3"><label><span className={label}>Category</span><input value={defaults.category} onChange={(event) => setDefaults({ ...defaults, category: event.target.value })} className={input} /></label><label><span className={label}>Subcategory</span><input value={defaults.subcategory} onChange={(event) => setDefaults({ ...defaults, subcategory: event.target.value })} className={input} /></label></div>
          {target.moduleId === 'erp' && target.entityType === 'product' && <><div className="mt-3 grid grid-cols-3 gap-2"><label><span className={label}>Price</span><input type="number" min="0" value={defaults.price} onChange={(event) => setDefaults({ ...defaults, price: event.target.value })} className={input} /></label><label><span className={label}>Cost</span><input type="number" min="0" value={defaults.cost} onChange={(event) => setDefaults({ ...defaults, cost: event.target.value })} className={input} /></label><label><span className={label}>Stock</span><input type="number" min="0" value={defaults.stock} onChange={(event) => setDefaults({ ...defaults, stock: event.target.value })} className={input} /></label></div><label className="mt-3 block"><span className={label}>Sizes (comma separated)</span><input value={defaults.sizes} onChange={(event) => setDefaults({ ...defaults, sizes: event.target.value })} className={input} placeholder="S, M, L, XL" /></label><label className="mt-3 block"><span className={label}>Colours</span><input value={defaults.colours} onChange={(event) => setDefaults({ ...defaults, colours: event.target.value })} className={input} placeholder="Black, Blue, Red" /></label><label className="mt-3 block"><span className={label}>Tags</span><input value={defaults.tags} onChange={(event) => setDefaults({ ...defaults, tags: event.target.value })} className={input} /></label><label className="mt-3 block"><span className={label}>Supplier</span><input value={defaults.supplier} onChange={(event) => setDefaults({ ...defaults, supplier: event.target.value })} className={input} /></label><label className="mt-3 block"><span className={label}>Description</span><textarea rows={3} value={defaults.description} onChange={(event) => setDefaults({ ...defaults, description: event.target.value })} className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-blue-500" /></label></>}

          {activeItem && status !== 'PROCESSED' && <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 p-3"><div className="text-[10px] font-extrabold uppercase tracking-wide text-violet-700">Individual override · {activeItem.originalName}</div><div className="mt-2 grid grid-cols-2 gap-2"><input value={edits[activeItem.id]?.sku || ''} onChange={(event) => edit(activeItem.id, { sku: event.target.value })} placeholder="SKU (optional)" className={input} /><input value={edits[activeItem.id]?.price || ''} onChange={(event) => edit(activeItem.id, { price: event.target.value })} placeholder="Price override" className={input} /><input value={edits[activeItem.id]?.category || ''} onChange={(event) => edit(activeItem.id, { category: event.target.value })} placeholder="Category override" className={input} /><input value={edits[activeItem.id]?.subcategory || ''} onChange={(event) => edit(activeItem.id, { subcategory: event.target.value })} placeholder="Subcategory" className={input} /></div></div>}

          <button onClick={suggest} disabled={!selected.size || suggesting || status === 'PROCESSED'} className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-violet-300 bg-violet-50 text-xs font-extrabold text-violet-700 disabled:opacity-40">{suggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{suggesting ? 'Suggesting…' : 'Suggest metadata with Kobe AI'}</button>
          <button onClick={process} disabled={!selected.size || processing || status === 'PROCESSED'} className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-extrabold text-white hover:bg-blue-500 disabled:opacity-40">{processing ? <Loader2 className="h-5 w-5 animate-spin" /> : <PackagePlus className="h-5 w-5" />}{processing ? 'Creating and moving…' : target.moduleId === 'erp' ? `Create ${selected.size} product${selected.size === 1 ? '' : 's'}` : `Process ${selected.size} asset${selected.size === 1 ? '' : 's'}`}</button>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-400">The whole selected batch is transactional. Processed images leave the intake gallery and appear under processed/{target.moduleId}/{target.entityType}. AI suggestions require review and are never silently published.</p>
        </aside>
      </main>
    </div>
  );
}
