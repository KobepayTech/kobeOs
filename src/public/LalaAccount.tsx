import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, Gift, Loader2, MoonStar, QrCode, RefreshCw, ShieldCheck, Ticket } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { publicApi } from './api';
import { lalaDate, lalaMoney, type LalaPassportData } from './lala-shared';

export default function LalaAccount({ token, view, onConnect }: { token: string; view: 'trips' | 'passport'; onConnect?: () => void }) {
  const [data, setData] = useState<LalaPassportData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const sequence = useRef(0);
  const load = useCallback(async () => {
    if (!token) return;
    const request = ++sequence.current;
    setLoading(true); setError('');
    try { const result = await publicApi<LalaPassportData>('/lala-public/passports/' + encodeURIComponent(token)); if (request === sequence.current) setData(result); }
    catch (reason) { if (request === sequence.current) setError((reason as Error).message); }
    finally { if (request === sequence.current) setLoading(false); }
  }, [token]);
  useEffect(() => { setData(null); void load(); return () => { sequence.current++; }; }, [load]);
  if (!token) return <div className="lala-account-intro"><span className="lala-illustration">{view === 'trips' ? <Ticket /> : <QrCode />}</span><p className="lala-eyebrow">A LITTLE MORE LALA</p><h2>{view === 'trips' ? 'Good stays start here.' : 'One passport. More possibilities.'}</h2><p>Keep your bookings, your check-in QR and your rewards together. Your next stay is only the beginning.</p><button className="lala-primary" onClick={onConnect}>Get your free Passport <ArrowRight size={17} /></button><span className="lala-caption"><ShieldCheck size={14} /> Secure phone verification</span></div>;
  if (loading && !data) return <div className="lala-empty" role="status"><Loader2 className="lala-spin" /> Opening your {view}…</div>;
  if (error) return <div className="lala-empty"><ShieldCheck /><h2>Let’s reconnect.</h2><p role="alert">{error}</p><button className="lala-secondary" onClick={() => void load()}><RefreshCw size={16} /> Try again</button>{onConnect && <button className="lala-text-button" onClick={onConnect}>Verify your phone again</button>}</div>;
  if (!data) return null;
  const active = data.activeBookings || [];
  return <div className="lala-account-content">
    <div className="lala-section-title"><div><p className="lala-eyebrow">{view === 'trips' ? 'YOUR NEXT CHAPTER' : 'ALWAYS WITH YOU'}</p><h1>{view === 'trips' ? 'Your stays.' : 'Your Passport.'}</h1></div><button className="lala-icon-button" aria-label="Refresh passport" onClick={() => void load()}><RefreshCw size={18} className={loading ? 'lala-spin' : ''} /></button></div>
    {view === 'passport' && <><section className="lala-passport-card"><div className="lala-passport-top"><span className="lala-wordmark"><MoonStar size={23} /> lala</span><span>TRAVEL A LITTLE FURTHER</span></div><div className="lala-passport-middle"><div><span className="lala-passport-label">LALA PASSPORT</span><h2>{data.passport.name}</h2><p>{data.passport.passportNumber}</p><span className="lala-membership">{data.rewards?.tier || 'Explorer'}</span></div><div className="lala-qr"><QRCodeSVG value={location.origin + '/lala/passport/' + encodeURIComponent(token)} size={84} /></div></div><div className="lala-passport-bottom"><ShieldCheck size={13} /> Your personal check-in QR · keep it private</div></section>
    <div className="lala-reward-grid"><section><Gift size={20} /><span>Lala Rewards</span><strong>{(data.rewards?.points || 0).toLocaleString()}<small> points</small></strong><p>Across the Lala network</p></section><section><MoonStar size={20} /><span>Verified stays</span><strong>{data.rewards?.verifiedStays || 0}</strong><p>A little more well-travelled</p></section></div>
    <div className="lala-section-title"><h2>Hotel rewards</h2><Gift size={19} /></div><p className="lala-muted">Each hotel’s rewards stay separate from your Lala balance.</p>{data.hotelLoyalty.length ? data.hotelLoyalty.map(account => <article className="lala-loyalty-row" key={account.id}><span className="lala-small-icon"><Gift size={19} /></span><div><h3>{account.hotelName}</h3><p>{account.tier} · {account.stays} stays</p></div><strong>{account.points.toLocaleString()}<small> points</small></strong></article>) : <div className="lala-soft-note">Your hotel balances will appear here when points have been credited.</div>}</>}
    {view === 'trips' && <><p className="lala-muted">The plans you’re looking forward to, all in one place.</p>{active.length ? active.map(booking => <article className="lala-trip-card" key={booking.id}><div className="lala-trip-top"><span className="lala-small-icon"><CalendarDays size={21} /></span><span className="lala-status">{booking.status.replace(/_/g, ' ')}</span></div><h2>{booking.hotelName}</h2><p>{booking.roomType}{booking.roomNumber ? ' · Room ' + booking.roomNumber : ''}</p><div className="lala-trip-dates"><div><span>CHECK-IN</span><b>{lalaDate(booking.checkIn)}</b></div><ArrowRight size={18} /><div><span>CHECK-OUT</span><b>{lalaDate(booking.checkOut)}</b></div></div><div className="lala-trip-footer"><span>Booking {booking.id.slice(0, 8)}</span><strong>{lalaMoney(booking.totalAmount, booking.currency)}</strong></div><p className="lala-caption">Payment status is confirmed by the hotel separately.</p></article>) : <div className="lala-empty"><Ticket /><h2>A stay to look forward to.</h2><p>Your upcoming reservations will appear here once a booking is received.</p><a className="lala-secondary" href="/lala">Explore stays <ArrowRight size={16} /></a></div>}{data.stays.length > 0 && <><h2 className="lala-subtitle">Past adventures</h2>{data.stays.map(stay => <div className="lala-history-row" key={stay.id}><CalendarDays size={18} /><div><b>{lalaDate(stay.checkIn)} — {lalaDate(stay.checkOut)}</b><p>Hotel +{stay.hotelPointsEarned} · Lala +{stay.lalaPointsEarned} points</p></div></div>)}</>}</>}
  </div>;
}
