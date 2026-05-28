// Kobe Cargo Exchange — shared types

export type FlightStatus = 'scheduled' | 'departed' | 'transit' | 'arrived' | 'delayed' | 'cancelled';
export type NegotiationStatus = 'open' | 'pending' | 'accepted' | 'rejected' | 'countered' | 'locked';
export type DealStatus = 'active' | 'completed' | 'cancelled' | 'disputed';
export type TrustTier = 'new' | 'verified' | 'trusted' | 'elite';

export const MAX_BARGAIN_AGENTS = 3;

// ── Flight & Route ────────────────────────────────────────────────────────────

export interface Airport {
  code: string;   // IATA
  name: string;
  city: string;
  country: string;
}

export interface FlightLeg {
  from: Airport;
  to: Airport;
  airline: string;
  flightNumber: string;
  departureTime: string;   // ISO
  arrivalTime: string;     // ISO
  status: FlightStatus;
  actualDeparture?: string;
  actualArrival?: string;
}

export interface FlightRoute {
  id: string;
  airline: string;
  airlineCode: string;
  legs: FlightLeg[];
  totalDurationHours: number;
  transitHubs: string[];   // IATA codes
  frequency: string;       // e.g. "Daily", "3x/week"
  avgRating: number;
}

// ── Passenger Kilo Listing ────────────────────────────────────────────────────

export interface PassengerListing {
  id: string;
  passengerId: string;
  passengerName: string;
  passengerPhone: string;
  trustScore: number;
  trustTier: TrustTier;

  // Flight info (from OCR or manual)
  airline: string;
  flightNumber: string;
  origin: string;       // IATA
  destination: string;  // IATA
  departureDate: string;
  arrivalDate: string;
  route: string;        // e.g. "CAN → ADD → DAR"

  // Capacity
  totalAllowedKg: number;
  availableKg: number;
  reservedKg: number;

  // Pricing
  askingPricePerKg: number;  // passenger's ask (USD)
  currency: 'USD' | 'TZS' | 'KES';

  // Negotiation state
  negotiations: Negotiation[];
  bargainCount: number;   // how many agents this passenger has bargained with
  bargainLocked: boolean; // true when bargainCount >= MAX_BARGAIN_AGENTS

  // Ticket verification
  ticketVerified: boolean;
  ticketImageUrl?: string;

  status: 'available' | 'negotiating' | 'sold' | 'expired';
  createdAt: string;
  expiresAt: string;
}

// ── Agent ─────────────────────────────────────────────────────────────────────

export interface Agent {
  id: string;
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  trustScore: number;
  trustTier: TrustTier;
  completedDeals: number;
  cancelledDeals: number;
  disputedDeals: number;

  // Pricing strategy
  buyRateMinUsd: number;   // min they'll pay passenger per bulk deal
  buyRateMaxUsd: number;   // max they'll pay
  sellRatePerKgUsd: number; // what they charge their customers

  routes: string[];        // routes they operate e.g. ["CAN-DAR", "PVG-NBO"]
  isOnline: boolean;
}

// ── Negotiation ───────────────────────────────────────────────────────────────

export interface NegotiationOffer {
  id: string;
  fromRole: 'passenger' | 'agent';
  amountUsd: number;       // bulk deal total (NOT per kg)
  kgIncluded: number;
  message?: string;
  timestamp: string;
}

export interface Negotiation {
  id: string;
  listingId: string;
  agentId: string;
  agentName: string;
  passengerId: string;
  status: NegotiationStatus;
  offers: NegotiationOffer[];
  agreedAmountUsd?: number;
  agreedKg?: number;
  createdAt: string;
  updatedAt: string;
}

// ── Deal (completed negotiation) ──────────────────────────────────────────────

export interface Deal {
  id: string;
  negotiationId: string;
  listingId: string;
  agentId: string;
  agentName: string;
  passengerId: string;
  passengerName: string;
  flightNumber: string;
  route: string;
  departureDate: string;

  // Financials — BULK model
  bulkBuyAmountUsd: number;   // agent paid passenger (bulk, NOT per kg)
  kgPurchased: number;
  effectiveCostPerKgUsd: number;  // bulkBuyAmountUsd / kgPurchased

  // Agent's customer charges (per kg)
  sellRatePerKgUsd: number;
  totalKgSold: number;
  totalRevenueUsd: number;

  // P&L
  grossProfitUsd: number;     // totalRevenueUsd - bulkBuyAmountUsd
  otherCostsUsd: number;      // handling, customs, etc.
  netProfitUsd: number;       // grossProfitUsd - otherCostsUsd
  marginPct: number;

  status: DealStatus;
  flightStatus: FlightStatus;
  createdAt: string;
  completedAt?: string;
}

// ── Finance summary ───────────────────────────────────────────────────────────

export interface FinanceSummary {
  totalBulkSpendUsd: number;
  totalRevenueUsd: number;
  totalGrossProfitUsd: number;
  totalNetProfitUsd: number;
  avgMarginPct: number;
  totalKgBought: number;
  totalKgSold: number;
  avgCostPerKgUsd: number;
  avgSellPerKgUsd: number;
  activeDeals: number;
  completedDeals: number;
  pendingNegotiations: number;
}
