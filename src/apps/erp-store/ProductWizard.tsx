import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Plus, Trash2, ChevronLeft, ChevronRight, Camera, Save, FileText, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

/**
 * 5-step product wizard matching the KobeERP spec — Basic → Variants → Pricing
 * → Photos → Confirm. All five steps drive the same UniversalProduct shape
 * so the existing inline form keeps working, but cashiers get a guided flow
 * with auto-SKU, margin preview, and a saved-as-draft state.
 *
 * Mounted as a route inside erp-store; the inline form remains for quick edits.
 */
export interface WizardVariant {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  stock: number;
  priceAdjustment?: number;
  imageUrl?: string;
}

export interface WizardProduct {
  id?: string;
  // Basic
  name: string;
  sku: string;
  barcode?: string;
  category: string;
  brand?: string;
  supplier?: string;
  description: string;
  trackInventory: boolean;
  lowStockThreshold: number;
  // Variants
  hasVariants: boolean;
  variants: WizardVariant[];
  // Pricing
  sellingPrice: number;
  wholesalePrice?: number;
  wholesaleMinQty?: number;
  costRmb?: number;
  costUsd?: number;
  costTzs?: number;
  fxRmbToTzs?: number;
  targetMarginPct?: number;
  currency: string;
  taxRate: number;
  stock: number;
  estimatedStock: number;
  // Photos
  imageUrl?: string;
  imageUrls: string[];
  videoUrl?: string;
  // Meta
  tags: string[];
  active: boolean;
  featured: boolean;
  status: 'DRAFT' | 'ACTIVE';
}

const BLANK: WizardProduct = {
  name: '',
  sku: '',
  category: '',
  description: '',
  trackInventory: true,
  lowStockThreshold: 10,
  hasVariants: false,
  variants: [],
  sellingPrice: 0,
  costTzs: 0,
  fxRmbToTzs: 350.5,
  currency: 'TZS',
  taxRate: 0,
  stock: 0,
  estimatedStock: 0,
  imageUrls: [],
  tags: [],
  active: true,
  featured: false,
  status: 'ACTIVE',
};

const CATEGORY_OPTIONS = [
  { value: 'electronics', label: '📱 Electronics' },
  { value: 'apparel',     label: '👕 Apparel' },
  { value: 'shoes',       label: '👟 Shoes & Sneakers' },
  { value: 'bags',        label: '🎒 Bags & Backpacks' },
  { value: 'home',        label: '🏠 Home & Kitchen' },
  { value: 'beauty',      label: '💄 Beauty & Personal Care' },
  { value: 'food',        label: '🍔 Food & Beverages' },
  { value: 'kids',        label: '🧸 Kids & Baby' },
  { value: 'other',       label: '📦 Other' },
];

const STORAGE_KEY = 'kobeerp:product-wizard-draft';

export function ProductWizard({
  onDone,
  initial,
}: {
  onDone?: (product: WizardProduct) => void;
  initial?: Partial<WizardProduct>;
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<WizardProduct>(() => {
    if (initial) return { ...BLANK, ...initial };
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? ({ ...BLANK, ...(JSON.parse(raw) as Partial<WizardProduct>) }) : BLANK;
    } catch {
      return BLANK;
    }
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAs, setSavedAs] = useState<'draft' | 'active' | null>(null);

  // Persist draft on every change so a refresh doesn't lose work.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      /* storage disabled */
    }
  }, [draft]);

  const patch = useCallback((p: Partial<WizardProduct>) => {
    setDraft((d) => ({ ...d, ...p }));
  }, []);

  // Auto-generate SKU when blank — first 4 letters of name + 3-digit suffix.
  useEffect(() => {
    if (!draft.sku && draft.name.length >= 2) {
      const prefix = draft.name
        .replace(/[^A-Za-z0-9]/g, '')
        .slice(0, 4)
        .toUpperCase();
      const suffix = String(Math.floor(100 + Math.random() * 900));
      patch({ sku: `${prefix}-${suffix}` });
    }
  }, [draft.name, draft.sku, patch]);

  const STEPS = [
    { label: 'Basic Info',   render: () => <StepBasic value={draft} onChange={patch} /> },
    { label: 'Variants',     render: () => <StepVariants value={draft} onChange={patch} /> },
    { label: 'Pricing',      render: () => <StepPricing value={draft} onChange={patch} /> },
    { label: 'Photos',       render: () => <StepPhotos value={draft} onChange={patch} /> },
    { label: 'Review',       render: () => <StepReview value={draft} /> },
  ];

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const submit = async (status: 'DRAFT' | 'ACTIVE') => {
    setSaving(true);
    setError(null);
    try {
      const payload = { ...draft, status, active: status === 'ACTIVE' };
      const created = await api<{ id: string }>('/pos/products', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSavedAs(status === 'ACTIVE' ? 'active' : 'draft');
      try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      onDone?.({ ...payload, id: created.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (savedAs) {
    return (
      <SuccessScreen
        status={savedAs}
        product={draft}
        onCreateAnother={() => {
          setDraft(BLANK);
          setStep(0);
          setSavedAs(null);
        }}
      />
    );
  }

  const progressPct = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="h-full flex flex-col bg-[#0a0a1a] text-white">
      {/* Header */}
      <div className="shrink-0 border-b border-white/[0.06] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Add product — step {step + 1} of {STEPS.length}</h1>
          <Button
            variant="ghost"
            onClick={() => submit('DRAFT')}
            disabled={saving || !draft.name.trim()}
            className="text-xs text-white/60 hover:text-white"
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            Save as draft
          </Button>
        </div>
        <Progress value={progressPct} className="h-1.5 bg-white/[0.06]" />
        <div className="flex justify-between text-[11px] text-white/40">
          {STEPS.map((s, i) => (
            <span key={s.label} className={i === step ? 'text-amber-300 font-medium' : ''}>
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Step body */}
      <div className="flex-1 overflow-y-auto p-5">
        {error && (
          <div className="mb-3 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded p-2">
            {error}
          </div>
        )}
        {STEPS[step].render()}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-white/[0.06] p-4 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={prev} disabled={step === 0} className="text-white/70">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next} className="bg-blue-600 hover:bg-blue-500">
            Continue <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button onClick={() => submit('DRAFT')} disabled={saving} variant="outline">
              <FileText className="w-4 h-4 mr-1.5" /> Save as draft
            </Button>
            <Button onClick={() => submit('ACTIVE')} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
              Publish product
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step 1 — Basic ──────────────────────────────────────────────────────────

function StepBasic({ value, onChange }: { value: WizardProduct; onChange: (p: Partial<WizardProduct>) => void }) {
  return (
    <div className="space-y-4 max-w-2xl">
      <Field label="Product name" required>
        <Input
          value={value.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g. Nike Air Max Style"
          className={inputCls}
          autoFocus
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="SKU" required hint="Auto-generated from the name — edit if you want something specific.">
          <Input value={value.sku} onChange={(e) => onChange({ sku: e.target.value })} className={inputCls + ' font-mono'} />
        </Field>
        <Field label="Barcode" hint="EAN, UPC, or internal scan code.">
          <Input value={value.barcode ?? ''} onChange={(e) => onChange({ barcode: e.target.value })} className={inputCls + ' font-mono'} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category" required>
          <select value={value.category} onChange={(e) => onChange({ category: e.target.value })} className={selectCls}>
            <option value="">— Choose —</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Brand">
          <Input value={value.brand ?? ''} onChange={(e) => onChange({ brand: e.target.value })} className={inputCls} />
        </Field>
      </div>
      <Field label="Supplier" hint="Where this product came from — supports per-supplier reports.">
        <Input value={value.supplier ?? ''} onChange={(e) => onChange({ supplier: e.target.value })} className={inputCls} />
      </Field>
      <Field label="Description">
        <Textarea
          value={value.description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={3}
          className={inputCls}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Track inventory">
          <select
            value={value.trackInventory ? '1' : '0'}
            onChange={(e) => onChange({ trackInventory: e.target.value === '1' })}
            className={selectCls}
          >
            <option value="1">Yes — keep a running count</option>
            <option value="0">No — service / digital good</option>
          </select>
        </Field>
        <Field label="Alert at stock below">
          <Input
            type="number"
            value={value.lowStockThreshold}
            onChange={(e) => onChange({ lowStockThreshold: Number(e.target.value) })}
            className={inputCls}
            disabled={!value.trackInventory}
          />
        </Field>
      </div>
    </div>
  );
}

// ── Step 2 — Variants ────────────────────────────────────────────────────────

function StepVariants({ value, onChange }: { value: WizardProduct; onChange: (p: Partial<WizardProduct>) => void }) {
  const addVariant = () => {
    onChange({
      hasVariants: true,
      variants: [
        ...value.variants,
        { id: `v-${Date.now()}-${value.variants.length}`, name: '', stock: 0 },
      ],
    });
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <Field label="Does this product have variants?">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onChange({ hasVariants: false, variants: [] })}
            className={`h-12 rounded-md border text-sm ${!value.hasVariants ? 'bg-blue-500/15 border-blue-500/40 text-blue-200' : 'border-white/10 text-white/60'}`}
          >
            Single product — one row, no sub-types
          </button>
          <button
            type="button"
            onClick={() => onChange({ hasVariants: true })}
            className={`h-12 rounded-md border text-sm ${value.hasVariants ? 'bg-blue-500/15 border-blue-500/40 text-blue-200' : 'border-white/10 text-white/60'}`}
          >
            Has variants — sizes, colours, styles
          </button>
        </div>
      </Field>

      {value.hasVariants ? (
        <Card className="bg-white/[0.02] border-white/10">
          <CardContent className="p-3 space-y-2">
            <div className="grid grid-cols-12 gap-2 text-[10px] uppercase text-white/40">
              <span className="col-span-4">Name (e.g. M / Red)</span>
              <span className="col-span-3">SKU suffix</span>
              <span className="col-span-2">Stock</span>
              <span className="col-span-2">Price ±</span>
              <span className="col-span-1"></span>
            </div>
            {value.variants.map((v, idx) => (
              <div key={v.id} className="grid grid-cols-12 gap-2">
                <Input
                  value={v.name}
                  onChange={(e) =>
                    onChange({ variants: value.variants.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)) })
                  }
                  className={`${inputCls} col-span-4`}
                />
                <Input
                  value={v.sku ?? ''}
                  onChange={(e) =>
                    onChange({ variants: value.variants.map((x, i) => (i === idx ? { ...x, sku: e.target.value } : x)) })
                  }
                  className={`${inputCls} col-span-3 font-mono`}
                />
                <Input
                  type="number"
                  value={v.stock}
                  onChange={(e) =>
                    onChange({
                      variants: value.variants.map((x, i) => (i === idx ? { ...x, stock: Number(e.target.value) } : x)),
                    })
                  }
                  className={`${inputCls} col-span-2`}
                />
                <Input
                  type="number"
                  placeholder="0"
                  value={v.priceAdjustment ?? ''}
                  onChange={(e) =>
                    onChange({
                      variants: value.variants.map((x, i) =>
                        i === idx ? { ...x, priceAdjustment: e.target.value === '' ? undefined : Number(e.target.value) } : x,
                      ),
                    })
                  }
                  className={`${inputCls} col-span-2`}
                />
                <button
                  onClick={() => onChange({ variants: value.variants.filter((_, i) => i !== idx) })}
                  className="col-span-1 text-rose-300 hover:text-rose-200 self-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <Button variant="outline" onClick={addVariant} className="w-full">
              <Plus className="w-4 h-4 mr-1.5" /> Add variant
            </Button>
            <p className="text-[10px] text-white/40">
              Total variants: {value.variants.length} · Total stock: {value.variants.reduce((s, v) => s + v.stock, 0)}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Field label="Stock on hand">
          <Input
            type="number"
            value={value.stock}
            onChange={(e) => onChange({ stock: Number(e.target.value) })}
            className={inputCls}
          />
        </Field>
      )}
    </div>
  );
}

// ── Step 3 — Pricing ─────────────────────────────────────────────────────────

function StepPricing({ value, onChange }: { value: WizardProduct; onChange: (p: Partial<WizardProduct>) => void }) {
  const cost = useMemo(() => {
    if (value.costTzs && value.costTzs > 0) return value.costTzs;
    if (value.costRmb && value.fxRmbToTzs) return Math.round(value.costRmb * value.fxRmbToTzs * 100) / 100;
    return 0;
  }, [value.costTzs, value.costRmb, value.fxRmbToTzs]);

  const margin = useMemo(() => {
    if (!value.sellingPrice || !cost) return null;
    const profit = value.sellingPrice - cost;
    return { profit, pct: (profit / value.sellingPrice) * 100 };
  }, [value.sellingPrice, cost]);

  const recommendedFromMargin = useMemo(() => {
    if (!value.targetMarginPct || !cost) return null;
    return Math.ceil(cost / (1 - value.targetMarginPct / 100));
  }, [value.targetMarginPct, cost]);

  const healthy = margin && margin.pct >= 20;
  const negative = margin && margin.pct < 0;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Selling price" required>
          <Input
            type="number"
            value={value.sellingPrice}
            onChange={(e) => onChange({ sellingPrice: Number(e.target.value) })}
            className={inputCls}
          />
        </Field>
        <Field label="Wholesale price">
          <Input
            type="number"
            value={value.wholesalePrice ?? ''}
            onChange={(e) => onChange({ wholesalePrice: e.target.value ? Number(e.target.value) : undefined })}
            className={inputCls}
          />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Cost (RMB)">
          <Input
            type="number"
            value={value.costRmb ?? ''}
            onChange={(e) => onChange({ costRmb: e.target.value ? Number(e.target.value) : undefined })}
            className={inputCls}
          />
        </Field>
        <Field label="FX RMB→TZS">
          <Input
            type="number"
            step="0.01"
            value={value.fxRmbToTzs ?? ''}
            onChange={(e) => onChange({ fxRmbToTzs: e.target.value ? Number(e.target.value) : undefined })}
            className={inputCls}
          />
        </Field>
        <Field label="Cost (TZS)" hint="Auto from RMB × FX. Edit to override.">
          <Input
            type="number"
            value={value.costTzs ?? cost}
            onChange={(e) => onChange({ costTzs: e.target.value ? Number(e.target.value) : undefined })}
            className={inputCls}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tax rate (%)">
          <Input
            type="number"
            step="0.01"
            value={value.taxRate * 100}
            onChange={(e) => onChange({ taxRate: Number(e.target.value) / 100 })}
            className={inputCls}
          />
        </Field>
        <Field label="Target margin (%)" hint="We'll suggest a price that gets you here.">
          <Input
            type="number"
            value={value.targetMarginPct ?? ''}
            onChange={(e) => onChange({ targetMarginPct: e.target.value ? Number(e.target.value) : undefined })}
            className={inputCls}
          />
        </Field>
      </div>

      <Card className={
        negative ? 'bg-rose-500/10 border-rose-500/30'
        : healthy ? 'bg-emerald-500/10 border-emerald-500/30'
        : 'bg-amber-500/10 border-amber-500/30'
      }>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-medium text-white">Margin preview</h3>
          {margin ? (
            <div className="text-xs text-white/80 space-y-1">
              <div className="flex justify-between"><span>Selling price</span><strong>{fmt(value.sellingPrice)} {value.currency}</strong></div>
              <div className="flex justify-between"><span>Cost</span><strong>{fmt(cost)} {value.currency}</strong></div>
              <div className="flex justify-between border-t border-white/10 pt-1 mt-1">
                <span>Gross profit</span>
                <strong className={negative ? 'text-rose-200' : 'text-emerald-200'}>
                  {fmt(margin.profit)} {value.currency} ({margin.pct.toFixed(1)}%)
                </strong>
              </div>
              {negative && (
                <p className="text-rose-200 text-[11px] pt-1 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Selling price is below cost — raise it before you publish.
                </p>
              )}
              {!negative && !healthy && (
                <p className="text-amber-200 text-[11px] pt-1">
                  Margin is below 20% — set a target margin above to see a healthier price.
                </p>
              )}
              {recommendedFromMargin !== null && (
                <p className="text-[11px] pt-1">
                  Recommended price for {value.targetMarginPct}% margin: <strong>{fmt(recommendedFromMargin)} {value.currency}</strong>
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-white/50">Enter a selling price and cost to see your margin.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Step 4 — Photos ──────────────────────────────────────────────────────────

function StepPhotos({ value, onChange }: { value: WizardProduct; onChange: (p: Partial<WizardProduct>) => void }) {
  return (
    <div className="space-y-4 max-w-2xl">
      <Field label="Main photo URL" hint="First image shown in the catalogue. Paste a URL or upload separately.">
        <Input
          value={value.imageUrl ?? ''}
          onChange={(e) => onChange({ imageUrl: e.target.value })}
          placeholder="https://…"
          className={inputCls}
        />
      </Field>
      <Field label="Additional images (one URL per line)">
        <Textarea
          value={value.imageUrls.join('\n')}
          onChange={(e) =>
            onChange({ imageUrls: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })
          }
          rows={4}
          className={inputCls}
          placeholder={`https://…/photo-2.jpg\nhttps://…/photo-3.jpg`}
        />
      </Field>
      <Field label="Video URL" hint="YouTube, Vimeo, or direct .mp4.">
        <Input
          value={value.videoUrl ?? ''}
          onChange={(e) => onChange({ videoUrl: e.target.value })}
          className={inputCls}
        />
      </Field>
      <div className="rounded-md border border-dashed border-white/15 p-6 text-center text-xs text-white/40">
        <Camera className="w-6 h-6 mx-auto mb-2 text-white/30" />
        Native camera upload arrives with the mobile build. Until then, paste hosted URLs above.
      </div>
    </div>
  );
}

// ── Step 5 — Review ──────────────────────────────────────────────────────────

function StepReview({ value }: { value: WizardProduct }) {
  const variantStock = value.variants.reduce((s, v) => s + v.stock, 0);
  const totalStock = value.hasVariants ? variantStock : value.stock;
  return (
    <div className="space-y-4 max-w-2xl">
      <Card className="bg-[#13131f] border-white/10">
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-medium text-white/85">Product summary</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div><span className="text-white/40">Name</span><br /><strong>{value.name || '—'}</strong></div>
            <div><span className="text-white/40">SKU</span><br /><strong className="font-mono">{value.sku || '—'}</strong></div>
            <div><span className="text-white/40">Category</span><br /><strong>{value.category || '—'}</strong></div>
            <div><span className="text-white/40">Brand</span><br /><strong>{value.brand || '—'}</strong></div>
            <div><span className="text-white/40">Selling price</span><br /><strong>{fmt(value.sellingPrice)} {value.currency}</strong></div>
            <div><span className="text-white/40">Total stock</span><br /><strong>{totalStock}{value.hasVariants ? ` across ${value.variants.length} variant${value.variants.length === 1 ? '' : 's'}` : ''}</strong></div>
          </div>
        </CardContent>
      </Card>
      {value.hasVariants && value.variants.length > 0 && (
        <Card className="bg-white/[0.02] border-white/10">
          <CardContent className="p-3">
            <table className="w-full text-[12px]">
              <thead className="text-white/40 text-[10px] uppercase">
                <tr><th className="text-left py-1">Variant</th><th className="text-left py-1">SKU</th><th className="text-right py-1">Stock</th><th className="text-right py-1">Δ Price</th></tr>
              </thead>
              <tbody>
                {value.variants.map((v) => (
                  <tr key={v.id} className="border-t border-white/[0.04]">
                    <td className="py-1">{v.name || <em className="text-white/30">unnamed</em>}</td>
                    <td className="py-1 font-mono text-white/60">{v.sku || '—'}</td>
                    <td className="py-1 text-right">{v.stock}</td>
                    <td className="py-1 text-right">{v.priceAdjustment ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
      <Card className="bg-white/[0.02] border-white/10">
        <CardContent className="p-3 text-xs text-white/60 space-y-1">
          <p>Photos: {value.imageUrl ? 1 : 0} main + {value.imageUrls.length} additional{value.videoUrl ? ', 1 video' : ''}</p>
          <p>Track inventory: {value.trackInventory ? 'Yes' : 'No'} · Alert below: {value.lowStockThreshold}</p>
          <p>Featured: {value.featured ? 'Yes' : 'No'} · Active: {value.active ? 'Yes' : 'No'}</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Success ──────────────────────────────────────────────────────────────────

function SuccessScreen({
  status,
  product,
  onCreateAnother,
}: {
  status: 'draft' | 'active';
  product: WizardProduct;
  onCreateAnother: () => void;
}) {
  return (
    <div className="h-full flex items-center justify-center p-6 bg-[#0a0a1a]">
      <Card className="bg-emerald-500/10 border-emerald-500/30 max-w-md w-full">
        <CardContent className="p-6 text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-300 mx-auto" />
          <h2 className="text-lg font-semibold text-white">
            {status === 'active' ? 'Product published!' : 'Saved as draft'}
          </h2>
          <p className="text-sm text-white/70">
            <strong>{product.name}</strong> ({product.sku}) is {status === 'active' ? 'now selling' : 'in your drafts list'}.
          </p>
          <Button onClick={onCreateAnother} className="w-full bg-blue-600 hover:bg-blue-500">
            <Plus className="w-4 h-4 mr-1.5" /> Add another product
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Shared ───────────────────────────────────────────────────────────────────

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-white/60 block mb-1">
        {label} {required && <span className="text-rose-300">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-white/40 mt-1">{hint}</p>}
    </div>
  );
}

const inputCls = 'bg-white/5 border-white/10 text-white text-sm';
const selectCls = 'w-full h-9 px-2 rounded-md bg-white/5 border border-white/10 text-xs text-white';

function fmt(n: number): string {
  return Number(n).toLocaleString();
}
