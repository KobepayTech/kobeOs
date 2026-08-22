import { Plus, Trash2, Star, Sparkles, ShieldCheck, Truck, Heart, Wrench, Scissors, Store, Clock } from 'lucide-react';

export interface SiteConfig {
  heroImageUrl?: string;
  about?: string;
  services?: Array<{ title: string; desc?: string; icon?: string }>;
  amenities?: string[];
  hours?: Array<{ day: string; open: string }>;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  mapQuery?: string;
  socials?: { facebook?: string; instagram?: string; tiktok?: string; x?: string };
  ctaLabel?: string;
  ctaHref?: string;
  cargoTracking?: boolean;
}

const ICON_CHOICES = ['star', 'sparkles', 'shield', 'truck', 'heart', 'wrench', 'scissors', 'store', 'clock'] as const;
const ICON_MAP: Record<string, typeof Star> = {
  star: Star, sparkles: Sparkles, shield: ShieldCheck, truck: Truck, heart: Heart, wrench: Wrench, scissors: Scissors, store: Store, clock: Clock,
};

const inputCls = 'w-full h-8 px-2 rounded-md bg-white/[0.04] border border-white/10 text-xs text-white/90 placeholder:text-white/30';
const labelCls = 'text-[10px] font-semibold text-white/50 uppercase tracking-wide';

export default function SiteContentEditor({ value, onChange }: { value: SiteConfig; onChange: (next: SiteConfig) => void }) {
  const c = value ?? {};
  const patch = (next: Partial<SiteConfig>) => onChange({ ...c, ...next });
  const services = c.services ?? [];
  const hours = c.hours ?? [];

  return (
    <div className="space-y-4">
      <Field label="Hero image URL"><input className={inputCls} value={c.heroImageUrl ?? ''} onChange={(event) => patch({ heroImageUrl: event.target.value })} placeholder="https://…" /></Field>
      <Field label="About / description"><textarea className={`${inputCls} h-20 resize-none py-1.5`} value={c.about ?? ''} onChange={(event) => patch({ about: event.target.value })} placeholder="Tell customers who you are…" /></Field>
      <label className="flex items-center gap-2 py-1 text-[11px] font-semibold text-white/70"><input type="checkbox" checked={Boolean(c.cargoTracking)} onChange={(event) => patch({ cargoTracking: event.target.checked })} className="accent-emerald-500" />Show a Track your parcel box (Cargo TZ)</label>
      <div className="grid grid-cols-2 gap-2"><Field label="CTA label"><input className={inputCls} value={c.ctaLabel ?? ''} onChange={(event) => patch({ ctaLabel: event.target.value })} placeholder="Get in touch" /></Field><Field label="CTA link"><input className={inputCls} value={c.ctaHref ?? ''} onChange={(event) => patch({ ctaHref: event.target.value })} placeholder="tel: / https:" /></Field></div>

      <div className="grid grid-cols-2 gap-2"><Field label="Phone"><input className={inputCls} value={c.phone ?? ''} onChange={(event) => patch({ phone: event.target.value })} placeholder="+255…" /></Field><Field label="WhatsApp"><input className={inputCls} value={c.whatsapp ?? ''} onChange={(event) => patch({ whatsapp: event.target.value })} placeholder="+255…" /></Field><Field label="Email"><input className={inputCls} value={c.email ?? ''} onChange={(event) => patch({ email: event.target.value })} placeholder="hello@…" /></Field><Field label="Map query"><input className={inputCls} value={c.mapQuery ?? ''} onChange={(event) => patch({ mapQuery: event.target.value })} placeholder="Business, City" /></Field></div>
      <Field label="Address"><input className={inputCls} value={c.address ?? ''} onChange={(event) => patch({ address: event.target.value })} placeholder="Street, City" /></Field>
      <div className="grid grid-cols-2 gap-2"><Field label="Facebook"><input className={inputCls} value={c.socials?.facebook ?? ''} onChange={(event) => patch({ socials: { ...c.socials, facebook: event.target.value } })} placeholder="https://facebook.com/…" /></Field><Field label="Instagram"><input className={inputCls} value={c.socials?.instagram ?? ''} onChange={(event) => patch({ socials: { ...c.socials, instagram: event.target.value } })} placeholder="https://instagram.com/…" /></Field></div>

      <div>
        <div className="mb-1.5 flex items-center justify-between"><span className={labelCls}>Services</span><button onClick={() => patch({ services: [...services, { title: '', desc: '', icon: 'star' }] })} className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 hover:text-amber-200"><Plus className="h-3 w-3" />Add</button></div>
        <div className="space-y-2">{services.map((service, index) => {
          const setService = (next: Partial<{ title: string; desc: string; icon: string }>) => patch({ services: services.map((item, itemIndex) => itemIndex === index ? { ...item, ...next } : item) });
          return <div key={index} className="space-y-1.5 rounded-lg border border-white/10 p-2"><div className="flex items-center gap-1.5"><select value={service.icon ?? 'star'} onChange={(event) => setService({ icon: event.target.value })} className="h-8 rounded-md border border-white/10 bg-white/[0.04] px-1 text-xs text-white/80">{ICON_CHOICES.map((icon) => <option key={icon} value={icon}>{icon}</option>)}</select><input className={inputCls} value={service.title} onChange={(event) => setService({ title: event.target.value })} placeholder="Service title" /><button onClick={() => patch({ services: services.filter((_, itemIndex) => itemIndex !== index) })} className="text-white/40 hover:text-rose-400"><Trash2 className="h-3.5 w-3.5" /></button></div><input className={inputCls} value={service.desc ?? ''} onChange={(event) => setService({ desc: event.target.value })} placeholder="Short description" /></div>;
        })}{services.length === 0 && <p className="text-[10px] text-white/30">No services added.</p>}</div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between"><span className={labelCls}>Opening hours</span><button onClick={() => patch({ hours: [...hours, { day: '', open: '' }] })} className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 hover:text-amber-200"><Plus className="h-3 w-3" />Add</button></div>
        <div className="space-y-1.5">{hours.map((hoursRow, index) => {
          const setHours = (next: Partial<{ day: string; open: string }>) => patch({ hours: hours.map((item, itemIndex) => itemIndex === index ? { ...item, ...next } : item) });
          return <div key={index} className="flex items-center gap-1.5"><input className={inputCls} value={hoursRow.day} onChange={(event) => setHours({ day: event.target.value })} placeholder="Mon–Fri" /><input className={inputCls} value={hoursRow.open} onChange={(event) => setHours({ open: event.target.value })} placeholder="9:00–18:00" /><button onClick={() => patch({ hours: hours.filter((_, itemIndex) => itemIndex !== index) })} className="text-white/40 hover:text-rose-400"><Trash2 className="h-3.5 w-3.5" /></button></div>;
        })}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className={labelCls}>{label}</span>{children}</label>;
}

export { ICON_MAP };
