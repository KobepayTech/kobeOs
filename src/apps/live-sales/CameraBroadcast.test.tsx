import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CameraBroadcast from './CameraBroadcast';
const mocks = vi.hoisted(() => ({ api: vi.fn(), getMedia: vi.fn(), stop: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: mocks.api }));
describe('camera broadcaster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.api.mockResolvedValue({ available: true });
    mocks.getMedia.mockResolvedValue({ getTracks: () => [{ stop: mocks.stop }] });
    vi.stubGlobal('MediaRecorder', class {
      static isTypeSupported() { return true; }
      state = 'inactive';
      start() { this.state = 'recording'; }
      stop() { this.state = 'inactive'; }
    });
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: mocks.getMedia } });
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  it('keeps the camera off until explicitly started and releases it on close', async () => {
    const view = render(<CameraBroadcast sessionId="sale" platform="instagram" />);
    fireEvent.click(screen.getByText('Broadcast from KobeOS · camera and microphone'));
    await screen.findByText('Ready for a platform-issued stream URL and key.');
    expect(mocks.getMedia).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Stream URL'), { target: { value: 'rtmps://live-upload.instagram.com/rtmp/' } });
    fireEvent.change(screen.getByLabelText('Stream key'), { target: { value: 'test-key' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start camera broadcast' }));
    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith('/live-sales/sale/broadcast/start', expect.objectContaining({ body: expect.stringContaining('test-key'), offlineFallback: false })));
    expect(screen.getByLabelText('Stream key')).toHaveValue('');
    view.unmount();
    expect(mocks.stop).toHaveBeenCalled();
    expect(mocks.api).toHaveBeenCalledWith('/live-sales/sale/broadcast/stop', expect.objectContaining({ method: 'POST', offlineFallback: false }));
  });
  it('does not promise broadcasting when the runtime is unavailable', async () => {
    mocks.api.mockResolvedValue({ available: false });
    render(<CameraBroadcast sessionId="sale" platform="tiktok" />);
    fireEvent.click(screen.getByText('Broadcast from KobeOS · camera and microphone'));
    await screen.findByText(/server needs its camera encoder/);
    expect(screen.getByRole('button', { name: 'Start camera broadcast' })).toBeDisabled();
    expect(mocks.getMedia).not.toHaveBeenCalled();
  });
});
