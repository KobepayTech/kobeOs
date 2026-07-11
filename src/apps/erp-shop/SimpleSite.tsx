import { useState } from 'react';
import type { SiteConfig } from './index';
import {
  Phone, Mail, MapPin, MessageCircle, Clock, ArrowRight, Facebook, Instagram,
  Star, Sparkles, ShieldCheck, Truck, Heart, Wrench, Scissors, Store, PackageSearch,
} from 'lucide-react';

/**
 * Simple one-page business website (template='site'). Reuses the storefront
 * pipeline — same {slug}.kobeapptz.com hosting and store_settings row — but
 * renders a lightweight brochure page instead of a product catalogue. For
 * businesses that just want an online presence: hero, about, services,
 * hours, and a way to be contacted. No cart, no products.
 */
interface Settings {
  storeName: string;
  tagline: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  footerText: string;
  bannerBg: string;
  siteConfig?: SiteConfig;
}

const ICONS: Record<string, typeof Star> = {
  star: Star, sparkles: Sparkles, shield: ShieldCheck, truck: Truck,
  heart: Heart, wrench: Wrench, scissors: Scissors, store: Store, clock: Clock,
};

export default function SimpleSite({ settings }: { settings: Settings }) {
  const c = settings.siteConfig ?? {};
  const primary = settings.primaryColor || '#6366f1';
  const accent = settings.accentColor || '#8b5cf6';
  const wa = (c.whatsapp || '').replace(/\D/g, '');
  const services = c.services ?? [];
  const hours = c.hours ?? [];

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="h-full overflow-auto bg-white text-slate-900" style={{ ['--primary' as string]: primary, ['--accent' as string]: accent }}>
      {/* Nav */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {settings.logoUrl
              ? <img src={settings.logoUrl} alt={settings.storeName} className="h-9 w-9 rounded-lg object-cover" />
              : <div className="h-9 w-9 rounded-lg grid place-items-center text-white font-black" style={{ background: primary }}>{settings.storeName.charAt(0)}</div>}
            <span className="font-extrabold text-lg">{settings.storeName}</span>
          </div>
          <nav className="hidden sm:flex items-center gap-5 text-sm font-semibold text-slate-600">
            {services.length > 0 && <button onClick={() => scrollTo('services')} className="hover:text-slate-900">Services</button>}
            {c.about && <button onClick={() => scrollTo('about')} className="hover:text-slate-900">About</button>}
            <button onClick={() => scrollTo('contact')} className="hover:text-slate-900">Contact</button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}>
        {c.heroImageUrl && <img src={c.heroImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" />}
        <div className="relative max-w-5xl mx-auto px-5 py-20 sm:py-28 text-white">
          <h1 className="text-3xl sm:text-5xl font-black max-w-2xl leading-tight">{settings.tagline || settings.storeName}</h1>
          {c.about && <p className="mt-4 text-base sm:text-lg text-white/85 max-w-xl">{truncate(c.about, 160)}</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={c.ctaHref || (wa ? `https://wa.me/${wa}` : '#contact')} onClick={(e) => { if (!c.ctaHref && !wa) { e.preventDefault(); scrollTo('contact'); } }}
              className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-white font-bold text-slate-900 active:scale-95 transition">
              {c.ctaLabel || 'Get in touch'} <ArrowRight className="w-4 h-4" />
            </a>
            {c.phone && <a href={`tel:${c.phone}`} className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-white/15 font-bold text-white border border-white/30"><Phone className="w-4 h-4" /> Call us</a>}
          </div>
        </div>
      </section>

      {/* Cargo TZ — track your parcel */}
      {c.cargoTracking && <TrackBox primary={primary} />}

      {/* Services */}
      {services.length > 0 && (
        <section id="services" className="max-w-5xl mx-auto px-5 py-16">
          <h2 className="text-2xl font-extrabold text-center">What we offer</h2>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((s, i) => {
              const Icon = ICONS[s.icon || 'star'] ?? Star;
              return (
                <div key={i} className="rounded-2xl border border-slate-200 p-5 hover:shadow-lg transition">
                  <div className="w-11 h-11 rounded-xl grid place-items-center text-white mb-3" style={{ background: primary }}><Icon className="w-5 h-5" /></div>
                  <div className="font-bold text-lg">{s.title}</div>
                  {s.desc && <p className="text-sm text-slate-500 mt-1">{s.desc}</p>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* About */}
      {c.about && (
        <section id="about" className="bg-slate-50 border-y border-slate-100">
          <div className="max-w-3xl mx-auto px-5 py-16 text-center">
            <h2 className="text-2xl font-extrabold">About {settings.storeName}</h2>
            <p className="mt-4 text-slate-600 leading-relaxed whitespace-pre-line">{c.about}</p>
          </div>
        </section>
      )}

      {/* Hours + Contact */}
      <section id="contact" className="max-w-5xl mx-auto px-5 py-16 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xl font-extrabold">Get in touch</h2>
          <div className="mt-5 space-y-3 text-sm">
            {c.phone && <ContactRow Icon={Phone} label={c.phone} href={`tel:${c.phone}`} />}
            {wa && <ContactRow Icon={MessageCircle} label={`WhatsApp ${c.whatsapp}`} href={`https://wa.me/${wa}`} />}
            {c.email && <ContactRow Icon={Mail} label={c.email} href={`mailto:${c.email}`} />}
            {c.address && <ContactRow Icon={MapPin} label={c.address} href={c.mapQuery ? `https://maps.google.com/?q=${encodeURIComponent(c.mapQuery)}` : undefined} />}
          </div>
          {(c.socials?.facebook || c.socials?.instagram) && (
            <div className="mt-5 flex gap-3">
              {c.socials?.facebook && <a href={c.socials.facebook} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-slate-100 grid place-items-center hover:bg-slate-200"><Facebook className="w-4 h-4" /></a>}
              {c.socials?.instagram && <a href={c.socials.instagram} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-slate-100 grid place-items-center hover:bg-slate-200"><Instagram className="w-4 h-4" /></a>}
            </div>
          )}
        </div>

        {hours.length > 0 && (
          <div>
            <h2 className="text-2xl font-extrabold flex items-center gap-2"><Clock className="w-5 h-5" /> Opening hours</h2>
            <div className="mt-5 rounded-2xl border border-slate-200 divide-y divide-slate-100">
              {hours.map((h, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="font-semibold text-slate-700">{h.day}</span>
                  <span className="text-slate-500">{h.open}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Sticky WhatsApp */}
      {wa && (
        <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"
          className="fixed bottom-5 right-5 z-30 w-14 h-14 rounded-full bg-[#25D366] grid place-items-center shadow-xl active:scale-95">
          <MessageCircle className="w-7 h-7 text-white" />
        </a>
      )}

      <footer className="border-t border-slate-100 py-8 text-center text-sm text-slate-400">
        {settings.footerText || `© ${new Date().getFullYear()} ${settings.storeName}`}
        <div className="mt-1 text-[11px]">Powered by KobeOS</div>
      </footer>
    </div>
  );
}

function TrackBox({ primary }: { primary: string }) {
  const [tn, setTn] = useState('');
  const go = () => { if (tn.trim()) window.location.href = `/ctz/${encodeURIComponent(tn.trim().toUpperCase())}`; };
  return (
    <section className="max-w-3xl mx-auto px-5 -mt-8 relative z-10">
      <div className="rounded-2xl bg-white shadow-xl border border-slate-100 p-5">
        <div className="flex items-center gap-2 font-extrabold text-slate-900"><PackageSearch className="w-5 h-5" style={{ color: primary }} /> Track your parcel</div>
        <div className="mt-3 flex gap-2">
          <input value={tn} onChange={(e) => setTn(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === 'Enter') go(); }}
            placeholder="Tracking number e.g. CTZ-2026...-000234" className="flex-1 h-12 px-4 rounded-xl border border-slate-200 text-sm font-mono" />
          <button onClick={go} className="h-12 px-6 rounded-xl text-white font-bold" style={{ background: primary }}>Track</button>
        </div>
      </div>
    </section>
  );
}

function ContactRow({ Icon, label, href }: { Icon: typeof Phone; label: string; href?: string }) {
  const inner = (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-slate-100 grid place-items-center text-slate-600 shrink-0"><Icon className="w-4 h-4" /></div>
      <span className="text-slate-700">{label}</span>
    </div>
  );
  return href ? <a href={href} target="_blank" rel="noreferrer" className="block hover:opacity-70">{inner}</a> : inner;
}

function truncate(s: string, n: number) { return s.length > n ? `${s.slice(0, n)}…` : s; }
