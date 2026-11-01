import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StoreBroadcastStudio } from './StoreBroadcastStudio';
import { api } from '@/lib/api';
import { connectLiveVideo } from '@/lib/live-video';

vi.mock('@/lib/api', () => ({ api: vi.fn() }));
vi.mock('@/lib/live-video', () => ({ connectLiveVideo: vi.fn() }));
const stopTrack = vi.fn();
const camera = { getTracks: () => [{ stop: stopTrack }], getVideoTracks: () => [] } as unknown as MediaStream;
const getUserMedia = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  getUserMedia.mockResolvedValue(camera);
  vi.mocked(api).mockImplementation(async (path) => path === '/pos/products' ? [{ id: 'product', name: 'Test cap', stock: 4, price: 1000 }] : path === '/live-sales/broadcast/settings' ? { configured: true } : path === '/live-sales' ? { id: 'session' } : { publishUrl: 'private-test-publish-url' });
  vi.mocked(connectLiveVideo).mockResolvedValue({ close: vi.fn() });
});
afterEach(cleanup);

it('requires private preview and a separate Go live action before broadcasting', async () => {
  render(<StoreBroadcastStudio onClose={vi.fn()} />);
  expect(getUserMedia).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Preview camera & microphone' }));
  await screen.findByText('Private preview · Only you can see this');
  expect(connectLiveVideo).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Test cap' }));
  fireEvent.click(screen.getByRole('button', { name: 'Go live to shoppers' }));
  await screen.findByText('LIVE · Your store');
  expect(connectLiveVideo).toHaveBeenCalledWith(expect.objectContaining({ stream: camera, url: 'private-test-publish-url' }));
  expect(api).toHaveBeenCalledWith('/live-sales/session/pins', expect.objectContaining({ body: JSON.stringify({ productId: 'product', code: 'A1', livePrice: 1000 }) }));
  fireEvent.click(screen.getByRole('button', { name: 'End broadcast' }));
  expect(stopTrack).toHaveBeenCalled();
  await waitFor(() => expect(api).toHaveBeenCalledWith('/live-sales/session/end', expect.objectContaining({ method: 'POST' })));
  expect(screen.getByText('Camera off')).toBeDefined();
});

it('does not claim LIVE when the video service rejects the connection', async () => {
  vi.mocked(connectLiveVideo).mockRejectedValue(new Error('Video service unavailable'));
  render(<StoreBroadcastStudio onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Preview camera & microphone' }));
  await screen.findByText('Private preview · Only you can see this');
  fireEvent.click(screen.getByRole('button', { name: 'Go live to shoppers' }));
  await screen.findByText('Video service unavailable');
  expect(screen.queryByText('LIVE · Your store')).toBeNull();
  expect(stopTrack).toHaveBeenCalled();
  expect(api).toHaveBeenCalledWith('/live-sales/session/end', expect.anything());
});

it('releases camera permission results that arrive after closing the studio', async () => {
  let release!: (stream: MediaStream) => void;
  getUserMedia.mockReturnValue(new Promise<MediaStream>(resolve => { release = resolve; }));
  const view = render(<StoreBroadcastStudio onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Preview camera & microphone' }));
  view.unmount(); release(camera);
  await waitFor(() => expect(stopTrack).toHaveBeenCalled());
  expect(connectLiveVideo).not.toHaveBeenCalled();
});

it('handles denied camera access without opening a selling session', async () => {
  getUserMedia.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
  render(<StoreBroadcastStudio onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Preview camera & microphone' }));
  await screen.findByRole('alert');
  expect(api).not.toHaveBeenCalledWith('/live-sales', expect.anything());
  expect(screen.getByText('Camera off')).toBeDefined();
});
