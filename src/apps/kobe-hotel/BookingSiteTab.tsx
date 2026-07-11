import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { QRCodeSVG } from 'qrcode.react';
import {
  Globe, Loader2, Save, CheckCircle2, Plus, Trash2, ExternalLink, ImageIcon, Palette,
} from 'lucide-react';

/**
 * Booking Site builder — brand the public /book page. Edits the hotel's
 * store_settings (name, logo, colours, hero, about, amenities); the public
 * booking site (src/public/HotelBooking) reads these live. Booking itself
 * already works — this is the design layer.
 */
interface SiteConfig {
  heroImageUrl?: string; about?: string; amenities?: string[];
  phone?: string; whatsapp?: string; address?: string;
}
interface Settings {
  storeName?: string; tagline?: string; logoUrl?: string;
  primaryColor?: string; accentColor?: string; domainSlug?: string;
  isPublished?: boolean; siteConfig?: SiteConfig;
}

export default function BookingSiteTab({ darkMode = true }: { darkMode?: boolean }) {
  const [s, setS] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [amenity, setAmenity] = useState('');

  const card = darkMode ? 'bg-[#12122a] border-white/10' : 'bg-white border-gray-200';
  const input = `w-full h-9 px-3 rounded-lg border text-sm ${darkMode ? 'bg-black/30 border-white/10 text-white' : 'bg-gray-50 border-gray-200'}`;
  const label = darkMode ? 'text-[11px] font-semibold text-white/50 uppercase tracking-wide' : 'text-[11px] font-semibold text-gray-500 uppercase tracking-wide';

  const load = useCallback(async () => {
    setLoading(true);
    try { setS(await api<Settings>('/store-settings')); }
    catch { /* offline */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const site = s.siteConfig ?? {};
  const setSite = (p: Partial<SiteConfig>) => setS((prev) => ({ ...prev, siteConfig: { ...prev.siteConfig, ...p } }));
  const amenities = site.amenities ?? [];

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      const updated = await api<Settings>('/store-settings', {
        method: 'PUT',
        body: JSON.stringify({
          storeName: s.storeName, tagline: s.tagline, logoUrl: s.logoUrl,
          primaryColor: s.primaryColor, accentColor: s.accentColor, siteConfig: s.siteConfig ?? {},
        }),
      });
      setS((prev) => ({ ...prev, ...updated }));
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (e) { setErr((e as Error).message); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="grid place-items-center h-full"><Loader2 className="w-6 h-6 animate-spin text-white/40" /></div>;

  const slug = s.domainSlug || '';
  const bookUrl = slug ? `https://${slug}.kobeapptz.com/book` : '';

  return (
    <div className="p-4 space-y-4 overflow-auto h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Globe className="w-5 h-5 text-teal-400" /><h2 className="text-lg font-bold">Booking Website</h2></div>
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />} {saved ? 'Saved' : 'Save'}
        </button>
      </div>

      {/* Live URL + QR */}
      <div className={`rounded-xl border p-4 ${card} flex items-center justify-between gap-4`}>
        <div className="min-w-0">
          <div className={label}>Public booking site</div>
          {slug ? (
            <a href={bookUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-teal-400 font-bold hover:underline mt-1 break-all">
              {bookUrl} <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </a>
          ) : (
            <p className="text-sm text-amber-400 mt-1">Publish your store once (Store Editor → Publish) to get a public address, then guests can book here.</p>
          )}
          {!s.isPublished && slug && <p className="text-[11px] text-amber-400 mt-1">Not published yet — publish from the Store Editor to make it reachable.</p>}
        </div>
        {bookUrl && <div className="bg-white rounded-lg p-2 shrink-0"><QRCodeSVG value={bookUrl} size={72} /></div>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Branding */}
        <div className={`rounded-xl border p-4 ${card} space-y-3`}>
          <div className="font-bold flex items-center gap-2"><Palette className="w-4 h-4 text-teal-400" /> Branding</div>
          <L label="Hotel name"><input className={input} value={s.storeName ?? ''} onChange={(e) => setS({ ...s, storeName: e.target.value })} placeholder="Serena Hotel" /></L>
          <L label="Tagline"><input className={input} value={s.tagline ?? ''} onChange={(e) => setS({ ...s, tagline: e.target.value })} placeholder="Luxury by the coast" /></L>
          <L label="Logo URL"><input className={input} value={s.logoUrl ?? ''} onChange={(e) => setS({ ...s, logoUrl: e.target.value })} placeholder="https://…" /></L>
          <L label={<span className="inline-flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Hero image URL</span>}>
            <input className={input} value={site.heroImageUrl ?? ''} onChange={(e) => setSite({ heroImageUrl: e.target.value })} placeholder="https://…" />
          </L>
          <div className="grid grid-cols-2 gap-2">
            <L label="Primary colour"><div className="flex gap-1.5"><input type="color" value={s.primaryColor ?? '#4f46e5'} onChange={(e) => setS({ ...s, primaryColor: e.target.value })} className="h-9 w-10 rounded bg-transparent border border-white/10" /><input className={input} value={s.primaryColor ?? ''} onChange={(e) => setS({ ...s, primaryColor: e.target.value })} placeholder="#4f46e5" /></div></L>
            <L label="Accent colour"><div className="flex gap-1.5"><input type="color" value={s.accentColor ?? '#8b5cf6'} onChange={(e) => setS({ ...s, accentColor: e.target.value })} className="h-9 w-10 rounded bg-transparent border border-white/10" /><input className={input} value={s.accentColor ?? ''} onChange={(e) => setS({ ...s, accentColor: e.target.value })} placeholder="#8b5cf6" /></div></L>
          </div>
        </div>

        {/* Content */}
        <div className={`rounded-xl border p-4 ${card} space-y-3`}>
          <div className="font-bold">Content</div>
          <L label="About the hotel"><textarea className={`${input} h-24 py-2 resize-none`} value={site.about ?? ''} onChange={(e) => setSite({ about: e.target.value })} placeholder="Describe your hotel…" /></L>
          <div className="grid grid-cols-2 gap-2">
            <L label="Phone"><input className={input} value={site.phone ?? ''} onChange={(e) => setSite({ phone: e.target.value })} placeholder="+255…" /></L>
            <L label="WhatsApp"><input className={input} value={site.whatsapp ?? ''} onChange={(e) => setSite({ whatsapp: e.target.value })} placeholder="+255…" /></L>
          </div>
          <L label="Address"><input className={input} value={site.address ?? ''} onChange={(e) => setSite({ address: e.target.value })} placeholder="Street, City" /></L>

          <div>
            <div className={label}>Amenities</div>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {amenities.map((a, i) => (
                <span key={i} className="inline-flex items-center gap-1 bg-teal-500/15 text-teal-300 rounded-full px-2.5 py-1 text-xs font-semibold">
                  {a}<button onClick={() => setSite({ amenities: amenities.filter((_, j) => j !== i) })}><Trash2 className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <input className={input} value={amenity} onChange={(e) => setAmenity(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && amenity.trim()) { setSite({ amenities: [...amenities, amenity.trim()] }); setAmenity(''); } }}
                placeholder="WiFi, Pool, Parking…" />
              <button onClick={() => { if (amenity.trim()) { setSite({ amenities: [...amenities, amenity.trim()] }); setAmenity(''); } }} className="h-9 px-3 rounded-lg bg-teal-600 text-white text-sm font-bold inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        </div>
      </div>

      {err && <div className="text-sm text-rose-400">{err}</div>}
    </div>
  );
}

function L({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="text-[11px] font-semibold text-white/50 uppercase tracking-wide">{label}</span>{children}</label>;
}
