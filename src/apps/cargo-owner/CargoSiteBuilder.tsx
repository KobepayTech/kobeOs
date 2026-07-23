import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { QRCodeSVG } from 'qrcode.react';
import { ExternalLink } from 'lucide-react';
import { SiteBuilder, type SiteSection } from '@/components/site-builder/SiteBuilder';
import { CargoSitePreview, type CargoSite } from '@/public/CargoSitePreview';

interface ModuleSiteSettings {
  name?: string;
  tagline?: string;
  logoUrl?: string;
  primaryColor?: string;
  domainSlug?: string | null;
  isPublished?: boolean;
  publishedUrl?: string | null;
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

const CARGO_SECTIONS: SiteSection[] = [
  { title: 'Brand', fields: [
    { key: 'companyName', label: 'Company name', type: 'text', placeholder: 'Kobe Cargo Ltd' },
    { key: 'tagline', label: 'Tagline', type: 'text', placeholder: 'Fast, tracked deliveries' },
    { key: 'logoUrl', label: 'Logo URL', type: 'text', placeholder: 'https://…' },
    { key: 'primaryColor', label: 'Primary colour', type: 'color' },
  ] },
  { title: 'Hero & about', fields: [
    { key: 'heroImageUrl', label: 'Hero image URL', type: 'text', placeholder: 'https://…' },
    { key: 'about', label: 'About us', type: 'textarea', placeholder: 'What your cargo company does…' },
  ] },
  { title: 'Services', fields: [
    { key: 'services', label: 'Services (one per line)', type: 'textarea', placeholder: 'Domestic parcels\nInternational freight\nDoor-to-door' },
  ] },
  { title: 'Contact', fields: [
    { key: 'phone', label: 'Phone', type: 'text', placeholder: '+255…' },
    { key: 'whatsapp', label: 'WhatsApp', type: 'text', placeholder: '+255…' },
    { key: 'address', label: 'Address', type: 'text', placeholder: 'Street, City' },
  ] },
];

function toBuilder(site: ModuleSiteSettings): CargoSite {
  const config = site.config ?? {};
  const services = Array.isArray(config.cargoServices)
    ? config.cargoServices
    : Array.isArray(config.services)
      ? config.services
      : [];
  return {
    companyName: site.name ?? '',
    tagline: site.tagline ?? '',
    logoUrl: site.logoUrl ?? '',
    primaryColor: site.primaryColor ?? '#059669',
    heroImageUrl: config.heroImageUrl ?? '',
    about: config.about ?? '',
    services: services.join('\n'),
    phone: config.phone ?? '',
    whatsapp: config.whatsapp ?? '',
    address: config.address ?? '',
  };
}

function toPayload(value: CargoSite) {
  return {
    name: value.companyName,
    tagline: value.tagline,
    logoUrl: value.logoUrl,
    primaryColor: value.primaryColor,
    config: {
      heroImageUrl: value.heroImageUrl,
      about: value.about,
      cargoServices: (value.services ?? '').split('\n').map((x) => x.trim()).filter(Boolean),
      phone: value.phone,
      whatsapp: value.whatsapp,
      address: value.address,
    },
  };
}

export default function CargoSiteBuilder() {
  const [value, setValue] = useState<CargoSite>({ primaryColor: '#059669' });
  const [meta, setMeta] = useState<{
    domainSlug?: string | null;
    isPublished?: boolean;
    publishedUrl?: string | null;
  }>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const applySite = useCallback((site: ModuleSiteSettings) => {
    setValue(toBuilder(site));
    setMeta({
      domainSlug: site.domainSlug,
      isPublished: site.isPublished,
      publishedUrl: site.publishedUrl,
    });
  }, []);

  const load = useCallback(async () => {
    try {
      applySite(await api<ModuleSiteSettings>('/module-sites/cargo'));
    } catch {
      // Offline desktop mode keeps local defaults editable.
    }
  }, [applySite]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      let site = await api<ModuleSiteSettings>('/module-sites/cargo', {
        method: 'PUT',
        body: JSON.stringify(toPayload(value)),
      });
      if (site.domainSlug && !site.isPublished) {
        site = await api<ModuleSiteSettings>('/module-sites/cargo/publish', { method: 'POST' });
      }
      applySite(site);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Keep edits visible for retry.
    } finally {
      setSaving(false);
    }
  };

  const slug = meta.domainSlug || '';
  const siteUrl = meta.publishedUrl || (slug ? `https://kobeapptz.com/cg/${slug}` : '');

  return (
    <div className="flex flex-col h-full">
      {siteUrl && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-[#111118] border-b border-white/10 text-white shrink-0">
          <a href={siteUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-emerald-400 font-bold text-xs hover:underline break-all">
            {siteUrl} <ExternalLink className="w-3.5 h-3.5 shrink-0" />
          </a>
          <div className="bg-white rounded p-1 shrink-0"><QRCodeSVG value={siteUrl} size={40} /></div>
        </div>
      )}
      <div className="flex-1 min-h-0">
        <SiteBuilder<CargoSite>
          title="Cargo Website"
          subtitle={slug ? `kobeapptz.com/cg/${slug} · independent cargo site` : 'Enter a company name to publish an independent link'}
          sections={CARGO_SECTIONS}
          value={value}
          onChange={setValue}
          onSave={save}
          saving={saving}
          saved={saved}
          renderPreview={(v) => <CargoSitePreview site={v} />}
        />
      </div>
    </div>
  );
}
