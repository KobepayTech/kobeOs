import { Phone, Mail, Building2, Wrench } from 'lucide-react';

/**
 * The public estate landing — the branded "generic site" a scanner sees (#11),
 * and the header of the token-gated tenant portal. One presentational component
 * so the site builder's preview and the live portal never drift apart.
 */

export interface EstateSite {
  businessName?: string;
  tagline?: string;
  primaryColor?: string;
  heroHeadline?: string;
  heroSubtext?: string;
  about?: string;
  services?: string; // one per line
  phone?: string;
  email?: string;
}

export function EstateSitePreview({
  config,
  properties,
}: {
  config: EstateSite;
  properties?: Array<{ name: string; address: string }>;
}) {
  const c = config ?? {};
  const primary = c.primaryColor || '#c8102e';
  const services = (c.services || '').split('\n').map((s) => s.trim()).filter(Boolean);

  return (
    <div className="min-h-full bg-white text-slate-900" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <header className="px-5 py-3 border-b border-slate-200 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg grid place-items-center text-white font-black" style={{ backgroundColor: primary }}>
          {(c.businessName || 'E').charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="text-base font-black leading-none">{c.businessName || 'Your Estate'}</div>
          <div className="text-[11px] text-slate-500">{c.tagline || 'Rentals & property management'}</div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 py-10 text-white" style={{ background: `linear-gradient(135deg, ${primary}, #1a1a2e)` }}>
        <h1 className="text-2xl md:text-3xl font-black max-w-lg">{c.heroHeadline || 'Quality homes, simple rent.'}</h1>
        <p className="text-white/85 text-sm mt-2 max-w-md">{c.heroSubtext || 'Browse available units, pay rent with your token, and reach our team any time.'}</p>
      </section>

      {/* About */}
      {c.about && (
        <section className="px-6 py-6 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900 mb-1">About us</h2>
          <p className="text-sm text-slate-600 leading-relaxed">{c.about}</p>
        </section>
      )}

      {/* Services */}
      {services.length > 0 && (
        <section className="px-6 py-6 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-3"><Wrench className="w-4 h-4 text-slate-500" /><h2 className="text-sm font-bold text-slate-900">Services</h2></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {services.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-slate-700">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: primary }} /> {s}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Properties */}
      {properties && properties.length > 0 && (
        <section className="px-6 py-6 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-3"><Building2 className="w-4 h-4 text-slate-500" /><h2 className="text-sm font-bold text-slate-900">Our properties</h2></div>
          <ul className="space-y-1.5">
            {properties.map((p, i) => (
              <li key={i} className="text-sm text-slate-700 border-b border-slate-100 last:border-0 pb-1.5">{p.name}<span className="text-slate-400"> · {p.address || '—'}</span></li>
            ))}
          </ul>
        </section>
      )}

      {/* Contact */}
      {(c.phone || c.email) && (
        <footer className="px-6 py-6 bg-slate-50">
          <h2 className="text-sm font-bold text-slate-900 mb-2">Contact</h2>
          <div className="flex flex-col gap-1.5 text-sm text-slate-700">
            {c.phone && <a href={`tel:${c.phone}`} className="inline-flex items-center gap-2"><Phone className="w-4 h-4" style={{ color: primary }} /> {c.phone}</a>}
            {c.email && <a href={`mailto:${c.email}`} className="inline-flex items-center gap-2"><Mail className="w-4 h-4" style={{ color: primary }} /> {c.email}</a>}
          </div>
        </footer>
      )}
    </div>
  );
}
