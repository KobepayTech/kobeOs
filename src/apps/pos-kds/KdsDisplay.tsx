import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { ensureSession } from '@/lib/auth';
import { KdsBoard, type KdsTicket } from './KdsBoard';
import { useOrderQueue } from './useOrderQueue';

export default function KdsDisplay() {
  const [pairing, setPairing] = useState(() => sessionStorage.getItem('kobeos:kds-display'));
  const [signedIn, setSignedIn] = useState(false);
  const [sound, setSound] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    const readPairingLink = () => {
      const token = new URLSearchParams(location.hash.slice(1)).get('pair');
      if (!token) return;
      sessionStorage.setItem('kobeos:kds-display', token);
      history.replaceState(history.state, '', location.pathname + location.search);
      setPairing(token);
    };
    readPairingLink();
    window.addEventListener('hashchange', readPairingLink);
    return () => window.removeEventListener('hashchange', readPairingLink);
  }, []);

  useEffect(() => {
    if (pairing) return;
    let active = true;
    void ensureSession().then(() => { if (active) setSignedIn(true); }).catch(() => {});
    return () => { active = false; };
  }, [pairing]);

  const load = useCallback((signal: AbortSignal) => pairing
    ? api<KdsTicket[]>('/kds-display/orders', {
      signal, auth: false, headers: { Authorization: `Bearer ${pairing}` }, offlineFallback: false, cache: 'no-store',
    })
    : api<KdsTicket[]>('/pos/orders/kds/tickets', { signal, offlineFallback: false, cache: 'no-store' }), [pairing]);
  const queue = useOrderQueue(load, { enabled: !!pairing || signedIn, live: !pairing });

  useEffect(() => {
    if (!queue.rows) return;
    const previous = seen.current;
    seen.current = new Set(queue.rows.map(ticket => ticket.id));
    const context = audio.current;
    if (!sound || !context || !previous || !queue.rows.some(ticket => ticket.fulfillmentStatus === 'NEW' && !previous.has(ticket.id))) return;
    const tone = context.createOscillator();
    const volume = context.createGain();
    tone.frequency.value = 880;
    volume.gain.setValueAtTime(0.15, context.currentTime);
    volume.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.15);
    tone.connect(volume).connect(context.destination);
    tone.start();
    tone.stop(context.currentTime + 0.15);
  }, [queue.rows, sound]);

  useEffect(() => () => {
    const context = audio.current;
    audio.current = null;
    if (context) void context.close().catch(() => {});
  }, []);

  const toggleSound = async () => {
    if (sound) {
      setSound(false);
      return;
    }
    try {
      audio.current ??= new AudioContext();
      await audio.current.resume();
      setSound(true);
    } catch { /* Audio is optional on browsers without Web Audio. */ }
  };

  return <main className="min-h-dvh bg-slate-950 p-4 text-lg text-slate-100 sm:p-6">
    <header className="mb-4 flex items-center justify-between gap-3">
      <h1 className="text-2xl font-extrabold">Order display</h1>
      {(pairing || signedIn) && <button type="button" onClick={() => void toggleSound()} aria-pressed={sound}
        className="rounded-lg border border-slate-500 px-3 py-2 text-sm">{sound ? 'Mute alerts' : 'Enable order alerts'}</button>}
    </header>
    {pairing || signedIn ? <KdsBoard {...queue} /> : <p>Sign in to KobeOS or use a display link from ERP Fulfillment.</p>}
  </main>;
}
