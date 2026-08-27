import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { publicApi } from './api';

/**
 * Kobe Live Ads OBS browser source (kobe.live/overlay/<token>). The creator
 * adds this URL once. It keeps the Kobe session alive (heartbeat), polls the
 * current slot, plays the sponsor creative during the playback window, shows a
 * persistent "scan QR / tap bio" card during the CTA window, and reports
 * proof-of-play. Transparent background for OBS.
 */

interface Slot {
  slotId: string; code: string; sponsor: string; offerText: string;
  couponCode: string | null; creativeVideoUrl: string | null;
  playbackEnd: string; ctaEnd: string;
}
interface OverlayState { handle: string; live: boolean; slot: Slot | null }

// In production the QR points at the kobe.live domain; in dev it uses this app.
const liveBase = typeof window !== 'undefined' && window.location.hostname === 'kobe.live'
  ? 'https://kobe.live'
  : `${window.location.origin}/kobelive`;

export default function LiveOverlay({ token }: { token: string }) {
  const [state, setState] = useState<OverlayState | null>(null);
  const impressed = useRef<Set<string>>(new Set());

  // Keep the session alive.
  useEffect(() => {
    const beat = () => { void publicApi(`/live/overlay/${token}/heartbeat`, { method: 'POST' }).catch(() => undefined); };
    beat();
    const t = setInterval(beat, 30_000);
    return () => clearInterval(t);
  }, [token]);

  // Poll the current slot.
  useEffect(() => {
    let alive = true;
    const pull = async () => {
      try { const s = await publicApi<OverlayState>(`/live/overlay/${token}/state`); if (alive) setState(s); }
      catch { /* keep last */ }
    };
    void pull();
    const t = setInterval(pull, 4000);
    return () => { alive = false; clearInterval(t); };
  }, [token]);

  // Proof-of-play: record one impression per slot while its creative window is open.
  useEffect(() => {
    const slot = state?.slot;
    if (!slot) return;
    const playing = new Date(slot.playbackEnd).getTime() > Date.now();
    if (playing && !impressed.current.has(slot.slotId)) {
      impressed.current.add(slot.slotId);
      void publicApi(`/live/overlay/${token}/impression`, { method: 'POST', body: JSON.stringify({ slotId: slot.slotId }) }).catch(() => undefined);
    }
  }, [state, token]);

  const slot = state?.slot;
  if (!slot) return <div style={{ width: '100vw', height: '100vh', background: 'transparent' }} />;

  const playing = new Date(slot.playbackEnd).getTime() > Date.now();
  const qrValue = `${liveBase}/a/${slot.code}`;

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'transparent', overflow: 'hidden' }} className="relative font-sans">
      {/* Full creative while the playback window is open */}
      {playing && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="rounded-3xl bg-black/80 text-white px-10 py-8 text-center shadow-2xl backdrop-blur">
            <div className="text-[11px] uppercase tracking-[0.3em] text-white/50">Sponsored</div>
            <div className="mt-2 text-5xl font-black">{slot.sponsor}</div>
            {slot.offerText && <div className="mt-2 text-lg text-white/80">{slot.offerText}</div>}
          </div>
        </div>
      )}

      {/* Persistent corner card through the CTA window */}
      <div className="absolute bottom-8 right-8 w-80 rounded-2xl bg-black/85 text-white p-4 shadow-2xl backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-white p-1.5"><QRCodeSVG value={qrValue} size={64} /></div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-white/45">Sponsored by</div>
            <div className="text-lg font-black truncate">{slot.sponsor}</div>
            {slot.couponCode && <div className="mt-0.5 text-xs font-bold text-amber-300">Code {slot.couponCode}</div>}
          </div>
        </div>
        <div className="mt-3 text-center text-xs font-bold text-white/70">
          Scan QR &nbsp;or&nbsp; tap the link in my bio ↑
        </div>
      </div>
    </div>
  );
}
