/**
 * Zustand stores for the KobeStudio creator marketplace.
 * Each store is a thin client-side cache that syncs with the backend on demand.
 */
import { create } from 'zustand';
import { api } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Creator {
  id: string;
  displayName: string;
  niche: string;
  country: string;
  platforms: { platform: string; handle: string; followers: number; engagementRate: number }[];
  trustScore: number;
  verified: boolean;
  ratePerPost: number;
  currency: string;
  bio: string;
  avatarUrl?: string;
}

export interface Campaign {
  id: string;
  title: string;
  brandId: string;
  brandName: string;
  status: 'draft' | 'open' | 'in_progress' | 'completed' | 'cancelled';
  budget: number;
  currency: string;
  niche: string;
  platforms: string[];
  kpis: { metric: string; target: number }[];
  deadline: string;
  description: string;
  createdAt: string;
}

export interface EscrowWallet {
  id: string;
  campaignId: string;
  campaignTitle: string;
  brandId: string;
  creatorId: string;
  amount: number;
  currency: string;
  status: 'held' | 'released' | 'refunded' | 'disputed';
  milestones: { label: string; amount: number; released: boolean }[];
  createdAt: string;
}

// ── Creator Store ─────────────────────────────────────────────────────────────

interface CreatorState {
  creators: Creator[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  nicheFilter: string;
  countryFilter: string;
  platformFilter: string;
  setSearch: (q: string) => void;
  setNicheFilter: (n: string) => void;
  setCountryFilter: (c: string) => void;
  setPlatformFilter: (p: string) => void;
  fetch: () => Promise<void>;
  filteredCreators: () => Creator[];
}

export const useCreatorStore = create<CreatorState>((set, get) => ({
  creators: [],
  loading: false,
  error: null,
  searchQuery: '',
  nicheFilter: '',
  countryFilter: '',
  platformFilter: '',

  setSearch: (q) => set({ searchQuery: q }),
  setNicheFilter: (n) => set({ nicheFilter: n }),
  setCountryFilter: (c) => set({ countryFilter: c }),
  setPlatformFilter: (p) => set({ platformFilter: p }),

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const data = await api<Creator[]>('/creators');
      set({ creators: data, loading: false });
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  filteredCreators: () => {
    const { creators, searchQuery, nicheFilter, countryFilter, platformFilter } = get();
    return creators.filter(c => {
      if (searchQuery && !c.displayName.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !c.niche.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (nicheFilter && c.niche !== nicheFilter) return false;
      if (countryFilter && c.country !== countryFilter) return false;
      if (platformFilter && !c.platforms.some(p => p.platform === platformFilter)) return false;
      return true;
    });
  },
}));

// ── Campaign Store ────────────────────────────────────────────────────────────

interface CampaignState {
  campaigns: Campaign[];
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  create: (dto: Partial<Campaign>) => Promise<Campaign | null>;
  updateStatus: (id: string, status: Campaign['status']) => Promise<void>;
}

export const useCampaignStore = create<CampaignState>((set, get) => ({
  campaigns: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const data = await api<Campaign[]>('/creators/campaigns');
      set({ campaigns: data, loading: false });
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  create: async (dto) => {
    try {
      const created = await api<Campaign>('/creators/campaigns', {
        method: 'POST',
        body: JSON.stringify(dto),
      });
      set(s => ({ campaigns: [created, ...s.campaigns] }));
      return created;
    } catch (e: unknown) {
      set({ error: (e as Error).message });
      return null;
    }
  },

  updateStatus: async (id, status) => {
    try {
      const updated = await api<Campaign>(`/creators/campaigns/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      set(s => ({ campaigns: s.campaigns.map(c => c.id === id ? updated : c) }));
    } catch (e: unknown) {
      set({ error: (e as Error).message });
    }
  },
}));

// ── Escrow Store ──────────────────────────────────────────────────────────────

interface EscrowState {
  wallets: EscrowWallet[];
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  releaseMilestone: (escrowId: string, milestoneIndex: number) => Promise<void>;
  openDispute: (escrowId: string) => Promise<void>;
}

export const useEscrowStore = create<EscrowState>((set) => ({
  wallets: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const data = await api<EscrowWallet[]>('/creators/escrow');
      set({ wallets: data, loading: false });
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  releaseMilestone: async (escrowId, milestoneIndex) => {
    try {
      const updated = await api<EscrowWallet>(`/creators/escrow/${escrowId}/release`, {
        method: 'POST',
        body: JSON.stringify({ milestoneIndex }),
      });
      set(s => ({ wallets: s.wallets.map(w => w.id === escrowId ? updated : w) }));
    } catch (e: unknown) {
      set({ error: (e as Error).message });
    }
  },

  openDispute: async (escrowId) => {
    try {
      const updated = await api<EscrowWallet>(`/creators/escrow/${escrowId}/dispute`, {
        method: 'POST',
      });
      set(s => ({ wallets: s.wallets.map(w => w.id === escrowId ? updated : w) }));
    } catch (e: unknown) {
      set({ error: (e as Error).message });
    }
  },
}));
