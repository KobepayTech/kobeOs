import { useEffect, useState } from 'react';
import { publicApi } from './api';
import { BedDouble, CalendarDays, CheckCircle2, Loader2, Users } from 'lucide-react';

/**
 * Public hotel booking site — the room-booking equivalent of the storefront.
 * Served at {slug}.kobeapptz.com/book (and /book/{slug}). Browse rooms, pick
 * dates, book. Booking lands as PENDING for the front desk to confirm.
 */
interface PublicRoom { id: string; roomNumber: string; type: string; rate: number; currency: string; capacity: number; available: boolean }
interface Branding {
  logoUrl: string; tagline: string; primaryColor: string; accentColor: string;
  heroImageUrl: string; about: string; amenities: string[]; phone: string; whatsapp: string; address: string;
}

export default function HotelBooking({ slug }: { slug: string }) {
  const [hotelName, setHotelName] = useState('Hotel');
  const [branding, setBranding] = useState<Branding | null>(null);
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<PublicRoom | null>(null);
  const [form, setForm] = useState({ guestName: '', guestPhone: '', checkIn: '', checkOut: '', guests: 1 });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ room: string; nights: number; totalAmount: number; currency: string; payment?: { initiated: boolean; message: string } } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    (async () => {
      try {
        const r = await publicApi<{ hotelName: string; rooms: PublicRoom[]; branding?: Branding }>(`/hotel/public/${encodeURIComponent(slug)}/rooms`);
        setHotelName(r.hotelName || 'Hotel');
        setBranding(r.branding ?? null);
        setRooms(r.rooms || []);
      } catch { setError('Could not load this hotel.'); }
      finally { setLoading(false); }
    })();
  }, [slug]);

  const book = async () => {
    setError(null);
    if (!form.guestName.trim() || !form.guestPhone.trim() || !form.checkIn || !form.checkOut) { setError('Fill in your name, phone and dates.'); return; }
    setBusy(true);
    try {
      const res = await publicApi<{ ok: boolean; room: string; nights: number; totalAmount: number; currency: string; payment?: { initiated: boolean; message: string } }>(`/hotel/public/${encodeURIComponent(slug)}/book`, {
        method: 'POST',
        body: JSON.stringify({ ...form, roomId: sel?.id, roomType: sel?.type }),
      });
      setDone(res);
    } catch (e) { setError((e as Error).message || 'Booking failed.'); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="min-h-[100dvh] grid place-items-center bg-slate-50"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  if (done) return (
    <div className="min-h-[100dvh] grid place-items-center bg-slate-50 p-6">
      <div className="max-w-sm w-full bg-white rounded-2xl border border-slate-200 p-6 text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
        <h1 className="text-lg font-extrabold text-slate-900">Booking requested!</h1>
        <p className="text-sm text-slate-500 mt-1">Room {done.room} · {done.nights} night(s)</p>
        <p className="text-2xl font-extrabold text-slate-900 mt-2">{done.currency} {done.totalAmount.toLocaleString()}</p>
        {done.payment?.initiated ? (
          <p className="mt-3 text-sm font-semibold text-indigo-600 bg-indigo-50 rounded-lg px-3 py-2">📱 {done.payment.message}</p>
        ) : (
          <p className="text-xs text-slate-400 mt-3">{done.payment?.message ?? 'The front desk will confirm your booking shortly.'}</p>
        )}
      </div>
    </div>
  );

  const primary = branding?.primaryColor || '#4f46e5';
  const accent = branding?.accentColor || '#8b5cf6';

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900">
      <header className="relative overflow-hidden text-white px-5 py-10" style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}>
        {branding?.heroImageUrl && <img src={branding.heroImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />}
        <div className="relative max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            {branding?.logoUrl && <img src={branding.logoUrl} alt={hotelName} className="h-12 w-12 rounded-xl object-cover ring-2 ring-white/40" />}
            <div>
              <h1 className="text-2xl font-extrabold">{hotelName}</h1>
              <p className="text-sm text-white/75">{branding?.tagline || 'Book your stay'}</p>
            </div>
          </div>
          {branding?.amenities && branding.amenities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {branding.amenities.slice(0, 8).map((a, i) => (
                <span key={i} className="text-[11px] font-semibold bg-white/20 rounded-full px-2.5 py-0.5">{a}</span>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {branding?.about && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 text-sm text-slate-600 leading-relaxed whitespace-pre-line">{branding.about}</div>
        )}
        {/* Dates + guests */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-500"><span className="inline-flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Check-in</span>
            <input type="date" min={today} value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} className="h-10 px-2 rounded-lg border border-slate-200 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-500"><span className="inline-flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Check-out</span>
            <input type="date" min={form.checkIn || today} value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} className="h-10 px-2 rounded-lg border border-slate-200 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-500"><span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> Guests</span>
            <input type="number" min={1} value={form.guests} onChange={(e) => setForm({ ...form, guests: Math.max(1, Number(e.target.value)) })} className="h-10 px-2 rounded-lg border border-slate-200 text-sm" />
          </label>
        </div>

        {/* Rooms */}
        <div className="space-y-2">
          <h2 className="text-sm font-extrabold text-slate-700">Rooms</h2>
          {rooms.length === 0 && <p className="text-sm text-slate-400">No rooms listed yet.</p>}
          {rooms.map((r) => (
            <button
              key={r.id}
              disabled={!r.available}
              onClick={() => setSel(r)}
              className={`w-full text-left rounded-2xl border p-4 flex items-center justify-between transition ${sel?.id === r.id ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-200'} ${r.available ? 'bg-white hover:border-indigo-300' : 'bg-slate-50 opacity-60'}`}
            >
              <div className="flex items-center gap-3">
                <BedDouble className="w-5 h-5 text-indigo-500" />
                <div>
                  <div className="font-extrabold text-slate-900">{r.type} · #{r.roomNumber}</div>
                  <div className="text-[11px] text-slate-400">Sleeps {r.capacity}{r.available ? '' : ' · Not available'}</div>
                </div>
              </div>
              <div className="font-extrabold text-slate-900">{r.currency} {r.rate.toLocaleString()}<span className="text-[10px] font-normal text-slate-400">/night</span></div>
            </button>
          ))}
        </div>

        {/* Guest details + book */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
          <input placeholder="Your full name" value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm" />
          <input placeholder="Phone number" value={form.guestPhone} onChange={(e) => setForm({ ...form, guestPhone: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm" />
          {error && <div className="text-xs text-red-600">{error}</div>}
          <button onClick={book} disabled={busy} style={{ background: primary }} className="w-full h-11 rounded-lg text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {sel ? `Book ${sel.type} #${sel.roomNumber}` : 'Book a room'}
          </button>
        </div>
      </div>
    </div>
  );
}
