/** Browser-to-Stream WHIP/WHEP. Publish URLs are capabilities: never log or persist them here. */
export function validateVideoEndpoint(raw: string, direction: 'publish' | 'play') {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || !/^customer-[a-z0-9]+\.cloudflarestream\.com$/.test(url.hostname)
    || url.username || url.password || url.port || url.search || url.hash
    || !new RegExp(`^/[A-Za-z0-9_-]{16,256}/webRTC/${direction}$`).test(url.pathname)) throw new Error('The store video connection is invalid.');
  return url;
}

export async function connectLiveVideo({ url, stream, signal, onTrack, onDisconnected }: {
  url: string; stream?: MediaStream; signal: AbortSignal;
  onTrack?: (event: RTCTrackEvent) => void; onDisconnected?: () => void;
}) {
  const endpoint = validateVideoEndpoint(url, stream ? 'publish' : 'play');
  const peer = new RTCPeerConnection({ bundlePolicy: 'max-bundle' });
  let resource: URL | null = null;
  let closed = false;
  const close = () => {
    if (!closed) { closed = true; peer.close(); signal.removeEventListener('abort', close); }
    const active = resource; resource = null;
    if (active) void fetch(active, { method: 'DELETE', credentials: 'omit', keepalive: true }).catch(() => {});
  };
  signal.addEventListener('abort', close, { once: true });
  if (signal.aborted) { close(); throw new DOMException('Stopped', 'AbortError'); }
  peer.ontrack = event => onTrack?.(event);
  peer.onconnectionstatechange = () => {
    if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected') { onDisconnected?.(); close(); }
  };
  try {
    if (stream) stream.getTracks().forEach(track => peer.addTransceiver(track, { direction: 'sendonly', streams: [stream] }));
    else { peer.addTransceiver('audio', { direction: 'recvonly' }); peer.addTransceiver('video', { direction: 'recvonly' }); }
    await peer.setLocalDescription(await peer.createOffer());
    await new Promise<void>((resolve, reject) => {
      if (peer.iceGatheringState === 'complete') { resolve(); return; }
      const finish = (error?: Error) => { clearTimeout(timer); peer.removeEventListener('icegatheringstatechange', gathered); signal.removeEventListener('abort', aborted); if (error) reject(error); else resolve(); };
      const gathered = () => { if (peer.iceGatheringState === 'complete') finish(); };
      const aborted = () => finish(new DOMException('Stopped', 'AbortError'));
      const timer = setTimeout(() => finish(new Error('Video connection timed out. Try again.')), 15000);
      peer.addEventListener('icegatheringstatechange', gathered); signal.addEventListener('abort', aborted, { once: true });
      if (signal.aborted) aborted();
    });
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/sdp' }, body: peer.localDescription?.sdp, signal, credentials: 'omit' });
    const location = response.headers.get('Location');
    if (location) {
      const candidate = new URL(location, endpoint);
      if (candidate.origin === endpoint.origin) resource = candidate;
    }
    if (!response.ok) throw new Error(stream ? 'The video service could not start this broadcast.' : 'The broadcast is not available yet. Try again shortly.');
    if (closed || signal.aborted) throw new DOMException('Stopped', 'AbortError');
    await peer.setRemoteDescription({ type: 'answer', sdp: await response.text() });
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => { clearTimeout(timer); peer.removeEventListener('connectionstatechange', changed); signal.removeEventListener('abort', aborted); if (error) reject(error); else resolve(); };
      const changed = () => { if (peer.connectionState === 'connected') finish(); else if (['failed', 'closed'].includes(peer.connectionState)) finish(new Error('Video could not connect.')); };
      const aborted = () => finish(new DOMException('Stopped', 'AbortError'));
      const timer = setTimeout(() => finish(new Error('Video connection timed out. Check your network and try again.')), 20000);
      peer.addEventListener('connectionstatechange', changed); signal.addEventListener('abort', aborted, { once: true }); changed();
      if (signal.aborted) aborted();
    });
    return { close };
  } catch (error) { close(); throw error; }
}
