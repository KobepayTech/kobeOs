import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE, api, getToken } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Image as ImageIcon, Upload, Loader2, Sparkles, CheckCircle2, X, Trash2, Plus, Download, AlertTriangle,
} from 'lucide-react';

/**
 * "From image" dialog for the POS. Operator drops or pastes a customer's
 * annotated catalog photo, server runs vision + OCR, dialog shows the
 * extracted items so the operator can fix names + quantities, then turns
 * the result into a real /pos/orders sale.
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
  ocrText?: string;
  model?: string;
  source: 'ollama' | 'ocr-fallback' | 'none';
  receivedBytes: number;
  catalogStats?: { total: number; withImage: number };
}

type CatalogProduct = { id: string; sku: string; name: string; price: number | string; stock?: number; imageUrl?: string | null };

const fmt = (n: number) => `TZS ${Math.round(n).toLocaleString()}`;

export function OrderFromImageDialog({
  open, onOpenChange, products, onOrderCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  products: CatalogProduct[];
  onOrderCreated: (orderNumber: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ParseResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [modelStatus, setModelStatus] = useState<{ model: string; installed: boolean; pulling: boolean; ollamaRunning: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Check vision model availability whenever the dialog opens, then
  // poll while a pull is in flight so the banner updates on its own.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const s = await api<{ model: string; installed: boolean; pulling: boolean; ollamaRunning: boolean }>('/order-from-image/vision-model/status');
        if (cancelled) return;
        setModelStatus(s);
      } catch { /* ignore — banner just stays hidden */ }
    };
    void tick();
    const id = setInterval(tick, modelStatus?.pulling ? 15_000 : 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [open, modelStatus?.pulling]);

  const installModel = async () => {
    try {
      await api('/order-from-image/vision-model/install', { method: 'POST' });
      setModelStatus((s) => (s ? { ...s, pulling: true } : s));
    } catch (e) {
      setErr(`Install failed: ${(e as Error).message}`);
    }
  };

  const reset = useCallback(() => {
    setFile(null); setPreview(null); setResult(null); setErr(null);
    setItems([]); setCustomerName(''); setParsing(false); setSubmitting(false);
  }, []);

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const pickFile = (f: File) => {
    setErr(null); setResult(null); setItems([]);
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
  };

  const upload = async () => {
    if (!file) return;
    setParsing(true);
    setErr(null);
    try {
      const token = getToken();
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

  // Editing the candidate list.
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
      onOrderCreated(sale?.receipt?.orderNumber ?? orderNumber);
      reset();
      onOpenChange(false);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#13131f] border-white/[0.06] text-white max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" /> Order from image
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-4">

          {modelStatus && !modelStatus.installed && (
            <VisionModelBanner status={modelStatus} onInstall={installModel} />
          )}

          {!preview ? (
            <ImageDropZone fileRef={fileRef} onPick={pickFile} />
          ) : !result ? (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden border border-white/[0.06] bg-black/40 max-h-[50vh] grid place-items-center">
                <img src={preview} alt="" className="max-h-[50vh] object-contain" />
                <button
                  onClick={() => { reset(); fileRef.current?.click(); }}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 grid place-items-center"
                  aria-label="Pick another"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
              <Button
                onClick={upload}
                disabled={parsing}
                className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold h-11"
              >
                {parsing
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Reading image…</>
                  : <><Sparkles className="w-4 h-4 mr-2" /> Extract order</>}
              </Button>
            </div>
          ) : (
            <ReviewView
              preview={preview}
              result={result}
              items={items}
              products={products}
              total={total}
              setItem={setItem}
              removeItem={removeItem}
              addItem={addItem}
              matchToProduct={matchToProduct}
              customerName={customerName}
              setCustomerName={setCustomerName}
            />
          )}

          {err && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs p-3">
              {err}
            </div>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) pickFile(f);
            e.target.value = '';
          }}
        />

        {result && (
          <div className="border-t border-white/[0.06] -mx-6 px-6 pt-3 pb-1 flex items-center justify-between gap-2">
            <div className="text-xs text-white/60">
              {matched.length === 0
                ? <span className="text-amber-400">Match at least one item to a catalog SKU to enable the order.</span>
                : <>{matched.length} item{matched.length === 1 ? '' : 's'} matched · <span className="font-bold text-white">{fmt(total)}</span></>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleClose(false)} className="border-white/15 text-white/80">
                Cancel
              </Button>
              <Button
                onClick={submit}
                disabled={!canSubmit || submitting}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:opacity-40"
              >
                {submitting
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating…</>
                  : <><CheckCircle2 className="w-4 h-4 mr-2" /> Create POS order</>}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ImageDropZone({
  fileRef, onPick,
}: { fileRef: React.RefObject<HTMLInputElement | null>; onPick: (f: File) => void }) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div
      onClick={() => fileRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onPick(f);
      }}
      onPaste={(e) => {
        const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'));
        const f = item?.getAsFile();
        if (f) onPick(f);
      }}
      tabIndex={0}
      className={`rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors ${
        dragOver
          ? 'border-violet-400 bg-violet-500/10'
          : 'border-white/[0.15] bg-white/[0.02] hover:border-white/[0.30]'
      }`}
    >
      <div className="w-12 h-12 mx-auto rounded-xl bg-violet-500/15 grid place-items-center mb-3">
        <ImageIcon className="w-6 h-6 text-violet-300" />
      </div>
      <p className="text-sm font-semibold text-white/80">
        Drop a customer's annotated catalog photo
      </p>
      <p className="text-[11px] text-white/40 mt-1">
        Or click to pick · paste from clipboard works too (Ctrl/Cmd + V)
      </p>
      <Button size="sm" variant="outline" className="mt-3 border-white/15 text-white/80">
        <Upload className="w-3.5 h-3.5 mr-1.5" /> Pick image
      </Button>
    </div>
  );
}

function ReviewView({
  preview, result, items, products, total,
  setItem, removeItem, addItem, matchToProduct, customerName, setCustomerName,
}: {
  preview: string;
  result: ParseResponse;
  items: ParsedItem[];
  products: CatalogProduct[];
  total: number;
  setItem: (i: number, patch: Partial<ParsedItem>) => void;
  removeItem: (i: number) => void;
  addItem: () => void;
  matchToProduct: (i: number, productId: string) => void;
  customerName: string;
  setCustomerName: (v: string) => void;
}) {
  void total;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-3">
        <div className="rounded-xl overflow-hidden border border-white/[0.06] bg-black/40 max-h-[60vh] grid place-items-center">
          <img src={preview} alt="" className="max-h-[60vh] object-contain" />
        </div>
        <SourceBadge result={result} />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-white/60 uppercase tracking-wide">Items detected</h3>
          <Button size="sm" variant="ghost" onClick={addItem} className="h-7 text-violet-300 hover:bg-violet-500/10 hover:text-violet-200">
            <Plus className="w-3.5 h-3.5 mr-1" /> Add row
          </Button>
        </div>

        {items.length === 0 ? (
          <p className="text-xs text-white/40 italic">
            No items extracted. Click "Add row" and pick from the catalog manually.
          </p>
        ) : (
          <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
            {items.map((it, i) => (
              <div key={i} className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white/40 mb-0.5">Detected name</div>
                    <input
                      value={it.name}
                      onChange={(e) => setItem(i, { name: e.target.value })}
                      className="w-full h-8 px-2 rounded bg-[#0a0a1a] border border-white/[0.08] text-xs text-white/90"
                    />
                  </div>
                  <div className="w-20 shrink-0">
                    <div className="text-xs text-white/40 mb-0.5">Qty</div>
                    <input
                      type="number"
                      min={1}
                      value={it.quantity}
                      onChange={(e) => setItem(i, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                      className="w-full h-8 px-2 rounded bg-[#0a0a1a] border border-white/[0.08] text-xs font-bold text-white text-right"
                    />
                  </div>
                  <button
                    onClick={() => removeItem(i)}
                    className="text-rose-400 hover:text-rose-300 mt-5"
                    aria-label="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div>
                  <div className="text-xs text-white/40 mb-0.5">
                    Match to catalog
                    {it.matchedProductId && (
                      <span className="ml-2 text-emerald-400 font-bold">✓ {it.matchedSku}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Catalog thumbnail — gives the operator a visual
                     *  confirmation that the AI's pick is actually the
                     *  item the customer marked. */}
                    <CatalogThumb url={it.matchedImageUrl} alt={it.matchedName ?? ''} size={40} />
                    <select
                      value={it.matchedProductId ?? ''}
                      onChange={(e) => matchToProduct(i, e.target.value)}
                      className="flex-1 h-8 px-2 rounded bg-[#0a0a1a] border border-white/[0.08] text-xs text-white/90"
                    >
                      <option value="">— pick a product —</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.sku} · {p.name} · {fmt(Number(p.price))}{!p.imageUrl ? ' (no img)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  {it.matchedProductId && (
                    <div className="text-[10px] text-white/40 mt-1 flex items-center justify-between">
                      <span>Line {fmt((Number(it.matchedPrice) || 0) * it.quantity)}</span>
                      {!it.matchedImageUrl && (
                        <span className="text-amber-400/80">
                          Bind a photo in Product Manager so this matches by sight next time
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {it.notes && (
                  <div className="text-[10px] text-white/40 italic">Note: {it.notes}</div>
                )}
              </div>
            ))}
          </div>
        )}

        <div>
          <div className="text-xs text-white/40 mb-0.5">Customer (optional)</div>
          <Input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Name or phone — recorded against the order"
            className="bg-[#0a0a1a] border-white/[0.08] text-xs"
          />
        </div>
      </div>
    </div>
  );
}

function SourceBadge({ result }: { result: ParseResponse }) {
  const stats = result.catalogStats;
  // Only show the coverage hint when there are actually products
  // without images — silent when the catalog is fully bound.
  const showCoverageHint = stats && stats.total > 0 && stats.withImage < stats.total;
  return (
    <div className="space-y-1">
      {result.source === 'ollama' && (
        <div className="text-[10px] text-emerald-400/80">
          ✓ Parsed by vision model {result.model && <span className="text-white/40">({result.model})</span>}
          {!result.hasAnnotations && ' · no marker annotations spotted'}
        </div>
      )}
      {result.source === 'ocr-fallback' && (
        <div className="text-[10px] text-amber-400/80">
          ⚠ Vision model not reachable — used OCR text extraction as a fallback. Review the items carefully.
        </div>
      )}
      {result.source === 'none' && (
        <div className="text-[10px] text-amber-400/80">
          ⚠ No AI parsing available — enter items manually. (Configure Ollama with a vision model like llava for automatic parsing.)
        </div>
      )}
      {showCoverageHint && (
        <div className="text-[10px] text-amber-300/80 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1">
          ℹ {stats.total - stats.withImage} of {stats.total} catalog products have no image bound — open Product Manager and add photos so the AI can match by what items look like, not just by name.
        </div>
      )}
    </div>
  );
}

function VisionModelBanner({
  status, onInstall,
}: {
  status: { model: string; installed: boolean; pulling: boolean; ollamaRunning: boolean };
  onInstall: () => void;
}) {
  if (!status.ollamaRunning) {
    return (
      <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
        <div className="flex-1 text-xs text-rose-200">
          <div className="font-bold">Ollama not reachable</div>
          <div className="text-rose-300/80 mt-0.5">
            Image parsing will fall back to Tesseract OCR (poor accuracy on handwriting).
            Start Ollama on the server, then refresh.
          </div>
        </div>
      </div>
    );
  }
  if (status.pulling) {
    return (
      <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-3 flex items-start gap-2">
        <Loader2 className="w-4 h-4 text-violet-300 mt-0.5 animate-spin shrink-0" />
        <div className="flex-1 text-xs text-violet-100">
          <div className="font-bold">Installing {status.model}…</div>
          <div className="text-violet-200/80 mt-0.5">
            ~5 GB download in progress on the server (5–30 min depending on bandwidth).
            You can close this dialog — the install continues in the background.
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
      <div className="flex-1 text-xs text-amber-100">
        <div className="font-bold">Vision model not installed: {status.model}</div>
        <div className="text-amber-200/80 mt-0.5">
          Image parsing will fall back to Tesseract OCR (poor accuracy on handwriting).
          Install the recommended vision model to enable AI parsing.
        </div>
      </div>
      <Button
        size="sm"
        onClick={onInstall}
        className="bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold shrink-0"
      >
        <Download className="w-3.5 h-3.5 mr-1.5" /> Install (~5 GB)
      </Button>
    </div>
  );
}

function CatalogThumb({ url, alt, size = 40 }: { url?: string | null; alt: string; size?: number }) {
  if (!url) {
    return (
      <div
        className="rounded bg-white/[0.05] border border-white/[0.06] grid place-items-center text-[8px] text-white/30 shrink-0"
        style={{ width: size, height: size }}
      >
        no img
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      className="rounded object-cover bg-white/[0.05] border border-white/[0.06] shrink-0"
      style={{ width: size, height: size }}
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
    />
  );
}
