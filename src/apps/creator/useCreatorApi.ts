import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { MarketCreator } from './marketplace-data';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface PlatformStats {
  platform: 'tiktok' | 'instagram' | 'youtube';
  handle: string;
  followers: number;
  avgViews: number;
  avgLikes: number;
  avgComments: number;
  engagementRate: number;
  totalPosts: number;
  bestPostViews: number;
  lastSyncedAt: string;
}

export interface ApiCreator {
  id: string;
  name: string;
  handle: string;
  niche: string;
  country: string;
  followers: number;
  engagement: number;
  avgViews: number;
  avatarUrl?: string | null;
  contactEmail?: string | null;
  phone?: string | null;
  bio?: string | null;
  platforms: string[];
  platformStats: PlatformStats[];
  verified: boolean;
  weeklyRateTzs: number;
  subscriptionTier: 'free' | 'basic' | 'premium' | 'elite';
  fraudSignals?: { fraudScore: number } | null;
  lastSyncedAt?: string | null;
}

export interface ApiCampaignRequirement {
  platform: string;
  contentType: string;
  minViews: number;
  minLikes?: number;
  deadline: string;
  description?: string;
}

export interface ApiCampaignOffer {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorHandle: string;
  amountTzs: number;
  status: string;
  proofUrls: string[];
  verifiedViews?: number;
  sentAt: string;
  respondedAt?: string;
  paidAt?: string;
  notes?: string;
}

export interface ApiCampaign {
  id: string;
  name: string;
  description: string;
  brand: string;
  niche: string;
  status: string;
  budgetTzs: number;
  platformFeePercent: number;
  requirements: ApiCampaignRequirement[];
  offers: ApiCampaignOffer[];
  endsAt?: string | null;
  escrowId?: string | null;
  createdAt: string;
}

export interface ApiEscrow {
  id: string;
  campaignId: string;
  offerId: string;
  amountTzs: number;
  feeTzs: number;
  netAmountTzs: number;
  status: 'held' | 'released' | 'refunded' | 'disputed';
  createdAt: string;
  releasedAt?: string | null;
  refundedAt?: string | null;
}

export interface ApiErrorResponse {
  error?: string;
  message?: string;
}

/* ------------------------------------------------------------------ */
/*  Helper: handle 401 → redirect to login                             */
/* ------------------------------------------------------------------ */

function handleAuthError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'status' in err) {
    const status = (err as { status: number }).status;
    if (status === 401) {
      // Dispatch auth error event for the app to handle
      window.dispatchEvent(new CustomEvent('kobe:auth-required'));
      return true;
    }
  }
  return false;
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object') {
    const e = err as ApiErrorResponse;
    return e.error || e.message || 'An unknown error occurred';
  }
  return 'An unknown error occurred';
}

/* ------------------------------------------------------------------ */
/*  Hook: useMarketplace — list all creators                           */
/* ------------------------------------------------------------------ */

export function useMarketplace() {
  const [creators, setCreators] = useState<MarketCreator[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<ApiCreator[]>('/creators/marketplace');
      const mapped: MarketCreator[] = res.map((c) => ({
        id: c.id,
        name: c.name,
        handle: c.handle,
        niche: c.niche || 'Other',
        country: c.country || '',
        followers: c.followers,
        engagement: c.engagement,
        avgViews: c.avgViews || 0,
        verified: c.verified,
        weeklyRateTzs: Number(c.weeklyRateTzs) || 0,
        subscriptionTier: c.subscriptionTier,
        platforms: c.platforms,
        bio: c.bio,
      }));
      setCreators(mapped);
    } catch (err) {
      handleAuthError(err);
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { creators, loading, error, refetch };
}

/* ------------------------------------------------------------------ */
/*  Hook: useSearchCreators — search with filters                      */
/* ------------------------------------------------------------------ */

export function useSearchCreators(
  q: string,
  platform: string,
  niche: string,
  country: string,
) {
  const [creators, setCreators] = useState<MarketCreator[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q) params.append('q', q);
      if (platform && platform !== 'all') params.append('platform', platform);
      if (niche && niche !== 'all') params.append('niche', niche);
      if (country && country !== 'all') params.append('country', country);
      const qs = params.toString();
      const path = `/creators/search${qs ? `?${qs}` : ''}`;
      const res = await api<ApiCreator[]>(path);
      const mapped: MarketCreator[] = res.map((c) => ({
        id: c.id,
        name: c.name,
        handle: c.handle,
        niche: c.niche || 'Other',
        country: c.country || '',
        followers: c.followers,
        engagement: c.engagement,
        avgViews: c.avgViews || 0,
        verified: c.verified,
        weeklyRateTzs: Number(c.weeklyRateTzs) || 0,
        subscriptionTier: c.subscriptionTier,
        platforms: c.platforms,
        bio: c.bio,
      }));
      setCreators(mapped);
    } catch (err) {
      handleAuthError(err);
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [q, platform, niche, country]);

  useEffect(() => {
    const t = setTimeout(() => refetch(), 300);
    return () => clearTimeout(t);
  }, [refetch]);

  return { creators, loading, error, refetch };
}

/* ------------------------------------------------------------------ */
/*  Hook: useMyCampaigns — list my campaigns (auth)                    */
/* ------------------------------------------------------------------ */

export function useMyCampaigns() {
  const [campaigns, setCampaigns] = useState<ApiCampaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<ApiCampaign[]>('/creators/campaigns/mine');
      setCampaigns(res);
    } catch (err) {
      handleAuthError(err);
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { campaigns, loading, error, refetch };
}

/* ------------------------------------------------------------------ */
/*  Hook: useOpenCampaigns — list open campaigns                       */
/* ------------------------------------------------------------------ */

export function useOpenCampaigns() {
  const [campaigns, setCampaigns] = useState<ApiCampaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<ApiCampaign[]>('/creators/campaigns/open');
      setCampaigns(res);
    } catch (err) {
      handleAuthError(err);
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { campaigns, loading, error, refetch };
}

/* ------------------------------------------------------------------ */
/*  Hook: useCreateCampaign                                            */
/* ------------------------------------------------------------------ */

export interface CreateCampaignPayload {
  name: string;
  description?: string;
  brand?: string;
  niche?: string;
  budgetTzs: number;
  requirements?: ApiCampaignRequirement[];
  endsAt?: string | null;
}

export function useCreateCampaign() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const create = useCallback(async (payload: CreateCampaignPayload) => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      await api('/creators/campaigns', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSuccess(true);
    } catch (err) {
      handleAuthError(err);
      const msg = extractErrorMessage(err);
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  return { create, loading, error, success };
}

/* ------------------------------------------------------------------ */
/*  Hook: useMyEscrow — my escrow as brand                             */
/* ------------------------------------------------------------------ */

export function useMyEscrow() {
  const [escrow, setEscrow] = useState<ApiEscrow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<ApiEscrow[]>('/creators/escrow/mine');
      setEscrow(res);
    } catch (err) {
      handleAuthError(err);
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { escrow, loading, error, refetch };
}

/* ------------------------------------------------------------------ */
/*  Hook: useCreatorEscrow — my escrow as creator                      */
/* ------------------------------------------------------------------ */

export function useCreatorEscrow() {
  const [escrow, setEscrow] = useState<ApiEscrow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<ApiEscrow[]>('/creators/escrow/creator');
      setEscrow(res);
    } catch (err) {
      handleAuthError(err);
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { escrow, loading, error, refetch };
}

/* ------------------------------------------------------------------ */
/*  Hook: useCreatorProfile — get creator by id                        */
/* ------------------------------------------------------------------ */

export function useCreatorProfile(id: string | undefined) {
  const [creator, setCreator] = useState<MarketCreator | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<ApiCreator>(`/creators/${id}`);
      const mapped: MarketCreator = {
        id: res.id,
        name: res.name,
        handle: res.handle,
        niche: res.niche || 'Other',
        country: res.country || '',
        followers: res.followers,
        engagement: res.engagement,
        avgViews: res.avgViews || 0,
        verified: res.verified,
        weeklyRateTzs: Number(res.weeklyRateTzs) || 0,
        subscriptionTier: res.subscriptionTier,
        platforms: res.platforms,
        bio: res.bio,
      };
      setCreator(mapped);
    } catch (err) {
      handleAuthError(err);
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { creator, loading, error, refetch };
}

/* ------------------------------------------------------------------ */
/*  Hook: useSyncCreator — sync creator metrics                        */
/* ------------------------------------------------------------------ */

export function useSyncCreator(id: string | undefined) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const sync = useCallback(
    async (platform: string, handle: string) => {
      if (!id) return;
      setLoading(true);
      setError(null);
      setSuccess(false);
      try {
        await api(`/creators/${id}/sync`, {
          method: 'POST',
          body: JSON.stringify({ platform, handle }),
        });
        setSuccess(true);
      } catch (err) {
        handleAuthError(err);
        const msg = extractErrorMessage(err);
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    [id],
  );

  return { sync, loading, error, success };
}

/* ------------------------------------------------------------------ */
/*  Hook: useSendOffer — send offer to a creator for a campaign        */
/* ------------------------------------------------------------------ */

export function useSendOffer(campaignId: string | undefined) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const sendOffer = useCallback(
    async (creatorId: string, amountTzs: number, notes?: string) => {
      if (!campaignId) return;
      setLoading(true);
      setError(null);
      setSuccess(false);
      try {
        await api(`/creators/campaigns/${campaignId}/offers`, {
          method: 'POST',
          body: JSON.stringify({ creatorId, amountTzs, notes }),
        });
        setSuccess(true);
      } catch (err) {
        handleAuthError(err);
        const msg = extractErrorMessage(err);
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    [campaignId],
  );

  return { sendOffer, loading, error, success };
}

/* ------------------------------------------------------------------ */
/*  Hook: useCampaignActions — publish / cancel                        */
/* ------------------------------------------------------------------ */

export function useCampaignActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publish = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await api(`/creators/campaigns/${id}/publish`, { method: 'POST' });
    } catch (err) {
      handleAuthError(err);
      const msg = extractErrorMessage(err);
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const cancel = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await api(`/creators/campaigns/${id}/cancel`, { method: 'POST' });
    } catch (err) {
      handleAuthError(err);
      const msg = extractErrorMessage(err);
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  return { publish, cancel, loading, error };
}

/* ------------------------------------------------------------------ */
/*  Hook: useSubscribe — subscribe to a creator tier                   */
/* ------------------------------------------------------------------ */

export interface SubscribePayload {
  tier: 'basic' | 'premium' | 'elite';
  phone: string;
  name?: string;
  email?: string;
}

export function useSubscribe(id: string | undefined) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const subscribe = useCallback(
    async (payload: SubscribePayload) => {
      if (!id) return;
      setLoading(true);
      setError(null);
      setSuccess(false);
      try {
        await api(`/creators/${id}/subscribe`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSuccess(true);
      } catch (err) {
        handleAuthError(err);
        const msg = extractErrorMessage(err);
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    [id],
  );

  return { subscribe, loading, error, success };
}
