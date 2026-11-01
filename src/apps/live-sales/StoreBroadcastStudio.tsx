import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { connectLiveVideo } from '@/lib/live-video';

const call = <T,>(path: string, body?: unknown) => api<T>(path, { method: body === undefined ? 'GET' : 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }), offlineFallback: false });

export function StoreBroadcastStudio({ onClose }: { onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const media = useRef<MediaStream | null>(null);
  const abort = useRef<AbortController | null>(null);
  const session = useRef<string | null>(null);
  const mounted = useRef(true);
  const generation = useRef(0);
  const [state, setState] = useState<'idle' | 'preview' | 'connecting' | 'live'>('idle');
  const [configured, setConfigured] = useState(false);
  const [setup, setSetup] = useState(false);
  const [publishUrl, setPublishUrl] = useState('');
  const [playbackUrl, setPlaybackUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('Live from our store');
  const [products, setProducts] = useState<Array<{ id: string; name: string; stock: number; price: number | string }>>([]);
  const [selected, setSelected] = useState<string[]>([]);

  const stop = () => {
    generation.current += 1;
    abort.current?.abort(); abort.current = null;
    media.current?.getTracks().forEach(track => track.stop()); media.current = null;
    if (video.current) video.current.srcObject = null;
    const id = session.current; session.current = null;
    if (id) void call(`/live-sales/${id}/end`, {}).catch(() => { if (mounted.current) setError('Camera stopped. The sales session could not be closed; end it in Live Sales.'); });
    if (mounted.current) { setState('idle'); setBusy(false); }
  };
  useEffect(() => {
    mounted.current = true;
    void call<{ configured: boolean }>('/live-sales/broadcast/settings').then(result => { if (mounted.current) setConfigured(result.configured); }).catch(() => { if (mounted.current) setError('Could not check the video connection.'); });
    void call<typeof products>('/pos/products').then(result => { if (mounted.current && Array.isArray(result)) setProducts(result); }).catch(() => { if (mounted.current) setError('Products could not load. Reopen the studio to retry.'); });
    return () => { mounted.current = false; stop(); };
  }, []);

  const preview = async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setError('Open the store over HTTPS in a browser that supports camera access.'); return; }
    const current = ++generation.current; setBusy(true); setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: true });
      if (!mounted.current || current !== generation.current) { stream.getTracks().forEach(track => track.stop()); return; }
      media.current = stream;
      stream.getVideoTracks().forEach(track => track.addEventListener('ended', stop, { once: true }));
      if (video.current) video.current.srcObject = stream;
      setState('preview');
    } catch { if (mounted.current && current === generation.current) setError('Camera or microphone access was unavailable. Check browser permissions and try again.'); }
    finally { if (mounted.current && current === generation.current) setBusy(false); }
  };
  const goLive = async () => {
    if (!media.current || !configured) return;
    const current = ++generation.current; setBusy(true); setState('connecting'); setError('');
    const controller = new AbortController(); abort.current = controller;
    try {
      const started = await call<{ id: string }>('/live-sales', { title, platform: 'other', kind: 'live', sourceHandle: `store-camera-${crypto.randomUUID()}` });
      if (!mounted.current || current !== generation.current) { void call(`/live-sales/${started.id}/end`, {}).catch(() => {}); return; }
      session.current = started.id;
      const pins = products.filter(product => selected.includes(product.id));
      for (const [index, product] of pins.entries()) {
        if (controller.signal.aborted) return;
        await call(`/live-sales/${started.id}/pins`, { productId: product.id, code: `A${index + 1}`, livePrice: Number(product.price) });
      }
      const connection = await call<{ publishUrl: string }>(`/live-sales/${started.id}/broadcast`, {});
      if (controller.signal.aborted) return;
      await connectLiveVideo({ url: connection.publishUrl, stream: media.current!, signal: controller.signal, onDisconnected: () => { stop(); if (mounted.current) setError('Video connection lost. The camera has stopped. Preview and reconnect to go live again.'); } });
      if (mounted.current && current === generation.current) setState('live');
    } catch (cause) { if (mounted.current && current === generation.current) { stop(); setError(cause instanceof Error ? cause.message : 'Could not start video.'); } }
    finally { if (mounted.current && current === generation.current) setBusy(false); }
  };
  const saveSetup = async () => {
    setBusy(true); setError('');
    try { await call('/live-sales/broadcast/settings', { publishUrl, playbackUrl }); setConfigured(true); setSetup(false); setPublishUrl(''); setPlaybackUrl(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Video setup failed.'); }
    finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-[100] overflow-auto bg-slate-950 p-5 text-white"><div className="mx-auto max-w-4xl space-y-5">
    <header className="flex items-start justify-between gap-4"><div className="min-w-0"><h1 className="text-2xl font-bold">Go live from your store</h1><p className="text-sm text-slate-400">Preview your camera, then broadcast to shoppers on your storefront.</p></div><button onClick={() => { stop(); onClose(); }} className="shrink-0 whitespace-nowrap rounded border border-slate-600 px-3 py-2">Close studio</button></header>
    <div className="relative aspect-video overflow-hidden rounded-2xl bg-black"><video ref={video} autoPlay muted playsInline className="h-full w-full object-contain" /><span role="status" className="absolute left-4 top-4 rounded bg-black/70 px-3 py-1 text-sm">{state === 'live' ? 'LIVE · Your store' : state === 'preview' ? 'Private preview · Only you can see this' : state === 'connecting' ? 'Connecting broadcast…' : 'Camera off'}</span></div>
    <label className="block text-sm">Broadcast title<input value={title} maxLength={120} disabled={state === 'live' || busy} onChange={event => setTitle(event.target.value)} className="mt-2 block w-full rounded border border-slate-700 bg-slate-900 p-3" /></label>
    <section className="rounded-xl border border-slate-700 p-4"><h2 className="font-semibold">Products in this live</h2><p className="mb-3 text-sm text-slate-400">Choose products to show beside your video at their current catalogue prices.</p><div className="flex flex-wrap gap-3">{products.filter(product => product.stock > 0).map(product => <label key={product.id} className="flex items-center gap-2 rounded bg-slate-900 px-3 py-2 text-sm"><input type="checkbox" checked={selected.includes(product.id)} disabled={state === 'live' || busy} onChange={event => setSelected(old => event.target.checked ? [...old, product.id] : old.filter(id => id !== product.id))} />{product.name}</label>)}{!products.length && <span className="text-sm text-slate-400">Add products to your store to feature them here.</span>}</div></section>
    {error && <p role="alert" className="rounded bg-amber-950 p-3 text-amber-200">{error}</p>}
    {!configured && <p className="text-amber-200">Store video needs a one-time connection. You can still check your camera privately.</p>}
    <div className="flex flex-wrap gap-3">{state === 'idle' ? <button disabled={busy} onClick={() => void preview()} className="rounded bg-violet-600 px-5 py-3 disabled:opacity-50">{busy ? 'Opening camera…' : 'Preview camera & microphone'}</button> : <><button disabled={busy || state !== 'preview' || !configured} onClick={() => void goLive()} className="rounded bg-rose-600 px-5 py-3 disabled:opacity-50">{state === 'live' ? 'Broadcasting to your store' : state === 'connecting' ? 'Connecting…' : 'Go live to shoppers'}</button><button onClick={stop} className="rounded border border-slate-600 px-5 py-3">{state === 'live' ? 'End broadcast' : 'Stop camera'}</button></>}<button disabled={state !== 'idle' || busy} onClick={() => setSetup(!setup)} className="rounded border border-slate-600 px-4 py-3 disabled:opacity-50">Video connection</button></div>
    <p className="text-sm text-slate-400">This broadcasts to your store. TikTok and Instagram broadcasting require their separate LIVE access and supported broadcast tools. Closing this studio stops your camera and store broadcast.</p>
    {setup && <section className="space-y-3 rounded-xl border border-slate-700 p-4"><h2 className="font-bold">Connect store video</h2><p className="text-sm text-slate-400">Use the WebRTC Broadcast and Playback URLs from your Cloudflare Stream live input. Keep the Broadcast URL private. Recording should be off.</p><label className="block text-sm">Private Broadcast URL<input type="password" autoComplete="off" value={publishUrl} onChange={event => setPublishUrl(event.target.value)} className="mt-1 block w-full rounded bg-slate-900 p-3" /></label><label className="block text-sm">Playback URL<input value={playbackUrl} onChange={event => setPlaybackUrl(event.target.value)} className="mt-1 block w-full rounded bg-slate-900 p-3" /></label><button disabled={busy || !publishUrl || !playbackUrl} onClick={() => void saveSetup()} className="rounded bg-violet-600 px-4 py-2 disabled:opacity-50">Save video connection</button></section>}
  </div></div>;
}
