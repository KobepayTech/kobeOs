import { useState } from 'react';
import { Truck, Search, Phone, MessageCircle, MapPin, PackageCheck } from 'lucide-react';

/** Presentational public cargo landing — shared by the live page (CargoSite)
 *  and the cargo-owner site builder preview so they never drift. */

export interface CargoSite {
  [key: string]: unknown;
  companyName?: string;
  tagline?: string;
  primaryColor?: string;
  logoUrl?: string;
  heroImageUrl?: string;
  about?: string;
  services?: string; // one per line
  phone?: string;
  whatsapp?: string;
  address?: string;
}

export function CargoSitePreview({ site, live }: { site: CargoSite; live?: boolean }) {
  const c = site ?? {};
  const primary = c.primaryColor || '#059669';
  const services = (c.services || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const [track, setTrack] = useState('');

  const doTrack = () => {
    const n = track.trim();
    if (!n) return;
    if (live) window.location.href = `/track/${encodeURIComponent(n)}`;
  };

  return (
    <div className="min-h-full bg-white text-slate-900" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <header className="px-5 py-3 border-b border-slate-200 flex items-center gap-3">
        {c.logoUrl
          ? <img src={c.logoUrl} alt="" className="h-8 w-auto max-w-[120px] object-contain" />
          : <div className="w-9 h-9 rounded-lg grid place-items-center text-white" style={{ backgroundColor: primary }}><Truck className="w-5 h-5" /></div>}
        <div>
          <div className="text-base font-black leading-none">{c.companyName || 'Your Cargo Co.'}</div>
          <div className="text-[11px] text-slate-500">{c.tagline || 'Fast, tracked deliveries'}</div>
        </div>
      </header>

      {/* Hero + tracking box */}
      <section className="relative px-6 py-10 text-white" style={{ background: c.heroImageUrl ? undefined : `linear-gradient(135deg, ${primary}, #0f172a)` }}>
        {c.heroImageUrl && <img src={c.heroImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />}
        <div className="relative max-w-md">
          <h1 className="text-2xl md:text-3xl font-black">{c.companyName || 'Track your shipment'}</h1>
          <p className="text-white/85 text-sm mt-1">{c.tagline || 'Enter your tracking number to see where your parcel is.'}</p>
          <div className="mt-4 flex gap-2 bg-white rounded-xl p-1.5 shadow-lg">
            <input
              value={track}
              onChange={(e) => setTrack(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doTrack()}
              placeholder="Tracking number"
              className="flex-1 h-10 px-3 rounded-lg text-slate-900 text-sm focus:outline-none"
            />
            <button onClick={doTrack} className="h-10 px-4 rounded-lg text-white text-sm font-bold inline-flex items-center gap-1.5" style={{ backgroundColor: primary }}>
              <Search className="w-4 h-4" /> Track
            </button>
          </div>
        </div>
      </section>

      {/* Services */}
      {services.length > 0 && (
        <section className="px-6 py-6 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-3"><PackageCheck className="w-4 h-4 text-slate-500" /><h2 className="text-sm font-bold">Our services</h2></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {services.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-slate-700"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: primary }} /> {s}</div>
            ))}
          </div>
        </section>
      )}

      {/* About */}
      {c.about && (
        <section className="px-6 py-6 border-b border-slate-100">
          <h2 className="text-sm font-bold mb-1">About us</h2>
          <p className="text-sm text-slate-600 leading-relaxed">{c.about}</p>
        </section>
      )}

      {/* Contact */}
      {(c.phone || c.whatsapp || c.address) && (
        <footer className="px-6 py-6 bg-slate-50 space-y-1.5 text-sm text-slate-700">
          {c.address && <div className="inline-flex items-center gap-2"><MapPin className="w-4 h-4" style={{ color: primary }} /> {c.address}</div>}
          {c.phone && <div><a href={`tel:${c.phone}`} className="inline-flex items-center gap-2"><Phone className="w-4 h-4" style={{ color: primary }} /> {c.phone}</a></div>}
          {c.whatsapp && <div><a href={`https://wa.me/${c.whatsapp.replace(/\D/g, '').replace(/^0/, '255')}`} className="inline-flex items-center gap-2"><MessageCircle className="w-4 h-4 text-emerald-600" /> WhatsApp</a></div>}
        </footer>
      )}
    </div>
  );
}
