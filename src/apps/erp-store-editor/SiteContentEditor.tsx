import type { SiteConfig } from './index';
import { Plus, Trash2, Star, Sparkles, ShieldCheck, Truck, Heart, Wrench, Scissors, Store, Clock } from 'lucide-react';

/**
 * Editor panel for the simple one-page website (template='site'). Edits the
 * siteConfig blob — hero image, about, services, hours, contact, socials.
 * Plain dark-theme inputs to match the store editor's left rail.
 */
const ICON_CHOICES = ['star', 'sparkles', 'shield', 'truck', 'heart', 'wrench', 'scissors', 'store', 'clock'] as const;
const ICON_MAP: Record<string, typeof Star> = {
  star: Star, sparkles: Sparkles, shield: ShieldCheck, truck: Truck, heart: Heart, wrench: Wrench, scissors: Scissors, store: Store, clock: Clock,
};

const inputCls = 'w-full h-8 px-2 rounded-md bg-white/[0.04] border border-white/10 text-xs text-white/90 placeholder:text-white/30';
const labelCls = 'text-[10px] font-semibold text-white/50 uppercase tracking-wide';

export default function SiteContentEditor({ value, onChange }: { value: SiteConfig; onChange: (next: SiteConfig) => void }) {
  const c = value ?? {};
  const patch = (p: Partial<SiteConfig>) => onChange({ ...c, ...p });
  const services = c.services ?? [];
  const hours = c.hours ?? [];

  return (
    <div className="space-y-4">
      {/* Basics */}
      <Field label="Hero image URL">
        <input className={inputCls} value={c.heroImageUrl ?? ''} onChange={(e) => patch({ heroImageUrl: e.target.value })} placeholder="https://…" />
      </Field>
      <Field label="About / description">
        <textarea className={`${inputCls} h-20 py-1.5 resize-none`} value={c.about ?? ''} onChange={(e) => patch({ about: e.target.value })} placeholder="Tell customers who you are…" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="CTA label"><input className={inputCls} value={c.ctaLabel ?? ''} onChange={(e) => patch({ ctaLabel: e.target.value })} placeholder="Get in touch" /></Field>
        <Field label="CTA link"><input className={inputCls} value={c.ctaHref ?? ''} onChange={(e) => patch({ ctaHref: e.target.value })} placeholder="tel: / https:" /></Field>
      </div>

      {/* Contact */}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Phone"><input className={inputCls} value={c.phone ?? ''} onChange={(e) => patch({ phone: e.target.value })} placeholder="+255…" /></Field>
        <Field label="WhatsApp"><input className={inputCls} value={c.whatsapp ?? ''} onChange={(e) => patch({ whatsapp: e.target.value })} placeholder="+255…" /></Field>
        <Field label="Email"><input className={inputCls} value={c.email ?? ''} onChange={(e) => patch({ email: e.target.value })} placeholder="hello@…" /></Field>
        <Field label="Map query"><input className={inputCls} value={c.mapQuery ?? ''} onChange={(e) => patch({ mapQuery: e.target.value })} placeholder="Business, City" /></Field>
      </div>
      <Field label="Address"><input className={inputCls} value={c.address ?? ''} onChange={(e) => patch({ address: e.target.value })} placeholder="Street, City" /></Field>

      {/* Socials */}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Facebook"><input className={inputCls} value={c.socials?.facebook ?? ''} onChange={(e) => patch({ socials: { ...c.socials, facebook: e.target.value } })} placeholder="https://facebook.com/…" /></Field>
        <Field label="Instagram"><input className={inputCls} value={c.socials?.instagram ?? ''} onChange={(e) => patch({ socials: { ...c.socials, instagram: e.target.value } })} placeholder="https://instagram.com/…" /></Field>
      </div>

      {/* Services */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className={labelCls}>Services</span>
          <button onClick={() => patch({ services: [...services, { title: '', desc: '', icon: 'star' }] })} className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 hover:text-amber-200"><Plus className="w-3 h-3" /> Add</button>
        </div>
        <div className="space-y-2">
          {services.map((s, i) => {
            const set = (p: Partial<{ title: string; desc: string; icon: string }>) => {
              const next = services.map((x, j) => (j === i ? { ...x, ...p } : x));
              patch({ services: next });
            };
            return (
              <div key={i} className="rounded-lg border border-white/10 p-2 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <select value={s.icon ?? 'star'} onChange={(e) => set({ icon: e.target.value })} className="h-8 px-1 rounded-md bg-white/[0.04] border border-white/10 text-xs text-white/80">
                    {ICON_CHOICES.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
                  </select>
                  <input className={inputCls} value={s.title} onChange={(e) => set({ title: e.target.value })} placeholder="Service title" />
                  <button onClick={() => patch({ services: services.filter((_, j) => j !== i) })} className="text-white/40 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
                <input className={inputCls} value={s.desc ?? ''} onChange={(e) => set({ desc: e.target.value })} placeholder="Short description" />
              </div>
            );
          })}
          {services.length === 0 && <p className="text-[10px] text-white/30">No services yet — add a few.</p>}
        </div>
      </div>

      {/* Hours */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className={labelCls}>Opening hours</span>
          <button onClick={() => patch({ hours: [...hours, { day: '', open: '' }] })} className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 hover:text-amber-200"><Plus className="w-3 h-3" /> Add</button>
        </div>
        <div className="space-y-1.5">
          {hours.map((h, i) => {
            const set = (p: Partial<{ day: string; open: string }>) => patch({ hours: hours.map((x, j) => (j === i ? { ...x, ...p } : x)) });
            return (
              <div key={i} className="flex items-center gap-1.5">
                <input className={inputCls} value={h.day} onChange={(e) => set({ day: e.target.value })} placeholder="Mon–Fri" />
                <input className={inputCls} value={h.open} onChange={(e) => set({ open: e.target.value })} placeholder="9:00–18:00" />
                <button onClick={() => patch({ hours: hours.filter((_, j) => j !== i) })} className="text-white/40 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className={labelCls}>{label}</span>{children}</label>;
}

export { ICON_MAP };
