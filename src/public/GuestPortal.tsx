import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, Minus, Plus, ShoppingBag, Sparkles, Utensils, Wine, X } from 'lucide-react';
import {
  detectTenantSubdomain, publicApi,
  type PublicMenuItem, type PublicOrder, type PublicTenant,
} from './api';

/**
 * Public, unauthenticated guest page mounted at /p/{slug}/(room|table)/{n}.
 * A phone scans a QR, lands here, browses the menu, places an order and
 * (for rooms) requests housekeeping etc. No login required — the URL slug
 * identifies the hotel; the server enforces tenant scoping.
 */

interface RouteParams {
  slug: string;
  locationType: 'room' | 'table';
  locationNumber: string;
}

function parseLocation(): RouteParams | null {
  const path = window.location.pathname;

  // Path form: /p/{slug}/(room|table)/{n}
  const pathMatch = path.match(/^\/p\/([a-z0-9][a-z0-9-]{0,38}[a-z0-9])\/(room|table)\/([^/]+)$/i);
  if (pathMatch) {
    return {
      slug: pathMatch[1].toLowerCase(),
      locationType: pathMatch[2].toLowerCase() as 'room' | 'table',
      locationNumber: decodeURIComponent(pathMatch[3]),
    };
  }

  // Subdomain form: {slug}.{base}/(room|table)/{n}
  const sub = detectTenantSubdomain();
  if (sub) {
    const subMatch = path.match(/^\/(room|table)\/([^/]+)$/i);
    if (subMatch) {
      return {
        slug: sub,
        locationType: subMatch[1].toLowerCase() as 'room' | 'table',
        locationNumber: decodeURIComponent(subMatch[2]),
      };
    }
  }

  return null;
}

interface CartLine { item: PublicMenuItem; qty: number; }

const SERVICE_KINDS: { kind: string; label: string }[] = [
  { kind: 'HOUSEKEEPING', label: 'Housekeeping' },
  { kind: 'TOWELS', label: 'Extra Towels' },
  { kind: 'WAKE_UP', label: 'Wake-up Call' },
  { kind: 'EXTEND_STAY', label: 'Extend Stay' },
  { kind: 'CHECKOUT', label: 'Request Checkout' },
];

export default function GuestPortal() {
  const route = useMemo(() => parseLocation(), []);

  if (!route) {
    return <BadLink />;
  }

  return <PortalBody route={route} />;
}

function PortalBody({ route }: { route: RouteParams }) {
  const [tenant, setTenant] = useState<PublicTenant | null>(null);
  const [menu, setMenu] = useState<PublicMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<PublicOrder | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [t, m] = await Promise.all([
          publicApi<PublicTenant>(`/public/hotel/${route.slug}`),
          publicApi<PublicMenuItem[]>(`/public/hotel/${route.slug}/menu-items`),
        ]);
        if (cancelled) return;
        setTenant(t);
        setMenu(m);
        if (m.length && !activeCategory) setActiveCategory(m[0].category);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.slug]);

  // Poll the placed order's status until terminal.
  useEffect(() => {
    if (!placedOrder) return;
    const terminal = ['DELIVERED', 'CANCELLED'].includes(placedOrder.status);
    if (terminal) return;
    const t = setInterval(async () => {
      try {
        const fresh = await publicApi<PublicOrder>(
          `/public/hotel/${route.slug}/orders/${placedOrder.id}`,
        );
        setPlacedOrder(fresh);
      } catch { /* ignore */ }
    }, 4000);
    return () => clearInterval(t);
  }, [placedOrder, route.slug]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(curr => (curr === msg ? null : curr)), 3000);
  };

  const categories = useMemo(
    () => Array.from(new Set(menu.map((m) => m.category))),
    [menu],
  );
  const visibleItems = useMemo(
    () => menu.filter((m) => !activeCategory || m.category === activeCategory),
    [menu, activeCategory],
  );
  const cartTotal = useMemo(
    () => cart.reduce((s, l) => s + Number(l.item.price) * l.qty, 0),
    [cart],
  );

  const brand = tenant?.brandColor || '#ec4899';

  const addToCart = (item: PublicMenuItem) => {
    setCart((prev) => {
      const i = prev.findIndex((l) => l.item.id === item.id);
      if (i === -1) return [...prev, { item, qty: 1 }];
      const next = prev.slice();
      next[i] = { ...next[i], qty: next[i].qty + 1 };
      return next;
    });
  };
  const changeQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.item.id === id ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0),
    );
  };

  const placeOrder = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const order = await publicApi<PublicOrder>(`/public/hotel/${route.slug}/orders`, {
        method: 'POST',
        body: JSON.stringify({
          roomNumber: route.locationNumber,
          locationType: route.locationType,
          items: cart.map((l) => ({
            menuItemId: l.item.id,
            name: l.item.name,
            qty: l.qty,
            price: Number(l.item.price),
            station: l.item.station,
          })),
          currency: tenant?.currency ?? 'TZS',
        }),
      });
      setPlacedOrder(order);
      setCart([]);
    } catch (err) {
      flash(`Could not place order: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const requestService = async (kind: string, label: string) => {
    try {
      await publicApi(`/public/hotel/${route.slug}/service-requests`, {
        method: 'POST',
        body: JSON.stringify({ roomNumber: route.locationNumber, kind }),
      });
      flash(`${label} requested for Room ${route.locationNumber}.`);
    } catch (err) {
      flash(`Could not submit request: ${(err as Error).message}`);
    }
  };

  if (loading) return <Splash brand={brand}>Loading…</Splash>;
  if (error) return <Splash brand={brand}>Couldn’t load this page.<br /><span className="text-xs opacity-70 mt-2 block">{error}</span></Splash>;
  if (!tenant) return <BadLink />;

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-32">
      <header className="sticky top-0 z-10 backdrop-blur bg-slate-950/80 border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight" style={{ color: brand }}>{tenant.name}</h1>
            <p className="text-xs text-slate-400">
              {route.locationType === 'room' ? 'Room' : 'Table'} {route.locationNumber}
            </p>
          </div>
          <Sparkles className="w-5 h-5 opacity-50" style={{ color: brand }} />
        </div>
      </header>

      {toast && (
        <div className="max-w-2xl mx-auto px-4 mt-3">
          <div className="rounded-lg border border-white/10 bg-white/5 text-sm px-3 py-2">{toast}</div>
        </div>
      )}

      {route.locationType === 'room' && (
        <section className="max-w-2xl mx-auto px-4 mt-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4" style={{ color: brand }} /> Quick Services
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SERVICE_KINDS.map((s) => (
              <button
                key={s.kind}
                onClick={() => requestService(s.kind, s.label)}
                className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-sm text-left"
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="max-w-2xl mx-auto px-4 mt-6">
        <h2 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
          <Utensils className="w-4 h-4" style={{ color: brand }} /> Menu
        </h2>
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setActiveCategory(c)}
                className={`whitespace-nowrap rounded-full px-3 py-1 text-xs border ${
                  activeCategory === c
                    ? 'bg-white/15 text-white border-white/20'
                    : 'bg-white/[0.03] text-slate-400 border-white/10'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
        {menu.length === 0 ? (
          <p className="text-sm text-slate-500 py-12 text-center">No menu items yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
            {visibleItems.map((m) => (
              <button
                key={m.id}
                onClick={() => addToCart(m)}
                className="text-left rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.name}</p>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1">
                    {m.station === 'bar' ? <Wine className="w-3 h-3" /> : <Utensils className="w-3 h-3" />}
                    {m.category}
                  </p>
                </div>
                <span className="text-sm font-semibold" style={{ color: brand }}>
                  {Number(m.price).toLocaleString()} {m.currency}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {cart.length > 0 && (
        <section className="fixed bottom-0 inset-x-0 z-20 border-t border-white/10 bg-slate-950/90 backdrop-blur">
          <div className="max-w-2xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" style={{ color: brand }} /> Your Order
              </h3>
              <span className="text-sm font-bold" style={{ color: brand }}>
                {cartTotal.toLocaleString()} {tenant.currency}
              </span>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {cart.map((l) => (
                <div key={l.item.id} className="flex items-center justify-between text-xs">
                  <span className="truncate flex-1">{l.item.name}</span>
                  <div className="flex items-center gap-2 ml-2">
                    <button onClick={() => changeQty(l.item.id, -1)} className="w-6 h-6 rounded bg-white/5 border border-white/10 flex items-center justify-center">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-5 text-center">{l.qty}</span>
                    <button onClick={() => changeQty(l.item.id, 1)} className="w-6 h-6 rounded bg-white/5 border border-white/10 flex items-center justify-center">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={placeOrder}
              disabled={submitting}
              className="w-full mt-3 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: brand }}
            >
              {submitting ? 'Placing…' : `Place Order — ${cartTotal.toLocaleString()} ${tenant.currency}`}
            </button>
          </div>
        </section>
      )}

      {placedOrder && <OrderStatusModal order={placedOrder} brand={brand} onClose={() => setPlacedOrder(null)} />}
    </div>
  );
}

function OrderStatusModal({ order, brand, onClose }: { order: PublicOrder; brand: string; onClose: () => void }) {
  const isTerminal = ['DELIVERED', 'CANCELLED'].includes(order.status);
  const statusLabel = order.status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="fixed inset-0 z-30 bg-black/70 backdrop-blur flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-white/10 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Order placed</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex items-center gap-3 mb-3">
          {isTerminal ? (
            <CheckCircle2 className="w-6 h-6" style={{ color: brand }} />
          ) : (
            <Clock className="w-6 h-6 animate-pulse" style={{ color: brand }} />
          )}
          <div>
            <p className="text-sm">Status: <span className="font-semibold">{statusLabel}</span></p>
            <p className="text-[11px] text-slate-500 font-mono">{order.id.slice(0, 8)}</p>
          </div>
        </div>
        <div className="space-y-1 text-xs">
          {order.items.map((it, i) => (
            <div key={i} className="flex justify-between">
              <span>{it.qty}× {it.name}</span>
              <span className="text-slate-400">{(Number(it.price) * it.qty).toLocaleString()} {order.currency}</span>
            </div>
          ))}
          <div className="flex justify-between pt-2 mt-2 border-t border-white/10 text-sm font-semibold">
            <span>Total</span>
            <span style={{ color: brand }}>{Number(order.total).toLocaleString()} {order.currency}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Splash({ brand, children }: { brand: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-2xl flex items-center justify-center" style={{ background: brand }}>
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div className="text-sm text-slate-300">{children}</div>
      </div>
    </div>
  );
}

function BadLink() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-semibold mb-2">Invalid link</h1>
        <p className="text-sm text-slate-400">
          This page expects a URL like <code className="text-pink-400">/p/&lt;hotel&gt;/room/101</code>.
        </p>
      </div>
    </div>
  );
}
