import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);
vi.stubGlobal('localStorage', {
  getItem: () => null,
  setItem: vi.fn(),
  removeItem: vi.fn(),
});

function ok(data: unknown) {
  return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve(data) } as Response);
}
function fail(status: number) {
  return Promise.resolve({ ok: false, status, statusText: 'Error', json: () => Promise.resolve({}) } as Response);
}

describe('KobeModels API', () => {
  beforeEach(() => mockFetch.mockReset());

  describe('catalogueApi', () => {
    it('fetches full catalogue', async () => {
      const catalogue = { version: '1.0.0', updatedAt: '2026-05-16', models: [] };
      mockFetch.mockReturnValueOnce(ok(catalogue));

      const { catalogueApi } = await import('../api');
      const result = await catalogueApi.all();

      expect(mockFetch).toHaveBeenCalledWith('/api/kobe-models/catalogue', expect.any(Object));
      expect(result.version).toBe('1.0.0');
    });

    it('fetches recommended models', async () => {
      mockFetch.mockReturnValueOnce(ok([{ id: 'mistral:7b', recommended: true }]));

      const { catalogueApi } = await import('../api');
      const result = await catalogueApi.recommended();

      expect(mockFetch).toHaveBeenCalledWith('/api/kobe-models/catalogue/recommended', expect.any(Object));
      expect(result[0].recommended).toBe(true);
    });

    it('fetches by category', async () => {
      mockFetch.mockReturnValueOnce(ok([{ id: 'deepseek-coder-v2:16b', category: 'coding' }]));

      const { catalogueApi } = await import('../api');
      const result = await catalogueApi.byCategory('coding');

      expect(mockFetch).toHaveBeenCalledWith('/api/kobe-models/catalogue/category/coding', expect.any(Object));
      expect(result[0].category).toBe('coding');
    });

    it('throws on 404', async () => {
      mockFetch.mockReturnValueOnce(fail(404));

      const { catalogueApi } = await import('../api');
      await expect(catalogueApi.byId('nonexistent:model')).rejects.toThrow('404');
    });
  });

  describe('downloadApi', () => {
    it('starts a download job', async () => {
      const job = { jobId: 'j1', modelId: 'mistral:7b', status: 'queued', progressPct: 0 };
      mockFetch.mockReturnValueOnce(ok(job));

      const { downloadApi } = await import('../api');
      const result = await downloadApi.start('mistral:7b');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/kobe-models/download',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ modelId: 'mistral:7b' }),
        }),
      );
      expect(result.jobId).toBe('j1');
      expect(result.status).toBe('queued');
    });

    it('polls a job by id', async () => {
      const job = { jobId: 'j1', modelId: 'mistral:7b', status: 'downloading', progressPct: 42 };
      mockFetch.mockReturnValueOnce(ok(job));

      const { downloadApi } = await import('../api');
      const result = await downloadApi.job('j1');

      expect(mockFetch).toHaveBeenCalledWith('/api/kobe-models/jobs/j1', expect.any(Object));
      expect(result.progressPct).toBe(42);
    });

    it('lists all jobs', async () => {
      mockFetch.mockReturnValueOnce(ok([{ jobId: 'j1' }, { jobId: 'j2' }]));

      const { downloadApi } = await import('../api');
      const result = await downloadApi.jobs();

      expect(result).toHaveLength(2);
    });
  });

  describe('installedApi', () => {
    it('lists installed models', async () => {
      mockFetch.mockReturnValueOnce(ok({ models: [{ name: 'mistral:7b', size: 4100000000 }] }));

      const { installedApi } = await import('../api');
      const result = await installedApi.list();

      expect(result.models[0].name).toBe('mistral:7b');
    });

    it('sets active model with PUT', async () => {
      mockFetch.mockReturnValueOnce(ok({ model: 'mistral:7b' }));

      const { installedApi } = await import('../api');
      await installedApi.setActive('mistral:7b');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/ai/models/active',
        expect.objectContaining({ method: 'PUT' }),
      );
    });

    it('deletes a model with DELETE', async () => {
      mockFetch.mockReturnValueOnce(ok(undefined));

      const { installedApi } = await import('../api');
      await installedApi.delete('mistral:7b');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/ai/models/mistral%3A7b',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });
});
