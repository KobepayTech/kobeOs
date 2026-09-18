import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

export default function CameraBroadcast({ sessionId, platform }: { sessionId: string; platform: string }) {
  const [serverUrl, setServerUrl] = useState('');
  const [streamKey, setStreamKey] = useState('');
  const [available, setAvailable] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('Checking camera broadcaster…');
  const preview = useRef<HTMLVideoElement>(null);
  const media = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const generation = useRef(0);
  const base = `/live-sales/${sessionId}/broadcast`;
  const request = <T,>(path: string, body?: unknown) => api<T>(base + path, { offlineFallback: false,
    signal: AbortSignal.timeout(15_000), ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}) });
  const releaseCamera = () => {
    generation.current++;
    const current = recorder.current;
    recorder.current = null;
    if (current && current.state !== 'inactive') current.stop();
    media.current?.getTracks().forEach(track => track.stop());
    media.current = null;
    if (preview.current) preview.current.srcObject = null;
  };
  useEffect(() => {
    let active = true;
    api<{ available: boolean }>(base, { offlineFallback: false, signal: AbortSignal.timeout(10_000) }).then(result => {
      if (active) { setAvailable(result.available); setMessage(result.available ? 'Ready for a platform-issued stream URL and key.' : 'The server needs its camera encoder installed. Phone live selling is available.'); }
    }).catch(() => { if (active) setMessage('Camera broadcaster could not be reached.'); });
    return () => {
      active = false;
      const wasActive = !!media.current || !!recorder.current;
      releaseCamera();
      if (wasActive) void api(base + '/stop', { method: 'POST', body: '{}', offlineFallback: false }).catch(() => undefined);
    };
  }, [base]);
  const stop = async () => {
    releaseCamera(); setRunning(false);
    try { await request('/stop', {}); setMessage('Camera stopped. End the broadcast in the platform’s live producer too.'); }
    catch { setMessage('Camera stopped. The server will close the connection after 30 seconds without video.'); }
  };
  const start = async () => {
    const mine = ++generation.current;
    setRunning(true);
    try {
      const mimeType = ['video/webm;codecs=vp8,opus', 'video/webm'].find(type => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type));
      if (!mimeType || !navigator.mediaDevices?.getUserMedia) throw new Error('Use Chrome or Edge on HTTPS for camera broadcasting.');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 720 }, height: { ideal: 1280 }, frameRate: { ideal: 30, max: 30 } }, audio: true });
      if (mine !== generation.current) { stream.getTracks().forEach(track => track.stop()); return; }
      media.current = stream;
      if (preview.current) preview.current.srcObject = stream;
      await request('/start', { serverUrl, streamKey });
      setStreamKey('');
      if (mine !== generation.current) { await request('/stop', {}); return; }
      const capture = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_000_000, audioBitsPerSecond: 128_000 });
      recorder.current = capture;
      let sequence = 0;
      let queued = 0;
      let queue = Promise.resolve();
      const fail = (error: unknown) => {
        if (mine !== generation.current) return;
        releaseCamera(); setRunning(false);
        setMessage(error instanceof Error ? error.message : 'The broadcast disconnected. Start again.');
        void request('/stop', {}).catch(() => undefined);
      };
      capture.onerror = () => fail(new Error('Camera recording failed. Check the camera and microphone.'));
      capture.ondataavailable = event => {
        if (!event.data.size || mine !== generation.current) return;
        if (++queued > 3 || event.data.size > 1_000_000) { fail(new Error('Upload connection is too slow for live video. Try phone streaming.')); return; }
        queue = queue.then(async () => {
          if (mine !== generation.current) return;
          const data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader(); reader.onerror = reject;
            reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.readAsDataURL(event.data);
          });
          if (mine !== generation.current) return;
          await request('/chunk', { sequence, data }); sequence++;
          if (mine === generation.current) setMessage('Video is being sent. Check the platform preview, then press Go Live there.');
        }).catch(fail).finally(() => { queued--; });
      };
      capture.start(1000);
    } catch (error) {
      if (mine !== generation.current) return;
      releaseCamera(); setRunning(false);
      setMessage(error instanceof Error ? error.message : 'Could not start camera broadcasting.');
      void request('/stop', {}).catch(() => undefined);
    }
  };
  const provider = platform === 'instagram' ? 'Instagram Live Producer' : 'TikTok LIVE';
  return <details className="mx-3 mt-3 rounded-lg border border-slate-700 bg-slate-900 p-3 text-xs shrink-0">
    <summary className="cursor-pointer font-bold">Broadcast from KobeOS · camera and microphone</summary>
    <div className="mt-3 grid gap-3 md:grid-cols-[160px_1fr]">
      <video ref={preview} autoPlay playsInline muted className="h-40 w-full rounded bg-black object-contain" aria-label="Camera preview" />
      <div className="space-y-2">
        <p>Open {provider}, select streaming software, and paste the stream URL and key it gives you. Your account must have access. KobeOS cannot issue platform keys.</p>
        <a className="text-fuchsia-300 underline" href={platform === 'instagram' ? 'https://www.instagram.com/' : 'https://www.tiktok.com/studio/live'} target="_blank" rel="noreferrer">Open {provider}</a>
        <label className="block">Stream URL<input value={serverUrl} onChange={e => setServerUrl(e.target.value)} disabled={running} placeholder="rtmps://…" className="block w-full rounded bg-slate-800 p-2" /></label>
        <label className="block">Stream key<input type="password" autoComplete="off" value={streamKey} onChange={e => setStreamKey(e.target.value)} disabled={running} className="block w-full rounded bg-slate-800 p-2" /></label>
        <p role="status">{message}</p>
        {running ? <button onClick={() => void stop()} className="rounded bg-red-700 px-3 py-2">Stop camera broadcast</button>
          : <button disabled={!available || !serverUrl || !streamKey} onClick={() => void start()} className="rounded bg-fuchsia-700 px-3 py-2 disabled:opacity-40">Start camera broadcast</button>}
        <p className="text-slate-400">Keep this window open. Product pins, comments and checkout continue alongside the video. End the live video in {provider} before stopping the camera here.</p>
      </div>
    </div>
  </details>;
}
