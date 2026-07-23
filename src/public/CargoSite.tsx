import { useEffect, useState } from 'react';
import { publicApi } from './api';
import { Loader2 } from 'lucide-react';
import { CargoSitePreview, type CargoSite as CargoSiteConfig } from './CargoSitePreview';

interface ModuleSiteSettings {
  name?: string;
  tagline?: string;
  primaryColor?: string;
  logoUrl?: string;
  config?: {
    heroImageUrl?: string;
    about?: string;
    services?: string[];
    cargoServices?: string[];
    phone?: string;
    whatsapp?: string;
    address?: string;
  };
}

function toSite(site: ModuleSiteSettings): CargoSiteConfig {
  const config = site.config ?? {};
  const services = Array.isArray(config.cargoServices)
    ? config.cargoServices
    : Array.isArray(config.services)
      ? config.services
      : [];
  return {
    companyName: site.name ?? '',
    tagline: site.tagline ?? '',
    primaryColor: site.primaryColor ?? '#059669',
    logoUrl: site.logoUrl ?? '',
    heroImageUrl: config.heroImageUrl ?? '',
    about: config.about ?? '',
    services: services.join('\n'),
    phone: config.phone ?? '',
    whatsapp: config.whatsapp ?? '',
    address: config.address ?? '',
  };
}

export default function CargoSite({ slug }: { slug: string }) {
  const [site, setSite] = useState<CargoSiteConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    publicApi<ModuleSiteSettings>(`/module-sites/public/cargo/${encodeURIComponent(slug)}`)
      .then((response) => { if (!cancelled) setSite(toSite(response)); })
      .catch(() => { if (!cancelled) setError('This cargo site isn’t published yet.'); });
    return () => { cancelled = true; };
  }, [slug]);

  if (error) return <div className="min-h-[100dvh] grid place-items-center bg-slate-100 text-slate-500 text-sm p-6 text-center">{error}</div>;
  if (!site) return <div className="min-h-[100dvh] grid place-items-center bg-slate-100"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  return <CargoSitePreview site={site} live />;
}
