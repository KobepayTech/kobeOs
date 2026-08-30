import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, Building2, CheckCircle2, ChevronRight, Grid3X3, Layers3,
  MapPin, Minus, PackageOpen, Phone, Plus, Search, ShoppingBag,
  ShoppingCart, Sparkles, Store, X,
} from 'lucide-react';
import { publicApi, publicAssetUrl } from './api';

interface Floor { id: string; name: string; code: string; level: number; shopCount: number }
interface Shop {
  id: string; publicCode: string; unitNumber: string; status: 'AVAILABLE' | 'CLAIMED' | 'INACTIVE'; categoryId: string;
  floor: Floor | null;
  business: null | { id: string; businessId: string; name: string; publicSlug: string; phone: string; tier: string; logoUrl: string; whatsapp: string };
  vacancy: null | { type: string; rentAmount: number; currency: string; sqft: number; status: string };
}
interface Variant { attributes?: Record<string, string> }
interface Product {
  id: string; productId: string; name: string; description: string; category: string; price: number | string; currency: string;
  imageUrl: string; imageUrls?: string[]; stock: number; variants?: Variant[]; requiredOptions?: string[];
  business: null | { id: string; name: string; publicSlug: string; phone: string; tier: string };
  shop: null | { publicCode: string; unitNumber: string; floor: string; floorCode: string };
}
interface MarketplaceData {
  site: { id: string; name: string; slug: string; publicUrl: string; address: string; city: string; imageUrl: string; tagline: string; brandColor: string };
  stats: { totalShops: number; openBusinesses: number; availableSpaces: number; products: number };
  floors: Floor[];
  categories: string[];
  shops: Shop[];
  products: Product[];
}
interface CartLine {
  productId: string; name: string; price: number; currency: string; quantity: number; imageUrl: string;
  businessName: string; shopCode: string; selectedOptions: Record<string, string>;
}

const money = (amount: number | string, currency = 'TZS') =>
  `${currency === 'TZS' ? 'TSh' : currency} ${Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function PropertyMarketplace({ slug, shopCode = '' }: { slug: string; shopCode?: string }) {
  const [data, setData] = useState<MarketplaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [category, setCategory] = useState('');
  const [floor, setFloor] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [choices, setChoices] = useState<Record<string, Record<string, string>>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [checkout, setCheckout] = useState({ name: '', phone: '', fulfillment: 'PICKUP' as 'PICKUP' | 'DELIVERY', address: '' });
  const [submitting, setSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState<{ orders?: Array<{ orderNumber: string }> } | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    const params = new URLSearchParams({ limit: '200' });
    if (appliedSearch) params.set('q', appliedSearch);
    if (category) params.set('category', category);
    if (floor) params.set('floor', floor);
    if (shopCode) params.set('shop', shopCode);
    publicApi<MarketplaceData>(`/commerce-public/marketplaces/${encodeURIComponent(slug)}?${params.toString()}`)
      .then((value) => { if (active) setData(value); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : String(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug, appliedSearch, category, floor, shopCode]);

  const selectedShop = useMemo(() => shopCode ? data?.shops.find((shop) => shop.publicCode.toLowerCase() === shopCode.toLowerCase()) : null, [data, shopCode]);
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const cartTotal = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);

  const optionValues = (product: Product, option: string) =>
    [...new Set((product.variants ?? []).map((variant) => variant.attributes?.[option]).filter((value): value is string => Boolean(value)))];

  const addToCart = (product: Product) => {
    const selected: Record<string, string> = {};
    for (const option of product.requiredOptions ?? []) {
      const values = optionValues(product, option);
      selected[option] = choices[product.productId]?.[option] || values[0] || '';
      if (!selected[option]) return;
    }
    setCart((current) => {
      const existing = current.find((line) => line.productId === product.productId && JSON.stringify(line.selectedOptions) === JSON.stringify(selected));
      if (existing) return current.map((line) => line === existing ? { ...line, quantity: line.quantity + 1 } : line);
      return [...current, {
        productId: product.productId,
        name: product.name,
        price: Number(product.price),
        currency: product.currency || 'TZS',
        quantity: 1,
        imageUrl: publicAssetUrl(product.imageUrl || product.imageUrls?.[0]),
        businessName: product.business?.name || 'Shop',
        shopCode: product.shop?.publicCode || '',
        selectedOptions: selected,
      }];
    });
    setCartOpen(true);
  };

  const changeQty = (index: number, delta: number) => setCart((current) =>
    current.flatMap((line, i) => i !== index ? [line] : line.quantity + delta <= 0 ? [] : [{ ...line, quantity: line.quantity + delta }]));

  const submitOrder = async () => {
    if (!checkout.name.trim() || !checkout.phone.trim() || !cart.length) return;
    if (checkout.fulfillment === 'DELIVERY' && !checkout.address.trim()) return;
    setSubmitting(true); setError('');
    try {
      const result = await publicApi<{ success: boolean; orders: Array<{ orderNumber: string }> }>('/commerce-public/jumla/orders', {
        method: 'POST',
        body: JSON.stringify({
          customer: { name: checkout.name.trim(), phone: checkout.phone.trim() },
          fulfillment: checkout.fulfillment,
          deliveryAddress: checkout.fulfillment === 'DELIVERY' ? checkout.address.trim() : undefined,
          note: `Order from ${data?.site.name || 'property marketplace'}`,
          lines: cart.map((line) => ({ productId: line.productId, quantity: line.quantity, selectedOptions: line.selectedOptions })),
        }),
      });
      setOrderResult(result);
      setCart([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally { setSubmitting(false); }
  };

  if (loading && !data) return <Loading />;
  if (!data) return <div className="min-h-screen grid place-items-center bg-slate-950 text-white p-6"><div className="max-w-md text-center"><Building2 className="h-10 w-10 mx-auto text-emerald-400" /><h1 className="mt-4 text-2xl font-black">Marketplace unavailable</h1><p className="mt-2 text-white/60">{error || 'This property site could not be loaded.'}</p></div></div>;

  const brand = data.site.brandColor || '#0f766e';
  return (
    <div className="min-h-screen bg-[#f6f8f7] text-slate-950" data-surface="light">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <a href="/" className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-white shadow-lg" style={{ background: brand }}><Building2 className="h-5 w-5" /></div>
            <div className="min-w-0"><b className="block truncate text-sm">{data.site.name}</b><span className="block truncate text-[10px] uppercase tracking-[0.18em] text-slate-400">KobeOS Marketplace</span></div>
          </a>
          <nav className="ml-auto hidden items-center gap-1 md:flex">
            <a href="#shops" className="rounded-xl px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">Shops</a>
            <a href="#products" className="rounded-xl px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">Products</a>
            <a href="#spaces" className="rounded-xl px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">Available spaces</a>
          </nav>
          <button onClick={() => setCartOpen(true)} className="relative ml-2 inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-black text-white">
            <ShoppingBag className="h-4 w-4" /> <span className="hidden sm:inline">Cart</span>
            {cartCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-emerald-400 px-1 text-[10px] text-slate-950">{cartCount}</span>}
          </button>
        </div>
      </header>

      {selectedShop ? (
        <ShopHero site={data.site} shop={selectedShop} products={data.products.length} brand={brand} />
      ) : (
        <section className="relative overflow-hidden bg-slate-950 text-white">
          {data.site.imageUrl && <img src={publicAssetUrl(data.site.imageUrl)} className="absolute inset-0 h-full w-full object-cover opacity-25" />}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(16,185,129,.28),transparent_35%),linear-gradient(115deg,rgba(15,23,42,.96),rgba(15,23,42,.72))]" />
          <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold text-emerald-200"><Sparkles className="h-3.5 w-3.5" /> Shop the whole property in one place</div>
              <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-6xl">{data.site.name}</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/65 sm:text-lg">{data.site.tagline}</p>
              <div className="mt-5 flex flex-wrap gap-4 text-xs text-white/55">
                <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{[data.site.address, data.site.city].filter(Boolean).join(', ') || 'Tanzania'}</span>
                <span className="inline-flex items-center gap-1.5"><Store className="h-4 w-4" />{data.stats.openBusinesses} active businesses</span>
              </div>
              <form onSubmit={(event) => { event.preventDefault(); setAppliedSearch(search.trim()); }} className="mt-8 flex max-w-2xl gap-2 rounded-2xl bg-white p-2 shadow-2xl">
                <Search className="ml-2 mt-3 h-5 w-5 shrink-0 text-slate-400" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search phones, clothes, shoes, electronics…" className="h-11 min-w-0 flex-1 bg-transparent px-2 text-sm text-slate-950 outline-none" />
                <button className="h-11 rounded-xl px-5 text-sm font-black text-white" style={{ background: brand }}>Search</button>
              </form>
            </div>
          </div>
        </section>
      )}

      <main className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6">
        {!selectedShop && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon={<Store />} label="Shops & businesses" value={data.stats.openBusinesses} />
          <Stat icon={<ShoppingBag />} label="Products available" value={data.stats.products} />
          <Stat icon={<Layers3 />} label="Floors" value={data.floors.length} />
          <Stat icon={<Building2 />} label="Spaces available" value={data.stats.availableSpaces} />
        </div>}

        {!selectedShop && data.categories.length > 0 && <section>
          <div className="mb-4 flex items-end justify-between"><div><span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">Explore</span><h2 className="mt-1 text-2xl font-black">Shop by category</h2></div>{category && <button onClick={() => setCategory('')} className="text-xs font-bold text-slate-500">Clear filter</button>}</div>
          <div className="flex gap-2 overflow-x-auto pb-2">{data.categories.map((item) => <button key={item} onClick={() => setCategory(item === category ? '' : item)} className={`shrink-0 rounded-2xl border px-4 py-3 text-sm font-black transition ${category === item ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white hover:border-slate-300'}`}><Grid3X3 className="mr-2 inline h-4 w-4" />{item}</button>)}</div>
        </section>}

        {!selectedShop && <section id="shops">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">Directory</span><h2 className="mt-1 text-2xl font-black">Businesses inside {data.site.name}</h2></div>
            <select value={floor} onChange={(event) => setFloor(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold"><option value="">All floors</option>{data.floors.map((item) => <option key={item.id} value={item.code}>{item.name} · {item.shopCount} shops</option>)}</select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.shops.filter((shop) => shop.business && shop.status === 'CLAIMED').slice(0, 18).map((shop) => <a key={shop.id} href={`/shop/${shop.publicCode}`} className="group rounded-3xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg">
            <div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center overflow-hidden rounded-2xl bg-emerald-50 text-emerald-700">{shop.business?.logoUrl ? <img src={publicAssetUrl(shop.business.logoUrl)} className="h-full w-full object-cover" /> : <Store className="h-5 w-5" />}</div><div className="min-w-0 flex-1"><b className="block truncate">{shop.business?.name}</b><span className="text-xs text-slate-500">{shop.floor?.name || 'Ground'} · {shop.publicCode}</span></div><ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-emerald-600" /></div>
            {shop.categoryId && <span className="mt-3 inline-block rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">{shop.categoryId}</span>}
          </a>)}</div>
        </section>}

        <section id="products">
          <div className="mb-4 flex items-end justify-between"><div><span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">{selectedShop ? 'Storefront' : 'Live inventory'}</span><h2 className="mt-1 text-2xl font-black">{selectedShop ? `Products from ${selectedShop.business?.name || selectedShop.publicCode}` : 'Popular products'}</h2></div>{appliedSearch && <button onClick={() => { setAppliedSearch(''); setSearch(''); }} className="text-xs font-bold text-slate-500">Clear search</button>}</div>
          {data.products.length ? <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{data.products.map((product) => <article key={product.productId} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
            <div className="relative aspect-square overflow-hidden bg-slate-100"><img src={publicAssetUrl(product.imageUrl || product.imageUrls?.[0])} className="h-full w-full object-cover transition duration-500 hover:scale-105" /><span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[9px] font-black backdrop-blur">{product.stock} in stock</span></div>
            <div className="p-3"><span className="text-[9px] font-black uppercase tracking-wide text-emerald-700">{product.category}</span><h3 className="mt-1 line-clamp-2 min-h-10 text-sm font-black">{product.name}</h3><p className="mt-1 truncate text-[10px] text-slate-500">{product.business?.name}{product.shop?.publicCode ? ` · ${product.shop.publicCode}` : ''}</p>
              {(product.requiredOptions ?? []).map((option) => { const values = optionValues(product, option); return values.length ? <label key={option} className="mt-2 block text-[9px] font-bold uppercase text-slate-400">{option}<select value={choices[product.productId]?.[option] || values[0]} onChange={(event) => setChoices((current) => ({ ...current, [product.productId]: { ...(current[product.productId] ?? {}), [option]: event.target.value } }))} className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-bold normal-case text-slate-700">{values.map((value) => <option key={value}>{value}</option>)}</select></label> : null; })}
              <div className="mt-3 flex items-center gap-2"><b className="min-w-0 flex-1 text-sm">{money(product.price, product.currency)}</b><button onClick={() => addToCart(product)} className="grid h-9 w-9 place-items-center rounded-xl text-white" style={{ background: brand }} aria-label={`Add ${product.name} to cart`}><Plus className="h-4 w-4" /></button></div>
            </div>
          </article>)}</div> : <div className="rounded-3xl border border-dashed border-slate-300 bg-white py-16 text-center"><PackageOpen className="mx-auto h-9 w-9 text-slate-300" /><b className="mt-3 block">No matching products</b><p className="mt-1 text-sm text-slate-500">Try another search or category.</p></div>}
        </section>

        {!selectedShop && <section id="spaces">
          <div className="mb-4"><span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">Lease</span><h2 className="mt-1 text-2xl font-black">Available shops</h2><p className="mt-1 text-sm text-slate-500">Vacant commercial spaces stay useful online until a tenant claims them.</p></div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{data.shops.filter((shop) => shop.status === 'AVAILABLE').slice(0, 12).map((shop) => <article key={shop.id} className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="flex items-start"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-50 text-amber-700"><Building2 className="h-5 w-5" /></div><span className="ml-auto rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">AVAILABLE</span></div>
            <h3 className="mt-4 text-lg font-black">Shop {shop.publicCode}</h3><p className="mt-1 text-xs text-slate-500">{shop.floor?.name || 'Ground'}{shop.vacancy?.type ? ` · ${shop.vacancy.type}` : ''}{shop.vacancy?.sqft ? ` · ${shop.vacancy.sqft} sqft` : ''}</p>
            <div className="mt-4 flex items-center"><div><span className="text-[9px] uppercase text-slate-400">Rent</span><b className="block text-sm">{shop.vacancy?.rentAmount ? money(shop.vacancy.rentAmount, shop.vacancy.currency) : 'Contact owner'}</b></div><a href={`/claim-shop?shop=${encodeURIComponent(shop.publicCode)}`} className="ml-auto inline-flex h-10 items-center gap-1 rounded-xl bg-slate-950 px-3 text-xs font-black text-white">Claim / Apply <ArrowRight className="h-3.5 w-3.5" /></a></div>
          </article>)}</div>
        </section>}
      </main>

      <footer className="border-t border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-xs text-slate-500 sm:flex-row sm:items-center sm:px-6"><div><b className="text-slate-900">{data.site.name}</b><span className="ml-2">Powered by KobeOS</span></div><span className="sm:ml-auto">{[data.site.address, data.site.city].filter(Boolean).join(', ')}</span></div></footer>

      {cartOpen && <CartDrawer cart={cart} total={cartTotal} checkout={checkout} setCheckout={setCheckout} onQty={changeQty} onClose={() => setCartOpen(false)} submitting={submitting} onSubmit={submitOrder} result={orderResult} error={error} />}
    </div>
  );
}

function ShopHero({ site, shop, products, brand }: { site: MarketplaceData['site']; shop: Shop; products: number; brand: string }) {
  const available = !shop.business && shop.status === 'AVAILABLE';
  return <section className="bg-slate-950 text-white"><div className="mx-auto max-w-7xl px-4 py-10 sm:px-6"><a href="/" className="text-xs font-bold text-white/50">← Back to {site.name}</a><div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center"><div className="grid h-20 w-20 place-items-center overflow-hidden rounded-3xl bg-white/10">{shop.business?.logoUrl ? <img src={publicAssetUrl(shop.business.logoUrl)} className="h-full w-full object-cover" /> : available ? <Building2 className="h-8 w-8" /> : <Store className="h-8 w-8" />}</div><div><div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black"><MapPin className="h-3 w-3" />{shop.floor?.name || 'Ground'} · {shop.publicCode}</div><h1 className="mt-3 text-3xl font-black sm:text-5xl">{shop.business?.name || `Shop ${shop.publicCode}`}</h1><p className="mt-2 text-sm text-white/55">{available ? `${shop.vacancy?.type || 'Commercial space'} available${shop.vacancy?.rentAmount ? ` · ${money(shop.vacancy.rentAmount, shop.vacancy.currency)}` : ''}` : `${products} products available in this shop.`}</p></div><div className="sm:ml-auto flex gap-2">{shop.business?.phone && <a href={`tel:${shop.business.phone}`} className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-xs font-black"><Phone className="h-4 w-4" /> Call</a>}{shop.business ? <a href={`https://${shop.business.publicSlug}.kobeapptz.com`} className="inline-flex h-11 items-center gap-2 rounded-xl px-4 text-xs font-black text-white" style={{ background: brand }}>Full shop <ArrowRight className="h-4 w-4" /></a> : available ? <a href={`/claim-shop?shop=${encodeURIComponent(shop.publicCode)}`} className="inline-flex h-11 items-center gap-2 rounded-xl px-4 text-xs font-black text-white" style={{ background: brand }}>Claim this shop <ArrowRight className="h-4 w-4" /></a> : null}</div></div></div></section>;
}
function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="rounded-3xl border border-slate-200 bg-white p-4"><div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700">{icon}</div><span className="mt-3 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span><b className="mt-1 block text-xl">{value.toLocaleString()}</b></div>;
}

function CartDrawer({ cart, total, checkout, setCheckout, onQty, onClose, submitting, onSubmit, result, error }: {
  cart: CartLine[]; total: number; checkout: { name: string; phone: string; fulfillment: 'PICKUP' | 'DELIVERY'; address: string };
  setCheckout: React.Dispatch<React.SetStateAction<{ name: string; phone: string; fulfillment: 'PICKUP' | 'DELIVERY'; address: string }>>;
  onQty: (index: number, delta: number) => void; onClose: () => void; submitting: boolean; onSubmit: () => void;
  result: { orders?: Array<{ orderNumber: string }> } | null; error: string;
}) {
  return <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm" onMouseDown={onClose}><aside onMouseDown={(event) => event.stopPropagation()} className="ml-auto flex h-full w-full max-w-md flex-col bg-white shadow-2xl"><header className="flex h-16 items-center border-b px-5"><ShoppingCart className="h-5 w-5" /><b className="ml-2">Your cart</b><button onClick={onClose} className="ml-auto grid h-9 w-9 place-items-center rounded-xl hover:bg-slate-100"><X className="h-4 w-4" /></button></header>
    <div className="flex-1 overflow-y-auto p-5">
      {result ? <div className="rounded-3xl bg-emerald-50 p-6 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" /><h3 className="mt-3 text-xl font-black">Order sent</h3><p className="mt-2 text-sm text-slate-600">Each shop received its part of your order.</p><div className="mt-4 space-y-2">{result.orders?.map((order) => <div key={order.orderNumber} className="rounded-xl bg-white p-3 font-mono text-xs font-bold">{order.orderNumber}</div>)}</div></div> : cart.length ? <div className="space-y-3">{cart.map((line, index) => <div key={`${line.productId}-${index}`} className="rounded-2xl border border-slate-200 p-3"><div className="flex gap-3"><img src={line.imageUrl} className="h-16 w-16 rounded-xl bg-slate-100 object-cover" /><div className="min-w-0 flex-1"><b className="line-clamp-2 text-sm">{line.name}</b><span className="mt-1 block text-[10px] text-slate-500">{line.businessName}{line.shopCode ? ` · ${line.shopCode}` : ''}</span><b className="mt-1 block text-xs">{money(line.price, line.currency)}</b></div></div><div className="mt-3 flex items-center"><button onClick={() => onQty(index, -1)} className="grid h-8 w-8 place-items-center rounded-lg border"><Minus className="h-3 w-3" /></button><b className="w-10 text-center text-xs">{line.quantity}</b><button onClick={() => onQty(index, 1)} className="grid h-8 w-8 place-items-center rounded-lg border"><Plus className="h-3 w-3" /></button><b className="ml-auto text-sm">{money(line.price * line.quantity, line.currency)}</b></div></div>)}</div> : <div className="py-24 text-center text-slate-400"><ShoppingBag className="mx-auto h-10 w-10" /><b className="mt-3 block text-slate-700">Your cart is empty</b><p className="mt-1 text-sm">Products from different shops can share one checkout.</p></div>}
    </div>
    {!result && cart.length > 0 && <div className="border-t p-5"><div className="mb-4 flex items-center"><span className="text-sm text-slate-500">Total</span><b className="ml-auto text-xl">{money(total, cart[0]?.currency || 'TZS')}</b></div><div className="grid gap-2"><input value={checkout.name} onChange={(e) => setCheckout((v) => ({ ...v, name: e.target.value }))} placeholder="Your name" className="h-11 rounded-xl border px-3 text-sm" /><input value={checkout.phone} onChange={(e) => setCheckout((v) => ({ ...v, phone: e.target.value }))} placeholder="Phone number" className="h-11 rounded-xl border px-3 text-sm" /><div className="grid grid-cols-2 gap-2"><button onClick={() => setCheckout((v) => ({ ...v, fulfillment: 'PICKUP' }))} className={`h-10 rounded-xl border text-xs font-black ${checkout.fulfillment === 'PICKUP' ? 'border-slate-950 bg-slate-950 text-white' : ''}`}>Pick up</button><button onClick={() => setCheckout((v) => ({ ...v, fulfillment: 'DELIVERY' }))} className={`h-10 rounded-xl border text-xs font-black ${checkout.fulfillment === 'DELIVERY' ? 'border-slate-950 bg-slate-950 text-white' : ''}`}>Delivery</button></div>{checkout.fulfillment === 'DELIVERY' && <input value={checkout.address} onChange={(e) => setCheckout((v) => ({ ...v, address: e.target.value }))} placeholder="Delivery address" className="h-11 rounded-xl border px-3 text-sm" />}{error && <p className="text-xs text-rose-600">{error}</p>}<button onClick={onSubmit} disabled={submitting || !checkout.name.trim() || !checkout.phone.trim() || (checkout.fulfillment === 'DELIVERY' && !checkout.address.trim())} className="h-12 rounded-xl bg-emerald-600 font-black text-white disabled:opacity-40">{submitting ? 'Sending order…' : 'Place order'}</button></div></div>}
  </aside></div>;
}

function Loading() {
  return <div className="min-h-screen bg-[#f6f8f7]"><div className="mx-auto max-w-7xl px-4 py-8 sm:px-6"><div className="h-16 animate-pulse rounded-2xl bg-white" /><div className="mt-5 h-80 animate-pulse rounded-3xl bg-slate-200" /><div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-3xl bg-white" />)}</div></div></div>;
}
