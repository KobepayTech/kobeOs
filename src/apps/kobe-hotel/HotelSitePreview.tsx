import { MapPin, Phone, MessageCircle, Star, BedDouble } from 'lucide-react';

/** Lean, presentational preview of the public hotel booking site — driven by
 *  the same fields the booking page reads (store_settings + siteConfig), so the
 *  builder preview matches what guests see. */

export interface HotelSite {
  [key: string]: unknown;
  hotelName?: string;
  tagline?: string;
  primaryColor?: string;
  accentColor?: string;
  logoUrl?: string;
  heroImageUrl?: string;
  about?: string;
  amenities?: string; // one per line in the builder
  phone?: string;
  whatsapp?: string;
  address?: string;
}

export function HotelSitePreview({ site }: { site: HotelSite }) {
  const c = site ?? {};
  const primary = c.primaryColor || '#4f46e5';
  const accent = c.accentColor || '#8b5cf6';
  const amenities = (c.amenities || '').split('\n').map((s) => s.trim()).filter(Boolean);

  return (
    <div className="min-h-full bg-white text-slate-900" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <header className="px-5 py-3 border-b border-slate-200 flex items-center gap-3">
        {c.logoUrl
          ? <img src={c.logoUrl} alt="" className="h-8 w-auto max-w-[120px] object-contain" />
          : <div className="w-9 h-9 rounded-lg grid place-items-center text-white font-black" style={{ backgroundColor: primary }}>{(c.hotelName || 'H').charAt(0).toUpperCase()}</div>}
        <div>
          <div className="text-base font-black leading-none">{c.hotelName || 'Your Hotel'}</div>
          <div className="text-[11px] text-slate-500">{c.tagline || 'Comfort & hospitality'}</div>
        </div>
        <button className="ml-auto h-8 px-3 rounded-lg text-white text-xs font-bold" style={{ backgroundColor: accent }}>Book now</button>
      </header>

      {/* Hero */}
      <section className="relative h-48 flex items-end text-white" style={{ background: c.heroImageUrl ? undefined : `linear-gradient(135deg, ${primary}, ${accent})` }}>
        {c.heroImageUrl && <img src={c.heroImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        <div className="relative p-5 bg-gradient-to-t from-black/50 to-transparent w-full">
          <h1 className="text-2xl font-black">{c.hotelName || 'Your Hotel'}</h1>
          <p className="text-white/90 text-sm">{c.tagline || 'Book your stay in seconds'}</p>
        </div>
      </section>

      {/* About */}
      {c.about && (
        <section className="px-5 py-5 border-b border-slate-100">
          <h2 className="text-sm font-bold mb-1">About</h2>
          <p className="text-sm text-slate-600 leading-relaxed">{c.about}</p>
        </section>
      )}

      {/* Amenities */}
      {amenities.length > 0 && (
        <section className="px-5 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-3"><Star className="w-4 h-4" style={{ color: accent }} /><h2 className="text-sm font-bold">Amenities</h2></div>
          <div className="grid grid-cols-2 gap-2">
            {amenities.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-slate-700"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: primary }} /> {a}</div>
            ))}
          </div>
        </section>
      )}

      {/* Sample rooms */}
      <section className="px-5 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-3"><BedDouble className="w-4 h-4 text-slate-500" /><h2 className="text-sm font-bold">Rooms</h2></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[{ t: 'Standard', p: 60000 }, { t: 'Deluxe', p: 95000 }].map((r) => (
            <div key={r.t} className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="h-20" style={{ background: `linear-gradient(135deg, ${primary}22, ${accent}22)` }} />
              <div className="p-3 flex items-center justify-between">
                <div><div className="text-sm font-bold">{r.t}</div><div className="text-[11px] text-slate-500">Sleeps 2</div></div>
                <div className="text-right"><div className="text-sm font-black">TZS {r.p.toLocaleString()}</div><button className="text-[11px] font-bold" style={{ color: primary }}>Book</button></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Contact */}
      {(c.phone || c.whatsapp || c.address) && (
        <footer className="px-5 py-5 bg-slate-50 space-y-1.5 text-sm text-slate-700">
          {c.address && <div className="inline-flex items-center gap-2"><MapPin className="w-4 h-4" style={{ color: primary }} /> {c.address}</div>}
          {c.phone && <div><a href={`tel:${c.phone}`} className="inline-flex items-center gap-2"><Phone className="w-4 h-4" style={{ color: primary }} /> {c.phone}</a></div>}
          {c.whatsapp && <div><a href={`https://wa.me/${c.whatsapp.replace(/\D/g, '').replace(/^0/, '255')}`} className="inline-flex items-center gap-2"><MessageCircle className="w-4 h-4 text-emerald-600" /> WhatsApp</a></div>}
        </footer>
      )}
    </div>
  );
}
