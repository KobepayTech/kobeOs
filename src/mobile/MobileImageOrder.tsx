import { useState, useRef, useEffect } from 'react';
import { API_BASE, api } from '@/lib/api';
import {
  Image as ImageIcon, Camera, Sparkles, Loader2, CheckCircle2, X, Trash2, Plus, Download, AlertTriangle,
} from 'lucide-react';

/**
 * Phone-first companion to OrderFromImageDialog. Take a photo with the
 * camera (or pick from the roll), the server runs vision + OCR, the
 * operator quickly matches items to catalog SKUs, taps Submit — and
 * the order lands in the same /pos/orders ledger as a counter sale.
 *
 * Useful when a customer forwards a marked-up WhatsApp catalog and the
 * seller is on a phone, not a desktop.
 */

interface ParsedItem {
  name: string;
  quantity: number;
  notes?: string;
  matchedProductId?: string | null;
  matchedSku?: string | null;
  matchedName?: string | null;
  matchedPrice?: number | null;
  matchedImageUrl?: string | null;
  confidence: number;
}
interface ParseResponse {
  hasAnnotations: boolean;
  items: ParsedItem[];
  rawSummary: string;
  source: 'ollama' | 'ocr-fallback' | 'none';
  model?: string;
  catalogStats?: { total: number; withImage: number };
}
interface Product { id: string; sku: string; name: string; price: number | string; stock?: number; imageUrl?: string | null }

const fmt = (n: number) => `TZS ${Math.round(n).toLocaleString()}`;

export default function MobileImageOrder() {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ParseResponse | null>(null);
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [modelStatus, setModelStatus] = useState<{ model: string; installed: boolean; pulling: boolean; ollamaRunning: boolean } | null>(null);

  // Check vision model availability up-front and poll while a pull is
  // in progress — sellers shouldn't have to refresh the page to see
  // that the install finished in the background.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const s = await api<{ model: string; installed: boolean; pulling: boolean; ollamaRunning: boolean }>('/order-from-image/vision-model/status');
        if (cancelled) return;
        setModelStatus(s);
      } catch { /* ignore */ }
    };
    void tick();
    const id = setInterval(tick, modelStatus?.pulling ? 15_000 : 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [modelStatus?.pulling]);

  const installModel = async () => {
    try {
      await api('/order-from-image/vision-model/install', { method: 'POST' });
      setModelStatus((s) => (s ? { ...s, pulling: true } : s));
    } catch (e) {
      setErr(`Install failed: ${(e as Error).message}`);
    }
  };

  const pickFile = async (f: File) => {
    setErr(null); setResult(null); setItems([]);
    setFile(f);
    setPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(f); });
    // Lazy-load the catalog the first time the user picks an image so
    // the dropdown for manual matching has something to offer.
    if (products.length === 0) {
      try {
        const list = await api<Product[]>('/pos/products');
        if (Array.isArray(list)) setProducts(list);
      } catch { /* offline — list stays empty, matching becomes manual entry */ }
    }
  };

  const upload = async () => {
    if (!file) return;
    setParsing(true);
    setErr(null);
    try {
      const token = localStorage.getItem('access_token');
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch(`${API_BASE}/order-from-image/parse`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || `HTTP ${res.status}`);
      }
      const data = await res.json() as ParseResponse;
      setResult(data);
      setItems(data.items);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setParsing(false);
    }
  };

  const setItem = (i: number, patch: Partial<ParsedItem>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const removeItem = (i: number) =>
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  const addItem = () =>
    setItems((prev) => [...prev, { name: '', quantity: 1, confidence: 0 }]);
  const matchToProduct = (i: number, productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setItem(i, {
      matchedProductId: p.id, matchedSku: p.sku, matchedName: p.name,
      matchedPrice: Number(p.price), matchedImageUrl: p.imageUrl ?? null,
      name: p.name, confidence: 1,
    });
  };

  const matched = items.filter((it) => it.matchedProductId);
  const total = matched.reduce((s, it) => s + (Number(it.matchedPrice) || 0) * it.quantity, 0);
  const canSubmit = matched.length > 0;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setErr(null);
    try {
      const orderNumber = `IM-${Date.now().toString(36).toUpperCase()}`;
      const sale = await api<{ receipt?: { orderNumber?: string } }>('/pos/orders', {
        method: 'POST',
        body: JSON.stringify({
          orderNumber,
          lines: matched.map((it) => ({ productId: it.matchedProductId!, quantity: it.quantity })),
          paymentMethod: 'CASH',
        }),
      });
      setDone(sale?.receipt?.orderNumber ?? orderNumber);
      setItems([]); setResult(null); setPreview(null); setFile(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 space-y-4 pb-28">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 grid place-items-center">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 leading-tight">Order from image</h2>
          <p className="text-[11px] text-slate-500">Forward a customer's marked-up WhatsApp photo to make an order</p>
        </div>
      </div>

      {modelStatus && !modelStatus.installed && (
        <MobileVisionModelBanner status={modelStatus} onInstall={installModel} />
      )}

      {done && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 p-3 flex items-start gap-2">
          <CheckCircle2 className="w-5 h-5 mt-0.5" />
          <div className="flex-1">
            <div className="text-sm font-extrabold">Order created</div>
            <div className="text-[11px] opacity-80">{done}</div>
          </div>
          <button onClick={() => setDone(null)}><X className="w-4 h-4" /></button>
        </div>
      )}
      {err && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 text-rose-800 p-3 text-xs flex items-start gap-2">
          <span className="flex-1">{err}</span>
          <button onClick={() => setErr(null)}><X className="w-3 h-3" /></button>
        </div>
      )}

      {!preview && (
        <div className="space-y-3">
          <button
            onClick={() => cameraRef.current?.click()}
            className="w-full h-14 rounded-xl bg-violet-600 active:bg-violet-700 text-white font-extrabold text-sm inline-flex items-center justify-center gap-2"
          >
            <Camera className="w-5 h-5" /> Take a photo
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full h-12 rounded-xl border-2 border-dashed border-slate-300 bg-white text-slate-700 font-bold text-sm inline-flex items-center justify-center gap-2 active:bg-slate-50"
          >
            <ImageIcon className="w-4 h-4" /> Pick from gallery / WhatsApp
          </button>
          <p className="text-[10px] text-slate-400 text-center">
            Works with photos a customer circled, marked, or wrote quantities on.
          </p>
        </div>
      )}

      {preview && !result && (
        <div className="space-y-3">
          <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100 grid place-items-center">
            <img src={preview} alt="" className="max-h-[55vh] object-contain" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { setPreview(null); setFile(null); }}
              className="h-11 rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-700 active:bg-slate-50"
            >
              Pick another
            </button>
            <button
              onClick={upload}
              disabled={parsing}
              className="h-11 rounded-lg bg-violet-600 active:bg-violet-700 text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {parsing
                ? <><Loader2 className="w-4 h-4 animate-spin" />Reading…</>
                : <><Sparkles className="w-4 h-4" />Extract order</>}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          {preview && (
            <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100 grid place-items-center max-h-40">
              <img src={preview} alt="" className="max-h-40 object-contain" />
            </div>
          )}
          <SourceBadge result={result} />

          <div className="bg-white border border-slate-200 rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wide">Items</span>
              <button onClick={addItem} className="text-[11px] font-bold text-violet-600 active:text-violet-800 inline-flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add row
              </button>
            </div>
            {items.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No items extracted. Add rows manually.</p>
            ) : items.map((it, i) => (
              <div key={i} className="space-y-1 border-b border-slate-100 last:border-0 pb-2 last:pb-0">
                <div className="flex items-center gap-2">
                  <input
                    value={it.name}
                    onChange={(e) => setItem(i, { name: e.target.value })}
                    placeholder="Detected name"
                    className="flex-1 h-9 px-2 rounded-lg border border-slate-200 bg-white text-sm"
                  />
                  <input
                    type="number"
                    min={1}
                    value={it.quantity}
                    onChange={(e) => setItem(i, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-16 h-9 px-2 rounded-lg border border-slate-200 bg-white text-sm font-bold text-right"
                  />
                  <button onClick={() => removeItem(i)} className="text-rose-500 active:text-rose-700 px-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <CatalogThumb url={it.matchedImageUrl ?? null} />
                  <select
                    value={it.matchedProductId ?? ''}
                    onChange={(e) => matchToProduct(i, e.target.value)}
                    className={`flex-1 h-9 px-2 rounded-lg border bg-white text-xs ${
                      it.matchedProductId ? 'border-emerald-300 text-emerald-700 font-bold' : 'border-slate-200 text-slate-500'
                    }`}
                  >
                    <option value="">— match to catalog —</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} · {p.name} · {fmt(Number(p.price))}{p.imageUrl ? '' : ' · (no img)'}
                      </option>
                    ))}
                  </select>
                </div>
                {it.matchedProductId && !it.matchedImageUrl && (
                  <p className="text-[10px] text-amber-600">
                    Bind a photo in Product Manager so this matches by sight next time.
                  </p>
                )}
                {it.matchedProductId && (
                  <div className="text-[10px] text-slate-500 text-right">
                    Line {fmt((Number(it.matchedPrice) || 0) * it.quantity)}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="fixed bottom-20 left-2 right-2 z-20 bg-white border border-slate-200 rounded-2xl p-3 shadow-xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">{matched.length} matched · order total</span>
              <span className="text-lg font-extrabold text-slate-900">{fmt(total)}</span>
            </div>
            <button
              onClick={submit}
              disabled={!canSubmit || submitting}
              className="w-full h-12 rounded-xl bg-emerald-600 active:bg-emerald-700 disabled:opacity-40 text-white font-extrabold text-sm inline-flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Creating…' : 'Create POS order'}
            </button>
          </div>
        </div>
      )}

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); e.target.value = ''; }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); e.target.value = ''; }}
      />
    </div>
  );
}

function SourceBadge({ result }: { result: ParseResponse }) {
  const tone =
    result.source === 'ollama' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : result.source === 'ocr-fallback' ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-slate-100 text-slate-600 border-slate-200';
  const label =
    result.source === 'ollama' ? `Parsed by vision model${result.model ? ` (${result.model})` : ''}`
    : result.source === 'ocr-fallback' ? 'Used OCR fallback — review carefully'
    : 'No AI available — review manually';
  const stats = result.catalogStats;
  const missing = stats ? stats.total - stats.withImage : 0;
  return (
    <div className="space-y-1">
      <div className={`text-[11px] px-3 py-1.5 rounded-lg border ${tone}`}>
        {label}{result.source === 'ollama' && !result.hasAnnotations ? ' · no markings detected' : ''}
      </div>
      {stats && missing > 0 && (
        <div className="text-[10px] px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-700">
          {missing} of {stats.total} catalog products have no image bound — matching falls back to text.
          Add product photos in Product Manager so the AI can match by sight.
        </div>
      )}
    </div>
  );
}

function MobileVisionModelBanner({
  status, onInstall,
}: {
  status: { model: string; installed: boolean; pulling: boolean; ollamaRunning: boolean };
  onInstall: () => void;
}) {
  if (!status.ollamaRunning) {
    return (
      <div className="rounded-xl border border-rose-300 bg-rose-50 text-rose-800 p-3 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <div className="flex-1 text-[11px]">
          <div className="font-bold">Ollama not reachable</div>
          <div className="opacity-80">Image parsing will fall back to basic OCR. Ask your admin to start Ollama on the server.</div>
        </div>
      </div>
    );
  }
  if (status.pulling) {
    return (
      <div className="rounded-xl border border-violet-300 bg-violet-50 text-violet-800 p-3 flex items-start gap-2">
        <Loader2 className="w-4 h-4 mt-0.5 animate-spin shrink-0" />
        <div className="flex-1 text-[11px]">
          <div className="font-bold">Installing AI vision model…</div>
          <div className="opacity-80">~5 GB downloading on the server (5–30 min). You can leave this page — it continues in the background.</div>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 text-amber-800 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <div className="flex-1 text-[11px]">
          <div className="font-bold">Vision model not installed</div>
          <div className="opacity-80">
            {status.model} — image parsing will fall back to basic OCR (poor accuracy on handwriting) until it's installed.
          </div>
        </div>
      </div>
      <button
        onClick={onInstall}
        className="w-full h-10 rounded-lg bg-amber-500 active:bg-amber-600 text-white text-xs font-extrabold inline-flex items-center justify-center gap-2"
      >
        <Download className="w-4 h-4" /> Install vision model (~5 GB)
      </button>
    </div>
  );
}

function CatalogThumb({ url }: { url: string | null }) {
  if (!url) {
    return (
      <div className="w-10 h-10 rounded-lg bg-slate-100 border border-dashed border-slate-300 grid place-items-center text-[8px] text-slate-400 shrink-0">
        no img
      </div>
    );
  }
  return (
    <img
      src={url}
      alt=""
      className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
    />
  );
}
