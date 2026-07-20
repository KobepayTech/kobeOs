import { useEffect, useState } from 'react';
import { publicApi } from './api';
import { Loader2 } from 'lucide-react';
import { CargoSitePreview, type CargoSite as CargoSiteConfig } from './CargoSitePreview';

/**
 * Public branded cargo landing at /cg/:slug. Reads the owner's published
 * store_settings via @Public GET /store/:slug and renders the branded landing
 * (company brand + services + a live tracking box). Configured from the
 * cargo-owner app's Site Builder.
 */

interface StoreSettings {
  storeName?: string; tagline?: string; primaryColor?: string; logoUrl?: string;
  siteConfig?: { heroImageUrl?: string; about?: string; services?: string[]; cargoServices?: string[]; phone?: string; whatsapp?: string; address?: string };
}

function toSite(s: StoreSettings): CargoSiteConfig {
  const c = s.siteConfig ?? {};
  const services = Array.isArray(c.cargoServices) ? c.cargoServices : Array.isArray(c.services) ? c.services : [];
  return {
    companyName: s.storeName ?? '', tagline: s.tagline ?? '', primaryColor: s.primaryColor ?? '#059669',
    logoUrl: s.logoUrl ?? '', heroImageUrl: c.heroImageUrl ?? '', about: c.about ?? '',
    services: services.join('\n'), phone: c.phone ?? '', whatsapp: c.whatsapp ?? '', address: c.address ?? '',
  };
}

export default function CargoSite({ slug }: { slug: string }) {
  const [site, setSite] = useState<CargoSiteConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    publicApi<{ settings: StoreSettings }>(`/store/${encodeURIComponent(slug)}`)
      .then((r) => { if (!cancelled) setSite(toSite(r.settings || {})); })
      .catch(() => { if (!cancelled) setError('This cargo site isn’t published yet.'); });
    return () => { cancelled = true; };
  }, [slug]);

  if (error) return <div className="min-h-[100dvh] grid place-items-center bg-slate-100 text-slate-500 text-sm p-6 text-center">{error}</div>;
  if (!site) return <div className="min-h-[100dvh] grid place-items-center bg-slate-100"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  return <CargoSitePreview site={site} live />;
}
