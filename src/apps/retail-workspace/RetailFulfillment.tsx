import { useCallback, useState } from 'react';
import { ApiError } from '@/lib/api';
import { KdsBoard, type KdsAction, type KdsTicket } from '@/apps/pos-kds/KdsBoard';
import { useOrderQueue } from '@/apps/pos-kds/useOrderQueue';
import { action, field, retailApi, tile } from './ShopPanels';

export default function RetailFulfillment({ slug, canPair }: { slug: string; canPair: boolean }) {
  const load = useCallback((signal: AbortSignal) => retailApi<KdsTicket[]>('/fulfillment', slug, { signal }), [slug]);
  const queue = useOrderQueue(load);
  const [busy, setBusy] = useState('');
  const [pairing, setPairing] = useState(false);
  const [displayUrl, setDisplayUrl] = useState('');
  const [error, setError] = useState('');

  const update = async (ticket: KdsTicket, target: KdsAction) => {
    setBusy(ticket.id);
    setError('');
    try {
      await retailApi(`/fulfillment/${ticket.id}/${target}`, slug, { method: 'POST' });
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Order update could not be confirmed. Check the queue and try again.');
    } finally {
      queue.refresh();
      setBusy('');
    }
  };

  const pair = async () => {
    setPairing(true);
    setError('');
    try {
      const { token } = await retailApi<{ token: string }>('/fulfillment/display', slug, { method: 'POST' });
      const prefix = (import.meta.env.VITE_PUBLIC_PATH_PREFIX as string | undefined)?.replace(/\/$/, '') ?? '';
      const url = new URL(`${prefix}/display/orders`, location.origin);
      url.hash = new URLSearchParams({ pair: token }).toString();
      setDisplayUrl(url.href);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not pair the display. Try again.');
    } finally {
      setPairing(false);
    }
  };

  return <section className={tile}>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-bold">Fulfillment</h2>
      {canPair && <button type="button" className={action} disabled={pairing} onClick={() => void pair()}>
        {pairing ? 'Creating link…' : 'Pair wall display'}
      </button>}
    </div>
    {displayUrl && <div className="mb-4 rounded-lg border p-3">
      <label className="block text-sm font-semibold">Open this link on the display. It expires in 12 hours.
        <input className={`${field} mt-2`} readOnly value={displayUrl} onFocus={event => event.currentTarget.select()} />
      </label>
      <a className="mt-2 inline-block text-sm font-semibold text-indigo-700" href={displayUrl} target="_blank" rel="noreferrer">Open display</a>
    </div>}
    {error && <p className="mb-3 text-sm text-rose-700" role="alert">{error}</p>}
    <KdsBoard {...queue} busy={busy} onAction={(ticket, target) => void update(ticket, target)} />
  </section>;
}
