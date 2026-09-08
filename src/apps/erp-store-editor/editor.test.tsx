import { afterEach, expect, it, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import StoreEditor from './index';
import { api } from '@/lib/api';
vi.mock('@/lib/api', () => ({
  api: vi.fn(async (path: string) => path === '/pos/products' ? [] : path === '/store-settings/publish-readiness' ? { ready: false, checks: [] } : { id: 'settings-id', ownerId: 'owner', storeName: 'My actual store', isPublished: true, domainSlug: 'my-store', publishedUrl: 'https://my-store.kobeapptz.com' }),
  assetUrl: (v: string) => v || '', apiBase: () => '/api', uploadFile: vi.fn(),
}));
afterEach(cleanup);
it('restores brand and design controls and saves only editable fields', async () => {
  render(<StoreEditor />);
  const name = await screen.findByLabelText('Store Name');
  expect((name as HTMLInputElement).value).toBe('My actual store');
  expect(screen.getByLabelText('Favicon')).toBeDefined();
  fireEvent.change(name, { target: { value: 'Updated store' } });
  const save = screen.getAllByRole('button', { name: /save/i })[0];
  fireEvent.click(save);
  await waitFor(() => expect(vi.mocked(api).mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(true));
  const call = vi.mocked(api).mock.calls.find(([, init]) => init?.method === 'PUT');
  const body = JSON.parse(call?.[1]?.body as string);
  expect(body.storeName).toBe('Updated store');
  expect(body.ownerId).toBeUndefined();
  expect(body.isPublished).toBeUndefined();
  expect(body.primaryColor).toBeDefined();
});
