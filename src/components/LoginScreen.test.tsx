import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoginScreen from './LoginScreen';
import { pendingOAuth, rememberOAuth } from '@/lib/oauth-flow';

const authMocks = vi.hoisted(() => ({ login: vi.fn(), register: vi.fn() }));
vi.mock('@/lib/auth', async (original) => ({ ...await original<typeof import('@/lib/auth')>(), ...authMocks }));

describe('returning to sign-in', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState(null, '', '/');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ok' }), { headers: { 'content-type': 'application/json' } })));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); sessionStorage.clear(); });

  it('keeps every social method usable after a failed health check', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Gateway unavailable')));
    render(<LoginScreen onLogin={vi.fn()} />);
    await screen.findByText('Kobe Cloud unavailable');
    for (const provider of ['Google', 'Facebook', 'TikTok']) {
      expect(screen.getByRole('button', { name: `Create with ${provider}` })).toBeEnabled();
    }
  });

  it('creates a phone account and opens the authenticated shell after success', async () => {
    const onLogin = vi.fn();
    const user = { id: 'phone-user', email: 'phone@phone.kobeos.local', phone: '+255712345678' };
    authMocks.register.mockResolvedValue(user);
    render(<LoginScreen onLogin={onLogin} />);
    fireEvent.click(screen.getByRole('button', { name: 'Phone number' }));
    fireEvent.change(screen.getByLabelText('Your name or business'), { target: { value: 'Amina' } });
    fireEvent.change(screen.getByLabelText('Phone number', { exact: true }), { target: { value: '+255712345678' } });
    fireEvent.change(screen.getByLabelText('Password', { exact: true }), { target: { value: 'long-password' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'long-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account and choose apps' }));
    await waitFor(() => expect(onLogin).toHaveBeenCalledWith(user, true));
    expect(authMocks.register).toHaveBeenCalledWith('+255712345678', 'long-password', 'Amina');
  });

  it('signs in with email despite an unavailable health endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Health endpoint unavailable')));
    const user = { id: 'email-user', email: 'amina@example.com' };
    authMocks.login.mockResolvedValue(user);
    const onLogin = vi.fn();
    window.history.replaceState(null, '', '/?signin=1');
    render(<LoginScreen onLogin={onLogin} />);
    fireEvent.change(screen.getByLabelText('Email address', { exact: true }), { target: { value: 'amina@example.com' } });
    fireEvent.change(screen.getByLabelText('Password', { exact: true }), { target: { value: 'long-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in and open App Store' }));
    await waitFor(() => expect(onLogin).toHaveBeenCalledWith(user, false));
  });

  it('offers recovery after an interrupted Google redirect', async () => {
    rememberOAuth('google');
    render(<LoginScreen onLogin={vi.fn()} />);
    expect(screen.getByText('Google sign-in has not finished')).toBeVisible();
    expect(await screen.findByText('Kobe Cloud is ready to sign you in.')).toBeVisible();
  });

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
