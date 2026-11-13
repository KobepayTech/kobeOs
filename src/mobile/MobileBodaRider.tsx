import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, ApiError } from '@/lib/api';
import { ensureSession } from '@/lib/auth';
import { currentDeliveryPoint } from '@/lib/delivery-location';
import { MobileSignIn } from './MobileShell';

interface RiderProfile {
  name: string;
  availableUntil: string | null;
}

export default function MobileBodaRider() {
  const { slug = '' } = useParams();
  const base = `/erp-delivery/${encodeURIComponent(slug)}/riders/me`;
  const [signedIn, setSignedIn] = useState<boolean>();
  const [profile, setProfile] = useState<RiderProfile>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now);
  const available = !!profile?.availableUntil && Date.parse(profile.availableUntil) > now;

  useEffect(() => {
    void ensureSession().then(() => setSignedIn(true), () => setSignedIn(false));
  }, []);
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    setError('');
    api<RiderProfile>(base, { offlineFallback: false }).then(
      rider => { if (!cancelled) setProfile(rider); },
      err => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) setSignedIn(false);
        else setError(err.message);
      },
    );
    return () => { cancelled = true; };
  }, [base, signedIn]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const update = async (share: boolean) => {
    setBusy(true);
    setError('');
    try {
      const point = share ? await currentDeliveryPoint() : undefined;
      const result = await api<{ availableUntil: string | null }>(`${base}/location`, {
        method: share ? 'PUT' : 'DELETE', body: point && JSON.stringify(point), offlineFallback: false,
      });
      setProfile(current => current && { ...current, ...result });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (signedIn === false) return <MobileSignIn slug={slug} onSignedIn={() => setSignedIn(true)} />;
  return <main className="min-h-dvh bg-slate-50 p-5 text-slate-900" data-surface="light">
    <section className="mx-auto max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
      <h1 className="text-xl font-bold">Boda boda rider</h1>
      {!profile && !error && <p role="status">Checking your registration…</p>}
      {profile && <>
        <p><strong>{profile.name}</strong> · {available ? 'Available' : 'Offline'}</p>
        <p className="text-sm text-slate-600">Share your current location to appear in this shop’s rider search for five minutes. Staff can see your approximate distance and call you.</p>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-lg bg-indigo-700 px-4 py-2 font-bold text-white disabled:opacity-50" disabled={busy} onClick={() => void update(true)}>
            {available ? 'Refresh my location' : 'Go available'}
          </button>
          {available && <button className="rounded-lg border px-4 py-2 font-bold disabled:opacity-50" disabled={busy} onClick={() => void update(false)}>Go offline</button>}
        </div>
      </>}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    </section>
  </main>;
}
