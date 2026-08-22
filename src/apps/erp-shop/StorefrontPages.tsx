import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Heart, PackageSearch, CreditCard, Star, Award } from 'lucide-react';
import { API_BASE } from '@/lib/api';
import { QRCodeSVG } from 'qrcode.react';

// Use the SAME base as the rest of the app (VITE_API_BASE → '/api' in prod).
// Previously this read a different var (VITE_API_URL) and defaulted to
// localhost:3000, so collections/brands/track pages called localhost in
// production while everything else used VITE_API_BASE.
const API = API_BASE;

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  category: string;
  imageUrl?: string | null;
  currency: string;
  brand?: string | null;
  compareAtPrice?: number | null;
}

function fmt(n: number, currency = 'TZS') {
  return `${currency} ${Number(n).toLocaleString('en-US')}`;
}

/**
 * Generic collection-driven page — drives New Arrivals, Best Sellers, Offers.
 * Hits /api/store/:slug/collections/:collectionSlug which the backend
 * resolves either from manual product ids or from the collection's rule.
 */
export function CollectionPage({
  slug,
  collectionSlug,
  title,
  empty,
  onAddToCart,
  onAddToWishlist,
  wishlist,
}: {
  slug: string;
  collectionSlug: string;
  title: string;
  empty: string;
  onAddToCart: (p: Product) => void;
  onAddToWishlist: (p: Product) => void;
  wishlist: string[];
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/store/${encodeURIComponent(slug)}/collections/${encodeURIComponent(collectionSlug)}?limit=48`);
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const body = (await res.json()) as { products: Product[] };
      setProducts(body.products ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [slug, collectionSlug]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-4 space-y-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      )}
      {error && <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded p-2">{error}</div>}
      {!loading && !error && !products.length && <div className="text-sm text-slate-400">{empty}</div>}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {products.map((p) => {
          const isWish = wishlist.includes(p.id);
          return (
            <Card key={p.id} className="bg-white/[0.04] border-white/10">
              <CardContent className="p-3 space-y-2">
                <div className="aspect-square bg-slate-800/60 rounded overflow-hidden flex items-center justify-center">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-xs text-slate-500">No image</div>
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium text-white/90 line-clamp-2">{p.name}</div>
                  {p.brand && <div className="text-[10px] text-slate-400">{p.brand}</div>}
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-sm font-bold text-white">{fmt(p.price, p.currency)}</div>
                    {p.compareAtPrice && p.compareAtPrice > p.price && (
                      <div className="text-[10px] text-slate-500 line-through">{fmt(p.compareAtPrice, p.currency)}</div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => onAddToWishlist(p)}
                      className={`p-1.5 rounded-md border ${
                        isWish ? 'bg-rose-500/15 border-rose-500/40 text-rose-300' : 'border-white/10 text-slate-400 hover:bg-white/5'
                      }`}
                      title={isWish ? 'In wishlist' : 'Add to wishlist'}
                    >
                      <Heart className={`w-3.5 h-3.5 ${isWish ? 'fill-current' : ''}`} />
                    </button>
                    <Button size="sm" onClick={() => onAddToCart(p)} disabled={p.stock <= 0} className="h-7 text-[11px] bg-blue-600 hover:bg-blue-500">
                      Add
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function BrandsPage({ slug, onPickBrand }: { slug: string; onPickBrand: (brand: string) => void }) {
  const [brands, setBrands] = useState<Array<{ brand: string; productCount: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/store/${encodeURIComponent(slug)}/brands`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed (${r.status})`);
        return r.json();
      })
      .then((rows: Array<{ brand: string; productCount: number }>) => setBrands(rows ?? []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Award className="w-4 h-4 text-blue-400" />
        <h2 className="text-base font-semibold">Shop by Brand</h2>
      </div>
      {loading && <div className="text-sm text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>}
      {error && <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded p-2">{error}</div>}
      {!loading && !error && !brands.length && <div className="text-sm text-slate-400">No brand information yet.</div>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {brands.map((b) => (
          <button
            key={b.brand}
            onClick={() => onPickBrand(b.brand)}
            className="aspect-square bg-white/[0.04] border border-white/10 rounded hover:bg-white/[0.08] hover:border-blue-500/40 transition-all flex flex-col items-center justify-center text-center p-3"
          >
            <div className="text-sm font-semibold text-white">{b.brand}</div>
            <div className="text-[10px] text-slate-400 mt-1">{b.productCount} products</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function WishlistPage({
  products,
  onAddToCart,
  onRemove,
}: {
  products: Product[];
  onAddToCart: (p: Product) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Heart className="w-4 h-4 text-rose-400" />
        <h2 className="text-base font-semibold">My Wishlist</h2>
      </div>
      {!products.length && (
        <div className="text-sm text-slate-400 py-8 text-center">
          Your wishlist is empty. Tap the heart on any product to save it here.
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {products.map((p) => (
          <Card key={p.id} className="bg-white/[0.04] border-white/10">
            <CardContent className="p-3 space-y-2">
              <div className="text-sm font-medium text-white/90 line-clamp-2">{p.name}</div>
              <div className="text-sm font-bold text-white">{fmt(p.price, p.currency)}</div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => onAddToCart(p)} className="h-7 text-[11px] bg-blue-600 hover:bg-blue-500 flex-1">
                  Add to cart
                </Button>
                <Button size="sm" variant="outline" onClick={() => onRemove(p.id)} className="h-7 text-[11px]">
                  Remove
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function TrackOrderPage({ slug }: { slug: string }) {
  const [orderNumber, setOrderNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState<unknown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const lookup = async () => {
    if (!orderNumber.trim() || !phone.trim()) {
      setError('Order number and phone are both required');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(
        `${API}/store/${encodeURIComponent(slug)}/orders/${encodeURIComponent(orderNumber.trim())}?phone=${encodeURIComponent(phone.trim())}`,
      );
      if (!res.ok) throw new Error(res.status === 404 ? 'Order not found' : `Failed (${res.status})`);
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to look up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-3 max-w-md">
      <div className="flex items-center gap-2">
        <PackageSearch className="w-4 h-4 text-blue-400" />
        <h2 className="text-base font-semibold">Track Your Order</h2>
      </div>
      <p className="text-xs text-slate-400">Enter the order number from your receipt and the phone you checked out with.</p>
      <Input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="Order number (e.g. KOBE-AB12CD)" className="bg-white/5 border-white/10 text-sm" />
      <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="bg-white/5 border-white/10 text-sm" />
      <Button onClick={lookup} disabled={loading} className="bg-blue-600 hover:bg-blue-500 text-sm">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Look up'}
      </Button>
      {error && <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded p-2">{error}</div>}
      {!!result && (
        <pre className="text-[11px] bg-slate-800/60 border border-white/10 rounded p-3 whitespace-pre-wrap text-slate-200">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}

export interface LoyaltyProfile {
  id: string;
  name: string;
  phone: string;
  address?: string;
  loyaltyCode: string;
  points: number;
  visits: number;
  purchaseCount: number;
  freeJerseyCredits: number;
  couponCode?: string | null;
  joinedAt?: string;
}

export function LoyaltyPage({
  slug,
  phone,
  setPhone,
  profile,
  onProfile,
  onSignup,
}: {
  slug: string;
  phone: string;
  setPhone: (s: string) => void;
  profile: LoyaltyProfile | null;
  onProfile: (profile: LoyaltyProfile) => void;
  onSignup: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = async () => {
    if (phone.replace(/\D/g, '').length < 9) {
      setError('Enter the phone number used for signup.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/store/${encodeURIComponent(slug)}/customers/profile?phone=${encodeURIComponent(phone.trim())}`);
      if (!res.ok) throw new Error(res.status === 404 ? 'No membership found for this phone.' : `Lookup failed (${res.status})`);
      onProfile(await res.json() as LoyaltyProfile);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load membership.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-2xl mx-auto text-[#1a1a1a]">
      <div className="flex items-center gap-2">
        <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
        <h2 className="text-xl font-bold">Loyalty Program</h2>
      </div>
      <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
        <CardContent className="p-5 space-y-2">
          <div className="text-xs text-amber-700 font-semibold uppercase tracking-wide">Kobe loyalty</div>
          <div className="text-2xl font-black">Your first purchase unlocks a free jersey</div>
          <p className="text-sm text-slate-600">
            Signup earns 100 points and a single-use 15% coupon. Every TZS 1,000 spent earns one more point.
          </p>
        </CardContent>
      </Card>

      <Card className="bg-white border-slate-200">
        <CardContent className="p-5 space-y-3">
          <label className="text-xs font-semibold text-slate-600">Find your membership by phone</label>
          <div className="flex gap-2">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="border-slate-300 text-sm" />
            <Button onClick={lookup} disabled={loading} className="bg-[#c8102e] hover:bg-[#a00d24] text-white">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Lookup'}
            </Button>
          </div>
          {error && <p className="text-xs text-rose-600">{error}</p>}
          {!profile && <button onClick={onSignup} className="text-xs font-semibold text-[#c8102e] underline underline-offset-2">Not registered? Sign up with name and phone.</button>}
        </CardContent>
      </Card>

      {profile && (
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <div className="bg-[#151515] text-white p-5 flex flex-col sm:flex-row gap-5 items-center">
              <div className="bg-white p-3 rounded-xl shrink-0">
                <QRCodeSVG value={`KOBE-LOYALTY:${slug}:${profile.loyaltyCode}`} size={132} />
              </div>
              <div className="text-center sm:text-left min-w-0">
                <div className="text-xs text-amber-300 uppercase tracking-[0.16em]">Member</div>
                <h3 className="text-2xl font-black mt-1">{profile.name}</h3>
                <p className="font-mono text-lg text-white/90 mt-1 break-all">{profile.loyaltyCode}</p>
                <p className="text-xs text-white/60 mt-1">Show this QR or code at checkout.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-200 bg-white">
              {[
                ['Points', profile.points.toLocaleString()],
                ['Purchases', profile.purchaseCount.toLocaleString()],
                ['Visits', profile.visits.toLocaleString()],
                ['Free jerseys', profile.freeJerseyCredits.toLocaleString()],
              ].map(([label, value]) => (
                <div key={label} className="p-4 text-center">
                  <div className="text-xl font-black">{value}</div>
                  <div className="text-[11px] text-slate-500 uppercase">{label}</div>
                </div>
              ))}
            </div>
            {profile.couponCode && (
              <div className="m-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                Available 15% coupon: <span className="font-mono font-bold">{profile.couponCode}</span>. It will be entered automatically at checkout.
              </div>
            )}
          </CardContent>
        </Card>
      )}
      </div>
  );
}

export function BnplPage({ slug }: { slug: string }) {
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState<number>(100000);
  const [months, setMonths] = useState<3 | 6 | 12>(3);
  const [result, setResult] = useState<{ eligible: boolean; availableCredit?: number; creditLimit?: number; currency?: string; reason?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    if (!phone.trim()) {
      setError('Phone is required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/store/${encodeURIComponent(slug)}/credit/eligibility?phone=${encodeURIComponent(phone.trim())}`);
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to check');
    } finally {
      setLoading(false);
    }
  };

  // Build the per-row preview so the buyer sees exactly when each
  // instalment falls due. Last row absorbs rounding residue so the
  // sum equals `amount` precisely.
  const schedule = useMemo(() => {
    if (!amount || amount <= 0 || months <= 0) return [];
    const per = Math.round((amount / months) * 100) / 100;
    const out: Array<{ due: Date; amount: number }> = [];
    let sumSoFar = 0;
    for (let i = 1; i <= months; i++) {
      const due = new Date();
      due.setMonth(due.getMonth() + i);
      const isLast = i === months;
      const row = isLast ? Math.round((amount - sumSoFar) * 100) / 100 : per;
      out.push({ due, amount: row });
      sumSoFar = Math.round((sumSoFar + row) * 100) / 100;
    }
    return out;
  }, [amount, months]);

  return (
    <div className="p-4 space-y-3 max-w-md">
      <div className="flex items-center gap-2">
        <CreditCard className="w-4 h-4 text-emerald-300" />
        <h2 className="text-base font-semibold">Buy Now, Pay Later</h2>
      </div>
      <p className="text-xs text-slate-400">
        Split your purchase over instalments. Approval is instant — enter your phone to see your limit.
      </p>
      <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="bg-white/5 border-white/10 text-sm" />
      <Button onClick={check} disabled={loading} className="bg-emerald-600 hover:bg-emerald-500 text-sm">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Check eligibility'}
      </Button>
      {error && <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded p-2">{error}</div>}
      {result && (
        <Card className={result.eligible ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}>
          <CardContent className="p-4 text-sm space-y-1">
            <div className={result.eligible ? 'text-emerald-300 font-semibold' : 'text-amber-200 font-semibold'}>
              {result.eligible ? 'Approved' : 'Not yet eligible'}
            </div>
            {result.eligible ? (
              <div className="text-xs text-white/80">
                Available credit: <strong>{fmt(Number(result.availableCredit ?? 0), result.currency ?? 'TZS')}</strong>
                <br />
                Limit: {fmt(Number(result.creditLimit ?? 0), result.currency ?? 'TZS')}
              </div>
            ) : (
              <div className="text-xs text-white/70">{result.reason ?? 'Try again after your first purchase.'}</div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
        <div>
          <h3 className="text-sm font-medium text-white/85">See your instalment plan</h3>
          <p className="text-[11px] text-white/40">Pick a purchase amount and number of months — we'll show the exact schedule before you commit.</p>
        </div>
        <div>
          <label className="text-[10px] text-white/40 uppercase">Amount</label>
          <Input
            type="number"
            value={amount}
            min={0}
            step="1000"
            onChange={(e) => setAmount(Number(e.target.value))}
            className="bg-white/5 border-white/10 text-sm"
          />
        </div>
        <div>
          <label className="text-[10px] text-white/40 uppercase mb-1 block">Pay in</label>
          <div className="grid grid-cols-3 gap-2">
            {([3, 6, 12] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMonths(m)}
                className={`h-9 rounded-md border text-xs font-medium transition-colors ${
                  months === m
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                    : 'border-white/10 text-white/60 hover:bg-white/[0.04]'
                }`}
              >
                {m} months
              </button>
            ))}
          </div>
        </div>

        {schedule.length > 0 && (
          <Card className="bg-rose-500/[0.06] border-rose-500/20">
            <CardContent className="p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between text-white/80">
                <span className="font-medium">Balance to pay later (red)</span>
                <span className="font-bold text-rose-200">{fmt(amount, result?.currency ?? 'TZS')}</span>
              </div>
              <div className="space-y-1">
                {schedule.map((row, idx) => (
                  <div key={idx} className="flex items-center justify-between text-white/70">
                    <span>
                      Instalment {idx + 1} of {schedule.length} — due{' '}
                      {row.due.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                    </span>
                    <span className="font-mono text-white">{fmt(row.amount, result?.currency ?? 'TZS')}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-white/40 pt-1">
                Schedule shown is exact — last instalment absorbs any rounding so the total matches your purchase amount.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
