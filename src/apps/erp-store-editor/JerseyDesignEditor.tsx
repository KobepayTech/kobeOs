import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Save, Plus, Trash2, Layout, Sparkles, Truck, Shield, RotateCcw, Star } from 'lucide-react';
import { PhotoUpload } from '@/components/PhotoUpload';

/**
 * Storefront design editor — projerseyshop.es-style sections (top promo,
 * hero, trust strip, footer columns). Reads/writes StoreSettings.jerseyConfig
 * through the existing PUT /store-settings endpoint, so saving here updates
 * the live storefront immediately.
 */
export interface JerseyConfig {
  topPromo?: { text?: string; ctaText?: string; bgColor?: string };
  hero?: { headline?: string; subtext?: string; cta?: string; imageUrl?: string; gradientFrom?: string; gradientTo?: string };
  trustStrip?: Array<{ icon: 'truck' | 'shield' | 'rotate' | 'star'; title: string; desc: string }>;
  footerColumns?: Array<{ title: string; items: Array<{ label: string; href?: string }> }>;
  newsletterPitch?: string;
  tiers?: Array<{ slug: string; label: string; parentSlug?: string; href?: string }>;
  paymentLogos?: Array<'visa' | 'mastercard' | 'amex' | 'paypal' | 'mpesa' | 'tigopesa' | 'airtelmoney' | 'kobepay'>;
  languages?: Array<{ code: string; label: string }>;
  trustpilot?: { businessUnitId?: string; templateId?: string };
}

type PaymentLogo = NonNullable<JerseyConfig['paymentLogos']>[number];
const ALL_PAYMENT_LOGOS: PaymentLogo[] = ['visa', 'mastercard', 'amex', 'paypal', 'mpesa', 'tigopesa', 'airtelmoney', 'kobepay'];

interface StoreSettings {
  jerseyConfig?: JerseyConfig;
  [k: string]: unknown;
}

const DEFAULT_CONFIG: Required<Pick<JerseyConfig, 'topPromo' | 'hero' | 'trustStrip' | 'footerColumns' | 'newsletterPitch'>> = {
  topPromo: { text: 'Free worldwide shipping over $50 · 30-day returns', ctaText: 'SIGN UP & GET 15% OFF', bgColor: '#0f172a' },
  hero: { headline: 'Daily new arrivals', subtext: 'Latest jerseys, shoes and apparel — shipped from Tanzania.', cta: 'Shop now', imageUrl: '', gradientFrom: '#1d4ed8', gradientTo: '#a21caf' },
  trustStrip: [
    { icon: 'truck',  title: 'Fast shipping',     desc: 'Same-day dispatch on orders before 2pm' },
    { icon: 'shield', title: 'Authentic',         desc: 'Sourced direct from suppliers' },
    { icon: 'rotate', title: '30-day returns',    desc: 'No-questions money-back' },
    { icon: 'star',   title: 'Excellent reviews', desc: '4.8 / 5 from 12,400+ customers' },
  ],
  footerColumns: [
    { title: 'Shop',    items: [{ label: 'All products' }, { label: 'New arrivals' }, { label: 'Hot offers' }] },
    { title: 'Support', items: [{ label: 'Track order' }, { label: 'Shipping' }, { label: 'Returns' }, { label: 'Contact' }] },
  ],
  newsletterPitch: '15% off your first order when you sign up.',
};

const ICONS = { truck: Truck, shield: Shield, rotate: RotateCcw, star: Star };

export function JerseyDesignEditor() {
  const [config, setConfig] = useState<JerseyConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const settings = await api<StoreSettings>('/store-settings');
      setConfig({ ...DEFAULT_CONFIG, ...(settings.jerseyConfig ?? {}) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api('/store-settings', {
        method: 'PUT',
        body: JSON.stringify({ jerseyConfig: config }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-5 h-5 animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Save controls */}
      <div className="flex items-center justify-between sticky top-0 bg-[#0a0a1a] py-2 z-10">
        <div className="flex items-center gap-2 text-white">
          <Layout className="w-4 h-4 text-amber-300" />
          <span className="text-sm font-medium">Storefront design</span>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-emerald-300">Saved ✓</span>}
          <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 h-8">
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
      {error && <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded p-2">{error}</div>}

      <Section title="Top promo bar" icon={<Sparkles className="w-3.5 h-3.5" />}>
        <Field label="Message">
          <Input value={config.topPromo?.text ?? ''} onChange={(e) => setConfig({ ...config, topPromo: { ...config.topPromo, text: e.target.value } })} className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="CTA label">
            <Input value={config.topPromo?.ctaText ?? ''} onChange={(e) => setConfig({ ...config, topPromo: { ...config.topPromo, ctaText: e.target.value } })} className={inputCls} />
          </Field>
          <Field label="Background color">
            <Input type="color" value={config.topPromo?.bgColor ?? '#0f172a'} onChange={(e) => setConfig({ ...config, topPromo: { ...config.topPromo, bgColor: e.target.value } })} className={inputCls} />
          </Field>
        </div>
      </Section>

      <Section title="Hero banner" icon={<Layout className="w-3.5 h-3.5" />}>
        <Field label="Headline">
          <Input value={config.hero?.headline ?? ''} onChange={(e) => setConfig({ ...config, hero: { ...config.hero, headline: e.target.value } })} className={inputCls} />
        </Field>
        <Field label="Subtext">
          <Textarea value={config.hero?.subtext ?? ''} onChange={(e) => setConfig({ ...config, hero: { ...config.hero, subtext: e.target.value } })} rows={2} className={inputCls} />
        </Field>
        <Field label="CTA label">
          <Input value={config.hero?.cta ?? ''} onChange={(e) => setConfig({ ...config, hero: { ...config.hero, cta: e.target.value } })} className={inputCls} />
        </Field>
        <Field label="Banner image (optional)" hint="Square image, ~600×600. Leave blank for a clean gradient hero.">
          <PhotoUpload
            value={config.hero?.imageUrl ?? null}
            onChange={(url) =>
              setConfig({ ...config, hero: { ...config.hero, imageUrl: url ?? undefined } })
            }
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Gradient from">
            <Input type="color" value={config.hero?.gradientFrom ?? '#1d4ed8'} onChange={(e) => setConfig({ ...config, hero: { ...config.hero, gradientFrom: e.target.value } })} className={inputCls} />
          </Field>
          <Field label="Gradient to">
            <Input type="color" value={config.hero?.gradientTo ?? '#a21caf'} onChange={(e) => setConfig({ ...config, hero: { ...config.hero, gradientTo: e.target.value } })} className={inputCls} />
          </Field>
        </div>
        <HeroPreview config={config} />
      </Section>

      <Section title="Trust strip (4 items)" icon={<Shield className="w-3.5 h-3.5" />}>
        {(config.trustStrip ?? []).map((item, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2 items-start">
            <select
              value={item.icon}
              onChange={(e) => {
                const next = [...(config.trustStrip ?? [])];
                next[idx] = { ...item, icon: e.target.value as NonNullable<JerseyConfig['trustStrip']>[number]['icon'] };
                setConfig({ ...config, trustStrip: next });
              }}
              className={`${selectCls} col-span-2`}
            >
              <option value="truck">Truck</option>
              <option value="shield">Shield</option>
              <option value="rotate">Rotate</option>
              <option value="star">Star</option>
            </select>
            <Input
              value={item.title}
              onChange={(e) => {
                const next = [...(config.trustStrip ?? [])];
                next[idx] = { ...item, title: e.target.value };
                setConfig({ ...config, trustStrip: next });
              }}
              className={`${inputCls} col-span-3`}
              placeholder="Title"
            />
            <Input
              value={item.desc}
              onChange={(e) => {
                const next = [...(config.trustStrip ?? [])];
                next[idx] = { ...item, desc: e.target.value };
                setConfig({ ...config, trustStrip: next });
              }}
              className={`${inputCls} col-span-6`}
              placeholder="Description"
            />
            <button
              onClick={() => setConfig({ ...config, trustStrip: (config.trustStrip ?? []).filter((_, i) => i !== idx) })}
              className="col-span-1 text-rose-300 hover:text-rose-200 self-center"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {(config.trustStrip?.length ?? 0) < 4 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfig({ ...config, trustStrip: [...(config.trustStrip ?? []), { icon: 'truck', title: '', desc: '' }] })}
            className="h-7 text-xs"
          >
            <Plus className="w-3 h-3 mr-1" /> Add trust item
          </Button>
        )}
      </Section>

      <Section title="Footer columns" icon={<Layout className="w-3.5 h-3.5" />}>
        {(config.footerColumns ?? []).map((col, idx) => (
          <Card key={idx} className="bg-white/[0.02] border-white/10">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  value={col.title}
                  onChange={(e) => {
                    const next = [...(config.footerColumns ?? [])];
                    next[idx] = { ...col, title: e.target.value };
                    setConfig({ ...config, footerColumns: next });
                  }}
                  className={inputCls + ' flex-1'}
                  placeholder="Column title"
                />
                <button
                  onClick={() => setConfig({ ...config, footerColumns: (config.footerColumns ?? []).filter((_, i) => i !== idx) })}
                  className="text-rose-300 hover:text-rose-200"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {col.items.map((item, j) => (
                <div key={j} className="grid grid-cols-12 gap-2">
                  <Input
                    value={item.label}
                    onChange={(e) => {
                      const next = [...(config.footerColumns ?? [])];
                      const items = [...col.items];
                      items[j] = { ...item, label: e.target.value };
                      next[idx] = { ...col, items };
                      setConfig({ ...config, footerColumns: next });
                    }}
                    className={`${inputCls} col-span-5`}
                    placeholder="Label"
                  />
                  <Input
                    value={item.href ?? ''}
                    onChange={(e) => {
                      const next = [...(config.footerColumns ?? [])];
                      const items = [...col.items];
                      items[j] = { ...item, href: e.target.value };
                      next[idx] = { ...col, items };
                      setConfig({ ...config, footerColumns: next });
                    }}
                    className={`${inputCls} col-span-6`}
                    placeholder="https://… (optional)"
                  />
                  <button
                    onClick={() => {
                      const next = [...(config.footerColumns ?? [])];
                      next[idx] = { ...col, items: col.items.filter((_, k) => k !== j) };
                      setConfig({ ...config, footerColumns: next });
                    }}
                    className="col-span-1 text-rose-300 hover:text-rose-200 self-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const next = [...(config.footerColumns ?? [])];
                  next[idx] = { ...col, items: [...col.items, { label: '' }] };
                  setConfig({ ...config, footerColumns: next });
                }}
                className="h-6 text-[11px]"
              >
                <Plus className="w-3 h-3 mr-1" /> Add link
              </Button>
            </CardContent>
          </Card>
        ))}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setConfig({ ...config, footerColumns: [...(config.footerColumns ?? []), { title: 'New column', items: [] }] })}
          className="h-7 text-xs w-full"
        >
          <Plus className="w-3 h-3 mr-1" /> Add footer column
        </Button>
      </Section>

      <Section title="Newsletter" icon={<Sparkles className="w-3.5 h-3.5" />}>
        <Field label="Pitch under the footer signup">
          <Textarea
            value={config.newsletterPitch ?? ''}
            onChange={(e) => setConfig({ ...config, newsletterPitch: e.target.value })}
            rows={2}
            className={inputCls}
          />
        </Field>
      </Section>

      <Section title="Multi-tier nav" icon={<Layout className="w-3.5 h-3.5" />}>
        <p className="text-[10px] text-white/40 mb-2">
          Header buttons + dropdowns. Set <code className="text-white/60">parentSlug</code> to nest a tier
          under another (e.g. parent <code className="text-white/60">world-cup</code> with children
          <code className="text-white/60"> clubs</code>, <code className="text-white/60">retro</code>).
        </p>
        {(config.tiers ?? []).map((tier, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2 items-start">
            <Input
              value={tier.slug}
              onChange={(e) => {
                const next = [...(config.tiers ?? [])];
                next[idx] = { ...tier, slug: e.target.value };
                setConfig({ ...config, tiers: next });
              }}
              className={`${inputCls} col-span-3`}
              placeholder="slug"
            />
            <Input
              value={tier.label}
              onChange={(e) => {
                const next = [...(config.tiers ?? [])];
                next[idx] = { ...tier, label: e.target.value };
                setConfig({ ...config, tiers: next });
              }}
              className={`${inputCls} col-span-3`}
              placeholder="Label"
            />
            <Input
              value={tier.parentSlug ?? ''}
              onChange={(e) => {
                const next = [...(config.tiers ?? [])];
                next[idx] = { ...tier, parentSlug: e.target.value || undefined };
                setConfig({ ...config, tiers: next });
              }}
              className={`${inputCls} col-span-2`}
              placeholder="parentSlug"
            />
            <Input
              value={tier.href ?? ''}
              onChange={(e) => {
                const next = [...(config.tiers ?? [])];
                next[idx] = { ...tier, href: e.target.value || undefined };
                setConfig({ ...config, tiers: next });
              }}
              className={`${inputCls} col-span-3`}
              placeholder="href (optional)"
            />
            <button
              onClick={() => setConfig({ ...config, tiers: (config.tiers ?? []).filter((_, i) => i !== idx) })}
              className="col-span-1 text-rose-300 hover:text-rose-200 self-center"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            setConfig({ ...config, tiers: [...(config.tiers ?? []), { slug: '', label: '' }] })
          }
          className="h-7 text-xs"
        >
          <Plus className="w-3 h-3 mr-1" /> Add tier
        </Button>
      </Section>

      <Section title="Languages" icon={<Sparkles className="w-3.5 h-3.5" />}>
        <p className="text-[10px] text-white/40 mb-2">Header language dropdown (ISO code + label).</p>
        {(config.languages ?? []).map((lang, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2 items-start">
            <Input
              value={lang.code}
              onChange={(e) => {
                const next = [...(config.languages ?? [])];
                next[idx] = { ...lang, code: e.target.value };
                setConfig({ ...config, languages: next });
              }}
              className={`${inputCls} col-span-3`}
              placeholder="en"
            />
            <Input
              value={lang.label}
              onChange={(e) => {
                const next = [...(config.languages ?? [])];
                next[idx] = { ...lang, label: e.target.value };
                setConfig({ ...config, languages: next });
              }}
              className={`${inputCls} col-span-8`}
              placeholder="English"
            />
            <button
              onClick={() => setConfig({ ...config, languages: (config.languages ?? []).filter((_, i) => i !== idx) })}
              className="col-span-1 text-rose-300 hover:text-rose-200 self-center"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            setConfig({ ...config, languages: [...(config.languages ?? []), { code: '', label: '' }] })
          }
          className="h-7 text-xs"
        >
          <Plus className="w-3 h-3 mr-1" /> Add language
        </Button>
      </Section>

      <Section title="Payment logos" icon={<Shield className="w-3.5 h-3.5" />}>
        <p className="text-[10px] text-white/40 mb-2">Toggle the payment badges shown in the footer.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
          {ALL_PAYMENT_LOGOS.map((p) => {
            const active = (config.paymentLogos ?? []).includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => {
                  const current = config.paymentLogos ?? [];
                  setConfig({
                    ...config,
                    paymentLogos: active ? current.filter((x) => x !== p) : [...current, p],
                  });
                }}
                className={`text-[10px] uppercase font-bold rounded px-2 py-1 ${
                  active ? 'bg-white text-slate-900' : 'bg-white/[0.05] text-white/40 hover:bg-white/[0.08]'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Trustpilot widget" icon={<Sparkles className="w-3.5 h-3.5" />}>
        <p className="text-[10px] text-white/40 mb-2">
          Pulls the real Trustpilot iframe when both fields are set. Leave blank for a static
          "Excellent reviews" placeholder.
        </p>
        <Field label="Business unit id">
          <Input
            value={config.trustpilot?.businessUnitId ?? ''}
            onChange={(e) =>
              setConfig({ ...config, trustpilot: { ...config.trustpilot, businessUnitId: e.target.value || undefined } })
            }
            className={inputCls}
            placeholder="e.g. 5d4f8b..."
          />
        </Field>
        <Field label="Template id" hint="Default 5419b6a8b0d04a076446a9ad (Mini horizontal).">
          <Input
            value={config.trustpilot?.templateId ?? ''}
            onChange={(e) =>
              setConfig({ ...config, trustpilot: { ...config.trustpilot, templateId: e.target.value || undefined } })
            }
            className={inputCls}
          />
        </Field>
      </Section>
    </div>
  );
}

function HeroPreview({ config }: { config: JerseyConfig }) {
  return (
    <div
      className="rounded-lg p-4 flex items-center gap-3 mt-2"
      style={{ background: `linear-gradient(135deg, ${config.hero?.gradientFrom ?? '#1d4ed8'}, ${config.hero?.gradientTo ?? '#a21caf'})` }}
    >
      {config.hero?.imageUrl ? (
        <img src={config.hero.imageUrl} alt="" className="w-14 h-14 rounded object-cover" />
      ) : (
        <div className="w-14 h-14 rounded bg-white/20" />
      )}
      <div className="text-white text-sm">
        <div className="font-bold">{config.hero?.headline || '—'}</div>
        <div className="text-white/85 text-[11px]">{config.hero?.subtext || '—'}</div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="bg-[#13131f] border-white/10">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center gap-2 text-white/80 text-xs font-medium uppercase tracking-wide">
          {icon} {title}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] text-white/40 uppercase">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-white/40 mt-0.5">{hint}</p>}
    </div>
  );
}

const inputCls = 'bg-white/5 border-white/10 text-white text-xs';
const selectCls = 'w-full h-9 px-2 rounded-md bg-white/5 border border-white/10 text-xs text-white';
