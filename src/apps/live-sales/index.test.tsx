import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, cloudApi } from '@/lib/api';
import LiveSales from './index';

vi.mock('@/lib/api', () => ({ api: vi.fn(), cloudApi: vi.fn(), apiBase: () => 'http://local/api', accountApiBase: () => 'https://cloud.example/api', hasCloudSession: () => true }));
const session = { id: 'live', title: 'TikTok phone sale', platform: 'tiktok', kind: 'live', status: 'LIVE', sourceHandle: '@shop', ingestToken: 'secret', currency: 'TZS', createdAt: new Date().toISOString() };
const clipboard = vi.fn().mockResolvedValue(undefined);
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: clipboard } });
  vi.mocked(api).mockImplementation(async path => {
    if (path === '/live-sales') return [session] as never;
    if (path === '/live-sales/operator/context') return { storefrontUrl: 'https://shop.example', catalogUrl: 'https://shop.example/?view=live', storefrontSlug: 'shop' } as never;
    if (path.endsWith('/stats')) return { pins: [] } as never;
    if (path.endsWith('/comments')) return [{ id: 'comment', text: 'A1', buyerHandle: 'buyer', source: 'tiktok', status: 'RESERVED', checkoutToken: 'buyer-token', createdAt: new Date().toISOString() }] as never;
    if (path.endsWith('/connection')) return { connected: false, webhookSubscribed: false, bridge: { status: 'connected', detail: 'Receiving TikTok comments.' } } as never;
    return [] as never;
  });
  vi.mocked(cloudApi).mockImplementation(async path => path.endsWith('/connections') ? [{ id: 'cloud-tiktok', platform: 'tiktok', connected: true, accountHandle: '@shop' }] as never : { connected: false } as never);
});
afterEach(cleanup);
describe('live phone console', () => {
  it('checks the local TikTok bridge even when the account is connected in the cloud', async () => {
    render(<LiveSales />);
    fireEvent.click(await screen.findByRole('button', { name: /TikTok phone sale/ }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/live-sales/live/connection', expect.anything()));
    expect(await screen.findByText('Receiving TikTok comments.')).toBeInTheDocument();
    expect(cloudApi).not.toHaveBeenCalledWith('/live-sales/instagram/relay', expect.anything());
  });
  it('copies a checkout URL the storefront can actually read', async () => {
    render(<LiveSales />);
    fireEvent.click(await screen.findByRole('button', { name: /TikTok phone sale/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Copy checkout' }));
    expect(clipboard).toHaveBeenCalledWith('https://shop.example/?live=buyer-token');
  });
});
