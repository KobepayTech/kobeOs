import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { QRCodeSVG } from 'qrcode.react';
import { ExternalLink } from 'lucide-react';
import { SiteBuilder, type SiteSection } from '@/components/site-builder/SiteBuilder';
import { HotelSitePreview, type HotelSite } from './HotelSitePreview';

interface ModuleSiteSettings {
  name?: string;
  tagline?: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  domainSlug?: string | null;
  isPublished?: boolean;
  publishedUrl?: string | null;
  config?: {
    heroImageUrl?: string;
    about?: string;
    amenities?: string[];
    phone?: string;
    whatsapp?: string;
    address?: string;
  };
}

const HOTEL_SECTIONS: SiteSection[] = [
  { title: 'Brand', fields: [
    { key: 'hotelName', label: 'Hotel name', type: 'text', placeholder: 'Serena Hotel' },
    { key: 'tagline', label: 'Tagline', type: 'text', placeholder: 'Luxury by the coast' },
    { key: 'logoUrl', label: 'Logo URL', type: 'text', placeholder: 'https://…' },
    { key: 'primaryColor', label: 'Primary colour', type: 'color' },
    { key: 'accentColor', label: 'Accent colour', type: 'color' },
  ] },
  { title: 'Hero & about', fields: [
    { key: 'heroImageUrl', label: 'Hero image URL', type: 'text', placeholder: 'https://…' },
    { key: 'about', label: 'About the hotel', type: 'textarea', placeholder: 'Describe your hotel…' },
  ] },
  { title: 'Amenities', fields: [
    { key: 'amenities', label: 'Amenities (one per line)', type: 'textarea', placeholder: 'WiFi\nPool\nParking' },
  ] },
  { title: 'Contact', fields: [
    { key: 'phone', label: 'Phone', type: 'text', placeholder: '+255…' },
    { key: 'whatsapp', label: 'WhatsApp', type: 'text', placeholder: '+255…' },
    { key: 'address', label: 'Address', type: 'text', placeholder: 'Street, City' },
  ] },
];

function toBuilder(site: ModuleSiteSettings): HotelSite {
  const config = site.config ?? {};
  return {
    hotelName: site.name ?? '',
    tagline: site.tagline ?? '',
    logoUrl: site.logoUrl ?? '',
    primaryColor: site.primaryColor ?? '#4f46e5',
    accentColor: site.accentColor ?? '#8b5cf6',
    heroImageUrl: config.heroImageUrl ?? '',
    about: config.about ?? '',
    amenities: (config.amenities ?? []).join('\n'),
    phone: config.phone ?? '',
    whatsapp: config.whatsapp ?? '',
    address: config.address ?? '',
  };
}

function toPayload(value: HotelSite) {
  return {
    name: value.hotelName,
    tagline: value.tagline,
    logoUrl: value.logoUrl,
    primaryColor: value.primaryColor,
    accentColor: value.accentColor,
    config: {
      heroImageUrl: value.heroImageUrl,
      about: value.about,
      amenities: (value.amenities ?? '').split('\n').map((x) => x.trim()).filter(Boolean),
      phone: value.phone,
      whatsapp: value.whatsapp,
      address: value.address,
    },
  };
}

export default function BookingSiteTab({ darkMode }: { darkMode?: boolean } = {}) {
  void darkMode;
  const [value, setValue] = useState<HotelSite>({
    primaryColor: '#4f46e5',
    accentColor: '#8b5cf6',
  });
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
      applySite(await api<ModuleSiteSettings>('/module-sites/hotel'));
    } catch {
      // Offline desktop mode keeps the editable defaults.
    }
  }, [applySite]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      let site = await api<ModuleSiteSettings>('/module-sites/hotel', {
        method: 'PUT',
        body: JSON.stringify(toPayload(value)),
      });
      if (site.domainSlug && !site.isPublished) {
        site = await api<ModuleSiteSettings>('/module-sites/hotel/publish', { method: 'POST' });
      }
      applySite(site);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // SiteBuilder keeps the unsaved local edits visible for retry.
    } finally {
      setSaving(false);
    }
  };

  const slug = meta.domainSlug || '';
  const bookUrl = meta.publishedUrl || (slug ? `https://${slug}.kobeapptz.com/book` : '');

  return (
    <div className="flex flex-col h-full">
      {bookUrl && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-[#111118] border-b border-white/10 text-white shrink-0">
          <a href={bookUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-teal-400 font-bold text-xs hover:underline break-all">
            {bookUrl} <ExternalLink className="w-3.5 h-3.5 shrink-0" />
          </a>
          <div className="bg-white rounded p-1 shrink-0"><QRCodeSVG value={bookUrl} size={40} /></div>
        </div>
      )}
      <div className="flex-1 min-h-0">
        <SiteBuilder<HotelSite>
          title="Booking Website"
          subtitle={slug ? `${slug}.kobeapptz.com/book · independent hotel site` : 'Enter a hotel name to publish an independent link'}
          sections={HOTEL_SECTIONS}
          value={value}
          onChange={setValue}
          onSave={save}
          saving={saving}
          saved={saved}
          renderPreview={(v) => <HotelSitePreview site={v} />}
        />
      </div>
    </div>
  );
}
