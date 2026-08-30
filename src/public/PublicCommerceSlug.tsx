import { useEffect, useState } from 'react';
import { Building2, Loader2, Store } from 'lucide-react';
import ErpShop from '../apps/erp-shop';
import { publicApi } from './api';
import PropertyMarketplace from './PropertyMarketplace';

type Resolution =
  | { kind: 'property'; slug: string; id: string; name: string }
  | { kind: 'business'; slug: string; id: string; name: string; tier?: string };

export default function PublicCommerceSlug({ slug, pathname }: { slug: string; pathname: string }) {
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    publicApi<Resolution>(`/commerce-public/resolve/${encodeURIComponent(slug)}`)
      .then((value) => { if (active) setResolution(value); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : String(reason)); });
    return () => { active = false; };
  }, [slug]);

  if (!resolution && !error) return <div className="min-h-screen grid place-items-center bg-slate-950 text-white"><Loader2 className="h-6 w-6 animate-spin text-emerald-400" /></div>;
  if (!resolution) return <div className="min-h-screen grid place-items-center bg-slate-950 px-6 text-center text-white"><div><Building2 className="mx-auto h-10 w-10 text-emerald-400" /><h1 className="mt-4 text-2xl font-black">Site not found</h1><p className="mt-2 max-w-md text-sm text-white/50">{error}</p></div></div>;

  if (resolution.kind === 'property') {
    const shopMatch = pathname.match(/^\/shop\/([A-Za-z0-9-]+)\/?$/);
    return <PropertyMarketplace slug={resolution.slug} shopCode={shopMatch?.[1] ?? ''} />;
  }

  return <ErpShop data={{ slug: resolution.slug }} />;
}
