import { afterEach, expect, it, vi } from 'vitest';
import { connectLiveVideo, validateVideoEndpoint } from './live-video';

afterEach(() => vi.unstubAllGlobals());

class Peer extends EventTarget {
  iceGatheringState = 'complete';
  connectionState = 'new';
  localDescription = { sdp: 'offer' };
  onconnectionstatechange?: () => void;
  ontrack?: () => void;
  addTransceiver = vi.fn();
  createOffer = vi.fn(async () => ({ sdp: 'offer' }));
  setLocalDescription = vi.fn(async () => {});
  setRemoteDescription = vi.fn(async () => { this.connectionState = 'connected'; this.dispatchEvent(new Event('connectionstatechange')); });
  close = vi.fn(() => { this.connectionState = 'closed'; this.dispatchEvent(new Event('connectionstatechange')); });
}

it('accepts only the expected Cloudflare video protocol and direction', () => {
  const url = 'https://customer-example.cloudflarestream.com/' + 'a'.repeat(32) + '/webRTC/publish';
  expect(validateVideoEndpoint(url, 'publish').protocol).toBe('https:');
  expect(() => validateVideoEndpoint(url, 'play')).toThrow();
  for (const bad of [url.replace('https:', 'http:'), url.replace('.com/', '.com.evil.test/'), url + '?token=secret', url.replace('customer-example', 'user:password@customer-example'), 'https://127.0.0.1/webRTC/publish']) expect(() => validateVideoEndpoint(bad, 'publish')).toThrow();
});

it('negotiates a real protocol session and deletes its resource when stopped', async () => {
  const peer = new Peer();
  vi.stubGlobal('RTCPeerConnection', vi.fn(function () { return peer; }));
  const fetcher = vi.fn().mockResolvedValue(new Response('answer', { status: 201, headers: { Location: '/session/test' } }));
  vi.stubGlobal('fetch', fetcher);
  const controller = new AbortController();
  await connectLiveVideo({ url: 'https://customer-example.cloudflarestream.com/' + 'a'.repeat(32) + '/webRTC/play', signal: controller.signal });
  expect(peer.addTransceiver).toHaveBeenCalledWith('video', { direction: 'recvonly' });
  expect(peer.setRemoteDescription).toHaveBeenCalledWith({ type: 'answer', sdp: 'answer' });
  controller.abort();
  expect(peer.close).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[1][0].href).toBe('https://customer-example.cloudflarestream.com/session/test');
  expect(fetcher.mock.calls[1][1]).toMatchObject({ method: 'DELETE', credentials: 'omit' });
});

it('cleans up a session response that arrives after cancellation', async () => {
  const peer = new Peer();
  vi.stubGlobal('RTCPeerConnection', vi.fn(function () { return peer; }));
  let respond!: (response: Response) => void;
  const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { respond = resolve; })).mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetcher);
  const controller = new AbortController();
  const promise = connectLiveVideo({ url: 'https://customer-example.cloudflarestream.com/' + 'a'.repeat(32) + '/webRTC/play', signal: controller.signal });
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  controller.abort();
  respond(new Response('answer', { status: 201, headers: { Location: '/session/late' } }));
  await expect(promise).rejects.toThrow('Stopped');
  expect(fetcher.mock.calls[1][1]).toMatchObject({ method: 'DELETE' });
  expect(peer.setRemoteDescription).not.toHaveBeenCalled();
});
