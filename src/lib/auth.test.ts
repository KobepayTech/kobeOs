import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  clearTokens: vi.fn(),
  getToken: vi.fn(() => 'access-token'),
  getRefreshToken: vi.fn(() => 'refresh-token'),
}));

vi.mock('./api', () => {
  class ApiError extends Error {
    constructor(public status: number, message: string, public body?: unknown) {
      super(message);
    }
  }
  return {
    api: mocks.api,
    clearTokens: mocks.clearTokens,
    getToken: mocks.getToken,
    getRefreshToken: mocks.getRefreshToken,
    setToken: vi.fn(),
    setRefreshToken: vi.fn(),
    ApiError,
  };
});

import { ApiError } from './api';
import { ensureSession, verifyOAuthSession } from './auth';

const storedUser = {
  id: 'user-1',
  email: 'owner@example.com',
  displayName: 'Hotel Owner',
};

describe('ensureSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getToken.mockReturnValue('access-token');
    mocks.getRefreshToken.mockReturnValue('refresh-token');
    localStorage.clear();
    localStorage.setItem('kobeos_auth_user', JSON.stringify(storedUser));
  });

  it('keeps the saved login during a temporary backend failure', async () => {
    mocks.api.mockRejectedValueOnce(new ApiError(503, 'Service unavailable'));

    await expect(ensureSession()).resolves.toEqual(storedUser);
    expect(mocks.clearTokens).not.toHaveBeenCalled();
  });

  it('uses the saved user when an offline read has no response body', async () => {
    mocks.api.mockResolvedValueOnce([]);

    await expect(ensureSession()).resolves.toEqual(storedUser);
    expect(mocks.clearTokens).not.toHaveBeenCalled();
  });

  it('clears tokens after a confirmed authentication rejection', async () => {
    mocks.api.mockRejectedValue(new ApiError(401, 'Unauthorized'));

    await expect(ensureSession()).rejects.toThrow('Unauthorized');
    expect(mocks.clearTokens).toHaveBeenCalledTimes(1);
  });
});

describe('new OAuth session verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('kobeos_auth_user', JSON.stringify(storedUser));
  });

  it('does not use a previous account when the new login cannot be verified', async () => {
    mocks.api.mockRejectedValue(new ApiError(503, 'Unavailable'));
    await expect(verifyOAuthSession('new-access', 'new-refresh')).rejects.toThrow('Unavailable');
    expect(mocks.api).toHaveBeenCalledWith('/users/me', expect.objectContaining({
      auth: false, offlineFallback: false, cache: 'no-store',
      headers: { Authorization: 'Bearer new-access' }, signal: expect.any(AbortSignal),
    }));
    expect(JSON.parse(localStorage.getItem('kobeos_auth_user')!)).toEqual(storedUser);
    expect(mocks.clearTokens).not.toHaveBeenCalled();
  });

  it('rejects offline fallback data rather than declaring a successful login', async () => {
    mocks.api.mockResolvedValue([]);
    await expect(verifyOAuthSession('new-access', 'new-refresh')).rejects.toThrow('could not verify');
  });

  it('stores the newly verified profile', async () => {
    const user = { id: 'new-user', email: 'new@example.com', displayName: 'New user' };
    mocks.api.mockResolvedValue(user);
    await expect(verifyOAuthSession('new-access', 'new-refresh')).resolves.toEqual(user);
    expect(JSON.parse(localStorage.getItem('kobeos_auth_user')!)).toEqual(user);
  });

  it('does not change the account after the user cancels verification', async () => {
    const controller = new AbortController();
    mocks.api.mockImplementation(async () => {
      controller.abort();
      return { id: 'new-user', email: 'new@example.com' };
    });
    await expect(verifyOAuthSession('new-access', 'new-refresh', controller.signal)).rejects.toThrow();
    expect(JSON.parse(localStorage.getItem('kobeos_auth_user')!)).toEqual(storedUser);
  });
});
