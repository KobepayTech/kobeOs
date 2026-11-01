import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { SocialConnectDialog } from './SocialConnectDialog';

vi.mock('@/lib/api', () => ({ api: vi.fn(), apiBase: () => '/api', accountApiBase: () => '/api', hasCloudSession: () => false, cloudApi: vi.fn() }));
const close = vi.fn();
const popup = { close, opener: window, location: { href: 'about:blank' } };
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
  vi.mocked(api).mockImplementation(async path => path === '/live-sales/connections' ? [] : { url: 'https://www.instagram.com/oauth/authorize?state=test' });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('keeps setup in place and confirms only a server-verified account', async () => {
  const connected = vi.fn();
  render(<SocialConnectDialog platform="instagram" onClose={vi.fn()} onConnected={connected} />);
  fireEvent.click(screen.getByRole('button', { name: 'Continue with Instagram' }));
  await waitFor(() => expect(popup.location.href).toContain('https://www.instagram.com/oauth/authorize'));
  expect(popup.opener).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'I approved — check connection' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith('/live-sales/connections', expect.anything()));
  expect(connected).not.toHaveBeenCalled();
  vi.mocked(api).mockResolvedValue([{ platform: 'instagram', connected: true, accountHandle: 'kobe.pay', webhookSubscribed: false }]);
  await waitFor(() => expect(screen.getByRole('button', { name: 'I approved — check connection' })).not.toBeDisabled());
  fireEvent.click(screen.getByRole('button', { name: 'I approved — check connection' }));
  await screen.findByText('Connected to kobe.pay');
  expect(screen.getByText(/Live comments are still awaiting Instagram approval/)).toBeDefined();
  expect(connected).toHaveBeenCalledTimes(1);
  expect(close).toHaveBeenCalled();
});

it('explains blocked popups without navigating away or claiming success', async () => {
  vi.mocked(window.open).mockReturnValue(null);
  render(<SocialConnectDialog platform="tiktok" onClose={vi.fn()} onConnected={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Continue with TikTok' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Allow the connection window');
  expect(api).not.toHaveBeenCalled();
});

it('rejects unexpected authorization hosts', async () => {
  vi.mocked(api).mockResolvedValue({ url: 'https://untrusted.example/authorize' });
  render(<SocialConnectDialog platform="instagram" onClose={vi.fn()} onConnected={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Continue with Instagram' }));
  expect((await screen.findByRole('alert')).textContent).toContain('temporarily unavailable');
  expect(close).toHaveBeenCalled();
});

it('does not mistake an existing connection for completed reauthorization', async () => {
  const connected = vi.fn();
  vi.mocked(api).mockImplementation(async path => path === '/live-sales/connections'
    ? [{ platform: 'instagram', connected: true, accountHandle: 'existing', connectedAt: 'old' }]
    : { url: 'https://www.instagram.com/oauth/authorize' });
  render(<SocialConnectDialog platform="instagram" onClose={vi.fn()} onConnected={connected} />);
  fireEvent.click(screen.getByRole('button', { name: 'Continue with Instagram' }));
  fireEvent.click(await screen.findByRole('button', { name: 'I approved — check connection' }));
  await waitFor(() => expect((screen.getByRole('button', { name: 'I approved — check connection' }) as HTMLButtonElement).disabled).toBe(false));
  expect(connected).not.toHaveBeenCalled();
  vi.mocked(api).mockResolvedValue([{ platform: 'instagram', connected: true, accountHandle: 'existing', connectedAt: 'new' }]);
  fireEvent.click(screen.getByRole('button', { name: 'I approved — check connection' }));
  await screen.findByText('Connected to existing');
  expect(connected).toHaveBeenCalledTimes(1);
});
