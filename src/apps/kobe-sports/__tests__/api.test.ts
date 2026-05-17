import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock localStorage
const mockStorage: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mockStorage[k] ?? null,
  setItem: (k: string, v: string) => { mockStorage[k] = v; },
  removeItem: (k: string) => { delete mockStorage[k]; },
});

function mockResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status < 400,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
  } as Response);
}

describe('KobeSports API', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('matchesApi', () => {
    it('lists matches with correct URL and auth header', async () => {
      mockStorage['access_token'] = 'test-token';
      mockFetch.mockReturnValueOnce(mockResponse({ data: [], total: 0 }));

      const { matchesApi } = await import('../api');
      await matchesApi.list(1, 20);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sports/matches?page=1&limit=20',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
        }),
      );
    });

    it('creates a match with POST', async () => {
      mockFetch.mockReturnValueOnce(mockResponse({ id: 'new-id', homeTeam: 'A', awayTeam: 'B' }));

      const { matchesApi } = await import('../api');
      const result = await matchesApi.create({ homeTeam: 'A', awayTeam: 'B', sport: 'football' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sports/matches',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(result).toMatchObject({ homeTeam: 'A', awayTeam: 'B' });
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockReturnValueOnce(mockResponse({}, 404));

      const { matchesApi } = await import('../api');
      await expect(matchesApi.get('bad-id')).rejects.toThrow('404');
    });

    it('fetches match events', async () => {
      const events = [{ id: 'e1', type: 'GOAL', minute: 23 }];
      mockFetch.mockReturnValueOnce(mockResponse(events));

      const { matchesApi } = await import('../api');
      const result = await matchesApi.events('match-1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sports/matches/match-1/events',
        expect.any(Object),
      );
      expect(result).toEqual(events);
    });
  });

  describe('teamsApi', () => {
    it('fetches league table for a competition', async () => {
      const teams = [{ id: 't1', name: 'Kobe FC', points: 60 }];
      mockFetch.mockReturnValueOnce(mockResponse(teams));

      const { teamsApi } = await import('../api');
      const result = await teamsApi.leagueTable('Premier League');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sports/teams/league-table/Premier%20League',
        expect.any(Object),
      );
      expect(result).toEqual(teams);
    });
  });

  describe('analyticsApi', () => {
    it('fetches analytics for a match', async () => {
      const analytics = { id: 'a1', matchId: 'm1', status: 'READY' };
      mockFetch.mockReturnValueOnce(mockResponse(analytics));

      const { analyticsApi } = await import('../api');
      const result = await analyticsApi.forMatch('m1');

      expect(mockFetch).toHaveBeenCalledWith('/api/sports/analytics/m1', expect.any(Object));
      expect(result).toMatchObject({ status: 'READY' });
    });

    it('posts to generate tactical report', async () => {
      mockFetch.mockReturnValueOnce(mockResponse({ report: 'Tactical analysis...' }));

      const { analyticsApi } = await import('../api');
      const result = await analyticsApi.tacticalReport('m1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sports/analytics/m1/tactical-report',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(result.report).toBe('Tactical analysis...');
    });
  });

  describe('aiSportsApi', () => {
    it('posts commentary request', async () => {
      mockFetch.mockReturnValueOnce(mockResponse({ commentary: 'GOAL! 23 minutes...' }));

      const { aiSportsApi } = await import('../api');
      const result = await aiSportsApi.commentary({
        matchId: 'm1',
        events: [],
        stats: { possession: { home: 55, away: 45 } },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/ai/sports/commentary',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(result.commentary).toContain('GOAL');
    });
  });
});
