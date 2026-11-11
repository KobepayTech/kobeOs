import PropertyVacancies from './PropertyVacancies';
import JumlaRealEstate from './JumlaRealEstate';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Bookmark, Building2, BusFront, CalendarDays, Car, Check, ChevronRight, Compass, Grid2X2, Heart, Loader2, MapPin, MessageCircle, Minus, PackageSearch, Phone, Play, Plus, Search, Send, Share2, ShoppingBag, SlidersHorizontal, Sparkles, Store, X } from 'lucide-react';
import { publicApi, publicAssetUrl } from './api';
import { usePwaManifest } from '@/hooks/usePwaManifest';
import { categoryKey, merchantClip, money, ProductArt, productPhotos, rankSimilar, readLocal, samples, storePath, writeLocal } from './jumla-catalog';
import type { Item } from './jumla-catalog';
import './jumla.css';

type CarFilters = { make: string; model: string; minYear: string; maxPrice: string; maxMileage: string; location: string; transmission: string; fuel: string; bodyType: string; condition: string; financing: string; dealer: string; color: string };
interface CartLine { item: Item; quantity: number; selectedOptions: Record<string, string> }
interface PropertyCard { id: string; name: string; address: string; city: string; imageUrl: string; totalShops: number; claimedShops: Array<{ shopCode: string; categoryId: string; business: { id: string; name: string; publicSlug: string; tier: string } | null }> }
interface CarCard { id: string; make: string; model: string; trim: string; year: number; price: number | string; currency: string; mileage: number; transmission: string; fuel: string; color: string; engine: string; driveType: string; bodyType: string; location: string; condition: string; status: string; financingAvailable: boolean; negotiable: boolean; canBuy: boolean; canSchedule: boolean; modelGroupKey: string; features: string[]; aiSalesCopy: string; media: Array<{ url: string; kind?: string }>; listing?: { highlights: string[]; socialCaption: string; verticalVideoUrl: string }; dealer: { name: string; phone: string; whatsapp?: string; publicSlug?: string; dealerSiteUrl?: string } }
interface Journey { trip: { id: string; origin: string; destination: string; scheduledDeparture: string; eta?: string; status: string }; operator: string; bus: string; availableSeats: number; canBuy: boolean }
const fallback = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80';

const tabs = [
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'shops', label: 'Shops', icon: Store },
  { id: 'saved', label: 'Saved', icon: Bookmark },
  { id: 'bag', label: 'Bag', icon: ShoppingBag },
] as const;
const markets = [
  { id: 'grid', label: 'Products', icon: Grid2X2, description: 'Browse by category', color: 'violet' },
  { id: 'properties', label: 'Properties', icon: Building2, description: 'Rent, buy and explore shopping centres', color: 'mint' },
  { id: 'cars', label: 'Cars', icon: Car, description: 'Dealer listings and test drives', color: 'peach' },
  { id: 'transport', label: 'Transport', icon: BusFront, description: 'Routes, seats and tickets', color: 'blue' },
] as const;
type Page = typeof tabs[number]['id'] | typeof markets[number]['id'] | 'product' | 'checkout';
type Vertical = 'properties' | 'cars' | 'transport';
type CreatorPick = { creator: { handle: string; name: string; avatarUrl: string | null } | null; productId: string | null; promoCode: string | null };
const categories = ['Electronics', 'Fashion', 'Home & Living', 'Beauty', 'Groceries'];
const blankFilters: CarFilters = { make: '', model: '', minYear: '', maxPrice: '', maxMileage: '', location: '', transmission: '', fuel: '', bodyType: '', condition: '', financing: '', dealer: '', color: '' };

type BrowseMode = 'discover' | 'grid';
type ProductSource = BrowseMode | 'clip' | 'similar';
type ProductPanel = { kind: 'shop' | 'clip' | 'similar'; item: Item };

function initialBrowseMode(): BrowseMode {
  const requested = new URLSearchParams(location.search).get('browse');
  if (requested === 'grid' || requested === 'discover') return requested;
  return readLocal<BrowseMode>('jumla_browse_mode', 'discover') === 'grid' ? 'grid' : 'discover';
}

function merchantClipsEnabled() {
  return new URLSearchParams(location.search).get('clips') !== 'off';
}

function browseEvent(row: Item, eventType: 'VIEW' | 'CART', source: ProductSource, entryView: BrowseMode, interaction?: string) {
  if (row.sample) return;
  let sessionId: string | undefined;
  try {
    sessionId = sessionStorage.getItem('jumla_browse_session') || crypto.randomUUID();
    sessionStorage.setItem('jumla_browse_session', sessionId);
  } catch { /* Browsing does not depend on analytics storage. */ }
  void publicApi('/commerce-public/jumla/interest', { method: 'POST', body: JSON.stringify({
    productId: row.productId, eventType, sessionId,
    metadata: {
      source, entryView, clipsEnabled: merchantClipsEnabled(),
      hasClip: Boolean(merchantClip(row)), hasSimilarOption: Boolean(row.category.trim()),
      ...(interaction ? { interaction } : {}),
    },
  }) }).catch(() => undefined);
}

function updateAffinity(scores: Record<string, number>, category: string, weight: number) {
  const key = categoryKey(category);
  if (!key || !weight) return scores;
  return { ...scores, [key]: Math.max(0, Math.min(30, (scores[key] || 0) + weight)) };
}

function currentRoute(): { page: Page; itemId: string } {
  const [path, itemId = ''] = window.location.hash.slice(1).split('/');
  if (!path && new URLSearchParams(window.location.search).has('listing')) return { page: 'properties', itemId };
  const page = [...tabs, ...markets].some(({ id }) => id === path) || path === 'product' || path === 'checkout' ? path as Page : initialBrowseMode();
  return { page, itemId };
}

function useListings<T,>(path: string) {
  const [result, setResult] = useState<{ path: string; rows: T[]; failed: boolean }>({ path: '', rows: [], failed: false });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      publicApi<T[]>(path, { signal: controller.signal })
        .then((rows) => { if (!controller.signal.aborted) setResult({ path, rows, failed: false }); })
        .catch(() => { if (!controller.signal.aborted) setResult({ path, rows: [], failed: true }); });
    }, 220);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [path, attempt]);
  const retry = useCallback(() => {
    setResult({ path: '', rows: [], failed: false });
    setAttempt((n) => n + 1);
  }, []);
  return {
    rows: result.path === path ? result.rows : [],
    failed: result.path === path && result.failed,
    pending: Boolean(path) && result.path !== path,
    retry,
  };
}

export default function Jumla() {
  const [{ page, itemId }, setRoute] = useState(currentRoute);
  const [entryView] = useState(() => {
    const { page: entry } = currentRoute();
    return entry === 'grid' || entry === 'discover' ? entry : initialBrowseMode();
  });
  const [browseMode, setBrowseMode] = useState<BrowseMode>(entryView);
  const [panel, setPanel] = useState<ProductPanel | null>(null);
  const [productSource, setProductSource] = useState<ProductSource | undefined>();
  const seen = useRef(new Set<string>());
  const [practice, setPractice] = useState(() => {
    const params = new URLSearchParams(location.search);
    return !readLocal('jumla_intro_complete', false) && !readLocal<CartLine[]>('jumla_cart', []).length
      && !params.has('kc') && !params.has('klv') && !params.has('listing');
  });
  const [cart, setCart] = useState(() => readLocal<CartLine[]>('jumla_cart', []).filter(({ item }) => !item.sample && !item.productId.startsWith('demo-')));
  const [practiceCart, setPracticeCart] = useState<CartLine[]>([]);
  const [saved, setSaved] = useState(() => readLocal<Item[]>('jumla_saved_products', []));
  const [practiceSaved, setPracticeSaved] = useState<Item[]>([]);
  const [liked, setLiked] = useState(() => readLocal<string[]>('jumla_liked_products', []));
  const [practiceLiked, setPracticeLiked] = useState<string[]>([]);
  const [affinity, setAffinity] = useState(() =>
    Object.entries(readLocal<Record<string, number>>('jumla_category_affinity', {}))
      .reduce((scores, [name, weight]) => updateAffinity(scores, name, weight), {} as Record<string, number>));
  // Keep the order fixed while shoppers swipe. Use new preferences when they return to Discover.
  const [feedAffinity, setFeedAffinity] = useState(affinity);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [verticalQuery, setVerticalQuery] = useState('');
  const [carFilters, setCarFilters] = useState(blankFilters);
  const [focused, setFocused] = useState<Item | null>(null);
  const [productBack, setProductBack] = useState<Page>('discover');
  const [feedPosition, setFeedPosition] = useState(0);
  const [pick, setPick] = useState<CreatorPick | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const main = useRef<HTMLElement>(null);
  const live = useListings<Item>('/commerce-public/jumla/items?limit=60');
  const { pending: livePending, retry: refreshLive } = live;
  const hasLiveProducts = live.rows.length > 0;
  const searchPath = page === 'search' && query.trim() && !practice ? `/commerce-public/jumla/items?q=${encodeURIComponent(query.trim())}` : '';
  const search = useListings<Item>(searchPath);
  const filteredCatalog = useListings<Item>((page === 'grid' || page === 'discover') && category && !practice ? `/commerce-public/jumla/items?category=${encodeURIComponent(category)}&limit=60` : '');
  const similarCatalog = useListings<Item>(panel?.kind === 'similar' && !practice && panel.item.category.trim()
    ? `/commerce-public/jumla/items?category=${encodeURIComponent(panel.item.category.trim())}&limit=60` : '');
  const encodedQuery = encodeURIComponent(verticalQuery);
  const carParams = new URLSearchParams({ q: verticalQuery, ...Object.fromEntries(Object.entries(carFilters).filter(([, value]) => value)) });
  const properties = useListings<PropertyCard>(page === 'properties' ? `/commerce-public/jumla/properties?q=${encodedQuery}` : '');
  const cars = useListings<CarCard>(page === 'cars' ? `/commerce-public/cars?${carParams}` : '');
  const journeys = useListings<Journey>(page === 'transport' ? `/transit-public/journeys/search?destination=${encodedQuery}` : '');
  usePwaManifest({ name: 'Jumla', shortName: 'Jumla', startUrl: '/jumla', iconBase: '/icon', themeColor: '#171525', enabled: true });

  useEffect(() => {
    const onHash = () => {
      const route = currentRoute();
      setRoute(route); setPanel(null);
      if (main.current) main.current.scrollTop = 0;
      if (route.page === 'discover' || route.page === 'grid') setBrowseMode(route.page);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => { writeLocal('jumla_cart', cart); }, [cart]);
  useEffect(() => { writeLocal('jumla_saved_products', saved); }, [saved]);
  useEffect(() => { writeLocal('jumla_liked_products', liked); }, [liked]);
  useEffect(() => { writeLocal('jumla_category_affinity', affinity); }, [affinity]);

  // Keep creator and livestream attribution across navigation and checkout.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    let code = params.get('kc') || '';
    try {
      const click = params.get('kcid');
      const liveClick = params.get('klv');
      if (code) {
        localStorage.setItem('jumla_attr_code', code);
        if (click) localStorage.setItem('jumla_attr_click', click);
        else localStorage.removeItem('jumla_attr_click');
      }
      if (liveClick) localStorage.setItem('jumla_live_click', liveClick);
      code ||= localStorage.getItem('jumla_attr_code') || '';
    } catch { /* Attribution storage may be disabled. */ }
    if (code) void publicApi<CreatorPick>(`/c/${encodeURIComponent(code)}/info`).then((info) => {
      if (info?.creator) setPick(info);
    }).catch(() => undefined);
  }, []);

  const go = useCallback((next: Page, id = '') => {
    if (next !== page) setVerticalQuery('');
    const hash = `#${next}${id ? `/${id}` : ''}`;
    if (location.hash !== hash) location.hash = hash;
  }, [page]);
  const startPractice = () => {
    setPanel(null); setPractice(true); setFeedPosition(0); setCategory(''); setConfirmation(''); go('discover');
  };
  const finishPractice = useCallback(() => {
    const interests = readLocal('jumla_intro_complete', false) ? affinity : samples.reduce((scores, row) => {
      const weight = (practiceLiked.includes(row.productId) ? 2 : 0)
        + (practiceSaved.some((savedRow) => savedRow.productId === row.productId) ? 3 : 0);
      return updateAffinity(scores, row.category, weight);
    }, affinity);
    setAffinity(interests);
    setFeedAffinity(interests);
    writeLocal('jumla_intro_complete', true);
    setPractice(false); setPracticeCart([]); setPracticeSaved([]); setPracticeLiked([]);
    setFeedPosition(0); setCategory(''); setConfirmation(''); go(browseMode);
    if (!hasLiveProducts && !livePending) refreshLive();
  }, [affinity, browseMode, go, hasLiveProducts, livePending, practiceLiked, practiceSaved, refreshLive]);

  const listed = practice ? samples : live.rows;
  const bag = practice ? practiceCart : cart;
  const savedItems = practice ? practiceSaved : saved;
  const likes = practice ? practiceLiked : liked;
  const item = [focused, ...listed, ...search.rows, ...filteredCatalog.rows, ...savedItems, ...bag.map((line) => line.item)]
    .find((row) => row?.productId === itemId && Boolean(row.sample) === practice);
  const bagCount = bag.reduce((count, line) => count + line.quantity, 0);
  const feed = useMemo(() => practice ? samples : [...live.rows].sort((a, b) =>
    Number(b.productId === pick?.productId) - Number(a.productId === pick?.productId)
    || Number(b.stock > 0) - Number(a.stock > 0)
    || (feedAffinity[categoryKey(b.category)] || 0) - (feedAffinity[categoryKey(a.category)] || 0)), [practice, live.rows, feedAffinity, pick?.productId]);
  const merchants = [...new Map(feed.map((row) => [row.businessId, row])).values()];
  const open = (row: Item, source?: ProductSource) => {
    setPanel(null); setFocused(row);
    if (page !== 'product') setProductBack(page);
    setProductSource(source ?? (page === 'grid' || page === 'discover' ? page : undefined));
    go('product', row.productId);
  };
  const impression = useCallback((row: Item, source: ProductSource, interaction = 'impression') => {
    if (row.sample) return;
    const key = JSON.stringify([source, interaction, row.productId]);
    if (seen.current.has(key)) return;
    seen.current.add(key);
    browseEvent(row, 'VIEW', source, entryView, interaction);
  }, [entryView]);
  const switchMode = (mode: BrowseMode) => {
    setBrowseMode(mode); writeLocal('jumla_browse_mode', mode); go(mode);
  };
  const showPanel = (row: Item, kind: ProductPanel['kind']) => {
    setPanel({ item: row, kind });
    if (kind !== 'shop') impression(row, kind, kind === 'clip' ? 'play_requested' : 'opened');
  };
  const learn = (row: Item, weight: number) => {
    if (row.sample || !row.category) return;
    setAffinity((current) => updateAffinity(current, row.category, weight));
  };
  const toggleLike = (row: Item) => {
    const active = likes.includes(row.productId);
    (row.sample ? setPracticeLiked : setLiked)((all) => active ? all.filter((id) => id !== row.productId) : [...all, row.productId]);
    learn(row, active ? -2 : 2);
  };
  const toggleSave = (row: Item) => {
    const active = savedItems.some((entry) => entry.productId === row.productId);
    (row.sample ? setPracticeSaved : setSaved)((all) => active ? all.filter((entry) => entry.productId !== row.productId) : [row, ...all]);
    learn(row, active ? -3 : 3);
  };
  const add = (row: Item, selectedOptions: Record<string, string>, source?: ProductSource) => {
    if (row.stock < 1 || Boolean(row.sample) !== practice) return;
    if (bag.filter((line) => line.item.productId === row.productId).reduce((sum, line) => sum + line.quantity, 0) >= row.stock) {
      setPanel(null); go('bag'); return;
    }
    const key = lineKey({ item: row, selectedOptions, quantity: 1 });
    (row.sample ? setPracticeCart : setCart)((all) => {
      const existing = all.find((line) => lineKey(line) === key);
      const quantity = all.filter((line) => line.item.productId === row.productId).reduce((sum, line) => sum + line.quantity, 0);
      if (quantity >= row.stock) return all;
      if (existing) return all.map((line) => line === existing ? { ...line, item: row, quantity: line.quantity + 1 } : line);
      return [...all, { item: row, quantity: 1, selectedOptions }];
    });
    if (!row.sample) {
      learn(row, 4);
      browseEvent(row, 'CART', source ?? productSource ?? browseMode, entryView);
    }
    setPanel(null); setConfirmation(''); go('bag');
  };
  const vertical = markets.find((entry) => entry.id === page && entry.id !== 'grid');
  const isSaved = (row: Item) => savedItems.some((entry) => entry.productId === row.productId);
  const categoryRows = practice ? listed : filteredCatalog.rows;
  const gridRows = category ? categoryRows.filter((row) => categoryKey(row.category) === categoryKey(category)) : listed;
  const discoverRows = category ? gridRows : feed;
  const browseRequest = category && !practice ? filteredCatalog : live;
  const categoryChoices = [...new Map([...categories, ...listed.map((row) => row.category).filter(Boolean)]
    .map((label) => [categoryKey(label), label.trim()])).values()];
  const categoryPicker = <div className="jl-chips" aria-label="Product categories">
    {['', ...categoryChoices].map((label) => <button key={label} aria-pressed={categoryKey(category) === categoryKey(label)}
      onClick={() => { if (category !== label) { setCategory(label); setFeedPosition(0); } }}>{label || 'All products'}</button>)}
  </div>;
  const similarRows = panel?.kind === 'similar' ? rankSimilar(panel.item, practice ? samples : similarCatalog.rows) : [];
  const swahili = navigator.language.toLowerCase().startsWith('sw');

  return <div className="jl-shell" data-surface="light">
    <div className="jumla-frame">
      <header className="jl-header">
        <button className="jl-brand" onClick={() => { if (page !== 'discover') setFeedAffinity(affinity); go(browseMode); }} aria-label="Jumla marketplace">
          <span className="jl-mark"><ShoppingBag size={18} /></span> jumla<span className="jl-dot">.</span>
        </button>
        <div className="jl-header-tools">
          <span className="jl-location"><MapPin size={13} /> Tanzania</span>
          <button className="jl-icon-btn" onClick={() => go('search')} aria-label="Search marketplace"><Search size={20} /></button>
        </div>
      </header>
      {practice && <div className="jl-demo-bar"><span><Sparkles size={14} /> Practice mode</span><button onClick={finishPractice}>Go live <ArrowRight size={13} /></button></div>}
      {!practice && pick?.creator && <div className="jl-demo-bar"><span>{pick.creator.name}’s picks {pick.promoCode && `· ${pick.promoCode}`}</span><button aria-label="Dismiss creator picks" onClick={() => {
        setPick(null);
        try { localStorage.removeItem('jumla_attr_code'); localStorage.removeItem('jumla_attr_click'); } catch { /* optional storage */ }
      }}><X size={16} /></button></div>}

      <main ref={main} className={`jl-main ${page === 'discover' ? 'jl-discover-main' : ''}`}>
        {page === 'discover' && <>
          <div className="jl-discover-bar">
            <div><span className="jl-kicker">{practice ? 'THE JUMLA WALKTHROUGH' : 'JUMLA DISCOVERY'}</span><h1>For you</h1></div>
            <BrowseSwitch mode="discover" onChange={switchMode} />
          </div>
          <div className="jl-discover-filters">{categoryPicker}</div>
          {discoverRows.length ? <SwipeFeed key={`${practice ? 'practice' : 'live'}:${category}`} items={discoverRows} position={feedPosition} onPosition={setFeedPosition} practice={practice}
            showPanel={showPanel} impression={impression} swahili={swahili} isSaved={isSaved} isLiked={(row) => likes.includes(row.productId)} onSave={toggleSave} onLike={toggleLike} finish={finishPractice}
            onPracticeEnd={practice && !category && hasLiveProducts && !practiceCart.length ? finishPractice : undefined}
            onRefresh={() => { setFeedPosition(0); setFeedAffinity(affinity); browseRequest.retry(); }} />
            : category ? <ListingStatus request={practice ? undefined : browseRequest} empty={<EmptyState icon={Compass}
                title={`No ${category.toLowerCase()} yet`} description="Choose another category to keep exploring." />} />
            : live.failed ? <EmptyState icon={Compass} title="Live feed is temporarily unavailable" description="You can still try the practice feed while listings reconnect."
              action={<><button className="jl-primary" onClick={startPractice}>Try the practice feed <ArrowRight size={16} /></button><button className="jl-quiet" onClick={live.retry}>Retry live feed</button></>} />
              : <ListingStatus request={live} empty={<EmptyState icon={Compass} title="Your feed starts here" description="Published products from Jumla merchants will appear here as shops join."
                action={<><button className="jl-primary" onClick={startPractice}>Try the practice feed <ArrowRight size={16} /></button><button className="jl-quiet" onClick={refreshLive}>Check for new listings</button></>} />} />}
        </>}

        {page === 'grid' && <div className="jl-content">
          <div className="jl-browse-heading"><PageTitle kicker="MARKETPLACE / PRODUCTS" title="Browse the grid" description="Compare products side by side and filter by category." />
            <BrowseSwitch mode="grid" onChange={switchMode} /></div>
          {categoryPicker}
          {gridRows.length ? <ProductGrid rows={gridRows} open={open} onImpression={impression} /> : <ListingStatus request={practice ? undefined : browseRequest} empty={<EmptyState icon={Grid2X2} title={category ? `No ${category.toLowerCase()} yet` : 'Products will appear here'} description="Check other categories or come back as merchants add products." />} />}
        </div>}

        {page === 'search' && <div className="jl-content">
          <PageTitle kicker="MARKETPLACE / SEARCH" title="Find what you need" description="Look up a product or explore another part of the marketplace." />
          <SearchBox label="Search products" value={query} onChange={setQuery} placeholder="Try headphones, fashion or a shop" />
          {query.trim() ? (() => {
            const term = query.trim().toLowerCase();
            const rows = practice ? samples.filter((row) => `${row.name} ${row.category} ${row.business.name}`.toLowerCase().includes(term)) : search.rows;
            return rows.length ? <ProductGrid rows={rows} open={open} /> : <ListingStatus request={practice ? undefined : search} empty={<EmptyState icon={Search} title="No matches found" description="Try a shorter keyword or another category." />} />;
          })() : <>
            <div className="jl-chips" aria-label="Suggested searches">{categories.map((label) => <button key={label} onClick={() => setQuery(label)}>{label}</button>)}</div>
            <h2 className="jl-section-title">Explore Jumla</h2>
            <div className="jl-market-links">{markets.map(({ id, icon: Icon, label, description, color }) => <button key={id} onClick={() => go(id)}>
              <span className={`jl-tile-icon jl-${color}`}><Icon size={21} /></span><span><strong>{label}</strong><small>{description}</small></span><ChevronRight size={17} />
            </button>)}</div>
          </>}
        </div>}

        {page === 'shops' && <div className="jl-content">
          <PageTitle kicker="MARKETPLACE / MERCHANTS" title="Explore shops" description={practice ? 'Meet the example shops behind the practice products.' : 'Discover merchants with products currently listed on Jumla.'} />
          {merchants.length ? <div className="jl-market-links">{merchants.map((row) => {
            const count = listed.filter((other) => other.businessId === row.businessId).length;
            const body = <><span className="jl-tile-icon jl-mint"><Store size={22} /></span><span><strong>{row.business.name}</strong><small>{row.sample ? 'Demo merchant · ' : ''}{count} {count === 1 ? 'listing' : 'listings'}</small></span><ChevronRight size={17} /></>;
            return row.sample ? <button key={row.businessId} onClick={() => open(row)}>{body}</button> : <a key={row.businessId} href={storePath(row)}>{body}</a>;
          })}</div> : <ListingStatus request={live} empty={<EmptyState icon={Store} title="No shops listed yet" description="Merchants appear here when their products are published and available to browse." action={<button className="jl-quiet" onClick={startPractice}>See example shops</button>} />} />}
        </div>}

        {vertical && <VerticalPage vertical={vertical.id as Vertical} query={verticalQuery} setQuery={setVerticalQuery} carFilters={carFilters} setCarFilters={setCarFilters}
          properties={properties} cars={cars} journeys={journeys} />}
        {page === 'saved' && <div className="jl-content">
          <PageTitle kicker="YOUR JUMLA / COLLECTION" title="Saved for later" description="Keep the products you want to come back to." />
          {savedItems.length ? <ProductGrid rows={savedItems} open={open} remove={toggleSave} /> : <EmptyState icon={Bookmark} title="Your list is empty" description="Tap the bookmark on a product to keep it here." action={<button className="jl-primary" onClick={() => go('discover')}>Explore the feed <ArrowRight size={16} /></button>} />}
        </div>}
        {page === 'product' && <div className="jl-content">
          <button className="jl-back" onClick={() => go(productBack)}><ArrowLeft size={17} /> Back</button>
          {item ? <ProductDetail key={item.productId} item={item} saved={isSaved(item)} onSave={() => toggleSave(item)} onAdd={add} onSimilar={() => showPanel(item, 'similar')} swahili={swahili} />
            : <ListingStatus request={live} empty={<EmptyState icon={PackageSearch} title="Listing unavailable" description="This product may have been removed or its shop may be temporarily offline." />} />}
        </div>}
        {page === 'bag' && <div className="jl-content">
          <PageTitle kicker="YOUR JUMLA / BAG" title={practice ? 'Practice bag' : 'Shopping bag'} description={practice ? 'Try changing quantities and selecting a product option.' : 'Review your products and their options before checkout.'} />
          <Bag lines={bag} practice={practice} setLines={practice ? setPracticeCart : setCart} browse={() => go('discover')} checkout={() => { setConfirmation(''); go('checkout'); }} />
        </div>}
        {page === 'checkout' && <div className="jl-content">
          <button className="jl-back" onClick={() => go('bag')}><ArrowLeft size={17} /> Back to bag</button>
          <PageTitle kicker="YOUR JUMLA / CHECKOUT" title={practice ? 'Practice checkout' : 'Checkout'} description={practice ? 'Try the steps with a sample order.' : 'Choose pickup or delivery and tell the merchant how to reach you.'} />
          {confirmation ? <EmptyState icon={Check} title={practice ? 'Practice complete' : 'Order sent'} description={confirmation}
            action={<button className="jl-primary" onClick={practice ? finishPractice : () => go('discover')}>{practice ? 'Explore live Jumla' : 'Keep browsing'} <ArrowRight size={16} /></button>} />
            : <Checkout lines={bag} practice={practice} promoHint={pick?.promoCode || ''} edit={() => go('bag')} complete={(message) => {
              (practice ? setPracticeCart : setCart)([]); setConfirmation(message);
            }} />}
        </div>}
      </main>

      {panel && <BrowsePanel key={`${panel.kind}:${panel.item.productId}`} panel={panel} close={() => setPanel(null)} swahili={swahili}
        open={open} add={add} similarRows={similarRows} similarRequest={practice ? undefined : similarCatalog} />}
      <nav className="jl-nav" aria-label="Main navigation">{tabs.map(({ id, label, icon: Icon }) =>
        <button key={id} aria-current={page === id || (id === 'discover' && page === 'grid') ? 'page' : undefined}
          onClick={() => { if (id === 'discover') { if (page !== browseMode) setFeedAffinity(affinity); go(browseMode); } else go(id); }}>
          <span><Icon size={21} />{id === 'bag' && bagCount > 0 && <b>{bagCount}</b>}</span>{label}
        </button>)}
      </nav>
    </div>
  </div>;
}

function BrowseSwitch({ mode, onChange }: { mode: BrowseMode; onChange: (mode: BrowseMode) => void }) {
  return <div className="jl-view-switch" role="group" aria-label="Shopping view">
    <button aria-pressed={mode === 'discover'} onClick={() => onChange('discover')}><Compass size={15} /> Discover</button>
    <button aria-pressed={mode === 'grid'} onClick={() => onChange('grid')}><Grid2X2 size={15} /> Grid</button>
  </div>;
}

function PageTitle({ kicker, title, description }: { kicker: string; title: string; description: string }) {
  return <div className="jl-page-title"><span className="jl-kicker">{kicker}</span><h1>{title}</h1><p>{description}</p></div>;
}

function EmptyState({ icon: Icon, title, description, action }: { icon: typeof Compass; title: string; description: string; action?: ReactNode }) {
  return <div className="jl-empty"><span className="jl-empty-icon"><Icon size={30} strokeWidth={1.65} /></span><h2>{title}</h2><p>{description}</p>{action}</div>;
}

function ListingStatus({ request, empty }: { request?: { pending: boolean; failed: boolean; retry: () => void }; empty: ReactNode }) {
  if (request?.pending) return <div className="jl-loading" role="status"><Loader2 size={22} className="animate-spin" /> Loading listings…</div>;
  if (request?.failed) return <EmptyState icon={PackageSearch} title="Listings are temporarily unavailable" description="Please try again in a moment." action={<button className="jl-quiet" onClick={request.retry}>Try again</button>} />;
  return empty;
}

function SearchBox({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (text: string) => void; placeholder: string }) {
  return <label className="jl-search"><Search size={20} /><input aria-label={label} type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

function SwipeFeed({ items, position, onPosition, practice, showPanel, impression, swahili, isSaved, isLiked, onSave, onLike, finish, onPracticeEnd, onRefresh }: {
  items: Item[]; position: number; onPosition: (position: number) => void; practice: boolean; swahili: boolean;
  showPanel: (item: Item, kind: ProductPanel['kind']) => void; impression: (row: Item, source: ProductSource) => void;
  isSaved: (item: Item) => boolean; isLiked: (item: Item) => boolean; onSave: (item: Item) => void; onLike: (item: Item) => void;
  finish: () => void; onPracticeEnd?: () => void; onRefresh: () => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const endCard = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!onPracticeEnd || !viewport.current || !endCard.current || typeof IntersectionObserver !== 'function') return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry && entry.intersectionRatio >= 0.99) {
        observer.disconnect();
        onPracticeEnd();
      }
    }, { root: viewport.current, threshold: 0.99 });
    observer.observe(endCard.current);
    return () => observer.disconnect();
  }, [onPracticeEnd]);
  const active = items[position];
  const clipsEnabled = merchantClipsEnabled();
  useEffect(() => { if (active) impression(active, 'discover'); }, [active, impression]);
  const startPosition = useRef(position);
  const last = items.length;
  useEffect(() => {
    const node = viewport.current;
    if (node) node.scrollTop = node.clientHeight * Math.min(startPosition.current, last);
  }, [last]);
  const move = (next: number) => {
    const node = viewport.current;
    if (!node) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    node.scrollTo({ top: node.clientHeight * Math.min(last, Math.max(0, next)), behavior: reduce ? 'instant' : 'smooth' });
  };

  return <div className="jl-feed-wrap">
    <div ref={viewport} className="jl-feed" aria-label="Vertical product feed" tabIndex={0}
      onScroll={(event) => { const node = event.currentTarget; if (node.clientHeight) onPosition(Math.round(node.scrollTop / node.clientHeight)); }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
        event.preventDefault(); move(position + (event.key === 'ArrowDown' ? 1 : -1));
      }}>
      {items.map((row, index) => <article className={`jl-slide jl-slide-${row.sample || 'live'}`} key={row.productId}>
        <ProductArt item={row} eager={index === position} />
        <div className="jl-shade" />
        <div className="jl-slide-top"><span>{row.sample ? 'DEMO PRODUCT' : 'JUMLA MARKET'}</span><span>{String(index + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}</span></div>
        <div className="jl-slide-actions">
          <button aria-label={isLiked(row) ? 'Unlike product' : 'Like product'} aria-pressed={isLiked(row)} onClick={() => onLike(row)}><Heart size={23} fill={isLiked(row) ? 'currentColor' : 'none'} /><small>Like</small></button>
          <button aria-label={isSaved(row) ? 'Remove saved product' : 'Save product'} aria-pressed={isSaved(row)} onClick={() => onSave(row)}><Bookmark size={22} fill={isSaved(row) ? 'currentColor' : 'none'} /><small>Save</small></button>
          <button aria-label="Previous product" disabled={index === 0} onClick={() => move(index - 1)}><ArrowUp size={19} /><small>Previous</small></button>
          <button aria-label="Next product" onClick={() => move(index + 1)}><ArrowDown size={22} /><small>Next</small></button>
        </div>
        <div className="jl-slide-copy">
          <div className="jl-kicker">{row.category || 'PRODUCT'} · {row.business.name}</div>
          <h2>{row.name}</h2><p>{money(row.price, row.currency)}</p>
          <div className="jl-slide-buttons">
            <button onClick={() => showPanel(row, 'shop')} className="jl-lime">{swahili ? 'Nunua bidhaa' : 'Shop this look'} <ArrowRight size={16} /></button>
            {clipsEnabled && merchantClip(row) && <button className="jl-slide-secondary" onClick={() => showPanel(row, 'clip')}><Play size={15} /> {swahili ? 'Tazama' : 'Watch'}</button>}
            {row.category.trim() && <button className="jl-slide-secondary" onClick={() => showPanel(row, 'similar')}>{swahili ? 'Bidhaa zinazofanana' : 'Find similar'}</button>}
          </div>
        </div>
      </article>)}
      <div ref={endCard} className="jl-slide jl-end"><Sparkles size={32} /><h2>{practice ? 'You’re ready to explore' : 'You’re all caught up'}</h2><p>{practice ? 'See products from real merchants in your live feed.' : 'Refresh your feed to check for new listings and updated recommendations.'}</p>
        <button className="jl-lime" onClick={practice ? finish : onRefresh}>{practice ? 'Explore live Jumla' : 'Refresh feed'} <ArrowRight size={16} /></button>
        <button className="jl-feed-back" onClick={() => move(0)}><ArrowUp size={16} /> Back to first product</button>
      </div>
    </div>
    <div className="jl-feed-hint"><ArrowUp size={14} /> Swipe up for the next product {practice && <span>· Try liking or saving</span>}</div>
  </div>;
}

function ProductGrid({ rows, open, remove, onImpression }: {
  rows: Item[]; open: (item: Item) => void; remove?: (item: Item) => void; onImpression?: (item: Item, source: ProductSource) => void;
}) {
  const grid = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!onImpression || !grid.current || !rows.some((row) => !row.sample) || typeof IntersectionObserver !== 'function') return;
    const byId = new Map(rows.filter((row) => !row.sample).map((row) => [row.productId, row]));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting, intersectionRatio }) => {
        if (!isIntersecting || intersectionRatio < 0.5) return;
        const row = byId.get((target as HTMLElement).dataset.productId || '');
        if (row) onImpression(row, 'grid');
        observer.unobserve(target);
      });
    }, { threshold: 0.5 });
    grid.current.querySelectorAll('[data-product-id]').forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [onImpression, rows]);

  return <div className="jl-product-grid" ref={grid}>{rows.map((row) =>
    <GridProduct key={row.productId} row={row} open={open} remove={remove} />)}</div>;
}

function GridProduct({ row, open, remove }: { row: Item; open: (item: Item) => void; remove?: (item: Item) => void }) {
  const [selectedPhoto, setSelectedPhoto] = useState(0);
  const photos = productPhotos(row);
  const photoIndex = selectedPhoto % Math.max(photos.length, 1);
  return <article data-product-id={row.productId}>
    <button className="jl-grid-product" onClick={() => open(row)}>
      <div className="jl-grid-art"><ProductArt item={row} photo={photos[photoIndex]} />{row.sample && <span className="jl-art-badge">Demo</span>}</div>
      <div className="jl-grid-copy"><small>{row.business.name}</small><strong>{row.name}</strong><b>{money(row.price, row.currency)}</b></div>
    </button>
    {photos.length > 1 && <button className="jl-grid-photos" aria-label={`Next photo for ${row.name} (photo ${photoIndex + 1} of ${photos.length})`}
      onClick={() => setSelectedPhoto((photoIndex + 1) % photos.length)}>{photoIndex + 1}/{photos.length} <ChevronRight size={15} /></button>}
    {remove && <button className="jl-remove" aria-label={`Remove ${row.name} from saved`} onClick={() => remove(row)}><Bookmark size={17} fill="currentColor" /></button>}
  </article>;
}

function BrowsePanel({ panel, close, open, add, similarRows, similarRequest, swahili }: {
  panel: ProductPanel; close: () => void; open: (row: Item, source?: ProductSource) => void;
  add: (row: Item, options: Record<string, string>, source?: ProductSource) => void; swahili: boolean;
  similarRows: Item[]; similarRequest?: { pending: boolean; failed: boolean; retry: () => void };
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [options, setOptions] = useState<Record<string, string>>({});
  const [clipFailed, setClipFailed] = useState(false);
  const { item, kind } = panel;
  const clip = kind === 'clip' ? merchantClip(item) : '';
  const pickup = [item.location?.property, item.location?.floor, item.location?.shopCode].filter(Boolean).join(' · ') || item.locationLabel;
  useEffect(() => {
    const node = dialog.current;
    const trigger = document.activeElement;
    node?.showModal();
    return () => {
      node?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);
  return <dialog className="jl-panel" ref={dialog} aria-labelledby="jl-panel-title" onCancel={(event) => { event.preventDefault(); close(); }}>
    <header><div><span className="jl-kicker">{kind === 'similar' ? item.name : item.business.name}</span>
      <h2 id="jl-panel-title">{kind === 'similar' ? swahili ? 'Bidhaa zinazofanana' : 'Find similar' : item.name}</h2></div>
      <button className="jl-icon-btn" aria-label={swahili ? 'Funga' : 'Close'} onClick={close}><X size={19} /></button>
    </header>
    {kind === 'similar' ? similarRows.length ? <ProductGrid rows={similarRows} open={(row) => open(row, 'similar')} />
      : <ListingStatus request={similarRequest} empty={<p role="status">{swahili ? 'Hakuna bidhaa zinazofanana kwa sasa.' : 'No similar products available right now.'}</p>} />
      : <>
        <p className="jl-panel-price">{money(item.price, item.currency)}</p>
        <p>{pickup ? `${swahili ? 'Mahali pa kuchukua' : 'Pickup'}: ${pickup}` : swahili ? 'Chagua kuchukua au kuletewa unapolipa.' : 'Choose pickup or delivery at checkout.'}</p>
        {clip && (clipFailed ? <p role="status">{swahili ? 'Video haipatikani kwa sasa.' : 'This video is temporarily unavailable.'}</p>
          : <video controls playsInline preload="none" src={clip} poster={publicAssetUrl(productPhotos(item)[0]) || undefined}
              aria-label={`${item.name} video`} onError={() => setClipFailed(true)} />)}
        {item.description && <p>{item.description}</p>}
        <form className="jl-form" onSubmit={(event) => { event.preventDefault(); add(item, options, kind === 'clip' ? 'clip' : 'discover'); }}>
          <ProductOptions item={item} selected={options} change={setOptions} />
          <button className="jl-primary jl-wide" type="submit" disabled={item.stock < 1}><ShoppingBag size={17} />
            {item.stock < 1 ? 'Out of stock' : item.sample ? 'Add to practice bag' : swahili ? 'Weka kwenye kikapu' : 'Add to bag'}</button>
        </form>
        <button className="jl-quiet jl-wide" onClick={() => open(item, kind === 'clip' ? 'clip' : 'discover')}>{swahili ? 'Maelezo zaidi' : 'Full product details'} <ArrowRight size={15} /></button>
      </>}
  </dialog>;
}

function ProductOptions({ item, selected, change }: { item: Item; selected: Record<string, string>; change: (options: Record<string, string>) => void }) {
  return <>{item.requiredOptions.map((option) => {
    const values = [...new Set(item.variants.map((variant) => variant.attributes?.[option]).filter((value): value is string => Boolean(value)))];
    return <label key={option} className="jl-field"><span>{option}</span>{values.length
      ? <select required value={selected[option] || ''} onChange={(event) => change({ ...selected, [option]: event.target.value })}><option value="">Select {option.toLowerCase()}</option>{values.map((value) => <option key={value}>{value}</option>)}</select>
      : <input required value={selected[option] || ''} onChange={(event) => change({ ...selected, [option]: event.target.value })} placeholder={`Enter ${option.toLowerCase()}`} />}</label>;
  })}</>;
}

function ProductDetail({ item, saved, onSave, onAdd, onSimilar, swahili }: { item: Item; saved: boolean; onSave: () => void; onAdd: (item: Item, options: Record<string, string>) => void; onSimilar: () => void; swahili: boolean }) {
  const [options, setOptions] = useState<Record<string, string>>({});
  const [photoIndex, setPhotoIndex] = useState(0);
  const photos = productPhotos(item);
  const whatsapp = item.business.whatsapp?.replace(/\D/g, '');
  return <>
    <div className="jl-detail-art"><ProductArt key={photos[photoIndex]} item={item} photo={photos[photoIndex]} />{item.sample && <span className="jl-art-badge">Demo product</span>}
      <button className="jl-remove" aria-label={saved ? 'Remove saved product' : 'Save product'} aria-pressed={saved} onClick={onSave}><Bookmark size={19} fill={saved ? 'currentColor' : 'none'} /></button>
      {photos.length > 1 && <div className="jl-photo-nav" aria-label="Product photos">{photos.map((photo, index) =>
        <button key={photo} aria-label={`Photo ${index + 1}`} aria-pressed={photoIndex === index} onClick={() => setPhotoIndex(index)} />)}</div>}
    </div>
    <div className="jl-detail-heading"><PageTitle kicker={item.category || 'PRODUCT'} title={item.name} description={item.description} /><strong>{money(item.price, item.currency)}</strong></div>
    <div className="jl-merchant"><span className="jl-tile-icon jl-mint"><Store size={20} /></span><div><b>{item.business.name}</b><small>{item.sample ? 'Demo merchant' : item.location ? [item.location.property, item.location.floor, item.location.shopCode].filter(Boolean).join(' · ') : `${item.stock} available`}</small></div>
      {!item.sample && item.business.publicSlug && <a href={storePath(item)}>Visit shop <ChevronRight size={15} /></a>}
    </div>
    {!item.sample && (item.business.phone || whatsapp) && <div className="jl-contact">{item.business.phone && <a className="jl-quiet" href={`tel:${item.business.phone}`}><Phone size={15} /> Call</a>}
      {whatsapp && <a className="jl-quiet" href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`I saw ${item.name} on Jumla`)}`}><MessageCircle size={15} /> WhatsApp</a>}</div>}
    <form className="jl-form" onSubmit={(event) => { event.preventDefault(); onAdd(item, options); }}>
      <ProductOptions item={item} selected={options} change={setOptions} />
      <button className="jl-primary jl-wide" type="submit" disabled={item.stock < 1}><ShoppingBag size={18} />{item.stock < 1 ? 'Out of stock' : item.sample ? 'Add to practice bag' : 'Add to bag'}</button>
    </form>
    {item.category.trim() && <button className="jl-quiet jl-wide jl-detail-similar" onClick={onSimilar}>{swahili ? 'Bidhaa zinazofanana' : 'Find similar'}</button>}
  </>;
}

const lineKey = (line: CartLine) => JSON.stringify([line.item.productId, Object.entries(line.selectedOptions).sort(([a], [b]) => a.localeCompare(b))]);
const subtotal = (lines: CartLine[]) => [...new Set(lines.map(({ item }) => item.currency || 'TZS'))].map((currency) =>
  money(lines.filter(({ item }) => (item.currency || 'TZS') === currency).reduce((sum, line) => sum + Number(line.item.price) * line.quantity, 0), currency)).join(' + ');
const hasMissingOptions = (lines: CartLine[]) => lines.some(({ item, selectedOptions }) => item.requiredOptions.some((option) => !selectedOptions[option]?.trim()));

function Bag({ lines, practice, setLines, browse, checkout }: { lines: CartLine[]; practice: boolean; setLines: React.Dispatch<React.SetStateAction<CartLine[]>>; browse: () => void; checkout: () => void }) {
  if (!lines.length) return <EmptyState icon={ShoppingBag} title="Your bag is empty" description="Open a product to choose your options and add it to your bag." action={<button className="jl-primary" onClick={browse}>Find a product <ArrowRight size={16} /></button>} />;
  const setQuantity = (target: CartLine, quantity: number) => setLines((all) => all.flatMap((line) => line !== target ? [line] : quantity < 1 ? [] : [{ ...line, quantity }]));
  return <form className="jl-form" onSubmit={(event) => { event.preventDefault(); checkout(); }}>
    {lines.map((line) => {
      const { item, quantity } = line;
      const count = lines.filter((entry) => entry.item.productId === item.productId).reduce((sum, entry) => sum + entry.quantity, 0);
      return <article key={lineKey(line)} className="jl-bag-card">
        <div className="jl-bag-row"><div className="jl-bag-art"><ProductArt item={item} /></div><div><small>{item.business.name}{practice && ' · Demo'}</small><h2>{item.name}</h2><b>{money(item.price, item.currency)}</b></div></div>
        <div className="jl-bag-row jl-quantity-row"><div className="jl-quantity">
          <button type="button" aria-label={quantity === 1 ? 'Remove item' : 'Reduce quantity'} onClick={() => setQuantity(line, quantity - 1)}><Minus size={15} /></button>
          <b>{quantity}</b><button type="button" aria-label="Increase quantity" disabled={count >= item.stock} onClick={() => setQuantity(line, quantity + 1)}><Plus size={15} /></button>
        </div><strong>{money(Number(item.price) * quantity, item.currency)}</strong></div>
        <ProductOptions item={item} selected={line.selectedOptions} change={(selectedOptions) => setLines((all) => {
          const updated = { ...line, selectedOptions };
          const match = all.find((entry) => entry !== line && lineKey(entry) === lineKey(updated));
          if (!match) return all.map((entry) => entry === line ? updated : entry);
          return all.flatMap((entry) => entry === line ? [] : entry === match ? [{ ...match, quantity: match.quantity + line.quantity }] : [entry]);
        })} />
      </article>;
    })}
    <div className="jl-summary"><div><span>Subtotal</span><strong>{subtotal(lines)}</strong></div><p>{practice ? 'Sample prices for the walkthrough.' : 'Merchants confirm any delivery fees separately.'}</p></div>
    <button type="submit" className="jl-primary jl-wide">Continue to checkout <ArrowRight size={18} /></button>
  </form>;
}

function Checkout({ lines, practice, promoHint, edit, complete }: { lines: CartLine[]; practice: boolean; promoHint: string; edit: () => void; complete: (message: string) => void }) {
  const [fulfillment, setFulfillment] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current || !lines.length || hasMissingOptions(lines)) return;
    if (practice) { complete('You tried the order flow. Your practice bag has been cleared.'); return; }
    if (lines.some(({ item }) => item.sample || item.productId.startsWith('demo-'))) return;
    const fields = new FormData(event.currentTarget);
    const name = String(fields.get('name') || '').trim();
    const phone = String(fields.get('phone') || '').trim();
    const address = String(fields.get('address') || '').trim();
    if (!name || !phone || (fulfillment === 'DELIVERY' && !address)) {
      setError('Enter your name, phone number and delivery address if needed.'); return;
    }
    inFlight.current = true; setSending(true); setError('');
    try {
      const local = (key: string) => { try { return localStorage.getItem(key) || ''; } catch { return ''; } };
      const code = local('jumla_attr_code');
      const clickId = local('jumla_attr_click');
      const liveClickVisitId = local('jumla_live_click');
      const promoCode = String(fields.get('promo') || '').trim().toUpperCase();
      const attribution = code || promoCode || liveClickVisitId ? { attribution: { code, clickId, promoCode, liveClickVisitId } } : {};
      const response = await publicApi<{ orders: Array<{ orderNumber: string }> }>('/commerce-public/jumla/orders', {
        method: 'POST', body: JSON.stringify({
          customer: { name, phone }, fulfillment, deliveryAddress: address, note: fields.get('note') || '',
          lines: lines.map(({ item, quantity, selectedOptions }) => ({ productId: item.productId, quantity, selectedOptions })), ...attribution,
        }),
      });
      complete(`Order reference ${response.orders.map((order) => order.orderNumber).join(', ')}`);
    } catch (err) { setError((err as Error).message); }
    finally { inFlight.current = false; setSending(false); }
  };

  if (!lines.length || hasMissingOptions(lines)) return <EmptyState icon={ShoppingBag} title={lines.length ? 'Choose your product options' : 'Your bag is empty'}
    description="Review your bag before continuing." action={<button className="jl-primary" onClick={edit}>Review bag</button>} />;
  return <form className="jl-form" onSubmit={submit}>
    <div className="jl-summary"><div><span>{lines.reduce((sum, line) => sum + line.quantity, 0)} {lines.reduce((sum, line) => sum + line.quantity, 0) === 1 ? 'item' : 'items'}</span><strong>{subtotal(lines)}</strong></div>
      <p>{practice ? 'This is a walkthrough. No payment or merchant notification.' : 'One order per merchant. Delivery charges may apply.'}</p></div>
    <fieldset className="jl-fulfillment"><legend>How will you get it?</legend>
      <label><input type="radio" name="fulfillment" checked={fulfillment === 'PICKUP'} onChange={() => setFulfillment('PICKUP')} /><Store size={19} /> Pickup</label>
      <label><input type="radio" name="fulfillment" checked={fulfillment === 'DELIVERY'} onChange={() => setFulfillment('DELIVERY')} /><MapPin size={19} /> Delivery</label>
    </fieldset>
    <label className="jl-field"><span>Full name</span><input name="name" autoComplete={practice ? 'off' : 'name'} placeholder="Your name" defaultValue={practice ? 'Demo shopper' : ''} readOnly={practice} required /></label>
    <label className="jl-field"><span>Phone number</span><input name="phone" type="tel" autoComplete={practice ? 'off' : 'tel'} placeholder="+255" defaultValue={practice ? '+255 ••• ••• •••' : ''} readOnly={practice} required /></label>
    {fulfillment === 'DELIVERY' && <label className="jl-field"><span>Delivery address</span><input name="address" autoComplete={practice ? 'off' : 'street-address'} defaultValue={practice ? 'Sample address, Dar es Salaam' : ''} readOnly={practice} required /></label>}
    {!practice && <>
      <label className="jl-field"><span>Order note <small>Optional</small></span><textarea name="note" rows={2} /></label>
      <label className="jl-field"><span>Creator code <small>Optional</small></span><input name="promo" placeholder={promoHint || 'Enter code'} /></label>
    </>}
    {error && <p className="jl-error" role="alert">{error}</p>}
    <button className="jl-primary jl-wide" disabled={sending} type="submit">{sending ? <Loader2 size={18} className="animate-spin" /> : practice ? <Check size={18} /> : <Send size={18} />}
      {practice ? 'Finish practice order' : 'Send order'}</button>
  </form>;
}

function VerticalPage({ vertical, query, setQuery, carFilters, setCarFilters, properties, cars, journeys }: {
  vertical: Vertical; query: string; setQuery: (value: string) => void; carFilters: CarFilters; setCarFilters: (filters: CarFilters) => void;
  properties: ReturnType<typeof useListings<PropertyCard>>; cars: ReturnType<typeof useListings<CarCard>>; journeys: ReturnType<typeof useListings<Journey>>;
}) {
  const [propertyView, setPropertyView] = useState<'real-estate' | 'centres' | 'vacancies'>('real-estate');
  const fields = {
    properties: { title: 'Explore properties', description: 'Find homes, land and commercial spaces for rent or sale.', placeholder: 'Property type, building or neighbourhood', empty: 'No properties found', detail: 'Commercial spaces and shop directories appear here when published.' },
    cars: { title: 'Find your next car', description: 'Browse dealer listings and arrange a showroom visit.', placeholder: 'Try Toyota Prado', empty: 'No matching vehicles', detail: 'Try another model or adjust the filters.' },
    transport: { title: 'Find a journey', description: 'Search bus routes and check departure times and seats.', placeholder: 'Destination, e.g. Arusha', empty: 'No journeys found', detail: 'Search another destination or check back as operators publish trips.' },
  }[vertical];
  const market = markets.find(({ id }) => id === vertical)!;
  const Icon = market.icon;
  const request = vertical === 'properties' ? properties : vertical === 'cars' ? cars : journeys;
  return <div className="jl-content">
    <div className={`jl-vertical-hero jl-${market.color}`}>
      <Icon size={27} /><PageTitle kicker={`MARKETPLACE / ${market.label.toUpperCase()}`} title={fields.title} description={fields.description} />
    </div>
    <SearchBox label={`Search ${vertical}`} value={query} onChange={setQuery} placeholder={fields.placeholder} />
    {vertical === 'cars' && <CarFilterBar filters={carFilters} setFilters={setCarFilters} />}
    {vertical === 'properties' && <div className="mt-4 flex flex-wrap gap-2">
      <button aria-pressed={propertyView === 'real-estate'} onClick={() => setPropertyView('real-estate')} className="rounded-full border px-4 py-2 text-sm font-bold">Rent or buy</button>
      <button aria-pressed={propertyView === 'centres'} onClick={() => setPropertyView('centres')} className="rounded-full border px-4 py-2 text-sm font-bold">Shopping centres</button>
      <button aria-pressed={propertyView === 'vacancies'} onClick={() => setPropertyView('vacancies')} className="rounded-full border px-4 py-2 text-sm font-bold">Managed rental vacancies</button>
    </div>}
    {vertical === 'properties' && propertyView === 'real-estate' ? <JumlaRealEstate query={query} /> :
      vertical === 'properties' && propertyView === 'vacancies' ? <PropertyVacancies query={query} /> :
      request.rows.length ? vertical === 'properties' ? <Properties rows={properties.rows} /> : vertical === 'cars' ? <Cars rows={cars.rows} /> : <Transport rows={journeys.rows} />
      : <ListingStatus request={request} empty={<EmptyState icon={Icon} title={fields.empty} description={fields.detail} />} />}
  </div>;
}
function Properties({ rows }: { rows: PropertyCard[] }) { return <div className="mt-6 grid md:grid-cols-2 xl:grid-cols-3 gap-5">{rows.map((p) => <article key={p.id} className="bg-white rounded-3xl overflow-hidden border"><img src={publicAssetUrl(p.imageUrl) || fallback} className="w-full h-44 object-cover" /><div className="p-5"><h3 className="text-xl font-black">{p.name}</h3><p className="text-sm text-slate-500 inline-flex items-center gap-1 mt-1"><MapPin className="h-4 w-4" />{p.address}, {p.city}</p><div className="mt-4 flex flex-wrap gap-2">{p.claimedShops.slice(0, 8).map((s) => <a key={s.shopCode} href={s.business ? `${s.business.tier === 'LITE' ? '/lite-shop' : '/shop'}/${s.business.publicSlug}` : '#'} className="rounded-xl bg-emerald-50 px-3 py-2 text-xs"><b>{s.shopCode}</b><span className="block text-slate-500">{s.business?.name || s.categoryId || 'Shop'}</span></a>)}</div><p className="mt-3 text-xs text-slate-400">{p.claimedShops.length} active merchants · {p.totalShops} shop units</p></div></article>)}{!rows.length && <Empty title="No commercial properties found" />}</div>; }

function CarFilterBar({ filters, setFilters }: { filters: CarFilters; setFilters: (value: CarFilters) => void }) { const fields: Array<[keyof CarFilters, string]> = [['make', 'Make'], ['model', 'Model'], ['minYear', 'From year'], ['maxPrice', 'Max price'], ['maxMileage', 'Max mileage'], ['location', 'Location'], ['transmission', 'Transmission'], ['fuel', 'Fuel'], ['bodyType', 'Body'], ['condition', 'Condition'], ['dealer', 'Dealer'], ['color', 'Color']]; return <details className="mt-5 rounded-2xl bg-white border p-4"><summary className="cursor-pointer font-black inline-flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" /> Car filters</summary><div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">{fields.map(([key, label]) => <input key={key} value={filters[key] || ''} onChange={(event) => setFilters({ ...filters, [key]: event.target.value })} placeholder={label} className="h-10 rounded-xl border px-3 text-sm" />)}<select value={filters.financing || ''} onChange={(event) => setFilters({ ...filters, financing: event.target.value })} className="h-10 rounded-xl border px-3 text-sm"><option value="">Any financing</option><option value="true">Financing available</option></select><button onClick={() => setFilters({ make: '', model: '', minYear: '', maxPrice: '', maxMileage: '', location: '', transmission: '', fuel: '', bodyType: '', condition: '', financing: '', dealer: '', color: '' })} className="h-10 rounded-xl bg-slate-100 text-sm font-bold">Clear</button></div></details>; }

function Cars({ rows }: { rows: CarCard[] }) {
  const [selected, setSelected] = useState<CarCard | null>(null);
  const [buyer, setBuyer] = useState({ customerName: '', customerPhone: '', customerWhatsapp: '', customerEmail: '', requestType: 'OUTRIGHT' as 'OUTRIGHT' | 'RESERVE' | 'FINANCE', offerAmount: '', preferredContact: 'PHONE', tradeInDetails: '', message: '' });
  const [visit, setVisit] = useState({ customerName: '', customerPhone: '', customerWhatsapp: '', customerEmail: '', appointmentType: 'SHOWROOM' as 'SHOWROOM' | 'TEST_DRIVE', scheduledFor: '', message: '' });
  const [panel, setPanel] = useState<'PURCHASE' | 'VISIT'>('PURCHASE');
  const [done, setDone] = useState('');
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; count: number; min: number; max: number }>();
    for (const car of rows) {
      const key = car.modelGroupKey || `${car.make.toLowerCase()}::${car.model.toLowerCase()}`;
      const price = Number(car.price);
      const row = map.get(key);
      if (row) { row.count += 1; row.min = Math.min(row.min, price); row.max = Math.max(row.max, price); }
      else map.set(key, { key, label: `${car.make} ${car.model}`, count: 1, min: price, max: price });
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [rows]);
  const save = (car: CarCard) => { const current = JSON.parse(localStorage.getItem('jumla_saved_cars') || '[]') as string[]; localStorage.setItem('jumla_saved_cars', JSON.stringify([...new Set([...current, car.id])])); setDone(`${car.make} ${car.model} saved.`); };
  const share = async (car: CarCard) => { const url = `${location.origin}/jumla?car=${car.id}`; if (navigator.share) await navigator.share({ title: `${car.year} ${car.make} ${car.model}`, text: car.aiSalesCopy, url }); else await navigator.clipboard.writeText(url); };
  return <>
    {groups.length > 0 && <div className="mt-6 max-w-3xl mx-auto"><p className="text-xs font-black uppercase tracking-[.15em] text-emerald-700">Model matches</p><div className="mt-2 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">{groups.map((group) => <div key={group.key} className="min-w-[220px] rounded-2xl border bg-white p-3"><b>{group.label}</b><span className="block text-xs text-slate-500 mt-1">{group.count} listing{group.count === 1 ? '' : 's'} · {money(group.min)}{group.max !== group.min ? ` – ${money(group.max)}` : ''}</span></div>)}</div></div>}
    <div className="mt-4 max-w-3xl mx-auto space-y-5 snap-y snap-mandatory">{rows.map((car) => { const whatsapp = (car.dealer.whatsapp || car.dealer.phone || '').replace(/\D/g, ''); return <article key={car.id} className="min-h-[calc(100vh-12rem)] snap-start bg-white rounded-[2rem] overflow-hidden border shadow-sm flex flex-col"><div className="relative"><img src={publicAssetUrl(car.media[0]?.url) || fallback} className="w-full h-[46vh] min-h-72 object-cover" /><span className="absolute top-4 left-4 rounded-full bg-black/70 text-white px-3 py-1 text-xs font-black">{car.status.replace(/_/g, ' ')}</span><div className="absolute top-4 right-4 flex gap-2"><button onClick={() => save(car)} aria-label="Save car" className="h-10 w-10 rounded-full bg-white/90 grid place-items-center"><Bookmark className="h-4 w-4" /></button><button onClick={() => void share(car)} aria-label="Share car" className="h-10 w-10 rounded-full bg-white/90 grid place-items-center"><Share2 className="h-4 w-4" /></button></div></div><div className="p-5 sm:p-7 flex-1"><p className="text-xs font-black text-emerald-700">{car.condition} · {car.year} · {car.location}</p><div className="flex items-start justify-between gap-4"><div><h3 className="text-2xl sm:text-3xl font-black">{car.make} {car.model}{car.trim ? ` ${car.trim}` : ''}</h3><p className="text-sm text-slate-500 mt-1">{car.mileage.toLocaleString()} km · {car.transmission} · {car.fuel}{car.engine ? ` · ${car.engine}` : ''}{car.driveType ? ` · ${car.driveType}` : ''}</p></div><p className="text-xl sm:text-2xl font-black whitespace-nowrap">{money(car.price, car.currency)}</p></div><div className="mt-3 flex flex-wrap gap-2">{(car.listing?.highlights || car.features || []).slice(0, 6).map((item, idx) => <span key={`${item}-${idx}`} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">{item}</span>)}</div><p className="mt-3 text-sm text-slate-600">{car.listing?.socialCaption || car.aiSalesCopy}</p><p className="mt-3 text-xs font-bold text-slate-500">Dealer: {car.dealer.name}{car.financingAvailable ? ' · Financing available' : ''}{car.negotiable ? ' · Negotiable' : ''}</p><div className="mt-5 grid grid-cols-5 gap-2"><button onClick={() => save(car)} className="h-11 rounded-xl bg-slate-100 text-xs font-black inline-flex items-center justify-center gap-1"><Bookmark className="h-4 w-4" /> Save</button><button onClick={() => void share(car)} className="h-11 rounded-xl bg-slate-100 text-xs font-black inline-flex items-center justify-center gap-1"><Share2 className="h-4 w-4" /> Share</button><a href={whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(`I saw the ${car.year} ${car.make} ${car.model} on Jumla`)}` : '#'} className="h-11 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-black inline-flex items-center justify-center gap-1"><MessageCircle className="h-4 w-4" /> Chat</a><a href={`tel:${car.dealer.phone}`} className="h-11 rounded-xl bg-slate-100 text-xs font-black inline-flex items-center justify-center gap-1"><Phone className="h-4 w-4" /> Call</a><a href={car.dealer.dealerSiteUrl || (car.dealer.publicSlug ? `https://${car.dealer.publicSlug}.kobeapptz.com` : '#')} className="h-11 rounded-xl bg-slate-900 text-white text-xs font-black inline-flex items-center justify-center gap-1"><Store className="h-4 w-4" /> Dealer</a></div><button onClick={() => { setSelected(car); setDone(''); setPanel(car.canBuy ? 'PURCHASE' : 'VISIT'); }} className="mt-3 w-full h-12 rounded-xl bg-[#071d18] text-white font-black">{car.canBuy ? 'Buy / Reserve / Finance / Visit' : car.canSchedule ? 'Book showroom / test drive' : car.status.replace(/_/g, ' ')}</button></div></article>; })}{!rows.length && <Empty title="No matching cars found" />}</div>
    {selected && <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4"><div className="w-full max-w-xl max-h-[95vh] overflow-y-auto rounded-3xl bg-white p-5"><button onClick={() => setSelected(null)} className="float-right"><X /></button><h3 className="text-xl font-black">{selected.year} {selected.make} {selected.model}{selected.trim ? ` ${selected.trim}` : ''}</h3><p className="text-sm text-slate-500">Dealer: {selected.dealer.name} · {selected.status.replace(/_/g, ' ')}</p><div className="mt-3 grid grid-cols-3 gap-2 text-xs">{[['Mileage', `${selected.mileage.toLocaleString()} km`], ['Engine', selected.engine || '—'], ['Drive', selected.driveType || '—'], ['Transmission', selected.transmission || '—'], ['Fuel', selected.fuel || '—'], ['Color', selected.color || '—']].map(([k,v]) => <div key={k} className="rounded-xl bg-slate-50 p-2"><small className="text-slate-400">{k}</small><b className="block mt-1">{v}</b></div>)}</div><div className="mt-4 grid grid-cols-2 gap-2"><button disabled={!selected.canBuy} onClick={() => setPanel('PURCHASE')} className={`h-10 rounded-xl text-xs font-black border disabled:opacity-30 ${panel === 'PURCHASE' ? 'bg-[#071d18] text-white' : ''}`}>Purchase / reserve</button><button disabled={!selected.canSchedule} onClick={() => setPanel('VISIT')} className={`h-10 rounded-xl text-xs font-black border disabled:opacity-30 ${panel === 'VISIT' ? 'bg-[#071d18] text-white' : ''}`}><CalendarDays className="inline h-3.5 w-3.5 mr-1" /> Showroom / test drive</button></div>{panel === 'PURCHASE' ? <><div className="mt-4 grid grid-cols-3 gap-2">{(['OUTRIGHT', 'RESERVE', 'FINANCE'] as const).map((type) => <button key={type} disabled={!selected.canBuy || (type === 'FINANCE' && !selected.financingAvailable)} onClick={() => setBuyer({ ...buyer, requestType: type })} className={`h-10 rounded-xl text-xs font-black border disabled:opacity-30 ${buyer.requestType === type ? 'bg-emerald-700 text-white' : ''}`}>{type === 'OUTRIGHT' ? 'Buy outright' : type === 'RESERVE' ? 'Reserve' : 'Finance'}</button>)}</div><input className="mt-4 w-full h-11 rounded-xl border px-3" placeholder="Your name" value={buyer.customerName} onChange={(e) => setBuyer({ ...buyer, customerName: e.target.value })} /><div className="grid grid-cols-2 gap-2"><input className="mt-2 w-full h-11 rounded-xl border px-3" placeholder="Phone" value={buyer.customerPhone} onChange={(e) => setBuyer({ ...buyer, customerPhone: e.target.value })} /><input className="mt-2 w-full h-11 rounded-xl border px-3" placeholder="WhatsApp" value={buyer.customerWhatsapp} onChange={(e) => setBuyer({ ...buyer, customerWhatsapp: e.target.value })} /></div><input className="mt-2 w-full h-11 rounded-xl border px-3" placeholder="Email (optional)" value={buyer.customerEmail} onChange={(e) => setBuyer({ ...buyer, customerEmail: e.target.value })} /><div className="grid grid-cols-2 gap-2"><input className="mt-2 w-full h-11 rounded-xl border px-3" type="number" placeholder="Your offer (optional)" value={buyer.offerAmount} onChange={(e) => setBuyer({ ...buyer, offerAmount: e.target.value })} /><select className="mt-2 w-full h-11 rounded-xl border px-3" value={buyer.preferredContact} onChange={(e) => setBuyer({ ...buyer, preferredContact: e.target.value })}><option value="PHONE">Call me</option><option value="WHATSAPP">WhatsApp</option><option value="SMS">SMS</option><option value="EMAIL">Email</option></select></div><textarea className="mt-2 w-full rounded-xl border p-3" placeholder="Trade-in details (optional)" value={buyer.tradeInDetails} onChange={(e) => setBuyer({ ...buyer, tradeInDetails: e.target.value })} /><textarea className="mt-2 w-full rounded-xl border p-3" placeholder="Message" value={buyer.message} onChange={(e) => setBuyer({ ...buyer, message: e.target.value })} /><button disabled={!buyer.customerName || !buyer.customerPhone || !selected.canBuy} onClick={async () => { const r = await publicApi<{ reservation: { reservationCode: string } | null }>(`/commerce-public/cars/${selected.id}/request`, { method: 'POST', body: JSON.stringify({ ...buyer, offerAmount: buyer.offerAmount ? Number(buyer.offerAmount) : undefined }) }); setDone(r.reservation ? `Reserved for 30 minutes: ${r.reservation.reservationCode}` : 'Purchase request sent to the dealer and ERP CRM'); }} className="mt-3 w-full h-11 rounded-xl bg-emerald-700 text-white font-black disabled:opacity-40">Send Purchase Request</button></> : <><div className="mt-4 grid grid-cols-2 gap-2"><button onClick={() => setVisit({ ...visit, appointmentType: 'SHOWROOM' })} className={`h-10 rounded-xl border text-xs font-black ${visit.appointmentType === 'SHOWROOM' ? 'bg-emerald-700 text-white' : ''}`}>Showroom visit</button><button onClick={() => setVisit({ ...visit, appointmentType: 'TEST_DRIVE' })} className={`h-10 rounded-xl border text-xs font-black ${visit.appointmentType === 'TEST_DRIVE' ? 'bg-emerald-700 text-white' : ''}`}>Test drive</button></div><input className="mt-3 w-full h-11 rounded-xl border px-3" placeholder="Your name" value={visit.customerName} onChange={(e) => setVisit({ ...visit, customerName: e.target.value })} /><div className="grid grid-cols-2 gap-2"><input className="mt-2 h-11 rounded-xl border px-3" placeholder="Phone" value={visit.customerPhone} onChange={(e) => setVisit({ ...visit, customerPhone: e.target.value })} /><input className="mt-2 h-11 rounded-xl border px-3" placeholder="WhatsApp" value={visit.customerWhatsapp} onChange={(e) => setVisit({ ...visit, customerWhatsapp: e.target.value })} /></div><input className="mt-2 w-full h-11 rounded-xl border px-3" placeholder="Email (optional)" value={visit.customerEmail} onChange={(e) => setVisit({ ...visit, customerEmail: e.target.value })} /><input type="datetime-local" className="mt-2 w-full h-11 rounded-xl border px-3" value={visit.scheduledFor} onChange={(e) => setVisit({ ...visit, scheduledFor: e.target.value })} /><textarea className="mt-2 w-full rounded-xl border p-3" placeholder="Message (optional)" value={visit.message} onChange={(e) => setVisit({ ...visit, message: e.target.value })} /><button disabled={!visit.customerName || !visit.customerPhone || !visit.scheduledFor || !selected.canSchedule} onClick={async () => { const r = await publicApi<{ appointment: { id: string } }>(`/commerce-public/cars/${selected.id}/appointments`, { method: 'POST', body: JSON.stringify(visit) }); setDone(`${visit.appointmentType === 'TEST_DRIVE' ? 'Test drive' : 'Showroom visit'} requested: ${r.appointment.id.slice(0,8).toUpperCase()}`); }} className="mt-3 w-full h-11 rounded-xl bg-emerald-700 text-white font-black disabled:opacity-40">Book appointment</button></>}{done && <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-emerald-700 font-bold">{done}</p>}</div></div>}
  </>;
}

function Transport({ rows }: { rows: Journey[] }) { return <div className="mt-6 space-y-3">{rows.map((row) => <article key={row.trip.id} className="bg-white rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center gap-4"><div className="h-12 w-12 rounded-xl bg-cyan-50 text-cyan-700 grid place-items-center"><BusFront /></div><div className="flex-1"><h3 className="font-black">{row.trip.origin} → {row.trip.destination}</h3><p className="text-sm text-slate-500">{row.operator} · {row.bus} · {new Date(row.trip.scheduledDeparture).toLocaleString()}</p></div><div><b className="block text-emerald-700">{row.availableSeats} seats</b><button disabled={!row.canBuy} onClick={async () => { const name = prompt('Passenger name'); const phone = prompt('Phone number'); const seat = prompt('Seat number'); if (name && phone && seat) await publicApi(`/transit-public/trips/${row.trip.id}/tickets`, { method: 'POST', body: JSON.stringify({ passengerName: name, passengerPhone: phone, seatNumber: seat, fare: 0 }) }); }} className="mt-1 h-9 px-4 rounded-xl bg-[#071d18] text-white text-xs font-black disabled:opacity-40">Buy Ticket</button></div></article>)}{!rows.length && <Empty title="No matching journeys" />}</div>; }
function Empty({ title }: { title: string }) { return <div className="col-span-full py-24 text-center text-slate-400"><PackageSearch className="h-10 w-10 mx-auto mb-3" /><b>{title}</b></div>; }
