import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { QRCodeSVG } from 'qrcode.react';
import { ExternalLink } from 'lucide-react';
import { SiteBuilder, type SiteSection } from '@/components/site-builder/SiteBuilder';
import { CargoSitePreview, type CargoSite } from '@/public/CargoSitePreview';

/**
 * Cargo site builder — brands the public /cg/{slug} landing (company brand,
 * services, tracking box). Built on the shared site-builder framework (same
 * architecture as the ERP/property/hotel builders) with a responsive live
 * preview. Persists to the owner's store_settings; cargo services live under
 * siteConfig.cargoServices so they never collide with the shop's own fields.
 */

interface Settings {
  storeName?: string; tagline?: string; logoUrl?: string; primaryColor?: string;
  domainSlug?: string; isPublished?: boolean; siteConfig?: Record<string, unknown>;
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
  { title: 'Services', fields: [{ key: 'services', label: 'Services (one per line)', type: 'textarea', placeholder: 'Domestic parcels\nInternational freight\nDoor-to-door' }] },
  { title: 'Contact', fields: [
    { key: 'phone', label: 'Phone', type: 'text', placeholder: '+255…' },
    { key: 'whatsapp', label: 'WhatsApp', type: 'text', placeholder: '+255…' },
    { key: 'address', label: 'Address', type: 'text', placeholder: 'Street, City' },
  ] },
];

export default function CargoSiteBuilder() {
  const [value, setValue] = useState<CargoSite>({ primaryColor: '#059669' });
  const [raw, setRaw] = useState<Record<string, unknown>>({});
  const [meta, setMeta] = useState<{ domainSlug?: string }>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await api<Settings>('/store-settings');
      const c = s.siteConfig ?? {};
      setRaw(c);
      setValue({
        companyName: s.storeName ?? '', tagline: s.tagline ?? '', logoUrl: s.logoUrl ?? '',
        primaryColor: s.primaryColor ?? '#059669',
        heroImageUrl: (c.heroImageUrl as string) ?? '', about: (c.about as string) ?? '',
        services: Array.isArray(c.cargoServices) ? (c.cargoServices as string[]).join('\n') : '',
        phone: (c.phone as string) ?? '', whatsapp: (c.whatsapp as string) ?? '', address: (c.address as string) ?? '',
      });
      setMeta({ domainSlug: s.domainSlug });
    } catch { /* offline */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true); setSaved(false);
    try {
      await api('/store-settings', {
        method: 'PUT',
        body: JSON.stringify({
          storeName: value.companyName, tagline: value.tagline, logoUrl: value.logoUrl,
          primaryColor: value.primaryColor,
          siteConfig: {
            ...raw,
            heroImageUrl: value.heroImageUrl, about: value.about,
            cargoServices: (value.services ?? '').split('\n').map((x) => x.trim()).filter(Boolean),
            phone: value.phone, whatsapp: value.whatsapp, address: value.address,
          },
        }),
      });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  const slug = meta.domainSlug || '';
  const siteUrl = slug ? `https://kobeapptz.com/cg/${slug}` : '';

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
          subtitle={slug ? `kobeapptz.com/cg/${slug}` : 'Publish your store to get a link'}
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
