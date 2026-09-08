import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import OAuthCallback from './OAuthCallback';

const mocks = vi.hoisted(() => ({ verify: vi.fn() }));
vi.mock('@/lib/auth', () => ({ verifyOAuthSession: mocks.verify }));

describe('OAuth callback recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, '', '/oauth/meta');
  });
  afterEach(() => { cleanup(); window.history.replaceState(null, '', '/'); });

  it.each(['Expired or mismatched OAuth state', 'access_denied'])('starts fresh after %s instead of replaying the error', async error => {
    window.history.replaceState(null, '', `/oauth/meta#error=${encodeURIComponent(error)}`);
    render(<OAuthCallback provider="meta" />);
    expect(await screen.findByRole('link', { name: 'Try Facebook again' })).toHaveAttribute('href', expect.stringContaining('/auth/oauth/meta'));
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
    expect(screen.getByRole('button', { name: 'Use another sign-in method' })).toBeVisible();
  });

  it('retries account verification without forcing Facebook login again after a temporary outage', async () => {
    window.history.replaceState(null, '', '/oauth/meta#access_token=test-access&refresh_token=test-refresh');
    mocks.verify.mockRejectedValue(new ApiError(503, 'Temporarily unavailable'));
    render(<OAuthCallback provider="meta" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Retry verification' }));
    await waitFor(() => expect(mocks.verify).toHaveBeenCalledTimes(2));
    expect(mocks.verify).toHaveBeenLastCalledWith('test-access', 'test-refresh', expect.any(AbortSignal));
    expect(window.location.hash).toBe('');
  });

  it('starts a new provider login after credentials are rejected', async () => {
    window.history.replaceState(null, '', '/oauth/meta#access_token=rejected&refresh_token=rejected');
    mocks.verify.mockRejectedValue(new ApiError(401, 'Unauthorized'));
    render(<OAuthCallback provider="meta" />);
    expect(await screen.findByRole('link', { name: 'Try Facebook again' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Retry verification' })).not.toBeInTheDocument();
  });

  it('shows a recoverable timeout instead of an endless spinner', async () => {
    window.history.replaceState(null, '', '/oauth/meta#access_token=test-access&refresh_token=test-refresh');
    mocks.verify.mockRejectedValue(new DOMException('Timed out', 'TimeoutError'));
    render(<OAuthCallback provider="meta" />);
    expect(await screen.findByText(/took too long to verify/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Retry verification' })).toBeVisible();
  });
});
