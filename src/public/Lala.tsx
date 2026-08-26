import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { BedDouble, CalendarDays, Gift, Hotel, Loader2, MapPin, Minus, Plus, Search, ShieldCheck, ShoppingBag, Sparkles, Star, Truck, UserRound, Utensils, X } from 'lucide-react';
import { publicApi, publicAssetUrl } from './api';
import { usePwaManifest } from '@/hooks/usePwaManifest';

interface Room { id: string; roomNumber: string; type: string; rate: number; currency: string; capacity: number; imageUrl: string }
interface HotelResult { hotel: { id: string; slug: string; name: string; location: string; phone: string; currency: string; logoUrl?: string }; profile: { description: string; amenities: string[]; images: string[]; guestRating: number; verifiedReviewCount: number; lastMinuteEnabled: boolean }; availableRooms: Room[]; foodAvailable?: boolean; verifiedAvailabilityAt: string }
interface MenuItem { id: string; name: string; category: string; price: number; currency: string; station: 'kitchen' | 'bar' | 'other'; imageUrl?: string | null }
const fallback = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=85';
const money = (n: number, c = 'TZS') => `${c} ${Number(n).toLocaleString()}`;
const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

export default function Lala() {
  const [search, setSearch] = useState({ destination: '', checkIn: today, checkOut: tomorrow, guests: '1' }); const [rows, setRows] = useState<HotelResult[]>([]);
  const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [selected, setSelected] = useState<{ hotel: HotelResult; room: Room } | null>(null);
  const [guest, setGuest] = useState({ name: '', phone: '', email: '', nationality: '' }); const [passportToken, setPassportToken] = useState(() => localStorage.getItem('lala_passport_token') || '');
  const [booking, setBooking] = useState(''); const [reverseOpen, setReverseOpen] = useState(false); const [budget, setBudget] = useState('');
  const [foodHotel, setFoodHotel] = useState<HotelResult | null>(null);
  usePwaManifest({ name: 'Lala by KobeOS', shortName: 'Lala', startUrl: '/lala', iconBase: '/lala', themeColor: '#28134f', enabled: true });
  const runSearch = async () => { setLoading(true); setError(''); try { setRows(await publicApi(`/lala-public/search?destination=${encodeURIComponent(search.destination)}&checkIn=${search.checkIn}&checkOut=${search.checkOut}&guests=${search.guests}`)); } catch (e) { setError((e as Error).message); } finally { setLoading(false); } };
  useEffect(() => { void runSearch(); }, []);
  const ensurePassport = async () => { if (passportToken) return passportToken; const result = await publicApi<{ passport: { qrToken: string } }>('/lala-public/passports', { method: 'POST', body: JSON.stringify(guest) }); localStorage.setItem('lala_passport_token', result.passport.qrToken); setPassportToken(result.passport.qrToken); return result.passport.qrToken; };
  const book = async () => { if (!selected) return; setLoading(true); setError(''); try { const token = await ensurePassport(); const result = await publicApi<{ booking: { id: string }; hotel: string; room: string; nights: number }>('/lala-public/bookings', { method: 'POST', body: JSON.stringify({ hotelId: selected.hotel.hotel.id, roomId: selected.room.id, passportToken: token, checkIn: search.checkIn, checkOut: search.checkOut, guests: Number(search.guests) }) }); setBooking(`Booking ${result.booking.id.slice(0, 8)} received at ${result.hotel}, room ${result.room}.`); } catch (e) { setError((e as Error).message); } finally { setLoading(false); } };
  const reverse = async () => { setLoading(true); try { const token = await ensurePassport(); const result = await publicApi<{ id: string }>('/lala-public/reverse-requests', { method: 'POST', body: JSON.stringify({ passportToken: token, destination: search.destination, checkIn: search.checkIn, checkOut: search.checkOut, guests: Number(search.guests), budget: Number(budget), currency: 'TZS' }) }); setBooking(`Request ${result.id.slice(0, 8)} sent. Participating hotels can now offer you a room.`); setReverseOpen(false); } catch (e) { setError((e as Error).message); } finally { setLoading(false); } };
  return <div className="min-h-screen bg-[#f8f5ff] text-[#241638]" data-surface="light"><header className="bg-[#24103f] text-white"><div className="max-w-7xl mx-auto h-16 px-4 flex items-center"><div className="h-10 w-10 rounded-2xl bg-[#ffcb69] text-[#24103f] grid place-items-center"><Hotel className="h-5 w-5" /></div><div className="ml-3"><h1 className="font-black text-xl">Lala</h1><p className="text-[10px] tracking-[.25em] text-white/50">LIVE HOTEL NETWORK</p></div><div className="ml-auto inline-flex gap-2"><span className="hidden sm:inline-flex items-center gap-1 text-xs text-white/60"><ShieldCheck className="h-4 w-4" /> Verified availability</span><button onClick={() => setReverseOpen(true)} className="h-9 px-3 rounded-xl bg-white/10 text-xs font-black">Let hotels offer</button></div></div></header>
  <section className="bg-gradient-to-br from-[#321456] via-[#552282] to-[#8a3b82] text-white"><div className="max-w-7xl mx-auto px-4 py-12 sm:py-20"><span className="text-[#ffcb69] text-xs font-black tracking-[.2em] inline-flex items-center gap-2"><Sparkles className="h-4 w-4" /> SLEEP BETTER, REWARDED EVERYWHERE</span><h2 className="mt-4 text-4xl sm:text-6xl font-black tracking-tight max-w-3xl">Real rooms. Live prices.<br />One Lala Passport.</h2><p className="mt-4 max-w-2xl text-white/65">Search live KobeOS hotel inventory, earn each hotel’s loyalty points and separate Lala Rewards, and review only stays you completed.</p><div className="mt-8 rounded-3xl bg-white p-3 grid md:grid-cols-[1.3fr_1fr_1fr_.6fr_auto] gap-2 shadow-2xl"><label className="relative"><MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={search.destination} onChange={(e) => setSearch({ ...search, destination: e.target.value })} placeholder="City or hotel" className="h-11 w-full rounded-xl bg-slate-50 pl-9 pr-3 text-sm" /></label><label className="relative"><CalendarDays className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input type="date" min={today} value={search.checkIn} onChange={(e) => setSearch({ ...search, checkIn: e.target.value, checkOut: e.target.value >= search.checkOut ? '' : search.checkOut })} className="h-11 w-full rounded-xl bg-slate-50 pl-9 pr-2 text-sm" /></label><label className="relative"><CalendarDays className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input type="date" min={search.checkIn || today} value={search.checkOut} onChange={(e) => setSearch({ ...search, checkOut: e.target.value })} className="h-11 w-full rounded-xl bg-slate-50 pl-9 pr-2 text-sm" /></label><label className="relative"><UserRound className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input type="number" min="1" value={search.guests} onChange={(e) => setSearch({ ...search, guests: e.target.value })} className="h-11 w-full rounded-xl bg-slate-50 pl-9 pr-2 text-sm" /></label><button onClick={() => void runSearch()} className="h-11 px-6 rounded-xl bg-[#24103f] text-white font-black inline-flex items-center justify-center gap-2"><Search className="h-4 w-4" /> Search</button></div></div></section>
  <main className="max-w-7xl mx-auto p-4 sm:p-6">{error && <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 p-3 mb-4 text-sm">{error}</div>}{booking && <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 mb-4 text-sm font-bold">{booking}</div>}{loading && !rows.length ? <div className="h-64 grid place-items-center"><Loader2 className="animate-spin" /></div> : <div className="space-y-6">{rows.map((row) => <article key={row.hotel.id} className="bg-white rounded-[2rem] border overflow-hidden shadow-sm"><div className="grid lg:grid-cols-[.8fr_1.2fr]"><img src={publicAssetUrl(row.profile.images[0]) || publicAssetUrl(row.availableRooms[0]?.imageUrl) || fallback} className="w-full h-64 lg:h-full object-cover" /><div className="p-5 sm:p-7"><div className="flex gap-3"><div className="flex-1"><h3 className="text-2xl font-black">{row.hotel.name}</h3><p className="text-sm text-slate-500 inline-flex items-center gap-1 mt-1"><MapPin className="h-4 w-4" />{row.hotel.location}</p></div><div className="text-right"><b className="inline-flex items-center gap-1 text-amber-600"><Star className="h-4 w-4 fill-current" />{row.profile.guestRating.toFixed(1)}</b><p className="text-[10px] text-slate-400">{row.profile.verifiedReviewCount} verified stays</p></div></div><p className="mt-3 text-sm text-slate-600">{row.profile.description}</p><div className="mt-3 flex flex-wrap gap-2">{row.profile.amenities.map((a) => <span key={a} className="px-2 py-1 rounded-lg bg-violet-50 text-violet-700 text-[11px] font-bold">{a}</span>)}</div><div className="mt-5 grid sm:grid-cols-2 gap-3">{row.availableRooms.slice(0, 6).map((room) => <button key={room.id} onClick={() => setSelected({ hotel: row, room })} className="text-left rounded-2xl border p-3 hover:border-violet-400 hover:bg-violet-50 transition"><div className="flex gap-3"><img src={publicAssetUrl(room.imageUrl) || fallback} className="h-16 w-20 rounded-xl object-cover" /><div><b className="block">{room.type}</b><span className="text-xs text-slate-500">Up to {room.capacity} guests</span><strong className="block text-violet-800 mt-1">{money(room.rate, room.currency)} <small className="font-normal">/ night</small></strong></div></div></button>)}</div>{row.foodAvailable && <button onClick={() => setFoodHotel(row)} className="mt-3 w-full h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black inline-flex items-center justify-center gap-2 text-sm"><Utensils className="h-4 w-4" /> Order food from this hotel</button>}<p className="mt-3 text-[10px] text-emerald-700 font-bold"><ShieldCheck className="inline h-3 w-3 mr-1" />Availability verified {new Date(row.verifiedAvailabilityAt).toLocaleTimeString()}</p></div></div></article>)}{!rows.length && !loading && <div className="py-24 text-center text-slate-400"><BedDouble className="h-12 w-12 mx-auto mb-3" /><b>No available rooms for this search</b></div>}</div>}</main>
  {selected && <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4"><div className="w-full max-w-lg max-h-[95vh] overflow-y-auto bg-white rounded-[2rem] p-5"><button onClick={() => setSelected(null)} className="float-right h-9 w-9 rounded-xl bg-slate-100 grid place-items-center"><X className="h-4 w-4" /></button><p className="text-xs font-black text-violet-700">BOOK THIS ROOM</p><h3 className="text-2xl font-black mt-1">{selected.room.type} · {selected.hotel.hotel.name}</h3><img src={publicAssetUrl(selected.room.imageUrl) || fallback} className="mt-4 w-full h-48 rounded-2xl object-cover" /><div className="mt-4 rounded-2xl bg-violet-50 p-4 flex justify-between"><span>{search.checkIn} → {search.checkOut}</span><b>{money(selected.room.rate, selected.room.currency)} / night</b></div>{!passportToken && <div className="mt-5"><div className="flex items-center gap-2"><Gift className="h-5 w-5 text-violet-700" /><div><b>Get your free Lala Passport</b><p className="text-xs text-slate-500">Your contact details are requested only now, at the end.</p></div></div><div className="grid sm:grid-cols-2 gap-2 mt-3"><input placeholder="Full name" value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} className="h-11 rounded-xl border px-3" /><input placeholder="Phone number" value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} className="h-11 rounded-xl border px-3" /><input placeholder="Email (optional)" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} className="h-11 rounded-xl border px-3" /><input placeholder="Nationality (optional)" value={guest.nationality} onChange={(e) => setGuest({ ...guest, nationality: e.target.value })} className="h-11 rounded-xl border px-3" /></div></div>}{passportToken && <a href={`/lala/passport/${passportToken}`} className="mt-4 rounded-xl bg-emerald-50 text-emerald-700 p-3 text-sm font-bold flex items-center gap-3"><span className="bg-white p-1 rounded-lg"><QRCodeSVG value={`${location.origin}/lala/passport/${passportToken}`} size={48} /></span><span><ShieldCheck className="inline h-4 w-4 mr-1" />Lala Passport ready<small className="block font-normal">Open QR and separate reward balances</small></span></a>}<button disabled={loading || (!passportToken && (!guest.name || !guest.phone))} onClick={() => void book()} className="mt-5 w-full h-12 rounded-xl bg-[#24103f] text-white font-black disabled:opacity-40">{loading ? 'Booking…' : 'Book now'}</button></div></div>}
  {reverseOpen && <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4"><div className="w-full max-w-md bg-white rounded-3xl p-5"><button onClick={() => setReverseOpen(false)} className="float-right"><X /></button><h3 className="text-xl font-black">Let hotels compete for you</h3><p className="text-sm text-slate-500 mt-1">Share destination, dates and budget. Hotels with verified rooms can send an offer.</p><input value={budget} onChange={(e) => setBudget(e.target.value)} type="number" placeholder="Total budget TZS" className="mt-4 w-full h-11 rounded-xl border px-3" />{!passportToken && <><input value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} placeholder="Name" className="mt-2 w-full h-11 rounded-xl border px-3" /><input value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} placeholder="Phone" className="mt-2 w-full h-11 rounded-xl border px-3" /></>}<button onClick={() => void reverse()} disabled={!search.destination || !budget || (!passportToken && (!guest.name || !guest.phone))} className="mt-4 w-full h-11 rounded-xl bg-violet-800 text-white font-black disabled:opacity-40">Send request</button></div></div>}
  {foodHotel && <FoodOrderModal hotel={foodHotel} onClose={() => setFoodHotel(null)} />}
  </div>;
}

/**
 * Standalone food ordering for a Lala-listed hotel — no room booking needed.
 * Pulls the hotel's public menu and places a pickup/delivery order straight
 * onto the hotel's kitchen board via the unauthenticated /public/hotel API.
 */
function FoodOrderModal({ hotel, onClose }: { hotel: HotelResult; onClose: () => void }) {
  const slug = hotel.hotel.slug;
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [mode, setMode] = useState<'pickup' | 'delivery'>('pickup');
  const [contact, setContact] = useState({ name: '', phone: '' });
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [placed, setPlaced] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try { const rows = await publicApi<MenuItem[]>(`/public/hotel/${slug}/menu-items`); if (alive) setMenu(rows.filter((m) => (m as MenuItem & { available?: boolean }).available !== false)); }
      catch (e) { if (alive) setError((e as Error).message); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [slug]);

  const setQty = (id: string, delta: number) => setCart((c) => { const q = Math.max(0, (c[id] || 0) + delta); const next = { ...c }; if (q) next[id] = q; else delete next[id]; return next; });
  const lines = menu.filter((m) => cart[m.id]);
  const currency = menu[0]?.currency || hotel.hotel.currency || 'TZS';
  const total = lines.reduce((sum, m) => sum + Number(m.price) * cart[m.id], 0);
  const categories = Array.from(new Set(menu.map((m) => m.category || 'Menu')));

  const submit = async () => {
    if (!lines.length) { setError('Add at least one item to your order.'); return; }
    if (!contact.name.trim() || !contact.phone.trim()) { setError('Enter your name and phone number.'); return; }
    if (mode === 'delivery' && !address.trim()) { setError('Enter a delivery address.'); return; }
    setBusy(true); setError('');
    try {
      const res = await publicApi<{ id: string }>(`/public/hotel/${slug}/orders`, {
        method: 'POST',
        body: JSON.stringify({
          roomNumber: mode === 'delivery' ? 'Delivery' : 'Pickup',
          locationType: mode,
          guestName: contact.name.trim(),
          guestPhone: contact.phone.trim(),
          items: lines.map((m) => ({ menuItemId: m.id, name: m.name, qty: cart[m.id], price: Number(m.price), station: m.station })),
          currency,
          note: mode === 'delivery' ? `Deliver to: ${address.trim()}` : 'Pickup order via Lala',
        }),
      });
      setPlaced(`Order ${res.id.slice(0, 8)} sent to ${hotel.hotel.name}. They'll call ${contact.phone.trim()} to confirm.`);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4">
      <div className="w-full max-w-lg max-h-[95vh] overflow-y-auto bg-white rounded-[2rem] p-5">
        <button onClick={onClose} className="float-right h-9 w-9 rounded-xl bg-slate-100 grid place-items-center"><X className="h-4 w-4" /></button>
        <p className="text-xs font-black text-amber-600 inline-flex items-center gap-1"><Utensils className="h-3.5 w-3.5" /> ORDER FOOD</p>
        <h3 className="text-2xl font-black mt-1">{hotel.hotel.name}</h3>
        <p className="text-sm text-slate-500">{hotel.hotel.location}</p>

        {placed ? (
          <div className="mt-5 rounded-2xl border border-emerald-500/40 bg-emerald-50 p-5 text-center">
            <div className="text-2xl">✅</div>
            <p className="mt-1 text-sm font-black text-emerald-700">{placed}</p>
            <button onClick={onClose} className="mt-4 h-11 px-6 rounded-xl bg-[#24103f] text-white font-black">Done</button>
          </div>
        ) : loading ? (
          <div className="h-40 grid place-items-center"><Loader2 className="animate-spin text-slate-400" /></div>
        ) : !menu.length ? (
          <div className="py-16 text-center text-slate-400"><Utensils className="h-10 w-10 mx-auto mb-2" /><b>No menu items available right now</b></div>
        ) : (
          <>
            <div className="mt-4 space-y-4">
              {categories.map((cat) => (
                <div key={cat}>
                  <p className="text-[11px] font-black uppercase tracking-wide text-slate-400 mb-2">{cat}</p>
                  <div className="space-y-2">
                    {menu.filter((m) => (m.category || 'Menu') === cat).map((m) => (
                      <div key={m.id} className="flex items-center gap-3 rounded-2xl border p-2.5">
                        <img src={publicAssetUrl(m.imageUrl) || fallback} alt={m.name} className="h-12 w-12 rounded-xl object-cover" />
                        <div className="flex-1 min-w-0"><b className="block truncate">{m.name}</b><span className="text-xs text-violet-800 font-bold">{money(Number(m.price), m.currency)}</span></div>
                        {cart[m.id] ? (
                          <div className="inline-flex items-center gap-2">
                            <button onClick={() => setQty(m.id, -1)} className="h-8 w-8 rounded-lg bg-slate-100 grid place-items-center"><Minus className="h-4 w-4" /></button>
                            <b className="w-5 text-center">{cart[m.id]}</b>
                            <button onClick={() => setQty(m.id, 1)} className="h-8 w-8 rounded-lg bg-amber-500 text-white grid place-items-center"><Plus className="h-4 w-4" /></button>
                          </div>
                        ) : (
                          <button onClick={() => setQty(m.id, 1)} className="h-8 px-3 rounded-lg bg-amber-500 text-white text-xs font-black inline-flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> Add</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button onClick={() => setMode('pickup')} className={`h-11 rounded-xl font-black inline-flex items-center justify-center gap-2 text-sm ${mode === 'pickup' ? 'bg-[#24103f] text-white' : 'bg-slate-100 text-slate-600'}`}><ShoppingBag className="h-4 w-4" /> Pickup</button>
              <button onClick={() => setMode('delivery')} className={`h-11 rounded-xl font-black inline-flex items-center justify-center gap-2 text-sm ${mode === 'delivery' ? 'bg-[#24103f] text-white' : 'bg-slate-100 text-slate-600'}`}><Truck className="h-4 w-4" /> Delivery</button>
            </div>

            <div className="mt-3 grid sm:grid-cols-2 gap-2">
              <input placeholder="Your name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} className="h-11 rounded-xl border px-3" />
              <input placeholder="Phone number" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} inputMode="tel" className="h-11 rounded-xl border px-3" />
            </div>
            {mode === 'delivery' && <input placeholder="Delivery address" value={address} onChange={(e) => setAddress(e.target.value)} className="mt-2 w-full h-11 rounded-xl border px-3" />}

            {error && <p className="mt-3 text-xs text-rose-600 font-bold text-center">{error}</p>}

            <button onClick={() => void submit()} disabled={busy || !lines.length} className="mt-4 w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black disabled:opacity-40 inline-flex items-center justify-center gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Place order · {money(total, currency)}</>}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
