import { useEffect, useState } from 'react';
import { Building2, Loader2 } from 'lucide-react';
import ErpShop from '../apps/erp-shop';
import { publicApi } from './api';
import PropertyMarketplace from './PropertyMarketplace';
import DealerSite from './DealerSite';

type Resolution =
  | { kind: 'property'; slug: string; id: string; name: string }
  | { kind: 'dealership'; slug: string; id: string; name: string; tier?: string }
  | { kind: 'business'; slug: string; id: string; name: string; tier?: string };

export default function PublicCommerceSlug({ slug, pathname }: { slug: string; pathname: string }) {
  const [result, setResult] = useState<{ slug: string; resolution: Resolution | null; error: string } | null>(null);
  const resolution = result?.slug === slug ? result.resolution : null;
  const error = result?.slug === slug ? result.error : '';

  useEffect(() => {
    let active = true;
    const resolve = async (): Promise<Resolution> => {
      try {
        return await publicApi<Resolution>(`/commerce-public/resolve/${encodeURIComponent(slug)}`);
      } catch (reason) {
        if ((reason as { status?: number } | null)?.status !== 404) throw reason;
        // Store Editor publishes StoreSettings independently of the optional
        // commerce business registry. Its public endpoint enforces publication.
        const store = await publicApi<{ settings: { id: string; domainSlug: string; storeName: string; isPublished: boolean } | null }>(`/store/${encodeURIComponent(slug)}`);
        if (!store.settings?.isPublished) throw new Error('Store not found');
        return { kind: 'business', id: store.settings.id, slug: store.settings.domainSlug, name: store.settings.storeName };
      }
    };
    resolve()
      .then((value) => { if (active) setResult({ slug, resolution: value, error: '' }); })
      .catch((reason) => { if (active) setResult({ slug, resolution: null, error: reason instanceof Error ? reason.message : String(reason) }); });
    return () => { active = false; };
  }, [slug]);

  if (!resolution && !error) return <div className="min-h-screen grid place-items-center bg-slate-950 text-white"><Loader2 className="h-6 w-6 animate-spin text-emerald-400" /></div>;
  if (!resolution) return <div className="min-h-screen grid place-items-center bg-slate-950 px-6 text-center text-white"><div><Building2 className="mx-auto h-10 w-10 text-emerald-400" /><h1 className="mt-4 text-2xl font-black">Site not found</h1><p className="mt-2 max-w-md text-sm text-white/50">{error}</p></div></div>;

  if (resolution.kind === 'property') {
    const shopMatch = pathname.match(/^\/shop\/([A-Za-z0-9-]+)\/?$/);
    return <PropertyMarketplace slug={resolution.slug} shopCode={shopMatch?.[1] ?? ''} />;
  }
  if (resolution.kind === 'dealership') return <DealerSite slug={resolution.slug} />;

  return <ErpShop data={{ slug: resolution.slug }} />;
}
