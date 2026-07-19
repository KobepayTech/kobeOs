import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { QRCodeSVG } from 'qrcode.react';
import { ExternalLink } from 'lucide-react';
import { SiteBuilder, type SiteSection } from '@/components/site-builder/SiteBuilder';
import { HotelSitePreview, type HotelSite } from './HotelSitePreview';

/**
 * Booking Site builder — brands the public /book page. Now built on the shared
 * site-builder framework (same architecture as the ERP store editor and the
 * property site builder), so it has a genuinely-responsive Desktop/Mobile live
 * preview. Persists to the hotel's store_settings (+ siteConfig), which the
 * public booking site (src/public/HotelBooking) reads live.
 */

interface SiteConfig { heroImageUrl?: string; about?: string; amenities?: string[]; phone?: string; whatsapp?: string; address?: string }
interface Settings { storeName?: string; tagline?: string; logoUrl?: string; primaryColor?: string; accentColor?: string; domainSlug?: string; isPublished?: boolean; siteConfig?: SiteConfig }

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
  { title: 'Amenities', fields: [{ key: 'amenities', label: 'Amenities (one per line)', type: 'textarea', placeholder: 'WiFi\nPool\nParking' }] },
  { title: 'Contact', fields: [
    { key: 'phone', label: 'Phone', type: 'text', placeholder: '+255…' },
    { key: 'whatsapp', label: 'WhatsApp', type: 'text', placeholder: '+255…' },
    { key: 'address', label: 'Address', type: 'text', placeholder: 'Street, City' },
  ] },
];

function toBuilder(s: Settings): HotelSite {
  const c = s.siteConfig ?? {};
  return {
    hotelName: s.storeName ?? '', tagline: s.tagline ?? '', logoUrl: s.logoUrl ?? '',
    primaryColor: s.primaryColor ?? '#4f46e5', accentColor: s.accentColor ?? '#8b5cf6',
    heroImageUrl: c.heroImageUrl ?? '', about: c.about ?? '',
    amenities: (c.amenities ?? []).join('\n'),
    phone: c.phone ?? '', whatsapp: c.whatsapp ?? '', address: c.address ?? '',
  };
}
function toSettings(v: HotelSite): Partial<Settings> {
  return {
    storeName: v.hotelName, tagline: v.tagline, logoUrl: v.logoUrl,
    primaryColor: v.primaryColor, accentColor: v.accentColor,
    siteConfig: {
      heroImageUrl: v.heroImageUrl, about: v.about,
      amenities: (v.amenities ?? '').split('\n').map((x) => x.trim()).filter(Boolean),
      phone: v.phone, whatsapp: v.whatsapp, address: v.address,
    },
  };
}

export default function BookingSiteTab({ darkMode }: { darkMode?: boolean } = {}) {
  void darkMode;
  const [value, setValue] = useState<HotelSite>({ primaryColor: '#4f46e5', accentColor: '#8b5cf6' });
  const [meta, setMeta] = useState<{ domainSlug?: string; isPublished?: boolean }>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try { const s = await api<Settings>('/store-settings'); setValue(toBuilder(s)); setMeta({ domainSlug: s.domainSlug, isPublished: s.isPublished }); }
    catch { /* offline */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true); setSaved(false);
    try { await api('/store-settings', { method: 'PUT', body: JSON.stringify(toSettings(value)) }); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    catch { /* ignore */ } finally { setSaving(false); }
  };

  const slug = meta.domainSlug || '';
  const bookUrl = slug ? `https://${slug}.kobeapptz.com/book` : '';

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
          subtitle={slug ? `${slug}.kobeapptz.com/book` : 'Publish your store to get a link'}
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
