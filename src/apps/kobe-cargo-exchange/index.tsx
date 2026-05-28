import { useState, useMemo, useCallback } from 'react';
import {
  PlaneTakeoff, PlaneLanding, Package, Users, BarChart3,
  Search, Plus, CheckCircle2, XCircle, Clock, AlertTriangle,
  ChevronRight, ArrowRight, Star, Shield, Zap, TrendingUp,
  TrendingDown, DollarSign, Scale, MessageSquare, RefreshCw,
  Upload, Eye, Lock, Unlock, Filter, Globe, MapPin,
  Plane, Navigation, Activity, Award, ThumbsUp, ThumbsDown,
} from 'lucide-react';
import type {
  PassengerListing, Agent, Deal, Negotiation, NegotiationOffer,
  FlightRoute, FinanceSummary, TrustTier,
} from './types';
import { MAX_BARGAIN_AGENTS } from './types';
import {
  DEMO_AGENTS, DEMO_LISTINGS, DEMO_DEALS, DEMO_ROUTES, COMMON_ROUTES,
} from './demo-data';

// ── Helpers ───────────────────────────────────────────────────────────────────

function usd(n: number) { return `$${n.toFixed(2)}`; }
function usdK(n: number) { return n >= 1000 ? `$${(n/1000).toFixed(1)}K` : `$${n.toFixed(0)}`; }

const STATUS_COLORS: Record<string, string> = {
  scheduled:   'bg-blue-500/20 text-blue-300 border-blue-500/30',
  departed:    'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  transit:     'bg-orange-500/20 text-orange-300 border-orange-500/30',
  arrived:     'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  delayed:     'bg-red-500/20 text-red-300 border-red-500/30',
  cancelled:   'bg-red-700/20 text-red-400 border-red-700/30',
  available:   'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  negotiating: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  sold:        'bg-violet-500/20 text-violet-300 border-violet-500/30',
  expired:     'bg-white/10 text-white/40 border-white/10',
  open:        'bg-blue-500/20 text-blue-300 border-blue-500/30',
  pending:     'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  accepted:    'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  rejected:    'bg-red-500/20 text-red-300 border-red-500/30',
  countered:   'bg-orange-500/20 text-orange-300 border-orange-500/30',
  locked:      'bg-white/10 text-white/40 border-white/10',
  active:      'bg-blue-500/20 text-blue-300 border-blue-500/30',
  completed:   'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  disputed:    'bg-red-500/20 text-red-300 border-red-500/30',
};

const TRUST_COLORS: Record<TrustTier, string> = {
  new:      'bg-white/10 text-white/50',
  verified: 'bg-blue-500/20 text-blue-300',
  trusted:  'bg-violet-500/20 text-violet-300',
  elite:    'bg-yellow-500/20 text-yellow-300',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border capitalize ${STATUS_COLORS[status] ?? 'bg-white/10 text-white/50 border-white/10'}`}>
      {status}
    </span>
  );
}

function TrustBadge({ tier, score }: { tier: TrustTier; score: number }) {
  return (
    <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${TRUST_COLORS[tier]}`}>
      <Shield className="w-3 h-3" />{score} · {tier}
    </span>
  );
}

type View = 'dashboard' | 'marketplace' | 'negotiate' | 'flights' | 'finance' | 'trust' | 'new-listing';

// ── Root Shell ────────────────────────────────────────────────────────────────

export default function KobeCargoExchange() {
  const [view, setView] = useState<View>('dashboard');
  const [listings, setListings] = useState<PassengerListing[]>(DEMO_LISTINGS);
  const [deals, setDeals] = useState<Deal[]>(DEMO_DEALS);
  const [selectedListing, setSelectedListing] = useState<PassengerListing | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

  const nav = [
    { id: 'dashboard',   label: 'Dashboard',   icon: BarChart3 },
    { id: 'marketplace', label: 'Marketplace',  icon: Users },
    { id: 'negotiate',   label: 'Negotiate',    icon: MessageSquare },
    { id: 'flights',     label: 'Flights',      icon: PlaneTakeoff },
    { id: 'finance',     label: 'Finance',      icon: DollarSign },
    { id: 'trust',       label: 'Trust Scores', icon: Shield },
  ] as const;

  return (
    <div className="flex h-full w-full bg-[#080814] text-white overflow-hidden">
      {/* Sidebar */}
      <aside className="w-52 bg-[#0b0b1a] border-r border-white/[0.06] flex flex-col shrink-0">
        <div className="px-4 pt-5 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center">
              <PlaneTakeoff className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <div className="text-xs font-bold text-white leading-tight">KOBE CARGO</div>
              <div className="text-[10px] text-white/30">Exchange</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {nav.map(item => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button key={item.id} onClick={() => setView(item.id as View)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ${active ? 'bg-sky-500/15 text-sky-300 border border-sky-500/20' : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'}`}>
                <Icon className="w-3.5 h-3.5 shrink-0" />{item.label}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/[0.06]">
          <button onClick={() => setView('new-listing')}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-colors">
            <Plus className="w-3.5 h-3.5" />New Listing
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-hidden">
        {view === 'dashboard'   && <DashboardView deals={deals} listings={listings} onNavigate={setView} />}
        {view === 'marketplace' && <MarketplaceView listings={listings} setListings={setListings} onNegotiate={l => { setSelectedListing(l); setView('negotiate'); }} />}
        {view === 'negotiate'   && <NegotiateView listing={selectedListing} listings={listings} setListings={setListings} deals={deals} setDeals={setDeals} />}
        {view === 'flights'     && <FlightsView routes={DEMO_ROUTES} deals={deals} />}
        {view === 'finance'     && <FinanceView deals={deals} setDeals={setDeals} />}
        {view === 'trust'       && <TrustView agents={DEMO_AGENTS} listings={listings} />}
        {view === 'new-listing' && <NewListingView onSave={l => { setListings(prev => [l, ...prev]); setView('marketplace'); }} onCancel={() => setView('marketplace')} />}
      </main>
    </div>
  );
}

// ── Dashboard View ────────────────────────────────────────────────────────────

function DashboardView({ deals, listings, onNavigate }: { deals: Deal[]; listings: PassengerListing[]; onNavigate: (v: View) => void }) {
  const summary: FinanceSummary = useMemo(() => {
    const completed = deals.filter(d => d.status === 'completed');
    const active = deals.filter(d => d.status === 'active');
    const totalSpend = deals.reduce((s, d) => s + d.bulkBuyAmountUsd, 0);
    const totalRev = completed.reduce((s, d) => s + d.totalRevenueUsd, 0);
    const totalGross = completed.reduce((s, d) => s + d.grossProfitUsd, 0);
    const totalNet = completed.reduce((s, d) => s + d.netProfitUsd, 0);
    const totalKgB = deals.reduce((s, d) => s + d.kgPurchased, 0);
    const totalKgS = completed.reduce((s, d) => s + d.totalKgSold, 0);
    return {
      totalBulkSpendUsd: totalSpend, totalRevenueUsd: totalRev,
      totalGrossProfitUsd: totalGross, totalNetProfitUsd: totalNet,
      avgMarginPct: completed.length ? completed.reduce((s,d) => s+d.marginPct,0)/completed.length : 0,
      totalKgBought: totalKgB, totalKgSold: totalKgS,
      avgCostPerKgUsd: totalKgB ? totalSpend/totalKgB : 0,
      avgSellPerKgUsd: totalKgS ? totalRev/totalKgS : 0,
      activeDeals: active.length, completedDeals: completed.length,
      pendingNegotiations: listings.filter(l => l.status === 'negotiating').length,
    };
  }, [deals, listings]);

  const kpis = [
    { label:'Total Bulk Spend', value: usdK(summary.totalBulkSpendUsd), sub:'paid to passengers', icon:<DollarSign className="w-5 h-5 text-red-400"/>, color:'border-red-500/20 bg-red-500/[0.04]' },
    { label:'Total Revenue', value: usdK(summary.totalRevenueUsd), sub:'charged to customers', icon:<TrendingUp className="w-5 h-5 text-emerald-400"/>, color:'border-emerald-500/20 bg-emerald-500/[0.04]' },
    { label:'Net Profit', value: usdK(summary.totalNetProfitUsd), sub:`${summary.avgMarginPct.toFixed(1)}% avg margin`, icon:<BarChart3 className="w-5 h-5 text-sky-400"/>, color:'border-sky-500/20 bg-sky-500/[0.04]' },
    { label:'Avg Cost/KG', value: usd(summary.avgCostPerKgUsd), sub:`sell @ ${usd(summary.avgSellPerKgUsd)}/kg`, icon:<Scale className="w-5 h-5 text-violet-400"/>, color:'border-violet-500/20 bg-violet-500/[0.04]' },
    { label:'KG Purchased', value: `${summary.totalKgBought}kg`, sub:`${summary.totalKgSold}kg sold`, icon:<Package className="w-5 h-5 text-orange-400"/>, color:'border-orange-500/20 bg-orange-500/[0.04]' },
    { label:'Active Deals', value: String(summary.activeDeals), sub:`${summary.completedDeals} completed`, icon:<Activity className="w-5 h-5 text-yellow-400"/>, color:'border-yellow-500/20 bg-yellow-500/[0.04]' },
  ];

  return (
    <div className="h-full overflow-y-auto p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-white">Kobe Cargo Exchange</h1>
          <p className="text-xs text-white/40 mt-0.5">Air-linked passenger kilo marketplace · Agent P&L dashboard</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onNavigate('marketplace')} className="text-xs px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition-colors flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />Browse Listings
          </button>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {kpis.map(k => (
          <div key={k.label} className={`p-4 rounded-xl border ${k.color}`}>
            <div className="flex items-start justify-between mb-2">{k.icon}<span className="text-[10px] text-white/30">{k.sub}</span></div>
            <div className="text-xl font-bold text-white">{k.value}</div>
            <div className="text-[11px] text-white/50 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Recent deals */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Recent Deals</h2>
          <button onClick={() => onNavigate('finance')} className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1">View all <ChevronRight className="w-3 h-3"/></button>
        </div>
        <div className="space-y-2">
          {deals.slice(0,4).map(d => (
            <div key={d.id} className="flex items-center gap-3 p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
                <Plane className="w-4 h-4 text-sky-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-white">{d.flightNumber}</span>
                  <span className="text-[10px] text-white/40">{d.route}</span>
                  <StatusBadge status={d.flightStatus} />
                </div>
                <div className="text-[10px] text-white/40 mt-0.5">{d.passengerName} · {d.kgPurchased}kg bulk @ {usd(d.bulkBuyAmountUsd)}</div>
              </div>
              <div className="text-right shrink-0">
                <div className={`text-sm font-bold ${d.netProfitUsd >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{usd(d.netProfitUsd)}</div>
                <div className="text-[10px] text-white/30">net profit</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Available listings */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Available Listings</h2>
          <button onClick={() => onNavigate('marketplace')} className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1">Browse <ChevronRight className="w-3 h-3"/></button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {listings.filter(l => l.status === 'available').slice(0,4).map(l => (
            <div key={l.id} className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-white">{l.flightNumber}</span>
                <StatusBadge status={l.status} />
              </div>
              <div className="text-[11px] text-white/50">{l.route} · {l.departureDate}</div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm font-bold text-white">{l.availableKg}kg</span>
                <span className="text-xs text-sky-300">{usd(l.askingPricePerKg)}/kg ask</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Marketplace View ──────────────────────────────────────────────────────────

function MarketplaceView({ listings, setListings, onNegotiate }: { listings: PassengerListing[]; setListings: React.Dispatch<React.SetStateAction<PassengerListing[]>>; onNegotiate: (l: PassengerListing) => void }) {
  const [search, setSearch] = useState('');
  const [routeFilter, setRouteFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const routes = useMemo(() => ['all', ...Array.from(new Set(listings.map(l => `${l.origin}-${l.destination}`)))], [listings]);

  const filtered = useMemo(() => listings.filter(l => {
    const q = search.toLowerCase();
    const ms = !q || l.passengerName.toLowerCase().includes(q) || l.flightNumber.toLowerCase().includes(q) || l.route.toLowerCase().includes(q);
    const mr = routeFilter === 'all' || `${l.origin}-${l.destination}` === routeFilter;
    const mst = statusFilter === 'all' || l.status === statusFilter;
    return ms && mr && mst;
  }), [listings, search, routeFilter, statusFilter]);

  return (
    <div className="h-full overflow-y-auto p-5 space-y-4">
      <div>
        <h2 className="text-base font-bold text-white">Passenger Kilo Marketplace</h2>
        <p className="text-xs text-white/40 mt-0.5">Browse available baggage allowance from verified passengers</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search passenger, flight…"
            className="w-full pl-8 pr-3 py-2 text-xs bg-white/[0.04] border border-white/[0.08] rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-sky-500/50" />
        </div>
        <select value={routeFilter} onChange={e => setRouteFilter(e.target.value)} className="text-xs px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white/70 focus:outline-none">
          {routes.map(r => <option key={r} value={r}>{r === 'all' ? 'All Routes' : r}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-xs px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white/70 focus:outline-none">
          <option value="all">All Status</option>
          <option value="available">Available</option>
          <option value="negotiating">Negotiating</option>
          <option value="sold">Sold</option>
        </select>
      </div>

      {/* Listings grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {filtered.map(l => <ListingCard key={l.id} listing={l} onNegotiate={onNegotiate} />)}
      </div>
      {filtered.length === 0 && (
        <div className="text-center py-16 text-white/30">
          <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No listings match your filters</p>
        </div>
      )}
    </div>
  );
}

function ListingCard({ listing: l, onNegotiate }: { listing: PassengerListing; onNegotiate: (l: PassengerListing) => void }) {
  const pct = Math.round((l.availableKg / l.totalAllowedKg) * 100);
  const canNegotiate = !l.bargainLocked && l.status !== 'sold' && l.status !== 'expired';
  return (
    <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl hover:border-white/[0.1] transition-all">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">{l.flightNumber}</span>
            {l.ticketVerified && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
            <StatusBadge status={l.status} />
          </div>
          <div className="text-xs text-white/40 mt-0.5">{l.route} · {l.departureDate}</div>
        </div>
        <TrustBadge tier={l.trustTier} score={l.trustScore} />
      </div>

      {/* Passenger */}
      <div className="flex items-center gap-2 mb-3 p-2 bg-white/[0.03] rounded-lg">
        <div className="w-7 h-7 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-300 text-xs font-bold">{l.passengerName[0]}</div>
        <div>
          <div className="text-xs font-medium text-white">{l.passengerName}</div>
          <div className="text-[10px] text-white/40">{l.airline}</div>
        </div>
      </div>

      {/* KG bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] text-white/40 mb-1">
          <span>{l.availableKg}kg available of {l.totalAllowedKg}kg</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <div className="h-full bg-sky-500 rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Price + bargain state */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] text-white/40">Asking price</div>
          <div className="text-sm font-bold text-white">{usd(l.askingPricePerKg)}<span className="text-white/40 font-normal text-[10px]">/kg</span></div>
          <div className="text-[10px] text-white/30 mt-0.5">
            {l.bargainLocked
              ? <span className="flex items-center gap-1 text-red-400"><Lock className="w-3 h-3"/>Bargaining locked (3/3)</span>
              : <span className="flex items-center gap-1 text-white/40"><Unlock className="w-3 h-3"/>{l.bargainCount}/{MAX_BARGAIN_AGENTS} agents</span>}
          </div>
        </div>
        <button onClick={() => onNegotiate(l)} disabled={!canNegotiate}
          className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${canNegotiate ? 'bg-sky-600 hover:bg-sky-500 text-white' : 'bg-white/[0.05] text-white/30 cursor-not-allowed'}`}>
          {l.bargainLocked ? 'Locked' : 'Negotiate'}
        </button>
      </div>
    </div>
  );
}

// ── Negotiation Engine View ───────────────────────────────────────────────────

function NegotiateView({ listing, listings, setListings, deals, setDeals }: {
  listing: PassengerListing | null;
  listings: PassengerListing[];
  setListings: React.Dispatch<React.SetStateAction<PassengerListing[]>>;
  deals: Deal[];
  setDeals: React.Dispatch<React.SetStateAction<Deal[]>>;
}) {
  const [selectedListingId, setSelectedListingId] = useState<string>(listing?.id ?? listings[0]?.id ?? '');
  const [offerAmount, setOfferAmount] = useState('');
  const [offerKg, setOfferKg] = useState('');
  const [message, setMessage] = useState('');
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [selectedAgent] = useState<Agent>(DEMO_AGENTS[0]);

  const activeListing = listings.find(l => l.id === selectedListingId) ?? listing ?? listings[0];

  const activeNeg = negotiations.find(n => n.listingId === activeListing?.id && n.agentId === selectedAgent.id);

  const sendOffer = useCallback(() => {
    if (!activeListing || !offerAmount || !offerKg) return;
    const amount = parseFloat(offerAmount);
    const kg = parseFloat(offerKg);
    if (isNaN(amount) || isNaN(kg)) return;

    const offer: NegotiationOffer = {
      id: `o${Date.now()}`, fromRole: 'agent', amountUsd: amount, kgIncluded: kg,
      message: message || undefined, timestamp: new Date().toISOString(),
    };

    if (activeNeg) {
      setNegotiations(prev => prev.map(n => n.id === activeNeg.id
        ? { ...n, offers: [...n.offers, offer], status: 'pending', updatedAt: new Date().toISOString() }
        : n));
    } else {
      // First offer — increment bargain count
      const newNeg: Negotiation = {
        id: `neg${Date.now()}`, listingId: activeListing.id, agentId: selectedAgent.id,
        agentName: selectedAgent.companyName, passengerId: activeListing.passengerId,
        status: 'pending', offers: [offer],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      setNegotiations(prev => [...prev, newNeg]);
      setListings(prev => prev.map(l => l.id === activeListing.id ? {
        ...l,
        bargainCount: l.bargainCount + 1,
        bargainLocked: l.bargainCount + 1 >= MAX_BARGAIN_AGENTS,
        status: 'negotiating',
        negotiations: [...l.negotiations, newNeg],
      } : l));
    }
    setOfferAmount(''); setOfferKg(''); setMessage('');
  }, [activeListing, activeNeg, offerAmount, offerKg, message, selectedAgent, setListings]);

  const acceptOffer = useCallback((negId: string) => {
    const neg = negotiations.find(n => n.id === negId);
    if (!neg || !activeListing) return;
    const lastOffer = neg.offers[neg.offers.length - 1];
    setNegotiations(prev => prev.map(n => n.id === negId ? { ...n, status: 'accepted', agreedAmountUsd: lastOffer.amountUsd, agreedKg: lastOffer.kgIncluded } : n));
    setListings(prev => prev.map(l => l.id === activeListing.id ? { ...l, status: 'sold' } : l));
    // Create deal
    const newDeal: Deal = {
      id: `d${Date.now()}`, negotiationId: negId, listingId: activeListing.id,
      agentId: selectedAgent.id, agentName: selectedAgent.companyName,
      passengerId: activeListing.passengerId, passengerName: activeListing.passengerName,
      flightNumber: activeListing.flightNumber, route: activeListing.route,
      departureDate: activeListing.departureDate,
      bulkBuyAmountUsd: lastOffer.amountUsd, kgPurchased: lastOffer.kgIncluded,
      effectiveCostPerKgUsd: lastOffer.amountUsd / lastOffer.kgIncluded,
      sellRatePerKgUsd: selectedAgent.sellRatePerKgUsd,
      totalKgSold: 0, totalRevenueUsd: 0,
      grossProfitUsd: -(lastOffer.amountUsd), otherCostsUsd: 0,
      netProfitUsd: -(lastOffer.amountUsd), marginPct: 0,
      status: 'active', flightStatus: 'scheduled',
      createdAt: new Date().toISOString(),
    };
    setDeals(prev => [newDeal, ...prev]);
  }, [negotiations, activeListing, selectedAgent, setListings, setDeals]);

  const rejectOffer = useCallback((negId: string) => {
    setNegotiations(prev => prev.map(n => n.id === negId ? { ...n, status: 'rejected' } : n));
  }, []);

  const counterOffer = useCallback((negId: string, amount: number, kg: number) => {
    const counterOff: NegotiationOffer = {
      id: `o${Date.now()}`, fromRole: 'passenger', amountUsd: amount, kgIncluded: kg,
      message: 'Counter offer', timestamp: new Date().toISOString(),
    };
    setNegotiations(prev => prev.map(n => n.id === negId
      ? { ...n, offers: [...n.offers, counterOff], status: 'countered', updatedAt: new Date().toISOString() }
      : n));
  }, []);

  if (!activeListing) return <div className="p-8 text-white/40 text-sm">No listings available</div>;

  const canSendOffer = !activeListing.bargainLocked && activeListing.status !== 'sold';

  return (
    <div className="h-full overflow-y-auto p-5 space-y-4">
      <div>
        <h2 className="text-base font-bold text-white">Negotiation Engine</h2>
        <p className="text-xs text-white/40 mt-0.5">Bulk deal negotiation · Max {MAX_BARGAIN_AGENTS} agents per passenger</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: listing selector + offer form */}
        <div className="space-y-3">
          {/* Select listing */}
          <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl">
            <label className="text-xs text-white/50 mb-1.5 block">Select Listing</label>
            <select value={selectedListingId} onChange={e => setSelectedListingId(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white focus:outline-none focus:border-sky-500/50">
              {listings.filter(l => l.status !== 'expired').map(l => (
                <option key={l.id} value={l.id}>{l.flightNumber} · {l.route} · {l.availableKg}kg · {usd(l.askingPricePerKg)}/kg ask</option>
              ))}
            </select>
          </div>

          {/* Listing summary */}
          <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">{activeListing.flightNumber}</span>
              <div className="flex gap-2">
                <StatusBadge status={activeListing.status} />
                {activeListing.bargainLocked && <span className="flex items-center gap-1 text-[10px] text-red-400"><Lock className="w-3 h-3"/>Locked</span>}
              </div>
            </div>
            <div className="text-xs text-white/50">{activeListing.route} · Departs {activeListing.departureDate}</div>
            <div className="grid grid-cols-3 gap-2 text-center mt-2">
              <div className="p-2 bg-white/[0.03] rounded-lg"><div className="text-sm font-bold text-white">{activeListing.availableKg}kg</div><div className="text-[10px] text-white/40">Available</div></div>
              <div className="p-2 bg-white/[0.03] rounded-lg"><div className="text-sm font-bold text-sky-300">{usd(activeListing.askingPricePerKg)}</div><div className="text-[10px] text-white/40">Ask/kg</div></div>
              <div className="p-2 bg-white/[0.03] rounded-lg"><div className="text-sm font-bold text-white">{activeListing.bargainCount}/{MAX_BARGAIN_AGENTS}</div><div className="text-[10px] text-white/40">Agents</div></div>
            </div>
          </div>

          {/* Offer form — BULK model */}
          <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl space-y-3">
            <div className="text-xs font-semibold text-white">Make Bulk Offer</div>
            <div className="p-2 bg-sky-500/10 border border-sky-500/20 rounded-lg text-[10px] text-sky-300">
              Agents buy ALL kilos in bulk (e.g. $200 for 30kg). You then charge customers per kg.
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-white/40 mb-1 block">Bulk Amount (USD)</label>
                <input type="number" value={offerAmount} onChange={e => setOfferAmount(e.target.value)} placeholder="e.g. 200"
                  className="w-full text-xs px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-sky-500/50" />
              </div>
              <div>
                <label className="text-[10px] text-white/40 mb-1 block">KG to Buy</label>
                <input type="number" value={offerKg} onChange={e => setOfferKg(e.target.value)} placeholder={`max ${activeListing.availableKg}`}
                  className="w-full text-xs px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-sky-500/50" />
              </div>
            </div>
            {offerAmount && offerKg && (
              <div className="p-2 bg-white/[0.03] rounded-lg text-[10px] space-y-1">
                <div className="flex justify-between"><span className="text-white/40">Effective cost/kg</span><span className="text-white font-medium">{usd(parseFloat(offerAmount)/parseFloat(offerKg))}</span></div>
                <div className="flex justify-between"><span className="text-white/40">Your sell rate</span><span className="text-emerald-400 font-medium">{usd(selectedAgent.sellRatePerKgUsd)}/kg</span></div>
                <div className="flex justify-between"><span className="text-white/40">Est. gross profit</span><span className="text-emerald-400 font-medium">{usd(parseFloat(offerKg)*selectedAgent.sellRatePerKgUsd - parseFloat(offerAmount))}</span></div>
              </div>
            )}
            <input value={message} onChange={e => setMessage(e.target.value)} placeholder="Optional message to passenger…"
              className="w-full text-xs px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-sky-500/50" />
            <button onClick={sendOffer} disabled={!canSendOffer || !offerAmount || !offerKg}
              className={`w-full py-2 rounded-lg text-xs font-medium transition-colors ${canSendOffer && offerAmount && offerKg ? 'bg-sky-600 hover:bg-sky-500 text-white' : 'bg-white/[0.05] text-white/30 cursor-not-allowed'}`}>
              {activeListing.bargainLocked ? 'Bargaining Locked' : 'Send Offer'}
            </button>
          </div>
        </div>

        {/* Right: negotiation thread */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-white">Negotiation Thread</div>
          {activeNeg ? (
            <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/50">Negotiation #{activeNeg.id.slice(-4)}</span>
                <StatusBadge status={activeNeg.status} />
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {activeNeg.offers.map(o => (
                  <div key={o.id} className={`p-2.5 rounded-lg text-xs ${o.fromRole === 'agent' ? 'bg-sky-500/10 border border-sky-500/20 ml-4' : 'bg-white/[0.04] border border-white/[0.08] mr-4'}`}>
                    <div className="flex justify-between mb-1">
                      <span className={`font-medium ${o.fromRole === 'agent' ? 'text-sky-300' : 'text-white'}`}>{o.fromRole === 'agent' ? 'You (Agent)' : 'Passenger'}</span>
                      <span className="text-white/30 text-[10px]">{new Date(o.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-white font-bold">{usd(o.amountUsd)} for {o.kgIncluded}kg</div>
                    <div className="text-white/40 text-[10px]">{usd(o.amountUsd/o.kgIncluded)}/kg effective</div>
                    {o.message && <div className="text-white/50 mt-1 italic">"{o.message}"</div>}
                  </div>
                ))}
              </div>
              {activeNeg.status === 'pending' && (
                <div className="flex gap-2 pt-2 border-t border-white/[0.06]">
                  <button onClick={() => acceptOffer(activeNeg.id)} className="flex-1 py-1.5 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center justify-center gap-1"><CheckCircle2 className="w-3.5 h-3.5"/>Accept</button>
                  <button onClick={() => counterOffer(activeNeg.id, activeNeg.offers[activeNeg.offers.length-1].amountUsd * 1.1, activeNeg.offers[activeNeg.offers.length-1].kgIncluded)} className="flex-1 py-1.5 text-xs rounded-lg bg-orange-600 hover:bg-orange-500 text-white transition-colors flex items-center justify-center gap-1"><RefreshCw className="w-3.5 h-3.5"/>Counter +10%</button>
                  <button onClick={() => rejectOffer(activeNeg.id)} className="flex-1 py-1.5 text-xs rounded-lg bg-red-600/80 hover:bg-red-600 text-white transition-colors flex items-center justify-center gap-1"><XCircle className="w-3.5 h-3.5"/>Reject</button>
                </div>
              )}
              {activeNeg.status === 'accepted' && <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-300 text-center">Deal accepted — {usd(activeNeg.agreedAmountUsd ?? 0)} for {activeNeg.agreedKg}kg</div>}
            </div>
          ) : (
            <div className="p-8 text-center text-white/30 bg-white/[0.02] border border-white/[0.06] rounded-xl">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No active negotiation</p>
              <p className="text-xs mt-1">Send an offer to start</p>
            </div>
          )}

          {/* All negotiations for this listing */}
          {negotiations.filter(n => n.listingId === activeListing.id).length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] text-white/30 uppercase tracking-wider">All Negotiations</div>
              {negotiations.filter(n => n.listingId === activeListing.id).map(n => (
                <div key={n.id} className="flex items-center justify-between p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg text-xs">
                  <span className="text-white/60">{n.agentName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white/40">{n.offers.length} offers</span>
                    <StatusBadge status={n.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Flight Tracker View ───────────────────────────────────────────────────────

const STATUS_ICONS: Record<string, React.ReactNode> = {
  scheduled:  <Clock className="w-4 h-4 text-blue-400" />,
  departed:   <PlaneTakeoff className="w-4 h-4 text-yellow-400" />,
  transit:    <Navigation className="w-4 h-4 text-orange-400" />,
  arrived:    <PlaneLanding className="w-4 h-4 text-emerald-400" />,
  delayed:    <AlertTriangle className="w-4 h-4 text-red-400" />,
  cancelled:  <XCircle className="w-4 h-4 text-red-500" />,
};

function FlightsView({ routes, deals }: { routes: FlightRoute[]; deals: Deal[] }) {
  const [origin, setOrigin] = useState('CAN');
  const [dest, setDest] = useState('DAR');
  const [suggested, setSuggested] = useState<FlightRoute[]>([]);
  const [searched, setSearched] = useState(false);

  const search = () => {
    const results = routes.filter(r =>
      r.legs[0].from.code === origin && r.legs[r.legs.length-1].to.code === dest
    );
    setSuggested(results.length > 0 ? results : routes);
    setSearched(true);
  };

  const origins = Array.from(new Set(COMMON_ROUTES.map(r => r.origin)));
  const dests   = Array.from(new Set(COMMON_ROUTES.map(r => r.dest)));

  return (
    <div className="h-full overflow-y-auto p-5 space-y-5">
      <div>
        <h2 className="text-base font-bold text-white">Flight Route Engine</h2>
        <p className="text-xs text-white/40 mt-0.5">Find airlines, routes, and track live flight status</p>
      </div>

      {/* Route search */}
      <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl">
        <div className="text-xs font-semibold text-white mb-3">Find Route</div>
        <div className="flex gap-2 flex-wrap">
          <div className="flex-1 min-w-[120px]">
            <label className="text-[10px] text-white/40 mb-1 block">Origin (IATA)</label>
            <select value={origin} onChange={e => setOrigin(e.target.value)} className="w-full text-xs px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white focus:outline-none">
              {origins.map(o => <option key={o} value={o}>{o} — {COMMON_ROUTES.find(r=>r.origin===o)?.originCity}</option>)}
            </select>
          </div>
          <div className="flex items-end pb-0.5"><ArrowRight className="w-4 h-4 text-white/30" /></div>
          <div className="flex-1 min-w-[120px]">
            <label className="text-[10px] text-white/40 mb-1 block">Destination (IATA)</label>
            <select value={dest} onChange={e => setDest(e.target.value)} className="w-full text-xs px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white focus:outline-none">
              {dests.map(d => <option key={d} value={d}>{d} — {COMMON_ROUTES.find(r=>r.dest===d)?.destCity}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={search} className="px-4 py-2 text-xs rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition-colors">Search</button>
          </div>
        </div>
      </div>

      {/* Suggested airlines */}
      {searched && (
        <div>
          <div className="text-xs font-semibold text-white mb-3">Recommended Airlines for {origin} → {dest}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(suggested.length > 0 ? suggested : routes).map(r => (
              <div key={r.id} className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl hover:border-white/[0.1] transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-300 text-xs font-bold">{r.airlineCode}</div>
                    <div>
                      <div className="text-xs font-semibold text-white">{r.airline}</div>
                      <div className="text-[10px] text-white/40">{r.frequency} · {r.totalDurationHours}h total</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-yellow-300">
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />{r.avgRating}
                  </div>
                </div>
                {/* Legs */}
                <div className="space-y-1.5">
                  {r.legs.map((leg, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px]">
                      {STATUS_ICONS[leg.status]}
                      <span className="font-mono text-white/70">{leg.flightNumber}</span>
                      <span className="text-white/50">{leg.from.code}</span>
                      <ArrowRight className="w-3 h-3 text-white/20" />
                      <span className="text-white/50">{leg.to.code}</span>
                      <StatusBadge status={leg.status} />
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/[0.06] text-[10px] text-white/40">
                  <Navigation className="w-3 h-3" />
                  {r.transitHubs.join(' → ')} transit
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active deal flight tracking */}
      <div>
        <div className="text-xs font-semibold text-white mb-3">Live Deal Tracking</div>
        <div className="space-y-2">
          {deals.filter(d => d.status === 'active').map(d => (
            <div key={d.id} className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Plane className="w-4 h-4 text-sky-400" />
                  <span className="text-sm font-bold text-white">{d.flightNumber}</span>
                  <span className="text-xs text-white/40">{d.route}</span>
                </div>
                <StatusBadge status={d.flightStatus} />
              </div>
              {/* Progress bar */}
              <div className="flex items-center gap-2 text-[10px]">
                {['scheduled','departed','transit','arrived'].map((s, i) => {
                  const stages = ['scheduled','departed','transit','arrived'];
                  const current = stages.indexOf(d.flightStatus);
                  const done = i <= current;
                  return (
                    <div key={s} className="flex items-center gap-1 flex-1">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${done ? 'bg-sky-400' : 'bg-white/10'}`} />
                      <span className={done ? 'text-sky-300' : 'text-white/20'}>{s}</span>
                      {i < 3 && <div className={`flex-1 h-px ${done && i < current ? 'bg-sky-400' : 'bg-white/10'}`} />}
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-white/40">
                <span>{d.passengerName} · {d.kgPurchased}kg</span>
                <span>Departs {d.departureDate}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Agent Finance Dashboard ───────────────────────────────────────────────────

function FinanceView({ deals, setDeals }: { deals: Deal[]; setDeals: React.Dispatch<React.SetStateAction<Deal[]>> }) {
  const [editDeal, setEditDeal] = useState<Deal | null>(null);
  const [soldKg, setSoldKg] = useState('');
  const [otherCosts, setOtherCosts] = useState('');

  const completed = deals.filter(d => d.status === 'completed');
  const active    = deals.filter(d => d.status === 'active');

  const totalSpend   = deals.reduce((s, d) => s + d.bulkBuyAmountUsd, 0);
  const totalRev     = completed.reduce((s, d) => s + d.totalRevenueUsd, 0);
  const totalNet     = completed.reduce((s, d) => s + d.netProfitUsd, 0);
  const totalKgBought = deals.reduce((s, d) => s + d.kgPurchased, 0);
  const avgCost      = totalKgBought ? totalSpend / totalKgBought : 0;
  const avgSell      = completed.reduce((s,d) => s + d.sellRatePerKgUsd, 0) / Math.max(completed.length, 1);
  const avgMargin    = completed.length ? completed.reduce((s,d) => s+d.marginPct,0)/completed.length : 0;

  const updateDeal = () => {
    if (!editDeal || !soldKg) return;
    const kg = parseFloat(soldKg);
    const costs = parseFloat(otherCosts) || 0;
    const rev = kg * editDeal.sellRatePerKgUsd;
    const gross = rev - editDeal.bulkBuyAmountUsd;
    const net = gross - costs;
    const margin = rev > 0 ? (net / rev) * 100 : 0;
    setDeals(prev => prev.map(d => d.id === editDeal.id ? {
      ...d, totalKgSold: kg, totalRevenueUsd: rev,
      grossProfitUsd: gross, otherCostsUsd: costs,
      netProfitUsd: net, marginPct: margin,
      status: 'completed', completedAt: new Date().toISOString(),
    } : d));
    setEditDeal(null); setSoldKg(''); setOtherCosts('');
  };

  return (
    <div className="h-full overflow-y-auto p-5 space-y-5">
      <div>
        <h2 className="text-base font-bold text-white">Agent Finance Dashboard</h2>
        <p className="text-xs text-white/40 mt-0.5">Bulk buy cost vs per-kg revenue · Real-time P&L</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label:'Total Bulk Spend', value:usdK(totalSpend), sub:'paid to passengers', color:'text-red-400', bg:'bg-red-500/[0.04] border-red-500/20' },
          { label:'Total Revenue', value:usdK(totalRev), sub:'from customers', color:'text-emerald-400', bg:'bg-emerald-500/[0.04] border-emerald-500/20' },
          { label:'Net Profit', value:usdK(totalNet), sub:`${avgMargin.toFixed(1)}% margin`, color:'text-sky-400', bg:'bg-sky-500/[0.04] border-sky-500/20' },
          { label:'Avg Cost/kg', value:usd(avgCost), sub:`sell @ ${usd(avgSell)}/kg`, color:'text-violet-400', bg:'bg-violet-500/[0.04] border-violet-500/20' },
        ].map(k => (
          <div key={k.label} className={`p-4 rounded-xl border ${k.bg}`}>
            <div className={`text-xl font-bold ${k.color}`}>{k.value}</div>
            <div className="text-[11px] text-white/50 mt-0.5">{k.label}</div>
            <div className="text-[10px] text-white/30">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Bulk vs Per-KG explainer */}
      <div className="p-4 bg-sky-500/[0.04] border border-sky-500/20 rounded-xl">
        <div className="text-xs font-semibold text-sky-300 mb-2">How the model works</div>
        <div className="grid grid-cols-3 gap-3 text-[11px]">
          <div className="text-center p-2 bg-white/[0.03] rounded-lg">
            <div className="text-white/40 mb-1">You pay passenger</div>
            <div className="text-white font-bold">BULK TOTAL</div>
            <div className="text-sky-300">e.g. $200 for 30kg</div>
          </div>
          <div className="flex items-center justify-center"><ArrowRight className="w-5 h-5 text-white/20" /></div>
          <div className="text-center p-2 bg-white/[0.03] rounded-lg">
            <div className="text-white/40 mb-1">You charge customers</div>
            <div className="text-white font-bold">PER KG</div>
            <div className="text-emerald-300">e.g. $12/kg × 30kg = $360</div>
          </div>
        </div>
        <div className="mt-2 text-center text-[11px] text-emerald-300 font-medium">Gross profit = $360 − $200 = $160 (44% margin)</div>
      </div>

      {/* Active deals — update sold KG */}
      {active.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-white mb-3">Active Deals — Record Sales</div>
          <div className="space-y-2">
            {active.map(d => (
              <div key={d.id} className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-white">{d.flightNumber}</span>
                      <StatusBadge status={d.flightStatus} />
                    </div>
                    <div className="text-[11px] text-white/40">{d.route} · {d.passengerName}</div>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-[11px]">
                      <div><span className="text-white/40">Bulk paid: </span><span className="text-red-300 font-medium">{usd(d.bulkBuyAmountUsd)}</span></div>
                      <div><span className="text-white/40">KG bought: </span><span className="text-white font-medium">{d.kgPurchased}kg</span></div>
                      <div><span className="text-white/40">Sell rate: </span><span className="text-emerald-300 font-medium">{usd(d.sellRatePerKgUsd)}/kg</span></div>
                    </div>
                  </div>
                  <button onClick={() => { setEditDeal(d); setSoldKg(String(d.kgPurchased)); setOtherCosts('0'); }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition-colors shrink-0">
                    Record Sales
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Record sales modal */}
      {editDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setEditDeal(null)}>
          <div className="bg-[#0f0f1e] border border-white/[0.08] rounded-2xl p-6 w-full max-w-sm mx-4 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white">Record Sales — {editDeal.flightNumber}</h3>
            <div className="p-3 bg-white/[0.03] rounded-lg text-[11px] space-y-1">
              <div className="flex justify-between"><span className="text-white/40">Bulk paid</span><span className="text-red-300">{usd(editDeal.bulkBuyAmountUsd)}</span></div>
              <div className="flex justify-between"><span className="text-white/40">KG purchased</span><span className="text-white">{editDeal.kgPurchased}kg</span></div>
              <div className="flex justify-between"><span className="text-white/40">Sell rate</span><span className="text-emerald-300">{usd(editDeal.sellRatePerKgUsd)}/kg</span></div>
            </div>
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">KG Actually Sold to Customers</label>
              <input type="number" value={soldKg} onChange={e => setSoldKg(e.target.value)} placeholder={`max ${editDeal.kgPurchased}`}
                className="w-full text-xs px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white focus:outline-none focus:border-sky-500/50" />
            </div>
            <div>
              <label className="text-[10px] text-white/40 mb-1 block">Other Costs (handling, customs, USD)</label>
              <input type="number" value={otherCosts} onChange={e => setOtherCosts(e.target.value)} placeholder="0"
                className="w-full text-xs px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white focus:outline-none focus:border-sky-500/50" />
            </div>
            {soldKg && (
              <div className="p-3 bg-emerald-500/[0.06] border border-emerald-500/20 rounded-lg text-[11px] space-y-1">
                <div className="flex justify-between"><span className="text-white/40">Revenue</span><span className="text-emerald-300 font-medium">{usd(parseFloat(soldKg)*editDeal.sellRatePerKgUsd)}</span></div>
                <div className="flex justify-between"><span className="text-white/40">Gross profit</span><span className="text-emerald-300 font-medium">{usd(parseFloat(soldKg)*editDeal.sellRatePerKgUsd - editDeal.bulkBuyAmountUsd)}</span></div>
                <div className="flex justify-between"><span className="text-white/40">Net profit</span><span className="text-emerald-400 font-bold">{usd(parseFloat(soldKg)*editDeal.sellRatePerKgUsd - editDeal.bulkBuyAmountUsd - (parseFloat(otherCosts)||0))}</span></div>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setEditDeal(null)} className="flex-1 py-2 text-xs rounded-lg border border-white/[0.1] text-white/50 hover:text-white/70 transition-colors">Cancel</button>
              <button onClick={updateDeal} className="flex-1 py-2 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors font-medium">Save & Complete</button>
            </div>
          </div>
        </div>
      )}

      {/* Completed deals table */}
      <div>
        <div className="text-xs font-semibold text-white mb-3">Completed Deals</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Flight','Route','Bulk Paid','KG','Eff. Cost/kg','Revenue','Gross','Other','Net','Margin'].map(h => (
                  <th key={h} className="text-left py-2 px-2 text-white/30 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {completed.map(d => (
                <tr key={d.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="py-2 px-2 text-white font-medium">{d.flightNumber}</td>
                  <td className="py-2 px-2 text-white/50">{d.route}</td>
                  <td className="py-2 px-2 text-red-300">{usd(d.bulkBuyAmountUsd)}</td>
                  <td className="py-2 px-2 text-white">{d.kgPurchased}kg</td>
                  <td className="py-2 px-2 text-white/60">{usd(d.effectiveCostPerKgUsd)}</td>
                  <td className="py-2 px-2 text-emerald-300">{usd(d.totalRevenueUsd)}</td>
                  <td className="py-2 px-2 text-emerald-300">{usd(d.grossProfitUsd)}</td>
                  <td className="py-2 px-2 text-white/50">{usd(d.otherCostsUsd)}</td>
                  <td className={`py-2 px-2 font-bold ${d.netProfitUsd >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{usd(d.netProfitUsd)}</td>
                  <td className={`py-2 px-2 font-medium ${d.marginPct >= 20 ? 'text-emerald-400' : d.marginPct >= 10 ? 'text-yellow-400' : 'text-red-400'}`}>{d.marginPct.toFixed(1)}%</td>
                </tr>
              ))}
              {completed.length === 0 && (
                <tr><td colSpan={10} className="py-8 text-center text-white/30">No completed deals yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Trust Score View ──────────────────────────────────────────────────────────

function TrustView({ agents, listings }: { agents: Agent[]; listings: PassengerListing[] }) {
  const [tab, setTab] = useState<'agents' | 'passengers'>('agents');

  const passengerMap = useMemo(() => {
    const m = new Map<string, { name: string; score: number; tier: TrustTier; deals: number; verified: boolean }>();
    listings.forEach(l => {
      if (!m.has(l.passengerId)) {
        m.set(l.passengerId, {
          name: l.passengerName, score: l.trustScore, tier: l.trustTier,
          deals: l.bargainCount, verified: l.ticketVerified,
        });
      }
    });
    return Array.from(m.values()).sort((a, b) => b.score - a.score);
  }, [listings]);

  const tierIcon = (tier: TrustTier) => {
    if (tier === 'elite')    return <Award className="w-4 h-4 text-yellow-400" />;
    if (tier === 'trusted')  return <Shield className="w-4 h-4 text-violet-400" />;
    if (tier === 'verified') return <CheckCircle2 className="w-4 h-4 text-blue-400" />;
    return <Clock className="w-4 h-4 text-white/30" />;
  };

  const scoreBar = (score: number) => (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full ${score >= 90 ? 'bg-yellow-400' : score >= 75 ? 'bg-violet-400' : score >= 60 ? 'bg-blue-400' : 'bg-white/30'}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs font-bold text-white w-7 text-right">{score}</span>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto p-5 space-y-5">
      <div>
        <h1 className="text-base font-bold text-white">Trust Scores</h1>
        <p className="text-xs text-white/40 mt-0.5">Reputation ratings for agents and passengers</p>
      </div>

      {/* Tier legend */}
      <div className="grid grid-cols-4 gap-3">
        {(['new','verified','trusted','elite'] as TrustTier[]).map(tier => {
          const meta: Record<TrustTier, { label: string; range: string }> = {
            new:      { label: 'New',      range: '< 60'  },
            verified: { label: 'Verified', range: '60–74' },
            trusted:  { label: 'Trusted',  range: '75–89' },
            elite:    { label: 'Elite',    range: '90+'   },
          };
          return (
            <div key={tier} className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <div className="flex items-center gap-2 mb-1">
                {tierIcon(tier)}
                <span className="text-xs font-semibold text-white">{meta[tier].label}</span>
              </div>
              <div className="text-[10px] text-white/40">Score {meta[tier].range}</div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/[0.04] rounded-lg w-fit">
        {(['agents','passengers'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${tab === t ? 'bg-sky-600 text-white' : 'text-white/50 hover:text-white/80'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'agents' && (
        <div className="space-y-2">
          {[...agents].sort((a, b) => b.trustScore - a.trustScore).map(agent => (
            <div key={agent.id} className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {tierIcon(agent.trustTier)}
                    <span className="text-sm font-semibold text-white">{agent.companyName}</span>
                    <TrustBadge tier={agent.trustTier} score={agent.trustScore} />
                    {agent.isOnline && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" title="Online" />}
                  </div>
                  <div className="text-xs text-white/40 mt-0.5">{agent.contactName} · {agent.routes.join(', ')}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-white/40">Sell rate</div>
                  <div className="text-sm font-bold text-emerald-300">${agent.sellRatePerKgUsd}/kg</div>
                </div>
              </div>
              {scoreBar(agent.trustScore)}
              <div className="grid grid-cols-3 gap-3 pt-1 border-t border-white/[0.04]">
                <div className="text-center">
                  <div className="text-sm font-bold text-emerald-300">{agent.completedDeals}</div>
                  <div className="text-[10px] text-white/40">Completed</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-red-300">{agent.cancelledDeals}</div>
                  <div className="text-[10px] text-white/40">Cancelled</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-orange-300">{agent.disputedDeals}</div>
                  <div className="text-[10px] text-white/40">Disputed</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'passengers' && (
        <div className="space-y-2">
          {passengerMap.map(p => (
            <div key={p.name} className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  {tierIcon(p.tier)}
                  <span className="text-sm font-semibold text-white">{p.name}</span>
                  <TrustBadge tier={p.tier} score={p.score} />
                  {p.verified && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Ticket ✓
                    </span>
                  )}
                </div>
                <div className="text-xs text-white/40 shrink-0">{p.deals} bargain{p.deals !== 1 ? 's' : ''}</div>
              </div>
              {scoreBar(p.score)}
            </div>
          ))}
          {passengerMap.length === 0 && (
            <div className="py-12 text-center text-white/30 text-sm">No passenger data yet</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── New Listing View ──────────────────────────────────────────────────────────

function NewListingView({ onSave, onCancel }: {
  onSave: (l: PassengerListing) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    passengerName: '', passengerPhone: '',
    airline: '', flightNumber: '',
    origin: '', destination: '',
    departureDate: '', arrivalDate: '',
    availableKg: '', askingPricePerKg: '',
    ticketVerified: false,
  });
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [ocrParsing, setOcrParsing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  const handleOcr = useCallback((file: File) => {
    setOcrFile(file);
    setOcrParsing(true);
    // Simulate OCR extraction after 1.2s
    setTimeout(() => {
      setForm(f => ({
        ...f,
        airline: 'Ethiopian Airlines',
        flightNumber: 'ET607',
        origin: 'CAN',
        destination: 'DAR',
        departureDate: '2026-07-15',
        arrivalDate: '2026-07-16',
        ticketVerified: true,
      }));
      setOcrParsing(false);
    }, 1200);
  }, []);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.passengerName.trim()) e.passengerName = 'Required';
    if (!form.flightNumber.trim())  e.flightNumber  = 'Required';
    if (!form.origin.trim())        e.origin        = 'Required';
    if (!form.destination.trim())   e.destination   = 'Required';
    if (!form.departureDate)        e.departureDate = 'Required';
    if (!form.availableKg || isNaN(Number(form.availableKg)) || Number(form.availableKg) <= 0)
      e.availableKg = 'Must be > 0';
    if (!form.askingPricePerKg || isNaN(Number(form.askingPricePerKg)) || Number(form.askingPricePerKg) <= 0)
      e.askingPricePerKg = 'Must be > 0';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const kg = Number(form.availableKg);
    const now = new Date().toISOString();
    const listing: PassengerListing = {
      id: `pl-${Date.now()}`,
      passengerId: `p-${Date.now()}`,
      passengerName: form.passengerName.trim(),
      passengerPhone: form.passengerPhone.trim(),
      trustScore: 55,
      trustTier: 'new',
      airline: form.airline.trim() || 'Unknown',
      flightNumber: form.flightNumber.trim().toUpperCase(),
      origin: form.origin.trim().toUpperCase(),
      destination: form.destination.trim().toUpperCase(),
      departureDate: form.departureDate,
      arrivalDate: form.arrivalDate || form.departureDate,
      route: `${form.origin.toUpperCase()} → ${form.destination.toUpperCase()}`,
      totalAllowedKg: kg,
      availableKg: kg,
      reservedKg: 0,
      askingPricePerKg: Number(form.askingPricePerKg),
      currency: 'USD',
      negotiations: [],
      bargainCount: 0,
      bargainLocked: false,
      ticketVerified: form.ticketVerified,
      status: 'available',
      createdAt: now,
      expiresAt: form.departureDate,
    };
    onSave(listing);
  };

  const field = (label: string, key: string, placeholder: string, type = 'text') => (
    <div>
      <label className="block text-[11px] text-white/50 mb-1">{label}</label>
      <input
        type={type}
        value={form[key as keyof typeof form] as string}
        onChange={e => set(key, e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-white/[0.04] border rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-sky-500/60 transition-colors ${errors[key] ? 'border-red-500/50' : 'border-white/[0.08]'}`}
      />
      {errors[key] && <p className="text-[10px] text-red-400 mt-0.5">{errors[key]}</p>}
    </div>
  );

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="max-w-xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-white">New Passenger Listing</h1>
            <p className="text-xs text-white/40 mt-0.5">Add a passenger's available kilo allowance</p>
          </div>
          <button onClick={onCancel} className="text-xs text-white/40 hover:text-white/70 transition-colors">Cancel</button>
        </div>

        {/* OCR Upload */}
        <div className={`p-4 rounded-xl border-2 border-dashed transition-colors ${ocrFile ? 'border-emerald-500/40 bg-emerald-500/[0.04]' : 'border-white/[0.08] bg-white/[0.02]'}`}>
          <label className="flex flex-col items-center gap-2 cursor-pointer">
            <Upload className={`w-6 h-6 ${ocrFile ? 'text-emerald-400' : 'text-white/30'}`} />
            <span className="text-xs text-white/50">
              {ocrParsing ? 'Parsing ticket…' : ocrFile ? `Parsed: ${ocrFile.name}` : 'Upload ticket image for auto-fill (OCR)'}
            </span>
            <input type="file" accept="image/*,.pdf" className="hidden"
              onChange={e => { if (e.target.files?.[0]) handleOcr(e.target.files[0]); }} />
          </label>
          {form.ticketVerified && !ocrParsing && (
            <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />Ticket verified via OCR
            </div>
          )}
        </div>

        {/* Passenger info */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Passenger</h2>
          <div className="grid grid-cols-2 gap-3">
            {field('Full Name', 'passengerName', 'Zhang Wei')}
            {field('Phone', 'passengerPhone', '+86 138 0000 0000')}
          </div>
        </div>

        {/* Flight info */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Flight Details</h2>
          <div className="grid grid-cols-2 gap-3">
            {field('Airline', 'airline', 'Ethiopian Airlines')}
            {field('Flight Number', 'flightNumber', 'ET607')}
            {field('Origin (IATA)', 'origin', 'CAN')}
            {field('Destination (IATA)', 'destination', 'DAR')}
            {field('Departure Date', 'departureDate', '', 'date')}
            {field('Arrival Date', 'arrivalDate', '', 'date')}
          </div>
        </div>

        {/* Capacity & pricing */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Capacity & Pricing</h2>
          <div className="grid grid-cols-2 gap-3">
            {field('Available KG', 'availableKg', '30', 'number')}
            {field('Asking Price / KG (USD)', 'askingPricePerKg', '9.00', 'number')}
          </div>
        </div>

        {/* Manual verify toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => set('ticketVerified', !form.ticketVerified)}
            className={`w-9 h-5 rounded-full transition-colors relative ${form.ticketVerified ? 'bg-emerald-500' : 'bg-white/10'}`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.ticketVerified ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-xs text-white/60">Mark ticket as verified</span>
        </label>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg border border-white/[0.08] text-white/60 text-sm hover:bg-white/[0.04] transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit}
            className="flex-1 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium transition-colors">
            Create Listing
          </button>
        </div>
      </div>
    </div>
  );
}

