import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoginScreen from './LoginScreen';
import { pendingOAuth, rememberOAuth } from '@/lib/oauth-flow';

describe('returning to sign-in', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState(null, '', '/');
    // A fresh Response per call, routed by URL. A single shared Response is
    // consumed by the first reader, so the second caller sees an unusable
    // body — which looked like the health check failing.
    const json = (body: unknown) => new Response(JSON.stringify(body), {
      headers: { 'content-type': 'application/json' },
    });
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(typeof input === 'string' ? input : (input as Request).url ?? input);
      if (url.includes('/auth/sign-in-methods')) {
        return json({
          password: true,
          google: { enabled: false, clientId: null },
          tiktok: { enabled: true },
          meta: { enabled: true },
        });
      }
      return json({ status: 'ok' });
    }));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); sessionStorage.clear(); });

  it('returns to sign-in with recovery choices after an interrupted Facebook login', async () => {
    rememberOAuth('meta');
    render(<LoginScreen onLogin={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    expect(screen.getByText('Facebook sign-in has not finished')).toBeVisible();
    expect(screen.queryByLabelText('Confirm password')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Use email or phone instead' }));
    expect(pendingOAuth()).toBeNull();
    expect(screen.queryByText('Facebook sign-in has not finished')).not.toBeInTheDocument();
    expect(await screen.findByText('Kobe Cloud is ready to sign you in.')).toBeVisible();
  });

  it('handles the browser Back button restoring the cached page', async () => {
    render(<LoginScreen onLogin={vi.fn()} />);
    rememberOAuth('meta');
    fireEvent(window, new Event('pageshow'));
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    expect(screen.getByText('Facebook sign-in has not finished')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sign in with Facebook' })).toBeVisible();
    expect(await screen.findByText('Kobe Cloud is ready to sign you in.')).toBeVisible();
  });

  it('opens sign-in rather than signup when returning from callback recovery', async () => {
    window.history.replaceState(null, '', '/?signin=1');
    render(<LoginScreen onLogin={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    expect(await screen.findByText('Kobe Cloud is ready to sign you in.')).toBeVisible();
  });
});
