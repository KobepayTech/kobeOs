import { useEffect, useRef, useState } from 'react';
import { connectLiveVideo } from '@/lib/live-video';

export function StoreLiveVideo({ playbackUrl }: { playbackUrl: string }) {
  return <LiveVideoPlayer key={playbackUrl} playbackUrl={playbackUrl} />;
}

function LiveVideoPlayer({ playbackUrl }: { playbackUrl: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const abort = useRef<AbortController | null>(null);
  const [state, setState] = useState<'idle' | 'connecting' | 'playing'>('idle');
  const [error, setError] = useState('');
  useEffect(() => { const element = video.current; return () => { abort.current?.abort(); if (element) element.srcObject = null; }; }, []);
  const watch = async () => {
    abort.current?.abort(); const controller = new AbortController(); abort.current = controller;
    setState('connecting'); setError('');
    try {
      const remote = new MediaStream();
      await connectLiveVideo({ url: playbackUrl, signal: controller.signal, onTrack: event => { remote.addTrack(event.track); if (video.current) video.current.srcObject = remote; }, onDisconnected: () => { if (!controller.signal.aborted) { setState('idle'); setError('The video stopped. Try watching again shortly.'); } } });
      if (!controller.signal.aborted) { setState('playing'); void video.current?.play().catch(() => {}); }
    } catch (cause) { if (!controller.signal.aborted) { setState('idle'); setError(cause instanceof Error ? cause.message : 'Video is temporarily unavailable.'); } }
  };
  return <section className="mx-auto max-w-4xl py-4" aria-label="Store live video"><video ref={video} controls playsInline className="aspect-video w-full rounded-xl bg-black" /><div className="mt-2 flex items-center gap-3"><button disabled={state === 'connecting'} onClick={() => { if (state === 'playing') { abort.current?.abort(); setState('idle'); if (video.current) video.current.srcObject = null; } else void watch(); }} className="rounded bg-white px-4 py-2 font-semibold text-rose-800 disabled:opacity-50">{state === 'playing' ? 'Stop watching' : state === 'connecting' ? 'Connecting video…' : 'Watch live video'}</button><span className="text-sm">{error || (state === 'playing' ? 'Live from the store' : 'Watch and shop the live collection.')}</span></div></section>;
}
