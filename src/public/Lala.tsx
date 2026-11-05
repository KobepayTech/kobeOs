import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ArrowDownUp, ArrowLeft, ArrowRight, BedDouble, CalendarDays, Check, ChevronRight, Compass, Gift, Heart, Loader2, MapPin, Minus, MoonStar, Phone, Plus, QrCode, Search, ShieldCheck, Sparkles, Ticket, Truck, UserRound, Utensils, Waves, X } from 'lucide-react';
import { publicApi, publicAssetUrl } from './api';
import { usePwaManifest } from '@/hooks/usePwaManifest';
import LalaAccount from './LalaAccount';
import { lalaDate, lalaMoney, lalaPhoto, type LalaHotel, type LalaRoom } from './lala-shared';
import './lala.css';

type Tab = 'discover' | 'saved' | 'trips' | 'passport';
type SearchInput = { destination: string; checkIn: string; checkOut: string; guests: string };
interface SavedHotel { id: string; name: string; location: string; image: string }
interface Offer { id: string; totalPrice: number; currency: string; message: string; expiresAt: string; hotel: { name: string; location: string } | null; room: { type: string } | null }
interface MenuItem { id: string; name: string; category: string; price: number; currency: string; station: 'kitchen' | 'bar' | 'other'; imageUrl?: string | null }
const today = new Date().toLocaleDateString('en-CA');
const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
const tomorrow = tomorrowDate.toLocaleDateString('en-CA');
const imageFor = (hotel: LalaHotel) => publicAssetUrl(hotel.profile.images[0]) || publicAssetUrl(hotel.availableRooms[0]?.imageUrl) || lalaPhoto;
const initialTab = (): Tab => ['saved', 'trips', 'passport'].includes(location.hash.slice(1)) ? location.hash.slice(1) as Tab : 'discover';
const readSaved = (): SavedHotel[] => { try { const value = JSON.parse(localStorage.getItem('lala_saved_hotels_v1') || '[]'); return Array.isArray(value) ? value.filter(h => h && typeof h.id === 'string' && typeof h.name === 'string') : []; } catch { return []; } };
function Photo({ src, alt, ...props }: { src?: string; alt: string; className?: string; loading?: 'lazy' | 'eager' }) {
  return <img {...props} src={src || lalaPhoto} alt={alt} onError={event => { if (event.currentTarget.src !== lalaPhoto) event.currentTarget.src = lalaPhoto; }} />;
}
function useDialogFocus(panel: RefObject<HTMLDivElement | null>, onClose: () => void, enabled = true) {
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    if (!enabled) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
      if (event.key === 'Tab') {
        const controls = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]');
        if (!controls?.length) { event.preventDefault(); return; }
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); previous?.focus(); };
  }, [enabled, panel]);
}
function Sheet({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useDialogFocus(panel, onClose);
  return <div className="lala-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}><div className="lala-sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={panel}><div className="lala-sheet-handle" /><div className="lala-sheet-heading"><h2>{title}</h2><button className="lala-icon-button" aria-label="Close" onClick={onClose}><X size={20} /></button></div>{children}</div></div>;
}

export default function Lala() {
  const frame = useRef<HTMLDivElement>(null);
  const results = useRef<HTMLElement>(null);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [search, setSearch] = useState<SearchInput>({ destination: '', checkIn: today, checkOut: tomorrow, guests: '1' });
  const [staySearch, setStaySearch] = useState<SearchInput>(search);
  const [rows, setRows] = useState<LalaHotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saved, setSaved] = useState<SavedHotel[]>(readSaved);
  const [filter, setFilter] = useState('All stays');
  const [hotel, setHotel] = useState<LalaHotel | null>(null);
  const [selected, setSelected] = useState<{ hotel: LalaHotel; room: LalaRoom } | null>(null);
  const [guest, setGuest] = useState({ name: '', phone: '', email: '', nationality: '' });
  const [passportToken, setPassportToken] = useState(() => localStorage.getItem('lala_passport_token_v2') || '');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneToken, setPhoneToken] = useState('');
  const [verificationMessage, setVerificationMessage] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reverseOpen, setReverseOpen] = useState(false);
  const [budget, setBudget] = useState('');
  const [requestId, setRequestId] = useState(() => localStorage.getItem('lala_reverse_request_id') || '');
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [foodHotel, setFoodHotel] = useState<LalaHotel | null>(null);
  const detailPanel = useRef<HTMLDivElement>(null);
  useDialogFocus(detailPanel, () => setHotel(null), !!hotel && !selected && !foodHotel);
  const searchSequence = useRef(0);
  useEffect(() => { const title = document.title; document.title = 'Lala — Hotels, rooms & rewards'; return () => { document.title = title; }; }, []);
  const nights = Math.max(1, Math.round((Date.parse(staySearch.checkOut) - Date.parse(staySearch.checkIn)) / 86400000) || 1);
  usePwaManifest({ name: 'Lala — Hotels, rooms & rewards', shortName: 'Lala', startUrl: location.hostname.startsWith('lala.') ? '/' : '/lala', iconBase: '/lala', themeColor: '#0066f5', backgroundColor: '#f5f7fa' });
  const changeTab = (next: Tab) => { setTab(next); setHotel(null); setError(''); history.replaceState(null, '', (location.hostname.startsWith('lala.') ? '/' : '/lala') + '#' + next); frame.current?.scrollTo?.({ top: 0 }); };
  useEffect(() => { const onHash = () => { setTab(initialTab()); setHotel(null); }; window.addEventListener('hashchange', onHash); return () => window.removeEventListener('hashchange', onHash); }, []);
  const runSearch = async (input = search, scroll = false) => {
    if (!input.checkIn || !input.checkOut || input.checkOut <= input.checkIn || input.checkIn < today) { setError('Choose a check-out date after your check-in date.'); return; }
    const sequence = ++searchSequence.current;
    setLoading(true); setError('');
    try { const data = await publicApi<LalaHotel[]>('/lala-public/search?' + new URLSearchParams(input)); if (sequence === searchSequence.current) { setRows(data); setStaySearch(input); } }
    catch (reason) { if (sequence === searchSequence.current) setError((reason as Error).message); }
    finally { if (sequence === searchSequence.current) { setLoading(false); if (scroll) results.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }); } }
  };
  useEffect(() => { void runSearch(); }, []);
  const toggleSaved = (item: LalaHotel) => {
    const next = saved.some(h => h.id === item.hotel.id) ? saved.filter(h => h.id !== item.hotel.id) : [...saved, { id: item.hotel.id, name: item.hotel.name, location: item.hotel.location, image: imageFor(item) }];
    setSaved(next); localStorage.setItem('lala_saved_hotels_v1', JSON.stringify(next));
  };
  const openSaved = async (item: SavedHotel) => {
    setLoading(true); setError('');
    try {
      const data = await publicApi<LalaHotel[]>('/lala-public/search?' + new URLSearchParams({ ...search, destination: item.name }));
      const current = data.find(h => h.hotel.id === item.id);
      if (current) { setStaySearch(search); setHotel(current); } else setError('This saved hotel has no available rooms for your selected dates. Try different dates in Discover.');
    } catch (reason) { setError((reason as Error).message); } finally { setLoading(false); }
  };
  const verifyPhone = async (send: boolean) => {
    setVerifying(true); setError('');
    try {
      if (send) { await publicApi('/lala-public/phone/request', { method: 'POST', body: JSON.stringify({ phone: guest.phone }) }); setVerificationMessage('Your code is on its way by SMS.'); }
      else { const result = await publicApi<{ phoneToken: string }>('/lala-public/phone/verify', { method: 'POST', body: JSON.stringify({ phone: guest.phone, code: phoneCode }) }); setPhoneToken(result.phoneToken); setVerificationMessage('Phone verified. You’re ready to go.'); }
    } catch (reason) { setError((reason as Error).message); } finally { setVerifying(false); }
  };
  const ensurePassport = async () => {
    if (passportToken) return passportToken;
    if (!phoneToken || !guest.name.trim()) throw new Error('Add your name and verify your phone to continue.');
    const result = await publicApi<{ passport: { qrToken: string } }>('/lala-public/passports', { method: 'POST', body: JSON.stringify({ ...guest, phoneToken }) });
    localStorage.setItem('lala_passport_token_v2', result.passport.qrToken); setPassportToken(result.passport.qrToken); return result.passport.qrToken;
  };
  const book = async () => {
    if (!selected || busy) return; setBusy(true); setError('');
    try {
      const token = await ensurePassport();
      const result = await publicApi<{ booking: { id: string }; hotel: string }>('/lala-public/bookings', { method: 'POST', body: JSON.stringify({ hotelId: selected.hotel.hotel.id, roomId: selected.room.id, passportToken: token, checkIn: staySearch.checkIn, checkOut: staySearch.checkOut, guests: Number(staySearch.guests) }) });
      setNotice('Reservation ' + result.booking.id.slice(0, 8) + ' received by ' + result.hotel + '. Arrange payment with the hotel.'); setSelected(null); changeTab('trips');
    } catch (reason) { setError((reason as Error).message); } finally { setBusy(false); }
  };
  const loadOffers = async (id = requestId, token = passportToken) => {
    if (!id || !token) return; setOffersLoading(true); setError('');
    try { setOffers(await publicApi<Offer[]>('/lala-public/reverse-requests/' + id + '/offers?passportToken=' + encodeURIComponent(token))); }
    catch (reason) { setError((reason as Error).message); } finally { setOffersLoading(false); }
  };
  useEffect(() => { if (requestId && passportToken) void loadOffers(); }, [requestId, passportToken]);
  const sendRequest = async () => {
    if (busy) return; setBusy(true); setError('');
    try {
      const token = await ensurePassport();
      const result = await publicApi<{ id: string }>('/lala-public/reverse-requests', { method: 'POST', body: JSON.stringify({ passportToken: token, ...search, guests: Number(search.guests), budget: Number(budget), currency: 'TZS' }) });
      localStorage.setItem('lala_reverse_request_id', result.id); setRequestId(result.id); setOffers([]); setReverseOpen(false); setNotice('Your request is with the hotels. Check your offers below.'); void loadOffers(result.id, token);
    } catch (reason) { setError((reason as Error).message); } finally { setBusy(false); }
  };
  const acceptOffer = async (offer: Offer) => {
    if (offersLoading) return; setOffersLoading(true); setError('');
    try {
      const result = await publicApi<{ booking: { id: string }; hotel: string }>('/lala-public/reverse-requests/' + requestId + '/offers/' + offer.id + '/accept', { method: 'POST', body: JSON.stringify({ passportToken }) });
      localStorage.removeItem('lala_reverse_request_id'); setRequestId(''); setOffers([]); setNotice('Reservation ' + result.booking.id.slice(0, 8) + ' received by ' + result.hotel + '. Arrange payment with the hotel.'); changeTab('trips');
    } catch (reason) { setError((reason as Error).message); } finally { setOffersLoading(false); }
  };
  const identityFields = <div className="lala-identity">
    <label>Your name<input autoComplete="name" value={guest.name} onChange={e => setGuest({ ...guest, name: e.target.value })} placeholder="Full name" /></label>
    <label>Phone number<div className="lala-phone-line"><input type="tel" autoComplete="tel" value={guest.phone} placeholder="+255 7XX XXX XXX" onChange={e => { setGuest({ ...guest, phone: e.target.value }); setPhoneToken(''); setVerificationMessage(''); }} /><button type="button" className="lala-small-button" disabled={verifying || !guest.phone || !!phoneToken} onClick={() => void verifyPhone(true)}>{phoneToken ? <Check size={16} /> : 'Send code'}</button></div></label>
    {!phoneToken && <label>SMS verification code<div className="lala-phone-line"><input aria-label="SMS code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={phoneCode} onChange={e => setPhoneCode(e.target.value)} placeholder="6-digit code" /><button type="button" className="lala-small-button" disabled={verifying || phoneCode.length !== 6} onClick={() => void verifyPhone(false)}>{verifying ? <Loader2 size={16} className="lala-spin" /> : 'Verify'}</button></div></label>}
    {verificationMessage && <p className="lala-verified" role="status"><ShieldCheck size={14} />{verificationMessage}</p>}
  </div>;
  const visible = filter === 'Under TZS 100k' ? rows.filter(h => h.availableRooms.some(r => r.currency === 'TZS' && r.rate < 100000)) : filter === 'Top rated' ? [...rows].sort((a, b) => b.profile.guestRating - a.profile.guestRating) : rows;
  const formError = error && <div className="lala-alert" role="alert">{error}</div>;
  return <div className="lala-world" data-surface="lala"><div className="lala-frame" ref={frame}>
    <header className="lala-header"><button className="lala-wordmark" aria-label="Lala home" onClick={() => changeTab('discover')}><BedDouble size={25} /> Lala<span>.</span></button><span className="lala-header-note">TZS · EN</span><button className="lala-icon-button lala-avatar" aria-label="Open Passport" onClick={() => changeTab('passport')}><UserRound size={19} /></button></header>
    {!selected && !reverseOpen && !identityOpen && formError}
    {notice && <div className="lala-notice" role="status"><Check size={18} /><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice('')}><X size={16} /></button></div>}
    {tab === 'discover' && <>
      <section className="lala-hero"><Photo src="https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&w=1000&q=85" alt="Turquoise water and a peaceful island escape" loading="eager" /><div className="lala-hero-shade" /><div className="lala-hero-copy"><span className="lala-hero-eyebrow"><span /> HOTELS & STAYS</span><h1>Great stays.<br /><em>Better trips.</em></h1><p>Find your next hotel with Lala.</p></div><span className="lala-hero-stamp"><Waves size={15} /> Explore Tanzania</span></section>
      <form className="lala-search-card" aria-label="Find a stay" onSubmit={e => { e.preventDefault(); void runSearch(search, true); }}>
        <div className="lala-search-tabs"><span><BedDouble size={18} /> Hotels</span><button type="button" onClick={() => { setError(''); setReverseOpen(true); }}><Sparkles size={16} /> Hotel offers <ChevronRight size={14} /></button></div><label className="lala-destination"><MapPin size={20} /><span><small>Destination</small><input aria-label="City or hotel" placeholder="City, area or hotel name" value={search.destination} onChange={e => setSearch({ ...search, destination: e.target.value })} /></span></label>
        <div className="lala-search-dates"><label><span>CHECK-IN</span><input aria-label="Check-in" type="date" min={today} value={search.checkIn} onChange={e => { const checkIn = e.target.value; const next = new Date(checkIn + 'T12:00:00'); next.setDate(next.getDate() + 1); setSearch({ ...search, checkIn, checkOut: checkIn >= search.checkOut ? next.toLocaleDateString('en-CA') : search.checkOut }); }} required /></label><span className="lala-date-divider" /><label><span>CHECK-OUT</span><input aria-label="Check-out" type="date" min={search.checkIn} value={search.checkOut} onChange={e => setSearch({ ...search, checkOut: e.target.value })} required /></label><label className="lala-guests"><span>Guests per room</span><select aria-label="Guests" value={search.guests} onChange={e => setSearch({ ...search, guests: e.target.value })}>{[1, 2, 3, 4, 5, 6, 8, 10].map(n => <option key={n} value={n}>{n} {n === 1 ? 'guest' : 'guests'}</option>)}</select></label></div>
        <button className="lala-primary" type="submit" disabled={loading}>{loading ? <Loader2 size={18} className="lala-spin" /> : <Search size={18} />} Search hotels <ArrowRight size={18} /></button>
      </form>
      <main className="lala-discover"><div className="lala-shortcuts"><button onClick={() => results.current?.scrollIntoView?.({ behavior: 'smooth' })}><span><BedDouble size={24} /></span>Hotels</button><button onClick={() => { setError(''); setReverseOpen(true); }}><span><Sparkles size={24} /></span>Hotel offers</button><button onClick={() => changeTab('saved')}><span><Heart size={24} /></span>Saved hotels</button><button onClick={() => changeTab('passport')}><span><Gift size={24} /></span>Rewards</button></div><button className="lala-member-banner" onClick={() => changeTab('passport')}><span className="lala-member-icon"><Gift size={24} /></span><span><b>Your next stay, more rewarding</b><small>View your Lala Passport and hotel rewards</small></span><ChevronRight size={18} /></button><div className="lala-trust-line"><ShieldCheck size={14} /> {loading ? 'Checking room availability…' : error ? 'Live availability temporarily unavailable' : 'Room availability checked with the hotel'} <span>✦</span></div>
        <section className="lala-destinations"><div className="lala-section-title"><div><p className="lala-eyebrow">EXPLORE TANZANIA</p><h2>Popular destinations</h2></div><Compass size={21} /></div><div className="lala-destination-pills">{['Anywhere', 'Dar es Salaam', 'Zanzibar', 'Arusha'].map(city => <button key={city} className={search.destination === (city === 'Anywhere' ? '' : city) ? 'is-active' : ''} onClick={() => { const next = { ...search, destination: city === 'Anywhere' ? '' : city }; setSearch(next); void runSearch(next, true); }}>{city === 'Anywhere' && <Compass size={14} />}{city}</button>)}</div></section>
        <section ref={results} className="lala-results"><div className="lala-section-title"><div><p className="lala-eyebrow">FIND YOUR NEXT STAY</p><h2>{search.destination ? 'Stays in ' + search.destination : 'Hotels you might like'}</h2></div><span className="lala-result-count">{visible.length}</span></div><div className="lala-filter-bar">{['All stays', 'Under TZS 100k', 'Top rated'].map(value => <button key={value} onClick={() => setFilter(value)} className={filter === value ? 'is-active' : ''}>{value === 'Top rated' && <ArrowDownUp size={13} />}{value}</button>)}</div>
        {loading && <div className="lala-loading" role="status"><Loader2 size={18} className="lala-spin" /> Checking live rooms…</div>}
        {!loading && !visible.length && <div className="lala-empty"><BedDouble /><h3>Find a hotel for your dates</h3><p>{error ? 'We couldn’t load rooms. Please try again.' : 'No rooms match this search. Try another destination, date or filter.'}</p><button className="lala-secondary" onClick={() => { setFilter('All stays'); const next = { ...search, destination: '' }; setSearch(next); void runSearch(next); }}>Show all stays <ArrowRight size={16} /></button></div>}
        {visible.map(item => { const lowest = [...item.availableRooms].sort((a, b) => a.rate - b.rate)[0]; const isSaved = saved.some(h => h.id === item.hotel.id); return <article className="lala-hotel-card" key={item.hotel.id}><div className="lala-hotel-image"><button className="lala-photo-button" aria-label={'View ' + item.hotel.name} onClick={() => setHotel(item)}><Photo src={imageFor(item)} alt={item.hotel.name} loading="lazy" /></button><span className="lala-photo-badge"><ShieldCheck size={12} /> Rooms available</span><button className={'lala-save-button ' + (isSaved ? 'is-saved' : '')} aria-label={(isSaved ? 'Unsave ' : 'Save ') + item.hotel.name} aria-pressed={isSaved} onClick={() => toggleSaved(item)}><Heart size={19} fill={isSaved ? 'currentColor' : 'none'} /></button></div><button className="lala-hotel-info" onClick={() => setHotel(item)}><div className="lala-hotel-title"><h3>{item.hotel.name}</h3>{item.profile.verifiedReviewCount > 0 ? <span><StarIcon />{item.profile.guestRating.toFixed(1)}</span> : <span className="lala-new-stay">New stay</span>}</div><p><MapPin size={13} />{item.hotel.location}</p><div className="lala-hotel-bottom"><span>{lowest && <><b>{lalaMoney(lowest.rate, lowest.currency)}</b><small> / night</small></>}</span><span className="lala-view-stay">Explore stay <ArrowRight size={14} /></span></div></button></article>; })}
        </section>
        <section className="lala-offer-banner"><span className="lala-offer-spark"><Sparkles size={24} /></span><p className="lala-eyebrow">PERSONAL HOTEL OFFERS</p><h2>Set your budget.<br /><em>Let hotels make an offer.</em></h2><p>Tell hotels what you have in mind.<br />Let the right stay come to you.</p><button onClick={() => { setError(''); setReverseOpen(true); }}>Let hotels offer <ArrowRight size={16} /></button><span className="lala-banner-orbit" /></section>
        {requestId && <section className="lala-offers"><div className="lala-section-title"><h2>Your hotel offers</h2><button className="lala-text-button" disabled={offersLoading} onClick={() => void loadOffers()}>{offersLoading ? 'Checking…' : 'Refresh'}</button></div>{!offers.length && <p className="lala-soft-note">Hotels haven’t responded yet. Check back here for offers.</p>}{offers.map(offer => <article className="lala-offer-card" key={offer.id}><span className="lala-eyebrow">AN OFFER FOR YOU</span><h3>{offer.hotel?.name || 'Hotel offer'}</h3><p>{offer.hotel?.location} · {offer.room?.type || 'Room'}</p><strong>{lalaMoney(offer.totalPrice, offer.currency)} <small>total stay</small></strong>{offer.message && <p>{offer.message}</p>}<p className="lala-caption">Expires {new Date(offer.expiresAt).toLocaleString()}</p><button className="lala-primary" disabled={offersLoading || Date.parse(offer.expiresAt) <= Date.now()} onClick={() => void acceptOffer(offer)}>Accept & reserve <ArrowRight size={16} /></button></article>)}</section>}
        <footer className="lala-footer"><MoonStar size={18} /><span>Hotels. Bookings. Rewards. All in Lala.</span><small>Lala · by KobeOS</small></footer>
      </main>
    </>}
    {tab === 'saved' && <main className="lala-account-content"><div className="lala-section-title"><div><p className="lala-eyebrow">YOUR SAVED HOTELS</p><h1>Saved hotels</h1></div><Heart size={23} /></div><p className="lala-muted">Your favorite hotels, ready when you are.</p>{loading && <div className="lala-loading" role="status"><Loader2 size={18} className="lala-spin" /> Checking current availability…</div>}{saved.length ? saved.map(item => <article className="lala-saved-card" key={item.id}><button onClick={() => void openSaved(item)}><Photo src={item.image} alt={item.name} loading="lazy" /><span><h2>{item.name}</h2><p><MapPin size={13} />{item.location}</p><small>Check current rooms <ArrowRight size={13} /></small></span></button><button className="lala-icon-button" aria-label={'Unsave ' + item.name} onClick={() => { const next = saved.filter(h => h.id !== item.id); setSaved(next); localStorage.setItem('lala_saved_hotels_v1', JSON.stringify(next)); }}><Heart size={18} fill="currentColor" /></button></article>) : <div className="lala-empty"><Heart /><h2>Love it? Save it.</h2><p>Tap the heart on a hotel to keep it here for another day.</p><button className="lala-primary" onClick={() => changeTab('discover')}>Find your next stay <ArrowRight size={17} /></button></div>}</main>}
    {(tab === 'trips' || tab === 'passport') && <LalaAccount token={passportToken} view={tab} onConnect={() => { setError(''); setPassportToken(''); localStorage.removeItem('lala_passport_token_v2'); setIdentityOpen(true); }} />}
    <nav className="lala-bottom-nav" aria-label="Lala navigation">{([{ id: 'discover', label: 'Discover', icon: Compass }, { id: 'saved', label: 'Saved', icon: Heart }, { id: 'trips', label: 'Trips', icon: Ticket }, { id: 'passport', label: 'Passport', icon: QrCode }] as const).map(item => <button key={item.id} className={tab === item.id ? 'is-active' : ''} aria-current={tab === item.id ? 'page' : undefined} onClick={() => changeTab(item.id)}><item.icon size={21} strokeWidth={tab === item.id ? 2 : 1.6} /><span>{item.label}</span>{tab === item.id && <i />}</button>)}</nav>
    {hotel && !selected && <div className="lala-detail" ref={detailPanel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={hotel.hotel.name}><div className="lala-detail-image"><Photo src={imageFor(hotel)} alt={hotel.hotel.name} /><button className="lala-detail-back" aria-label="Back to stays" onClick={() => setHotel(null)}><ArrowLeft size={20} /></button><button className="lala-detail-heart" aria-label="Save hotel" aria-pressed={saved.some(h => h.id === hotel.hotel.id)} onClick={() => toggleSaved(hotel)}><Heart size={20} fill={saved.some(h => h.id === hotel.hotel.id) ? 'currentColor' : 'none'} /></button><span className="lala-detail-stamp">HOTEL OVERVIEW</span></div><div className="lala-detail-body"><p className="lala-eyebrow">{hotel.hotel.location}</p><h1>{hotel.hotel.name}</h1><div className="lala-detail-rating">{hotel.profile.verifiedReviewCount > 0 ? <><StarIcon /> {hotel.profile.guestRating.toFixed(1)} <span>· {hotel.profile.verifiedReviewCount} verified reviews</span></> : <><ShieldCheck size={15} /><span>Available for your selected dates</span></>}</div><p className="lala-detail-description">{hotel.profile.description || 'Find your room, settle in and make yourself at home. Contact the hotel for more details about your stay.'}</p><div className="lala-amenities">{hotel.profile.amenities.map(a => <span key={a}><Check size={13} />{a}</span>)}</div><div className="lala-date-summary"><CalendarDays size={18} /><div><b>{lalaDate(staySearch.checkIn)} — {lalaDate(staySearch.checkOut)}</b><span>{nights} {nights === 1 ? 'night' : 'nights'} · {staySearch.guests} {staySearch.guests === '1' ? 'guest' : 'guests'}</span></div><button onClick={() => { setHotel(null); changeTab('discover'); frame.current?.scrollTo?.({ top: 200, behavior: 'smooth' }); }}>Edit</button></div><div className="lala-section-title"><h2>Choose your room</h2><BedDouble size={20} /></div><p className="lala-muted">Available rooms for your selected dates.</p>{hotel.availableRooms.map(room => <article className="lala-room-card" key={room.id}><Photo src={publicAssetUrl(room.imageUrl) || imageFor(hotel)} alt={room.type} /><div><h3>{room.type}</h3><p><UserRound size={13} /> Up to {room.capacity} guests</p><strong>{lalaMoney(room.rate, room.currency)}<small> / night</small></strong><button className="lala-small-button" onClick={() => { setError(''); setSelected({ hotel, room }); }}>Choose room <ArrowRight size={14} /></button></div></article>)}{hotel.foodAvailable && <button className="lala-secondary" onClick={() => setFoodHotel(hotel)}><Utensils size={18} /> Something delicious? View the menu <ChevronRight size={16} /></button>}<div className="lala-hotel-contact">{hotel.hotel.phone && <a className="lala-secondary" href={'tel:' + hotel.hotel.phone}><Phone size={16} /> Call the hotel <ArrowRight size={16} /></a>}</div><p className="lala-caption lala-detail-caption"><ShieldCheck size={14} /> Final availability is checked when you reserve.</p></div></div>}
    {selected && <Sheet title="Review your reservation" onClose={() => !busy && setSelected(null)}><div className="lala-booking-hotel"><Photo src={publicAssetUrl(selected.room.imageUrl) || imageFor(selected.hotel)} alt={selected.room.type} /><div><p className="lala-eyebrow">YOUR STAY</p><h3>{selected.hotel.hotel.name}</h3><span>{selected.room.type} · {staySearch.guests} guest{staySearch.guests === '1' ? '' : 's'}</span></div></div><div className="lala-booking-dates"><CalendarDays size={18} /><b>{lalaDate(staySearch.checkIn)} — {lalaDate(staySearch.checkOut)}</b><span>{nights} night{nights === 1 ? '' : 's'}</span></div><div className="lala-price-lines"><p><span>{lalaMoney(selected.room.rate, selected.room.currency)} × {nights} night{nights === 1 ? '' : 's'}</span><b>{lalaMoney(selected.room.rate * nights, selected.room.currency)}</b></p><p className="lala-total"><span>Room total</span><b>{lalaMoney(selected.room.rate * nights, selected.room.currency)}</b></p></div>{!passportToken ? <><div className="lala-inline-heading"><Gift size={19} /><div><h3>Guest details & Lala Passport</h3><p>Free to join. Yours to keep.</p></div></div>{identityFields}</> : <div className="lala-verified"><ShieldCheck size={17} /> Your Lala Passport is ready.</div>}{formError}<div className="lala-payment-note"><ShieldCheck size={18} /><p><b>Reserve now. Pay the hotel.</b><span>No online payment is collected here. The hotel confirms payment separately.</span></p></div><button className="lala-primary" onClick={() => void book()} disabled={busy || (!passportToken && (!phoneToken || !guest.name.trim()))}>{busy ? <Loader2 className="lala-spin" size={18} /> : 'Request reservation'}<ArrowRight size={17} /></button></Sheet>}
    {reverseOpen && <Sheet title="Request a hotel offer" onClose={() => !busy && setReverseOpen(false)}><p className="lala-muted">Choose your dates and total budget. Hotels can send you a personal room offer.</p><div className="lala-identity"><label>Destination<input placeholder="City or destination" value={search.destination} onChange={e => setSearch({ ...search, destination: e.target.value })} /></label><div className="lala-two-fields"><label>Check-in<input type="date" min={today} value={search.checkIn} onChange={e => setSearch({ ...search, checkIn: e.target.value })} /></label><label>Check-out<input type="date" min={search.checkIn} value={search.checkOut} onChange={e => setSearch({ ...search, checkOut: e.target.value })} /></label></div><label>Total budget · TZS<input type="number" min="1" placeholder="What would you like to spend?" value={budget} onChange={e => setBudget(e.target.value)} /></label></div>{!passportToken && identityFields}{formError}<button className="lala-primary" disabled={busy || !search.destination.trim() || Number(budget) <= 0 || !search.checkIn || search.checkOut <= search.checkIn || (!passportToken && (!phoneToken || !guest.name.trim()))} onClick={() => void sendRequest()}>{busy ? <Loader2 className="lala-spin" size={18} /> : 'Find my offer'}<Sparkles size={17} /></button><p className="lala-caption">A request is not a booking. Choose an offer before reserving.</p></Sheet>}
    {identityOpen && <Sheet title="Your free Lala Passport." onClose={() => !busy && setIdentityOpen(false)}><p className="lala-muted">One familiar face at every check-in. Verify your phone to create or recover your Passport.</p>{identityFields}{formError}<button className="lala-primary" disabled={busy || !phoneToken || !guest.name.trim()} onClick={() => { setBusy(true); setError(''); void ensurePassport().then(() => setIdentityOpen(false)).catch(reason => setError((reason as Error).message)).finally(() => setBusy(false)); }}>{busy ? <Loader2 size={18} className="lala-spin" /> : 'Open my Passport'}<ArrowRight size={17} /></button></Sheet>}
    {foodHotel && <FoodOrder hotel={foodHotel} onClose={() => setFoodHotel(null)} />}
  </div></div>;
}

function StarIcon() { return <span className="lala-star" aria-label="rating">★</span>; }

function FoodOrder({ hotel, onClose }: { hotel: LalaHotel; onClose: () => void }) {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [mode, setMode] = useState<'pickup' | 'delivery'>('pickup');
  const [contact, setContact] = useState({ name: '', phone: '' });
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [placed, setPlaced] = useState('');
  useEffect(() => { let alive = true; publicApi<MenuItem[]>('/public/hotel/' + hotel.hotel.slug + '/menu-items').then(rows => { if (alive) setMenu(rows.filter(m => (m as MenuItem & { available?: boolean }).available !== false)); }).catch(reason => { if (alive) setError((reason as Error).message); }).finally(() => { if (alive) setLoading(false); }); return () => { alive = false; }; }, [hotel.hotel.slug]);
  const lines = menu.filter(m => cart[m.id]);
  const total = lines.reduce((sum, m) => sum + Number(m.price) * cart[m.id], 0);
  const currency = menu[0]?.currency || hotel.hotel.currency || 'TZS';
  const qty = (id: string, delta: number) => setCart(previous => ({ ...previous, [id]: Math.max(0, (previous[id] || 0) + delta) }));
  const submit = async () => {
    if (busy || !lines.length || !contact.name.trim() || !contact.phone.trim() || (mode === 'delivery' && !address.trim())) return;
    setBusy(true); setError('');
    try {
      const result = await publicApi<{ id: string }>('/public/hotel/' + hotel.hotel.slug + '/orders', { method: 'POST', body: JSON.stringify({ roomNumber: mode === 'delivery' ? 'Delivery' : 'Pickup', locationType: mode, guestName: contact.name.trim(), guestPhone: contact.phone.trim(), items: lines.map(m => ({ menuItemId: m.id, name: m.name, qty: cart[m.id], price: Number(m.price), station: m.station })), currency, note: mode === 'delivery' ? 'Deliver to: ' + address.trim() : 'Pickup order via Lala' }) });
      setPlaced('Order ' + result.id.slice(0, 8) + ' sent. The hotel will call you to confirm.');
    } catch (reason) { setError((reason as Error).message); } finally { setBusy(false); }
  };
  return <Sheet title={'A taste of ' + hotel.hotel.name} onClose={() => !busy && onClose()}>{placed ? <div className="lala-empty"><Check /><h3>Something good is cooking.</h3><p role="status">{placed}</p><button className="lala-primary" onClick={onClose}>Lovely, thank you <Check size={16} /></button></div> : <>{loading && <div className="lala-loading"><Loader2 className="lala-spin" size={18} /> Opening the menu…</div>}{!loading && !menu.length && <div className="lala-empty"><Utensils /><p>No menu items available right now.</p></div>}{menu.map(item => <article className="lala-menu-row" key={item.id}><Photo src={publicAssetUrl(item.imageUrl)} alt={item.name} /><div><h3>{item.name}</h3><p>{lalaMoney(Number(item.price), item.currency)}</p></div><div className="lala-quantity">{!!cart[item.id] && <><button aria-label={'Remove ' + item.name} onClick={() => qty(item.id, -1)}><Minus size={14} /></button><b>{cart[item.id]}</b></>}<button aria-label={'Add ' + item.name} onClick={() => qty(item.id, 1)}><Plus size={14} /></button></div></article>)}{menu.length > 0 && <><div className="lala-mode-buttons"><button className={mode === 'pickup' ? 'is-active' : ''} onClick={() => setMode('pickup')}><Utensils size={16} /> Pickup</button><button className={mode === 'delivery' ? 'is-active' : ''} onClick={() => setMode('delivery')}><Truck size={16} /> Delivery</button></div><div className="lala-identity"><label>Your name<input autoComplete="name" value={contact.name} onChange={e => setContact({ ...contact, name: e.target.value })} /></label><label>Phone number<input type="tel" autoComplete="tel" value={contact.phone} onChange={e => setContact({ ...contact, phone: e.target.value })} /></label>{mode === 'delivery' && <label>Delivery address<input value={address} onChange={e => setAddress(e.target.value)} /></label>}</div><button className="lala-primary" disabled={busy || !lines.length || !contact.name.trim() || !contact.phone.trim() || (mode === 'delivery' && !address.trim())} onClick={() => void submit()}>{busy ? <Loader2 className="lala-spin" size={18} /> : 'Place order · ' + lalaMoney(total, currency)}<ArrowRight size={17} /></button></>}{error && <div className="lala-alert" role="alert">{error}</div>}</>}</Sheet>;
}
